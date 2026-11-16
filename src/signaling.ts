import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { Config } from './config.js';
import { idPattern, parseMessage, type Outcome, type Role } from './protocol.js';
import { httpError } from './http-errors.js';
import type { makeRateLimiter } from './rate-limit.js';
import { MemoryChannelRepo } from './filepizza/channel.js';
import type { registerFilePizzaPeer } from './filepizza-peer.js';

interface Session {
  id: string;
  hashes: Record<Role, Buffer>;
  peers: Partial<Record<Role, WebSocket>>;
  deadline: number;
  stage: 'waiting' | 'ready' | 'peer_ready';
  channel: { longSlug: string; secret: string; uploaderPeerID: string };
  receiverPeerID: string;
}

const hash = (token: string) => createHash('sha256').update(token).digest();
const random = (bytes: number) => randomBytes(bytes).toString('hex');
const minute = 60_000;
const sessionCap = 500;
const historyCap = 5000;
export const frameLimit = 24 * 1024;

function send(socket: WebSocket | undefined, message: object) {
  if (!socket || socket.readyState !== socket.OPEN) return;
  if (socket.bufferedAmount > 256 * 1024) { socket.terminate(); return; }
  socket.send(JSON.stringify(message));
}

export function registerSignaling(app: FastifyInstance, config: Config, rateLimit: ReturnType<typeof makeRateLimiter>, peer: ReturnType<typeof registerFilePizzaPeer>) {
  const channels = new MemoryChannelRepo();
  const sessions = new Map<string, Session>();
  const closed = new Map<string, { hashes: Session['hashes']; outcome: Outcome; until: number }>();
  const sockets = new Map<WebSocket, boolean>();

  function finish(session: Session, outcome: Outcome, disconnected?: Role) {
    if (!sessions.delete(session.id)) return;
    void channels.destroyChannel(session.channel.longSlug);
    if (closed.size >= historyCap) closed.delete(closed.keys().next().value!);
    closed.set(session.id, { hashes: session.hashes, outcome, until: Date.now() + 10 * minute });
    for (const socket of Object.values(session.peers)) {
      send(socket, { type: 'ended', outcome, ...(disconnected ? { disconnected } : {}) });
      socket.close(1000);
    }
    peer.revoke(session.channel.uploaderPeerID);
    peer.revoke(session.receiverPeerID);
    session.peers = {};
  }

  function iceSettings(session: Session, role: Role) {
    const iceServers: { urls: string[]; username?: string; credential?: string }[] = [];
    if (config.stunUrls.length) iceServers.push({ urls: config.stunUrls });
    if (config.turnUrls.length && config.turnSecret) {
      const expires = Math.ceil(session.deadline / 1000) + 60;
      const username = `${expires}:${random(12)}-${role}`;
      const credential = createHmac('sha1', config.turnSecret).update(username).digest('base64');
      iceServers.push({ urls: config.turnUrls, username, credential });
    }
    return { iceServers, iceTransportPolicy: config.forceRelay ? 'relay' : 'all' };
  }

  async function tryReady(session: Session) {
    if (!session.peers.sender || !session.peers.receiver || session.stage !== 'waiting') return;
    session.stage = 'ready';
    session.deadline = Date.now() + config.activeMs;
    if (!await channels.renewChannel(session.channel.longSlug, session.channel.secret, Math.ceil(config.activeMs / 1000))) {
      finish(session, 'expired');
      return;
    }
    const channel = await channels.fetchChannel(session.channel.longSlug, true);
    if (!sessions.has(session.id)) return;
    if (!channel) { finish(session, 'expired'); return; }
    const transferKey = random(32);
    for (const role of ['sender', 'receiver'] as const) {
      const peerId = role === 'sender' ? channel.uploaderPeerID : session.receiverPeerID;
      const other = role === 'sender' ? session.receiverPeerID : channel.uploaderPeerID;
      send(session.peers[role], {
        type: 'ready', rtc: iceSettings(session, role), peerPath: peer.path, uploaderPeerID: channel.uploaderPeerID,
        peerId, peerToken: peer.allow(peerId, other, role), transferKey,
      });
    }
  }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const session of sessions.values()) if (now >= session.deadline) finish(session, 'expired');
    for (const [id, entry] of closed) if (now >= entry.until) closed.delete(id);
  }, 1000).unref();
  const heartbeat = setInterval(() => {
    for (const [socket, alive] of sockets) {
      if (!alive) { socket.terminate(); continue; }
      sockets.set(socket, false);
      socket.ping();
    }
  }, 15_000).unref();
  app.addHook('onClose', async () => {
    clearInterval(sweep);
    clearInterval(heartbeat);
    channels.close();
  });

  app.get('/api/config', async () => ({ maxFileBytes: config.maxFileBytes }));
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.post('/api/transfers', { onRequest: rateLimit('create') }, async (request, reply) => {
    // The onRequest hook checks the origin before Fastify parses the request.
    const origin = request.headers.origin!;
    if (request.body !== undefined || request.url !== '/api/transfers') return httpError(reply, 400, 'unexpected_input');
    if (sessions.size >= sessionCap) return httpError(reply, 503, 'capacity', 5);
    const id = config.nodeId ? config.nodeId + random(15) : random(16);
    const senderToken = random(32);
    const receiverToken = random(32);
    const deadline = Date.now() + config.inviteMs;
    const channel = await channels.createChannel(random(16), Math.ceil(config.inviteMs / 1000));
    if (sessions.size >= sessionCap) {
      await channels.destroyChannel(channel.longSlug);
      return httpError(reply, 503, 'capacity', 5);
    }
    sessions.set(id, { id, hashes: { sender: hash(senderToken), receiver: hash(receiverToken) }, peers: {}, deadline, stage: 'waiting', channel, receiverPeerID: random(16) });
    return reply.code(201).send({ sessionId: id, senderToken, inviteUrl: `${origin}/receive/${id}#${receiverToken}`, expiresAt: new Date(deadline).toISOString() });
  });

  function handleSocket(socket: WebSocket, request: FastifyRequest<{ Params: { id?: string } }>) {
    if (sockets.size >= 1200) {
      send(socket, { type: 'error', code: 'capacity' });
      socket.close(1013);
      return;
    }
    let session: Session | undefined;
    let role: Role | undefined;
    let allowance = config.signalBurst;
    let lastMessage = Date.now();
    let rejected = false;
    const reject = (code: string) => {
      rejected = true;
      send(socket, { type: 'error', code });
      socket.close(1008);
    };
    const authTimeout = setTimeout(() => reject('auth_timeout'), 5000).unref();

    sockets.set(socket, true);
    socket.on('pong', () => { if (sockets.has(socket)) sockets.set(socket, true); });
    socket.on('error', () => socket.terminate());
    socket.on('close', () => {
      clearTimeout(authTimeout);
      sockets.delete(socket);
      if (session && role && session.peers[role] === socket) finish(session, 'failed', role);
    });

    socket.on('message', (payload, binary) => {
      if (rejected) return;
      const now = Date.now();
      allowance = Math.min(config.signalBurst, allowance + Math.max(0, now - lastMessage) * config.signalRate / 1000);
      lastMessage = now;
      if (allowance < 1) return reject('rate_limit');
      allowance -= 1;
      const message = binary ? null : parseMessage(payload.toString());
      if (!message) return reject('invalid_message');

      if (!session || !role) {
        if (message.type !== 'auth') return reject('auth_required');
        if (request.params?.id && request.params.id !== message.sessionId) return reject('unavailable');
        const found = sessions.get(message.sessionId);
        if (found && now >= found.deadline) finish(found, 'expired');
        const current = sessions.get(message.sessionId);
        const history = closed.get(message.sessionId);
        const hashes = current?.hashes ?? history?.hashes;
        const tokenHash = hash(message.token);
        const matches = hashes && (timingSafeEqual(hashes.sender, tokenHash) ? 'sender' : timingSafeEqual(hashes.receiver, tokenHash) ? 'receiver' : undefined);
        if (!matches) return reject('unavailable');
        if (!current) return reject(history?.outcome === 'expired' ? 'expired' : 'used');
        if (current.peers[matches]) return reject('used');
        session = current;
        role = matches;
        current.peers[role] = socket;
        clearTimeout(authTimeout);
        send(socket, { type: 'joined', role });
        void tryReady(current).catch(() => finish(current, 'failed'));
        return;
      }

      if (!sessions.has(session.id)) return;
      if (now >= session.deadline) { finish(session, 'expired'); return; }
      if (message.type === 'auth') return reject('invalid_message');
      if (message.type === 'end') {
        if ((message.outcome === 'completed' && (role !== 'sender' || session.stage !== 'peer_ready')) ||
            (message.outcome === 'declined' && (role !== 'receiver' || session.stage !== 'peer_ready'))) return reject('forbidden');
        finish(session, message.outcome);
        return;
      }

      if (role !== 'sender' || session.stage !== 'ready' || !peer.isRegistered(session.channel.uploaderPeerID)) return reject('forbidden');
      session.stage = 'peer_ready';
      send(session.peers.receiver, message);
    });
  }

  app.route<{ Params: { id?: string } }>({
    method: 'GET',
    url: '/ws/signaling/:id?',
    exposeHeadRoute: false,
    preValidation: [async (request, reply) => {
      const id = request.params?.id;
      if ((id && !idPattern.test(id)) || request.url !== (id ? `/ws/signaling/${id}` : '/ws/signaling')) return httpError(reply, 400, 'invalid_invite');
      if (config.nodeId && !id?.startsWith(config.nodeId)) return httpError(reply, 404, 'not_found');
      if (!request.ws) return httpError(reply.header('Upgrade', 'websocket'), 426, 'upgrade_required');
      if (!config.origins.includes(request.headers.origin ?? '')) return httpError(reply, 403, 'origin');
    }, rateLimit('join'), async (_request, reply) => {
      if (sockets.size >= 1200) return httpError(reply, 503, 'capacity', 5);
    }],
    handler: (_request, reply) => httpError(reply.header('Upgrade', 'websocket'), 426, 'upgrade_required'),
    wsHandler: handleSocket,
  });
}
