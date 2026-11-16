import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';

// Run on a fresh test stack with RATE_LIMIT_CREATE=4 and both instances healthy.
const origin = process.argv[2];
assert.ok(origin, 'Pass the public test origin');
const wsOrigin = origin.replace(/^http/, 'ws');
const create = () => fetch(`${origin}/api/transfers`, { method: 'POST', headers: { origin } });
const sockets = [];

async function peer(session, token, role) {
  const ws = new WebSocket(`${wsOrigin}/ws/signaling/${session.sessionId}`, { headers: { origin } });
  sockets.push(ws);
  const messages = [];
  ws.addEventListener('message', ({ data }) => messages.push(JSON.parse(data)));
  await once(ws, 'open', { signal: AbortSignal.timeout(5000) });
  ws.send(JSON.stringify({ type: 'auth', sessionId: session.sessionId, token }));
  const next = async () => {
    for (let attempt = 0; attempt < 100 && !messages.length; attempt++) await setTimeout(50);
    assert.ok(messages.length, 'Expected a signaling message');
    return messages.shift();
  };
  assert.deepEqual(await next(), { type: 'joined', role });
  return { ws, next };
}

try {
  const sessions = [];
  for (let index = 0; index < 4; index++) {
    const response = await create();
    assert.equal(response.status, 201);
    sessions.push(await response.json());
  }
  assert.deepEqual([...new Set(sessions.map(session => session.sessionId.slice(0, 2)))].sort(), ['01', '02']);
  const blocked = await create();
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  for (const session of sessions) {
    const sender = await peer(session, session.senderToken, 'sender');
    const receiver = await peer(session, new URL(session.inviteUrl).hash.slice(1), 'receiver');
    assert.equal((await sender.next()).type, 'ready');
    assert.equal((await receiver.next()).type, 'ready');
    sender.ws.send(JSON.stringify({ type: 'end', outcome: 'cancelled' }));
    assert.deepEqual(await receiver.next(), { type: 'ended', outcome: 'cancelled' });
  }
  assert.equal((await fetch(`${origin}/ws/signaling/invalid`)).status, 400);
  console.log('Two signaling instances admitted both roles; the fifth invite was rate-limited across the pool.');
} finally {
  for (const socket of sockets) socket.close();
}
