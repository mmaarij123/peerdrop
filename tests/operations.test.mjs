import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readConfig } from '../build/config.js';
import { makeServer } from '../build/server.js';

test('configuration validates bounds and loads mounted secrets without exposing their values', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'peerdrop-'));
  try {
    const secret = randomBytes(32).toString('hex');
    const path = join(folder, 'turn');
    await writeFile(path, `${secret}\n`);
    const config = readConfig({
      NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://drop.example.test',
      TURN_URLS: 'turn:turn.example.test', TURN_SHARED_SECRET_FILE: path, RATE_LIMIT_CREATE: '3',
    });
    assert.equal(config.turnSecret, secret);
    assert.equal(config.createLimit, 3);
    assert.equal(readConfig({ MAX_FILE_MIB: '' }).maxFileBytes, null);
    assert.equal(readConfig({ MAX_FILE_MIB: '512' }).maxFileBytes, 512 * 1024 ** 2);
    assert.throws(() => readConfig({ MAX_FILE_MIB: '0' }), /MAX_FILE_MIB/);
    assert.throws(() => readConfig({ RATE_LIMIT_JOIN: '1e2' }), /RATE_LIMIT_JOIN/);
    assert.throws(() => readConfig({ FORCE_RELAY: 'TRUE' }), /FORCE_RELAY/);
    assert.throws(() => readConfig({ NODE_ENV: 'production' }), /HTTPS PUBLIC_ORIGIN/);
    assert.equal(readConfig({ LOCAL_TURN: 'true' }).localTurn, true);
    assert.throws(() => readConfig({ LOCAL_TURN: 'true', HOST: '0.0.0.0' }), /standalone loopback/);
    assert.throws(() => readConfig({ LOCAL_TURN: 'true', NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://drop.example.test' }), /standalone loopback/);
    assert.throws(() => readConfig({ TURN_SHARED_SECRET_FILE: path, TURN_SHARED_SECRET: secret }), /Set only one/);
    assert.throws(() => readConfig({ SIGNALING_NODE_ID: '01' }), /Redis|REDIS/);
    assert.throws(() => readConfig({ RATE_LIMIT_REDIS_URL: `invalid://${secret}` }), error => !error.message.includes(secret));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('HTTP contracts distinguish unsupported methods, paths, payloads and media types', async t => {
  const config = readConfig({});
  const app = await makeServer(config);
  t.after(() => app.close());
  const origin = config.origins[0];
  const post = options => app.inject({ method: 'POST', url: '/api/transfers', headers: { origin, 'content-type': 'application/json' }, ...options });
  const wrongMethod = await app.inject('/api/transfers');
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.allow, 'POST');
  assert.equal((await app.inject('/api/missing')).json().error, 'not_found');
  assert.equal((await app.inject('/receive/invalid')).json().error, 'invalid_invite');
  const upgrade = await app.inject('/ws/signaling');
  assert.equal(upgrade.statusCode, 426);
  assert.equal(upgrade.headers.upgrade, 'websocket');
  assert.equal((await post({ payload: '{' })).json().error, 'invalid_request');
  const big = await post({ payload: JSON.stringify('x'.repeat(1100)) });
  assert.equal(big.statusCode, 413);
  assert.equal(big.json().error, 'payload_too_large');
  const media = await post({ headers: { origin, 'content-type': 'application/octet-stream' }, payload: 'bytes' });
  assert.equal(media.statusCode, 415);
  assert.equal(media.json().error, 'unsupported_media_type');
});

test('standalone loopback aliases can create invites on the configured port', async t => {
  const config = readConfig({ PORT: '4174', PUBLIC_ORIGIN: 'http://localhost:4174' });
  const app = await makeServer(config);
  t.after(() => app.close());
  for (const origin of ['http://localhost:4174', 'http://127.0.0.1:4174']) {
    const response = await app.inject({ method: 'POST', url: '/api/transfers', headers: { origin } });
    assert.equal(response.statusCode, 201);
    assert.equal(new URL(response.json().inviteUrl).origin, origin);
  }
  const otherPort = await app.inject({ method: 'POST', url: '/api/transfers', headers: { origin: 'http://localhost:4175' } });
  assert.equal(otherPort.statusCode, 403);
  assert.deepEqual(readConfig({ NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://drop.example.test' }).origins, ['https://drop.example.test']);
});
