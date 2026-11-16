import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { cleanName, fileChannel } from '../dist/channel.js';

function endpoint(file, limit = 64, maxMessageSize = 8) {
  const messages = [];
  const progress = [];
  const channel = new EventTarget();
  channel.readyState = 'open';
  channel.bufferedAmount = 0;
  channel.send = message => messages.push(typeof message === 'string' ? JSON.parse(message) : message);
  let failures = 0;
  let blob;
  const flow = fileChannel(channel, {
    file, limit, maxMessageSize: () => maxMessageSize,
    onOffer() {}, onSending() {}, onDelivered() {},
    onProgress: count => progress.push(count),
    onPrepared: prepared => { blob = prepared; },
    onError: () => { failures++; },
  });
  const offer = (size, overrides = {}) => {
    const transferId = randomUUID();
    channel.onmessage({ data: JSON.stringify({ type: 'metadata', transferId, name: 'example.txt', size, mime: 'text/plain', ...overrides }) });
    return transferId;
  };
  const receive = data => channel.onmessage({ data: typeof data === 'object' && !(data instanceof ArrayBuffer) ? JSON.stringify(data) : data });
  return { channel, messages, progress, flow, receive, offer, failures: () => failures, blob: () => blob };
}

test('receiver rejects invalid metadata, bytes before consent, excess bytes and premature end', () => {
  for (const [size, mime] of [[65, 'text/plain'], [-1, 'text/plain'], [3, 'text/html;unknown=1']]) {
    const peer = endpoint();
    peer.offer(size, { mime });
    assert.equal(peer.failures(), 1);
    assert.equal(peer.blob(), undefined);
  }
  for (const scenario of ['before consent', 'oversized chunk', 'premature end']) {
    const peer = endpoint();
    const transferId = peer.offer(3);
    if (scenario !== 'before consent') peer.flow.accept();
    if (scenario === 'premature end') peer.receive({ type: 'end', transferId });
    else peer.receive(new ArrayBuffer(scenario === 'before consent' ? 1 : 4));
    assert.equal(peer.failures(), 1, scenario);
    assert.equal(peer.blob(), undefined, scenario);
  }
});

test('sender waits for consent, honors the negotiated limit and unblocks on cancellation', async () => {
  let reads = 0;
  const file = new File([new Uint8Array(23)], 'sample.bin');
  const slice = file.slice.bind(file);
  file.slice = (...args) => { reads++; return slice(...args); };
  const peer = endpoint(file);
  const [{ transferId }] = peer.messages;
  assert.equal(reads, 0);
  peer.channel.bufferedAmount = 600_000;
  peer.receive({ type: 'accept', transferId });
  await setTimeout(0);
  assert.equal(reads, 0);
  peer.channel.bufferedAmount = 0;
  peer.channel.dispatchEvent(new Event('bufferedamountlow'));
  await setTimeout(0);
  assert.deepEqual(peer.messages.slice(1, -1).map(chunk => chunk.byteLength), [8, 8, 7]);
  assert.deepEqual(peer.progress, [8, 16, 23]);

  const blocked = endpoint(file);
  blocked.channel.bufferedAmount = 600_000;
  blocked.receive({ type: 'accept', transferId: blocked.messages[0].transferId });
  blocked.flow.notify('cancel');
  await setTimeout(0);
  assert.equal(reads, 3);
  assert.deepEqual(blocked.messages.map(message => message.type), ['metadata', 'cancel']);
});

test('suggested filenames omit separators, reserved names and invisible controls', () => {
  assert.equal(cleanName('..\\a/b\u202E.txt '), '_a_b_.txt');
  assert.equal(cleanName('NUL.txt'), '_NUL.txt');
  assert.equal(cleanName('   ...'), 'download');
  assert.equal(cleanName('LPT1 .txt'), '_LPT1.txt');
  assert.equal(cleanName('CONOUT$.log'), '_CONOUT$.log');
  const longName = `${'文'.repeat(110)}.pdf`;
  const shortened = cleanName(longName);
  assert.ok(Buffer.byteLength(shortened) <= 240);
  assert.ok(shortened.endsWith('.pdf'));
  assert.equal(cleanName(shortened), shortened);
  assert.equal(cleanName(`NUL${' '.repeat(260)}name.txt`), '_NUL.txt');
  assert.equal(endpoint(new File([], longName)).messages[0].name, shortened);
});

test('closing a channel releases a sender blocked on receive credit', async () => {
  const window = 1024 ** 2;
  const file = new File([new Uint8Array(window + 16_384)], 'window.bin');
  const peer = endpoint(file, null, 16_384);
  const [{ transferId }] = peer.messages;
  peer.receive({ type: 'accept', transferId, window });
  for (let attempt = 0; attempt < 100 && peer.progress.at(-1) !== window; attempt++) await setTimeout(10);
  assert.equal(peer.progress.at(-1), window);
  peer.channel.readyState = 'closed';
  peer.channel.dispatchEvent(new Event('close'));
  peer.receive({ type: 'credit', transferId, bytes: window });
  await setTimeout(0);
  assert.equal(peer.progress.at(-1), window);
  assert.equal(peer.failures(), 0);
});
