import { isIP } from 'node:net';
import { readFileSync } from 'node:fs';

const MiB = 1024 * 1024;

function numberSetting(name: string, value: string | undefined, fallback: number, min: number, max: number) {
  const number = value === undefined ? fallback : /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return number;
}

function secretSetting(env: NodeJS.ProcessEnv, name: string) {
  const file = env[`${name}_FILE`];
  const inline = env[name];
  if (!file) return inline || undefined;
  if (inline) throw new Error(`Set only one of ${name} or ${name}_FILE`);
  try {
    const secret = readFileSync(file, 'utf8').trim();
    if (secret) return secret;
  } catch { /* Do not disclose filesystem paths or contents. */ }
  throw new Error(`${name}_FILE must be a readable, nonempty file`);
}

export function readConfig(env = process.env) {
  const number = (name: string, fallback: number, min: number, max: number) => numberSetting(name, env[name], fallback, min, max);
  const port = number('PORT', 3000, 1, 65535);
  const production = env.NODE_ENV === 'production';
  const configuredOrigin = env.PUBLIC_ORIGIN;
  if (production && !configuredOrigin?.startsWith('https://')) throw new Error('Production requires an HTTPS PUBLIC_ORIGIN');
  const loopbackOrigins = [new URL(`http://localhost:${port}`).origin, new URL(`http://127.0.0.1:${port}`).origin];
  const origins = configuredOrigin ? [configuredOrigin] : loopbackOrigins;
  if (configuredOrigin && !production && !env.SIGNALING_NODE_ID && !env.TRUST_PROXY_IP && loopbackOrigins.includes(configuredOrigin)) {
    origins.push(...loopbackOrigins.filter(origin => origin !== configuredOrigin));
  }
  for (const value of origins) {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin'); }
    if (value !== url.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin');
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('PUBLIC_ORIGIN requires HTTPS outside loopback');
    }
  }
  const split = (value: string | undefined) => value?.split(',').map(url => url.trim()).filter(Boolean) ?? [];
  const stunUrls = split(env.STUN_URLS);
  const turnUrls = split(env.TURN_URLS);
  if (env.FORCE_RELAY !== undefined && !['true', 'false'].includes(env.FORCE_RELAY)) throw new Error('FORCE_RELAY must be true or false');
  if (production && env.TURN_SHARED_SECRET) throw new Error('Production requires TURN_SHARED_SECRET_FILE for TURN credentials');
  const turnSecret = secretSetting(env, 'TURN_SHARED_SECRET');
  if (turnSecret && !/^[\x21-\x7e]{32,256}$/.test(turnSecret)) throw new Error('TURN shared secret must contain 32–256 printable non-space ASCII characters');
  const forceRelay = env.FORCE_RELAY === 'true';
  const trustProxy = env.TRUST_PROXY_IP;
  const nodeId = env.SIGNALING_NODE_ID;
  const localTurn = env.LOCAL_TURN === 'true';
  if (env.LOCAL_TURN && !['true', 'false'].includes(env.LOCAL_TURN)) throw new Error('LOCAL_TURN must be true or false');
  if (localTurn && (production || nodeId || trustProxy || turnUrls.length || turnSecret || forceRelay || (env.HOST && env.HOST !== '127.0.0.1') || origins.some(origin => !loopbackOrigins.includes(origin)))) {
    throw new Error('LOCAL_TURN requires standalone loopback development with no external TURN configuration');
  }
  const rateStoreUrl = secretSetting(env, 'RATE_LIMIT_REDIS_URL');
  if (nodeId !== undefined && !/^(01|02)$/.test(nodeId)) throw new Error('SIGNALING_NODE_ID must be 01 or 02');
  if (nodeId && !rateStoreUrl) throw new Error('Load-balanced signaling requires RATE_LIMIT_REDIS_URL or its file equivalent');
  if (rateStoreUrl) {
    let parsed: URL;
    try { parsed = new URL(rateStoreUrl); } catch { throw new Error('Invalid rate-limit Redis URL'); }
    if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.hostname || parsed.search || parsed.hash) throw new Error('Invalid rate-limit Redis URL');
    if (production && (parsed.username || parsed.password) && !env.RATE_LIMIT_REDIS_URL_FILE) throw new Error('Production Redis credentials require RATE_LIMIT_REDIS_URL_FILE');
  }
  if (trustProxy && !isIP(trustProxy)) throw new Error('TRUST_PROXY_IP must be a single IP address');
  if (stunUrls.some(url => !/^stuns?:[^\s]+$/.test(url)) || turnUrls.some(url => !/^turns?:[^\s]+$/.test(url))) {
    throw new Error('Invalid STUN or TURN URL');
  }
  if ((turnUrls.length || forceRelay) && (!turnUrls.length || !turnSecret)) {
    throw new Error('TURN requires a configured URL and a shared secret of at least 32 characters');
  }
  return {
    port, host: env.HOST || '127.0.0.1', origins, trustProxy, stunUrls, turnUrls, turnSecret, forceRelay,
    nodeId, rateStoreUrl, localTurn,
    maxFileBytes: env.MAX_FILE_MIB ? number('MAX_FILE_MIB', 0, 1, Math.floor(Number.MAX_SAFE_INTEGER / MiB)) * MiB : null,
    inviteMs: number('INVITE_TTL_SECONDS', 600, 1, 600) * 1000,
    activeMs: number('ACTIVE_TTL_SECONDS', 7200, 1, 86400) * 1000,
    rateWindowSeconds: number('RATE_LIMIT_WINDOW_SECONDS', 60, 1, 3600),
    createLimit: number('RATE_LIMIT_CREATE', 20, 1, 1000),
    joinLimit: number('RATE_LIMIT_JOIN', 60, 1, 2000),
    signalBurst: number('RATE_LIMIT_SIGNAL_BURST', 100, 1, 1000),
    signalRate: number('RATE_LIMIT_SIGNAL_PER_SECOND', 25, 1, 1000),
  };
}

export type Config = ReturnType<typeof readConfig>;
