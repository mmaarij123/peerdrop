import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { makeServer } from '../build/server.js';
import { readConfig } from '../build/config.js';

async function setup(t, overrides = {}) {
  const config = { ...readConfig({}), ...overrides };
  const app = await makeServer(config);
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  config.origins = [origin];
  t.after(() => app.close());
  const create = async () => {
    const response = await fetch(`${origin}/api/transfers`, { method: 'POST', headers: { origin } });
    assert.equal(response.status, 201);
    return response.json();
  };
  const wsOrigin = origin.replace('http:', 'ws:');
  function peerUrl(ready) {
    const query = new URLSearchParams({ key: 'peerjs', id: ready.peerId, token: ready.peerToken });
    return `${wsOrigin}${ready.peerPath}/peerjs?${query}`;
  }
  async function socket(url = `${wsOrigin}/ws/signaling`) {
    const ws = new WebSocket(url, { headers: { origin } });
    t.after(() => ws.close());
    const messages = [];
    ws.addEventListener('message', ({ data }) => messages.push(JSON.parse(data)));
    await once(ws, 'open', { signal: AbortSignal.timeout(5000) });
    return {
      ws,
      send: (message) => ws.send(JSON.stringify(message)),
      async next() {
        for (let attempt = 0; attempt < 120 && !messages.length; attempt++) await setTimeout(50);
        assert.ok(messages.length, 'Expected a signaling message');
        return messages.shift();
      },
    };
  }
  const auth = (invite, role) => ({
    type: 'auth', sessionId: invite.sessionId,
    token: role === 'sender' ? invite.senderToken : new URL(invite.inviteUrl).hash.slice(1),
  });
  const join = async (invite, role) => {
    const peer = await socket();
    peer.send(auth(invite, role));
    assert.deepEqual(await peer.next(), { type: 'joined', role });
    return peer;
  };
  const register = async ready => {
    const peer = await socket(peerUrl(ready));
    assert.deepEqual(await peer.next(), { type: 'OPEN' });
    return peer;
  };
  return { app, origin, create, socket, auth, join, register, peerUrl };
}

test('same-origin creation, first-message authentication, and isolated one-time sessions', { timeout: 20_000 }, async t => {
  const { app, origin, create, socket, auth, join, register, peerUrl } = await setup(t, { activeMs: 5000 });
  assert.equal((await app.inject('/healthz')).statusCode, 200);
  assert.deepEqual((await app.inject('/api/config')).json(), { maxFileBytes: null });
  assert.equal((await app.inject({ method: 'POST', url: '/api/transfers', headers: { origin: 'https://example.test' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/transfers', headers: { origin }, payload: { file: 'bytes' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/transfers?extra=1', headers: { origin } })).json().error, 'unexpected_input');
  const badOrigin = new WebSocket(`${origin.replace('http:', 'ws:')}/ws/signaling`, { headers: { origin: 'https://example.test' } });
  await once(badOrigin, 'error');
  const invite = await create();
  const other = await create();
  const parsed = new URL(invite.inviteUrl);
  assert.equal(parsed.pathname, `/receive/${invite.sessionId}`);
  assert.match(invite.senderToken, /^[a-f0-9]{64}$/);
  assert.match(parsed.hash, /^#[a-f0-9]{64}$/);
  assert.notEqual(invite.senderToken, parsed.hash.slice(1));
  assert.equal(parsed.search, '');
  const unauthenticated = await socket();
  unauthenticated.send({ type: 'peer_ready' });
  assert.equal((await unauthenticated.next()).code, 'auth_required');
  const misplaced = await socket();
  misplaced.send({ ...auth(invite, 'receiver'), sessionId: other.sessionId });
  assert.equal((await misplaced.next()).code, 'unavailable');
  const sender = await join(invite, 'sender');
  const receiver = await join(invite, 'receiver');
  const [senderReady, receiverReady] = await Promise.all([sender.next(), receiver.next()]);
  assert.equal(senderReady.type, 'ready');
  assert.equal(receiverReady.type, 'ready');
  assert.equal(receiverReady.uploaderPeerID, senderReady.peerId);
  assert.equal(receiverReady.transferKey, senderReady.transferKey);
  assert.match(receiverReady.peerToken, /^[a-f0-9]{64}$/);
  assert.notEqual(senderReady.peerToken, receiverReady.peerToken);
  const badPeer = new WebSocket(peerUrl({ ...receiverReady, peerToken: senderReady.peerToken }), { headers: { origin } });
  await once(badPeer, 'error', { signal: AbortSignal.timeout(5000) });
  const duplicate = await socket();
  duplicate.send(auth(invite, 'receiver'));
  assert.equal((await duplicate.next()).code, 'used');
  const [uploader, downloader] = await Promise.all([register(senderReady), register(receiverReady)]);
  const duplicatePeer = new WebSocket(peerUrl(receiverReady), { headers: { origin } });
  await once(duplicatePeer, 'error', { signal: AbortSignal.timeout(5000) });
  sender.send({ type: 'peer_ready' });
  assert.deepEqual(await receiver.next(), { type: 'peer_ready' });
  const offer = {
    type: 'OFFER', dst: senderReady.peerId,
    payload: { type: 'data', connectionId: 'dc_test', label: 'peerdrop-file', reliable: true, serialization: 'raw', sdp: { type: 'offer', sdp: 'sample' } },
  };
  downloader.send(offer);
  assert.deepEqual(await uploader.next(), { ...offer, src: receiverReady.peerId });
  const answer = { type: 'ANSWER', dst: receiverReady.peerId, payload: { type: 'data', connectionId: 'dc_test', sdp: { type: 'answer', sdp: 'sample' } } };
  uploader.send(answer);
  assert.deepEqual(await downloader.next(), { ...answer, src: senderReady.peerId });
  const downloaderClosed = once(downloader.ws, 'close', { signal: AbortSignal.timeout(5000) });
  downloader.send({ ...offer, dst: other.sessionId });
  assert.equal((await downloaderClosed)[0].code, 1008);
  const uploaderClosed = once(uploader.ws, 'close', { signal: AbortSignal.timeout(5000) });
  receiver.send({ type: 'end', outcome: 'completed' });
  assert.equal((await receiver.next()).code, 'forbidden');
  assert.deepEqual(await sender.next(), { type: 'ended', outcome: 'failed', disconnected: 'receiver' });
  assert.equal((await uploaderClosed)[0].code, 1000);
  const after = await socket();
  after.send(auth(invite, 'receiver'));
  assert.equal((await after.next()).code, 'used');
});

test('invite expiry, abandoned socket timeout, and separate active deadline', { timeout: 15_000 }, async t => {
  const { create, socket, auth, join, register } = await setup(t, { inviteMs: 1200, activeMs: 2800 });
  const active = await create();
  const unused = await create();
  const sender = await join(active, 'sender');
  const receiver = await join(active, 'receiver');
  const ready = await sender.next();
  assert.equal(ready.type, 'ready');
  await register(ready);
  assert.equal((await receiver.next()).type, 'ready');
  const noAuth = await socket();
  await setTimeout(1300);
  const expired = await socket();
  expired.send(auth(unused, 'receiver'));
  assert.equal((await expired.next()).code, 'expired');
  sender.send({ type: 'peer_ready' });
  assert.equal((await receiver.next()).type, 'peer_ready');
  assert.deepEqual(await sender.next(), { type: 'ended', outcome: 'expired' });
  assert.equal((await noAuth.next()).code, 'auth_timeout');
});

test('TURN credentials are scoped to the authenticated ready event', { timeout: 15_000 }, async t => {
  const secret = randomBytes(32).toString('hex');
  const { create, join } = await setup(t, { turnUrls: ['turn:127.0.0.1:3478'], turnSecret: secret, forceRelay: true });
  const invite = await create();
  assert.equal(JSON.stringify(invite).includes(secret), false);
  const sender = await join(invite, 'sender');
  const receiver = await join(invite, 'receiver');
  const [first, second] = await Promise.all([sender.next(), receiver.next()]);
  assert.notEqual(first.rtc.iceServers[0].username, second.rtc.iceServers[0].username);
  for (const event of [first, second]) {
    const server = event.rtc.iceServers[0];
    assert.equal(event.rtc.iceTransportPolicy, 'relay');
    assert.equal(server.credential, createHmac('sha1', secret).update(server.username).digest('base64'));
    assert.equal(JSON.stringify(event).includes(secret), false);
  }
  sender.send({ type: 'end', outcome: 'cancelled' });
  assert.equal((await receiver.next()).outcome, 'cancelled');
});

test('signaling frames and HTTP creation are bounded', { timeout: 15_000 }, async t => {
  const { app, origin, create, socket, join, register } = await setup(t);
  const invite = await create();
  const sender = await join(invite, 'sender');
  const receiver = await join(invite, 'receiver');
  await sender.next();
  await receiver.next();
  const senderClosed = once(sender.ws, 'close');
  sender.ws.send('x'.repeat(24 * 1024 + 1));
  assert.equal((await senderClosed)[0].code, 1009);
  assert.deepEqual(await receiver.next(), { type: 'ended', outcome: 'failed', disconnected: 'sender' });

  const floodInvite = await create();
  const floodSender = await join(floodInvite, 'sender');
  const floodReceiver = await join(floodInvite, 'receiver');
  const peer = await register(await floodSender.next());
  await floodReceiver.next();
  const peerClosed = once(peer.ws, 'close', { signal: AbortSignal.timeout(5000) });
  for (let index = 0; index < 110; index++) {
    peer.send({ type: 'HEARTBEAT' });
  }
  assert.equal((await peerClosed)[0].code, 1008);

  for (let index = 0; index < 18; index++) await create();
  const limited = await app.inject({ method: 'POST', url: '/api/transfers', headers: { origin } });
  assert.equal(limited.statusCode, 429);
  assert.ok(Number(limited.headers['retry-after']) >= 1 && Number(limited.headers['retry-after']) <= 60);
  for (let index = 0; index < 55; index++) (await socket()).ws.close();
  const rejected = new WebSocket(`${origin.replace('http:', 'ws:')}/ws/signaling`, { headers: { origin } });
  const result = await Promise.race([once(rejected, 'error').then(() => 'rejected'), once(rejected, 'open').then(() => 'opened', () => 'rejected')]);
  if (result === 'opened') rejected.close();
  assert.equal(result, 'rejected');
});
