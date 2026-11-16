import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from './config.js';
import { httpError } from './http-errors.js';

type Bucket = 'create' | 'join';
type Counter = { count: number; until: number };

// Set the expiry with the first increment in the same atomic operation.
const countRequest = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
  return {count, redis.call('PTTL', KEYS[1])}
`;

export function makeRateLimiter(app: FastifyInstance, config: Config) {
  const windowMs = config.rateWindowSeconds * 1000;
  const counters = new Map<string, Counter>();
  const redis = config.rateStoreUrl ? createClient({
    url: config.rateStoreUrl,
    disableOfflineQueue: true,
    commandsQueueMaxLength: 1000,
    socket: { connectTimeout: 1000 },
  }) : undefined;
  if (redis) {
    redis.on('error', () => {});
    // Binding can fail. Start Redis only once the HTTP server is listening.
    app.addHook('onListen', async () => { if (!redis.isOpen) void redis.connect().catch(() => {}); });
  }
  function removeExpired(now: number) {
    for (const [key, entry] of counters) if (entry.until <= now) counters.delete(key);
  }
  const sweep = redis ? undefined : setInterval(() => removeExpired(Date.now()), Math.min(windowMs, 60_000)).unref();
  app.addHook('onClose', async () => {
    clearInterval(sweep);
    if (redis?.isOpen) redis.destroy();
  });

  async function increment(bucket: Bucket, ip: string) {
    if (redis) {
      if (!redis.isReady) {
        if (!redis.isOpen) void redis.connect().catch(() => {});
        throw new Error('Rate store unavailable');
      }
      const key = `peerdrop:rate:${bucket}:${createHash('sha256').update(ip).digest('hex')}`;
      const result = await redis.withCommandOptions({ abortSignal: AbortSignal.timeout(1000) })
        .eval(countRequest, { keys: [key], arguments: [String(windowMs)] });
      if (!Array.isArray(result) || result.length !== 2) throw new Error('Invalid rate counter');
      const [count, remainingMs] = result;
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || typeof remainingMs !== 'number' || remainingMs < 0) {
        throw new Error('Invalid rate counter');
      }
      return { count, remainingMs };
    }
    const now = Date.now();
    const key = `${bucket}:${ip}`;
    let entry = counters.get(key);
    if (!entry || entry.until <= now) {
      if (!entry && counters.size >= 10_000) {
        removeExpired(now);
        if (counters.size >= 10_000) throw new Error('Rate store capacity');
      }
      entry = { count: 0, until: now + windowMs };
      counters.set(key, entry);
    }
    return { count: ++entry.count, remainingMs: entry.until - now };
  }

  return (bucket: Bucket) => async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { count, remainingMs } = await increment(bucket, request.ip);
      if (count > (bucket === 'create' ? config.createLimit : config.joinLimit)) {
        return httpError(reply, 429, 'rate_limit', Math.max(1, Math.ceil(remainingMs / 1000)));
      }
    } catch {
      return httpError(reply, 503, 'rate_store_unavailable', 5);
    }
  };
}
