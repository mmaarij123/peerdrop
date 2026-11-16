import { MEMORY_BYTES, RECEIVE_WINDOW, openReceiveStorage } from './receive-storage.js';

const CHUNK_BYTES = 16 * 1024;
const LOW_WATER = 128 * 1024;
const HIGH_WATER = 512 * 1024;
const safeMime = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;
const transferIdPattern = /^[a-f0-9-]{36}$/;
const filenameBytes = 240;
const encoder = new TextEncoder();
const reservedName = /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])$/i;

export function cleanName(value) {
  const cleaned = value.normalize('NFC')
    .replace(/[<>:"/\\|?*\p{Cc}\p{Cf}]/gu, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '');
  const stem = cleaned.split('.', 1)[0].trimEnd();
  const safe = reservedName.test(stem) ? `_${cleaned}` : cleaned;
  const extension = /(?<=.)\.[a-z0-9]{1,16}$/i.exec(safe)?.[0] ?? '';
  const base = safe.slice(0, safe.length - extension.length);
  let remaining = filenameBytes - extension.length;
  let clipped = '';
  for (const character of base) {
    remaining -= encoder.encode(character).length;
    if (remaining < 0) break;
    clipped += character;
  }
  const name = clipped.replace(/[.\s]+$/g, '') + extension || 'download';
  return reservedName.test(name.split('.', 1)[0].trimEnd()) ? `_${name}` : name;
}

function waitForBuffer(channel, signal) {
  if (signal.aborted || channel.readyState !== 'open') return Promise.reject(new Error('Channel closed'));
  if (channel.bufferedAmount < HIGH_WATER) return Promise.resolve();
  return new Promise((resolve, reject) => {
    function cleanup() {
      channel.removeEventListener('bufferedamountlow', ready);
      channel.removeEventListener('close', abort);
      signal.removeEventListener('abort', abort);
    }
    function ready() { cleanup(); resolve(); }
    function abort() { cleanup(); reject(new Error('Transfer interrupted')); }
    channel.addEventListener('bufferedamountlow', ready, { once: true });
    channel.addEventListener('close', abort, { once: true });
    signal.addEventListener('abort', abort, { once: true });
    if (channel.bufferedAmount <= LOW_WATER) ready();
  });
}

export function fileChannel(channel, { file, limit, maxMessageSize, onOffer, onProgress, onSending, onPrepared, onDelivered, onError }) {
  const controller = new AbortController();
  const { signal } = controller;
  let stage = 'opening';
  let metadata;
  let received = 0;
  let sent = 0;
  let persisted = 0;
  let acknowledged = 0;
  let windowBytes = 0;
  let wakeSender;
  let storage;
  let writes = Promise.resolve();
  let chunks = [];
  // Coalesce small chunks to keep per-chunk memory bounded even for a misbehaving sender.
  let block;
  let blockUsed = 0;
  const blockBytes = 256 * 1024;
  channel.binaryType = 'arraybuffer';
  channel.bufferedAmountLowThreshold = LOW_WATER;

  function stop() {
    if (signal.aborted) return;
    controller.abort();
    wakeSender?.();
    void storage?.dispose();
    storage = undefined;
    chunks = [];
    block = undefined;
  }

  function command(type, fields = {}) {
    if (signal.aborted || channel.readyState !== 'open') throw new Error('Channel closed');
    channel.send(JSON.stringify({ type, transferId: metadata.transferId, ...fields }));
  }

  function opened() {
    if (signal.aborted || stage !== 'opening') return;
    if (!file) { stage = 'metadata'; return; }
    metadata = { transferId: crypto.randomUUID(), name: cleanName(file.name), size: file.size, mime: safeMime.test(file.type) && file.type.length <= 127 ? file.type : '', flowControl: true };
    stage = 'decision';
    command('metadata', metadata);
    onOffer(metadata);
  }

  async function sendFile() {
    const maximum = maxMessageSize();
    const size = Number.isFinite(maximum) && maximum > 0 ? Math.min(CHUNK_BYTES, Math.floor(maximum)) : CHUNK_BYTES;
    if (size < 1) throw new Error('Invalid negotiated message size');
    while (sent < file.size) {
      const length = Math.min(size, file.size - sent);
      while (windowBytes && sent + length - acknowledged > windowBytes) {
        if (signal.aborted) throw new Error('Transfer interrupted');
        await new Promise(resolve => { wakeSender = resolve; });
        wakeSender = undefined;
      }
      await waitForBuffer(channel, signal);
      const chunk = await file.slice(sent, sent + length).arrayBuffer();
      if (signal.aborted || channel.readyState !== 'open' || chunk.byteLength !== length) throw new Error('Transfer interrupted');
      channel.send(chunk);
      sent += chunk.byteLength;
      onProgress(sent);
    }
    stage = 'ack';
    command('end');
  }

  function saveBlock(data) {
    if (!storage) { chunks.push(data); return; }
    writes = writes.then(async () => {
      if (signal.aborted) return;
      await storage.write(data);
      if (signal.aborted) return;
      persisted += data.byteLength;
      command('credit', { bytes: persisted });
    }).catch(() => fail('The receiver’s browser couldn’t store the file. Free up space on the receiving device and try again.'));
  }

  function binary(data) {
    if (file || stage !== 'data' || !(data instanceof ArrayBuffer) || data.byteLength < 1 || data.byteLength > CHUNK_BYTES ||
        data.byteLength > metadata.size - received || (windowBytes && received + data.byteLength - persisted > windowBytes)) throw new Error('Invalid file bytes');
    const bytes = new Uint8Array(data);
    for (let offset = 0; offset < bytes.length;) {
      if (!block) block = new Uint8Array(Math.min(blockBytes, metadata.size - received - offset));
      const length = Math.min(block.length - blockUsed, bytes.length - offset);
      block.set(bytes.subarray(offset, offset + length), blockUsed);
      offset += length;
      blockUsed += length;
      if (blockUsed === block.length) {
        saveBlock(block);
        block = undefined;
        blockUsed = 0;
      }
    }
    received += data.byteLength;
    onProgress(received);
  }

  async function prepare() {
    const disk = storage;
    await writes;
    if (signal.aborted) return;
    const blob = disk ? await disk.finish() : new Blob(chunks, { type: 'application/octet-stream' });
    if (signal.aborted) return;
    if (blob.size !== metadata.size) throw new Error('Incomplete file');
    chunks = [];
    stage = 'prepared';
    onPrepared(blob, metadata.name, disk?.dispose);
    storage = undefined;
    command('ack');
  }

  function receive(data) {
    if (signal.aborted) return;
    if (typeof data !== 'string') { binary(data); return; }
    if (data.length > 4096) throw new Error('Oversized command');
    const message = JSON.parse(data);
    if (!message || typeof message.transferId !== 'string' || !transferIdPattern.test(message.transferId)) throw new Error('Invalid transfer ID');
    if (!file && stage === 'metadata' && message.type === 'metadata') {
      const { transferId, name, size, mime, flowControl } = message;
      if (typeof name !== 'string' || !name || name.length > 510 || !Number.isSafeInteger(size) || size < 0 || (limit !== null && size > limit) ||
          typeof mime !== 'string' || mime.length > 127 || (mime && !safeMime.test(mime))) throw new Error('Invalid file metadata');
      metadata = { transferId, name: cleanName(name), size, mime, flowControl: flowControl === true };
      stage = 'decision';
      onOffer(metadata);
      return;
    }
    if (message.transferId !== metadata?.transferId) throw new Error('Unexpected transfer ID');
    if (file && stage === 'decision' && message.type === 'accept') {
      if (message.window !== undefined && message.window !== RECEIVE_WINDOW) throw new Error('Invalid receive window');
      windowBytes = message.window ?? 0;
      stage = 'data';
      onSending();
      void sendFile().catch(() => fail());
    } else if (file && windowBytes && (stage === 'data' || stage === 'ack') && message.type === 'credit') {
      if (!Number.isSafeInteger(message.bytes) || message.bytes <= acknowledged || message.bytes > sent) throw new Error('Invalid receive credit');
      acknowledged = message.bytes;
      wakeSender?.();
    } else if (!file && stage === 'data' && message.type === 'end') {
      if (received !== metadata.size) throw new Error('Incomplete file');
      stage = 'finalizing';
      void prepare().catch(() => fail('The receiver couldn’t prepare the download. Free up space on the receiving device and try again.'));
    } else if (file && stage === 'ack' && message.type === 'ack') {
      if (windowBytes && acknowledged !== file.size) throw new Error('File still has uncredited bytes');
      stage = 'done';
      onDelivered();
    } else if (message.type === 'cancel' || (file && stage === 'decision' && message.type === 'decline')) {
      // Signaling carries the authoritative terminal outcome, including before a channel opens.
      stop();
    } else {
      throw new Error('Unexpected file message');
    }
  }

  function fail(message = 'The file transfer was interrupted. Try a fresh link.') {
    if (signal.aborted) return;
    stop();
    onError(message);
  }

  function guarded(callback) {
    try { callback(); } catch { fail(); }
  }

  channel.onopen = () => guarded(opened);
  channel.onmessage = ({ data }) => guarded(() => receive(data));
  channel.onerror = () => fail();
  // Release work immediately while signaling determines the displayed outcome.
  channel.addEventListener('close', stop, { once: true });
  if (channel.readyState === 'open') guarded(opened);

  return {
    async accept() {
      if (signal.aborted || file || stage !== 'decision') return;
      if (metadata.size > MEMORY_BYTES) {
        if (!metadata.flowControl) { fail('Ask the sender to refresh PeerDrop and create a fresh invite for this file.'); return; }
        stage = 'opening-storage';
        try {
          const disk = await openReceiveStorage();
          if (signal.aborted) { void disk.dispose(); return; }
          storage = disk;
          windowBytes = RECEIVE_WINDOW;
        } catch {
          fail('This browser couldn’t prepare the file. Try another browser or ask the sender for a smaller file.');
          return;
        }
      }
      guarded(() => { stage = 'data'; command('accept', windowBytes ? { window: windowBytes } : {}); onSending(); });
    },
    stop,
    notify(type) {
      if (metadata && !signal.aborted && channel.readyState === 'open') {
        try { command(type); } catch { /* The signaling message still terminates the session. */ }
      }
      stop();
    },
  };
}
