import { connect } from './connection.js';
import { cleanName, fileChannel } from './channel.js';

const byId = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  'transfer-title', 'transfer-status', 'transfer-detail', 'connection-path', 'file-picker', 'file-drop-zone', 'file-input', 'file-limit',
  'create-link', 'file-summary', 'selected-name', 'selected-size', 'invite', 'invite-link', 'copy-link', 'invite-note',
  'progress-group', 'progress-label', 'transfer-progress', 'accept-file', 'decline-file', 'cancel-transfer', 'save-file', 'new-link', 'new-file',
].map(id => [id, byId(id)]));
const terminal = new Set(['completed', 'declined', 'cancelled', 'expired', 'failed']);
const REQUEST_TIMEOUT = 15_000;
const role = location.pathname.startsWith('/receive/') ? 'receiver' : 'sender';
const sessionId = role === 'receiver' ? location.pathname.split('/').at(-1) : '';

let state = 'loading';
let detail = '';
let connection;
let transfer;
let request;
let file;
let metadata;
let maxBytes;
let invite;
let bytes = 0;
let blobUrl;
let disposeDownload;
let deliveryConfirmed = false;
let progressFrame;
let generation = 0;

const labels = {
  loading: 'Getting ready', idle: 'Choose a file to send', creating: 'Creating your invite',
  waiting: 'Waiting for receiver', connecting: 'Connecting', acceptance: role === 'sender' ? 'Waiting for the receiver to accept' : 'Accept this file?',
  transferring: 'Transferring', completed: role === 'sender' ? 'Delivered' : 'Ready to save',
  declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired', failed: 'Transfer failed',
};
const outcomes = {
  completed: role === 'sender' ? 'The receiver confirmed delivery.' : 'The complete file is ready to save.',
  declined: 'The receiver declined the file.', cancelled: 'This transfer was cancelled.',
  expired: 'This invite or transfer has expired. Start again with a fresh link.',
  failed: 'The transfer was interrupted. Start again with a fresh link.',
};

function show(id, visible) { ui[id].hidden = !visible; }

function formatBytes(value) {
  if (value >= 1000 ** 3) return `${(value / 1000 ** 3).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB`;
  if (value < 1000) return `${value.toLocaleString()} ${value === 1 ? 'byte' : 'bytes'}`;
  if (value < 1000 ** 2) return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`;
  return `${(value / 1000 ** 2).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
}

function overLimit(size) { return maxBytes != null && size > maxBytes; }

function fetchForTransfer(path, controller, options = {}) {
  return fetch(path, { ...options, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT)]) });
}

function drawProgress() {
  if (!metadata) return;
  const percent = metadata.size ? Math.floor(100 * bytes / metadata.size) : state === 'completed' ? 100 : 0;
  ui['transfer-progress'].value = percent;
  const direction = role === 'sender' ? 'Bytes sent' : 'Bytes received';
  ui['progress-label'].textContent = `${direction}: ${bytes.toLocaleString()} of ${metadata.size.toLocaleString()} (${percent}%)`;
}

function render() {
  ui['transfer-status'].closest('.transfer-panel').dataset.state = state;
  ui['transfer-status'].textContent = labels[state];
  ui['transfer-detail'].textContent = detail;
  show('file-picker', role === 'sender' && state === 'idle');
  ui['create-link'].disabled = !file || overLimit(file.size);
  show('file-summary', Boolean(metadata));
  if (metadata) {
    ui['selected-name'].textContent = metadata.name;
    ui['selected-size'].textContent = formatBytes(metadata.size);
  }
  show('invite', Boolean(invite) && state === 'waiting');
  ui['invite-link'].value = invite?.inviteUrl ?? '';
  ui['invite-note'].textContent = invite ? `Share this link with one person. It expires at ${new Date(invite.expiresAt).toLocaleTimeString()}.` : '';
  show('progress-group', state === 'transferring' || state === 'completed');
  show('accept-file', role === 'receiver' && state === 'acceptance');
  show('decline-file', role === 'receiver' && state === 'acceptance');
  show('cancel-transfer', !deliveryConfirmed && !blobUrl && ['creating', 'waiting', 'connecting', 'acceptance', 'transferring'].includes(state));
  show('save-file', role === 'receiver' && state === 'completed' && Boolean(blobUrl));
  show('new-link', role === 'sender' && terminal.has(state) && maxBytes !== undefined);
  show('new-file', role === 'sender' && terminal.has(state) && maxBytes !== undefined);
  drawProgress();
}

function change(next, message = '') {
  state = next;
  detail = message;
  if (state !== 'waiting') invite = undefined;
  render();
}

function releaseDownload() {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = undefined;
  void disposeDownload?.();
  disposeDownload = undefined;
  ui['save-file'].removeAttribute('href');
  ui['save-file'].removeAttribute('download');
}

function finish(outcome, message) {
  if (terminal.has(state)) return;
  transfer?.stop();
  if (outcome !== 'completed') releaseDownload();
  change(outcome, message ?? outcomes[outcome]);
  if (outcome === 'completed' && role === 'receiver') ui['save-file'].focus();
}

function start(session, token, pendingInvite) {
  const attempt = ++generation;
  const current = () => attempt === generation && !terminal.has(state);
  connection = connect({
    role, sessionId: session, token,
    onJoined() {
      if (!current()) return;
      if (role === 'receiver' && location.hash) history.replaceState(null, '', location.pathname);
      if (!pendingInvite) return;
      invite = pendingInvite;
      pendingInvite = undefined;
      change('waiting', 'Send the invite link and keep this tab open.');
    },
    onReady() {
      if (current()) change('connecting', 'Keep both tabs open while PeerDrop connects you.');
    },
    onPath(path) {
      if (!current()) return;
      ui['connection-path'].textContent = path === 'Relayed' ? 'Assisted connection' : 'Direct connection';
      show('connection-path', true);
    },
    onChannel(channel, maxMessageSize) {
      if (!current()) { channel.close(); return; }
      transfer = fileChannel(channel, {
        file, limit: maxBytes, maxMessageSize,
        onOffer(offer) {
          if (!current()) return;
          metadata = { ...offer, name: cleanName(offer.name) };
          change('acceptance', role === 'receiver' ? 'Only accept a file you were expecting.' : 'The receiver can see the file name and size before deciding.');
        },
        onSending() {
          if (current()) change('transferring', role === 'sender' ? 'You’ll see Delivered once the receiver has the full file.' : 'Keep this tab open until the file is ready to save.');
        },
        onProgress(count) {
          if (!current()) return;
          bytes = count;
          progressFrame ??= requestAnimationFrame(() => {
            progressFrame = undefined;
            drawProgress();
          });
        },
        onPrepared(blob, name, dispose) {
          if (!current()) { void dispose?.(); return; }
          disposeDownload = dispose;
          blobUrl = URL.createObjectURL(blob);
          ui['save-file'].href = blobUrl;
          ui['save-file'].download = name;
          change('transferring', 'File received. Confirming delivery.');
        },
        onDelivered() {
          if (!current()) return;
          deliveryConfirmed = true;
          render();
          connection.end('completed');
        },
        onError(message) {
          if (!current()) return;
          finish('failed', message);
          connection.end('failed');
        },
      });
    },
    onEnded(outcome, disconnected) {
      if (!current()) return;
      // After acknowledgment, a receiver may leave before the server sees completion.
      if (outcome === 'failed' && role === 'sender' && deliveryConfirmed && disconnected === 'receiver') {
        finish('completed');
        return;
      }
      if (outcome === 'completed' && !(role === 'sender' ? deliveryConfirmed : blobUrl)) {
        finish('failed', 'PeerDrop couldn’t confirm that the file arrived. Try a fresh link.');
        return;
      }
      finish(outcome);
    },
    onError(outcome, message) {
      if (!current()) return;
      finish(outcome, message);
      if (outcome === 'failed') connection.end('failed');
    },
  });
}

async function createInvite() {
  if (!file || overLimit(file.size) || state !== 'idle') return;
  const controller = new AbortController();
  request = controller;
  metadata = { name: cleanName(file.name), size: file.size };
  change('creating');
  try {
    const response = await fetchForTransfer('/api/transfers', controller, { method: 'POST' });
    if (response.status === 403) {
      finish('failed', 'This address can’t create invites. Open the original PeerDrop site link and try again.');
      return;
    }
    if (response.status === 429 || response.status === 503) {
      const retry = Number(response.headers.get('Retry-After'));
      const wait = retry > 0 && Number.isSafeInteger(retry) ? `Try again in ${retry} ${retry === 1 ? 'second' : 'seconds'}.` : 'Try again shortly.';
      finish('failed', `${response.status === 429 ? 'Too many invites.' : 'PeerDrop can’t create invites right now.'} ${wait}`);
      return;
    }
    if (!response.ok) {
      finish('failed', 'Could not create an invite. Try again.');
      return;
    }
    const { sessionId, senderToken, inviteUrl, expiresAt } = await response.json();
    if (controller.signal.aborted) return;
    start(sessionId, senderToken, { inviteUrl, expiresAt });
  } catch (error) {
    if (!controller.signal.aborted) {
      finish('failed', error.name === 'TimeoutError' ? 'Creating the invite took too long. Try again.' : 'Could not create an invite. Try again.');
    }
  } finally {
    if (request === controller) request = undefined;
  }
}

function stopByChoice(outcome) {
  if (terminal.has(state)) return;
  request?.abort();
  transfer?.notify(outcome === 'declined' ? 'decline' : 'cancel');
  connection?.end(outcome);
  finish(outcome);
}

if (role === 'sender') {
  const input = ui['file-input'];
  const dropZone = ui['file-drop-zone'];
  const canDrop = event => state === 'idle' && dropZone.contains(event.target);
  const isFileDrag = event => event.dataTransfer?.types.includes('Files');

  function selectFile(message = '') {
    file = input.files[0];
    change('idle', file && overLimit(file.size) ? `Choose a file that is ${formatBytes(maxBytes)} or smaller.` : message);
  }

  input.addEventListener('change', () => selectFile());
  document.addEventListener('dragover', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    const hovering = canDrop(event);
    event.dataTransfer.dropEffect = hovering ? 'copy' : 'none';
    dropZone.classList.toggle('is-drag-over', hovering);
  });
  dropZone.addEventListener('dragleave', event => {
    if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('is-drag-over');
  });
  document.addEventListener('drop', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dropZone.classList.remove('is-drag-over');
    if (!canDrop(event)) return;
    const { files, items } = event.dataTransfer;
    if (files.length !== 1 || Array.from(items).some(item => item.webkitGetAsEntry?.()?.isDirectory)) {
      input.value = '';
      selectFile('Drop one file at a time. For a folder or several files, create a ZIP first.');
      return;
    }
    input.files = files;
    selectFile();
  });
}
ui['create-link'].addEventListener('click', createInvite);
ui['copy-link'].addEventListener('click', async () => {
  const currentInvite = invite;
  if (!currentInvite) return;
  try {
    await navigator.clipboard.writeText(currentInvite.inviteUrl);
    if (invite === currentInvite) ui['invite-note'].textContent = 'Invite link copied.';
  } catch {
    if (invite !== currentInvite) return;
    ui['invite-link'].select();
    ui['invite-note'].textContent = 'Copy the selected link to share it.';
  }
});
ui['accept-file'].addEventListener('click', () => transfer?.accept());
ui['decline-file'].addEventListener('click', () => stopByChoice('declined'));
ui['cancel-transfer'].addEventListener('click', () => stopByChoice('cancelled'));
function resetSender() {
  generation++;
  if (progressFrame !== undefined) cancelAnimationFrame(progressFrame);
  progressFrame = undefined;
  connection?.stop();
  connection = undefined;
  transfer = undefined;
  metadata = undefined;
  bytes = 0;
  deliveryConfirmed = false;
  show('connection-path', false);
  releaseDownload();
  change('idle');
}

ui['new-link'].addEventListener('click', () => {
  resetSender();
  if (file) void createInvite();
});
ui['new-file'].addEventListener('click', () => {
  file = undefined;
  ui['file-input'].value = '';
  resetSender();
  ui['file-input'].focus();
});

addEventListener('pagehide', () => {
  request?.abort();
  transfer?.stop();
  connection?.stop();
  releaseDownload();
  if (progressFrame !== undefined) cancelAnimationFrame(progressFrame);
});
addEventListener('pageshow', event => {
  if (!event.persisted) return;
  if (role === 'sender') location.reload();
  else {
    state = 'failed';
    change('failed', 'This invite is no longer available. Ask the sender for a new link.');
  }
});

async function initialize() {
  let token = role === 'receiver' ? location.hash.slice(1) : '';
  const title = role === 'sender' ? 'Send a file' : 'Receive a file';
  ui['transfer-title'].textContent = title;
  document.title = `${title} · PeerDrop`;
  if (role === 'receiver' && (!/^[a-f0-9]{32}$/.test(sessionId) || !/^[a-f0-9]{64}$/.test(token))) {
    finish('failed', 'Open the full invite link from the sender. If it was already used, ask for a fresh link.');
    return;
  }
  if (!window.isSecureContext || typeof RTCPeerConnection !== 'function') {
    finish('failed', 'Could not start a transfer here. Open the original PeerDrop link in another browser.');
    return;
  }
  const controller = new AbortController();
  request = controller;
  try {
    const response = await fetchForTransfer('/api/config', controller);
    if (!response.ok) {
      finish('failed', 'PeerDrop is unavailable. Try again in a moment.');
      return;
    }
    ({ maxFileBytes: maxBytes } = await response.json());
    if (controller.signal.aborted) return;
    if (maxBytes !== null && (!Number.isSafeInteger(maxBytes) || maxBytes < 1)) {
      finish('failed', 'Could not get the file size limit. Refresh to try again.');
      return;
    }
    if (role === 'sender') {
      ui['file-limit'].textContent = maxBytes === null
        ? 'One file per invite. The receiver needs enough free space for large files.'
        : `One file per invite, up to ${formatBytes(maxBytes)}.`;
      change('idle');
    } else {
      change('connecting', 'Connecting to the sender.');
      start(sessionId, token);
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      finish('failed', error.name === 'TimeoutError' ? 'PeerDrop took too long to load. Refresh the page to try again.' : 'PeerDrop is unavailable. Try again in a moment.');
    }
  } finally {
    token = '';
    if (request === controller) request = undefined;
  }
}

void initialize();
