import { AsyncLocalStorage, createHook } from 'node:async_hooks';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import type { FastifyInstance } from 'fastify';
import { ExpressPeerServer, type IMessage } from 'peer';
import { WebSocket, WebSocketServer } from 'ws';
import type { Config } from './config.js';
import { httpError } from './http-errors.js';
import { idPattern, tokenPattern, type Role } from './protocol.js';
import type { makeRateLimiter } from './rate-limit.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

type Grant = {
  role: Role;
  token: Buffer;
  other: string;
  socket?: WebSocket;
  remaining: number;
  updated: number;
};

function validMessage(message: IMessage, grant: Grant) {
  if (message.type === 'HEARTBEAT') return true;
  if (message.dst !== grant.other) return false;
  const payload = message.payload as Record<string, unknown> | undefined;
  if (payload?.type !== 'data' || typeof payload.connectionId !== 'string' || payload.connectionId.length > 128) return false;
  switch (message.type) {
    case 'OFFER':
    case 'ANSWER': {
      const description = payload.sdp as { type?: unknown; sdp?: unknown } | undefined;
      if (description?.type !== message.type.toLowerCase() || typeof description.sdp !== 'string') return false;
      return message.type === 'OFFER'
        ? grant.role === 'receiver' && payload.serialization === 'raw' && payload.label === 'peerdrop-file' && payload.reliable === true
        : grant.role === 'sender';
    }
    case 'CANDIDATE': {
      const candidate = payload.candidate as { candidate?: unknown } | undefined;
      return typeof candidate?.candidate === 'string';
    }
    default:
      return false;
  }
}

export function registerFilePizzaPeer(app: FastifyInstance, config: Config, rateLimit: ReturnType<typeof makeRateLimiter>) {
  const mount = config.nodeId ? `/peerjs/${config.nodeId}` : '/peerjs';
  const path = `${mount}/filepizza`;
  const grants = new Map<string, Grant>();
  const sockets = new WebSocketServer({ noServer: true });
  const router = express();
  const peer = ExpressPeerServer(createServer(), { path: '/filepizza', allow_discovery: false, createWebSocketServer: () => sockets });

  // PeerServer starts two recurring timers on mount and exposes no shutdown API.
  const scope = new AsyncLocalStorage<boolean>();
  const timers = new Map<number, NodeJS.Timeout>();
  const hook = createHook({
    init(id, kind, _trigger, resource) {
      if (kind === 'Timeout' && scope.getStore()) timers.set(id, (resource as NodeJS.Timeout).unref());
    },
    destroy(id) { timers.delete(id); },
  }).enable();
  scope.run(true, () => { router.use(mount, peer); });
  app.addHook('onClose', async () => {
    hook.disable();
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    sockets.close();
    grants.clear();
  });

  peer.on('error', () => {});
  peer.on('message', (client, message) => {
    const grant = grants.get(client.getId());
    if (grant?.socket?.readyState === WebSocket.OPEN && validMessage(message, grant)) {
      const target = grants.get(grant.other)?.socket;
      if (!target || target.bufferedAmount <= 256 * 1024 || message.type === 'HEARTBEAT') return;
      target.terminate();
    }
    // The upstream server emits this event before dispatching the message.
    (message as { type: IMessage['type'] | string }).type = 'blocked';
    client.getSocket()?.close(1008);
  });

  app.get(`${path}/peerjs`, { websocket: true, exposeHeadRoute: false, preValidation: [async (request, reply) => {
    if (!request.ws) return httpError(reply.header('Upgrade', 'websocket'), 426, 'upgrade_required');
    if (!config.origins.includes(request.headers.origin ?? '')) return httpError(reply, 403, 'origin');
  }, rateLimit('join'), async (request, reply) => {
    const { id, token, key } = request.query as Record<string, unknown>;
    if (typeof id !== 'string' || !idPattern.test(id) || typeof token !== 'string' || !tokenPattern.test(token) || key !== 'peerjs') {
      return httpError(reply, 400, 'invalid_request');
    }
    const grant = grants.get(id);
    if (!grant || !timingSafeEqual(grant.token, digest(token))) return httpError(reply, 403, 'invalid_peer');
    if (grant.socket) return httpError(reply, 409, 'peer_registered');
  }] }, (socket, request) => {
    const { id } = request.query as { id: string };
    const grant = grants.get(id);
    if (!grant || grant.socket) { socket.close(1008); return; }
    grant.socket = socket;
    socket.once('close', () => { grant.socket = undefined; });
    socket.on('message', (_data, binary) => {
      const now = performance.now();
      grant.remaining = Math.min(config.signalBurst, grant.remaining + (now - grant.updated) * config.signalRate / 1000);
      grant.updated = now;
      if (binary || grant.remaining < 1) {
        socket.close(1008);
        return;
      }
      grant.remaining--;
    });
    sockets.emit('connection', socket, request.raw);
  });

  return {
    path,
    isRegistered(id: string) { return grants.get(id)?.socket?.readyState === WebSocket.OPEN; },
    allow(id: string, other: string, role: Role) {
      const token = randomBytes(32).toString('hex');
      grants.set(id, { role, token: digest(token), other, remaining: config.signalBurst, updated: performance.now() });
      return token;
    },
    revoke(id: string) {
      grants.get(id)?.socket?.close(1000);
      grants.delete(id);
    },
  };
}
