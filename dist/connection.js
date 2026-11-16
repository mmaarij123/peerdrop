const joinErrors = {
  expired: 'This invite has expired. Ask the sender for a new link.',
  used: 'This invite has already been used. Ask the sender for a new link.',
  unavailable: 'This invite is unavailable. Ask the sender for a new link.',
  rate_limit: 'Too many attempts. Wait a minute and try again.',
  capacity: 'PeerDrop is busy. Try again shortly.',
};

const CHANNEL_LABEL = 'peerdrop-file';

export function connect({ role, sessionId, token, onJoined, onReady, onChannel, onEnded, onError, onPath }) {
  const url = new URL(`/ws/signaling/${sessionId}`, location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(url);
  let peer;
  let peerConnection;
  let dataConnection;
  let joined = false;
  let registered = false;
  let senderReady = false;
  let closed = false;
  let pendingEnd;
  let closeTimer;
  let pathPoll;
  let iceGrace;
  let connectionTimer;
  let channelCloseTimer;
  let transferKey;
  let uploaderPeerID;
  let turnConfigured = false;

  const setupTimer = setTimeout(() => {
    if (!joined) onError('failed', 'Could not join the transfer. Open the original invite again or ask the sender for a fresh link.');
  }, 9000);

  function send(message) {
    if (!closed && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function stop() {
    if (closed) return;
    closed = true;
    clearTimeout(setupTimer);
    clearTimeout(closeTimer);
    clearTimeout(iceGrace);
    clearTimeout(connectionTimer);
    clearTimeout(channelCloseTimer);
    clearInterval(pathPoll);
    transferKey = '';
    peer?.destroy();
    if (socket.readyState < WebSocket.CLOSING) socket.close();
  }

  function end(outcome) {
    if (closed || pendingEnd) return;
    pendingEnd = outcome;
    if (joined) send({ type: 'end', outcome });
    closeTimer = setTimeout(() => {
      if (outcome === 'completed') onError('failed', 'PeerDrop couldn’t confirm that the file arrived. Try a fresh link.');
      stop();
    }, 2500);
  }

  function reportConnectionFailure() {
    if (closed || pendingEnd) return;
    const detail = turnConfigured
      ? 'The browsers couldn’t connect. Check that both devices are online, then try a fresh link.'
      : 'The browsers couldn’t connect. Try another browser or internet connection, then use a fresh link.';
    onError('failed', detail);
  }

  function reportSignalingFailure() {
    if (!closed && !pendingEnd) onError('failed', 'Could not reach PeerDrop. Try a fresh link.');
  }

  async function samplePath() {
    if (closed || !peerConnection) return;
    const stats = await peerConnection.getStats();
    if (closed) return;
    const transport = [...stats.values()].find(stat => stat.type === 'transport' && stat.selectedCandidatePairId);
    const pair = transport ? stats.get(transport.selectedCandidatePairId) : [...stats.values()].find(stat => stat.type === 'candidate-pair' && stat.selected === true);
    const local = pair && stats.get(pair.localCandidateId);
    const remote = pair && stats.get(pair.remoteCandidateId);
    if (local?.candidateType && remote?.candidateType) {
      onPath(local.candidateType === 'relay' || remote.candidateType === 'relay' ? 'Relayed' : 'Direct');
    }
  }

  function scheduleChannelClosed() {
    if (closed || pendingEnd || channelCloseTimer !== undefined) return;
    // The terminal control event can follow closure of the data channel.
    channelCloseTimer = setTimeout(() => {
      if (!closed && !pendingEnd) onError('failed', 'The transfer was interrupted. Try a fresh link.');
    }, 1500);
  }

  function expectChannel(connection) {
    dataConnection = connection;
    peerConnection = connection.peerConnection;
    connection.on('error', () => {
      if (connection.open) scheduleChannelClosed();
      else reportConnectionFailure();
    });
    connection.on('close', scheduleChannelClosed);
    connection.once('open', () => {
      if (closed || pendingEnd) { connection.close(); return; }
      const channel = connection.dataChannel;
      if (!channel || channel.label !== CHANNEL_LABEL || !channel.ordered || channel.maxRetransmits !== null || channel.maxPacketLifeTime !== null) {
        connection.close();
        reportConnectionFailure();
        return;
      }
      clearTimeout(connectionTimer);
      channel.addEventListener('close', scheduleChannelClosed, { once: true });
      // The reliable raw channel lets the file protocol retain its own backpressure.
      onChannel(channel, () => peerConnection?.sctp?.maxMessageSize);
      void samplePath().catch(() => {});
      pathPoll = setInterval(() => { void samplePath().catch(() => {}); }, 1000);
    });
    peerConnection?.addEventListener('connectionstatechange', () => {
      clearTimeout(iceGrace);
      if (closed || pendingEnd) return;
      if (peerConnection.connectionState === 'failed') {
        if (connection.open) scheduleChannelClosed();
        else reportConnectionFailure();
      }
      if (peerConnection.connectionState === 'disconnected') {
        iceGrace = setTimeout(() => {
          if (!closed && !pendingEnd) onError('failed', 'The connection was interrupted. Try a fresh link.');
        }, 8000);
      }
    });
  }

  function callSender() {
    if (role !== 'receiver' || !registered || !senderReady || dataConnection || closed || pendingEnd) return;
    const connection = peer.connect(uploaderPeerID, {
      label: CHANNEL_LABEL,
      reliable: true,
      serialization: 'raw',
      metadata: { transferKey },
    });
    if (connection) expectChannel(connection);
    else reportSignalingFailure();
  }

  function startPeer(message) {
    const Peer = globalThis.peerjs?.Peer;
    if (!joined || peer || typeof Peer !== 'function') throw new Error('File signaling is unavailable');
    ({ uploaderPeerID, transferKey } = message);
    if (typeof uploaderPeerID !== 'string' || typeof transferKey !== 'string' || typeof message.peerPath !== 'string' ||
        typeof message.peerId !== 'string' || typeof message.peerToken !== 'string') {
      throw new Error('Invalid file signaling configuration');
    }
    turnConfigured = (message.rtc.iceServers ?? []).some(server => [server.urls].flat().some(url => /^turns?:/i.test(url)));
    onReady();
    peer = new Peer(message.peerId, {
      host: location.hostname,
      port: Number(location.port || (location.protocol === 'https:' ? 443 : 80)),
      secure: location.protocol === 'https:',
      path: message.peerPath,
      token: message.peerToken,
      config: message.rtc,
      referrerPolicy: 'no-referrer',
    });
    connectionTimer = setTimeout(reportConnectionFailure, 30_000);
    peer.on('error', error => {
      if (dataConnection?.open && error.type !== 'webrtc') return;
      if (error.type === 'webrtc') reportConnectionFailure();
      else reportSignalingFailure();
    });
    peer.on('disconnected', () => { if (!dataConnection?.open) reportSignalingFailure(); });
    peer.on('connection', incoming => {
      if (role !== 'sender' || dataConnection || incoming.metadata?.transferKey !== transferKey ||
          incoming.label !== CHANNEL_LABEL || incoming.serialization !== 'raw' || closed || pendingEnd) {
        incoming.close();
        return;
      }
      expectChannel(incoming);
    });
    peer.once('open', () => {
      if (closed || pendingEnd) return;
      registered = true;
      if (role === 'sender') send({ type: 'peer_ready' });
      else callSender();
    });
  }

  function handle(message) {
    switch (message.type) {
      case 'error':
        onError(message.code === 'expired' ? 'expired' : 'failed', joinErrors[message.code] ?? 'The connection ended. Try a fresh link.');
        stop();
        return;
      case 'joined':
        if (message.role !== role || joined) throw new Error('Unexpected role');
        joined = true;
        clearTimeout(setupTimer);
        if (pendingEnd) send({ type: 'end', outcome: pendingEnd });
        else onJoined();
        return;
      case 'ended':
        onEnded(message.outcome, message.disconnected);
        stop();
        return;
      case 'ready':
        if (!pendingEnd) startPeer(message);
        return;
      case 'peer_ready':
        senderReady = true;
        callSender();
        return;
      default:
        throw new Error('Unexpected signaling message');
    }
  }

  socket.onopen = () => {
    send({ type: 'auth', sessionId, token });
    token = '';
  };
  socket.onmessage = ({ data }) => {
    if (closed) return;
    try { handle(JSON.parse(data)); }
    catch { reportSignalingFailure(); }
  };
  socket.onclose = () => {
    if (closed) return;
    if (!pendingEnd || pendingEnd === 'completed') onError('failed', 'The connection was interrupted. Try a fresh link.');
    stop();
  };
  return { stop, end };
}
