export type Role = 'sender' | 'receiver';
export type Outcome = 'completed' | 'declined' | 'cancelled' | 'expired' | 'failed';

export const idPattern = /^[a-f0-9]{32}$/;
export const tokenPattern = /^[a-f0-9]{64}$/;

type Auth = { type: 'auth'; sessionId: string; token: string };
type PeerReady = { type: 'peer_ready' };
type End = { type: 'end'; outcome: Exclude<Outcome, 'expired'> };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMessage(text: string): Auth | PeerReady | End | null {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  if (!object(data)) return null;
  const { type, sessionId, token, outcome } = data;
  switch (type) {
    case 'auth':
      return typeof sessionId === 'string' && idPattern.test(sessionId) && typeof token === 'string' && tokenPattern.test(token)
        ? { type, sessionId, token } : null;
    case 'peer_ready': return { type };
    case 'end':
      return outcome === 'completed' || outcome === 'declined' || outcome === 'cancelled' || outcome === 'failed' ? { type, outcome } : null;
    default: return null;
  }
}
