import { fileURLToPath, pathToFileURL } from 'node:url';
import { createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import { readConfig, type Config } from './config.js';
import { frameLimit, registerSignaling } from './signaling.js';
import { idPattern } from './protocol.js';
import { httpError } from './http-errors.js';
import { makeRateLimiter } from './rate-limit.js';
import { startLocalTurn } from './local-turn.js';
import { registerFilePizzaPeer } from './filepizza-peer.js';

const resolvePackage = createRequire(import.meta.url).resolve;
const peerClient = join(dirname(resolvePackage('peerjs')), 'peerjs.min.js');

const errors: Record<number, string> = {
  400: 'invalid_request', 403: 'forbidden', 404: 'not_found', 405: 'method_not_allowed',
  413: 'payload_too_large', 415: 'unsupported_media_type', 429: 'rate_limit', 503: 'unavailable',
};

export async function makeServer(config: Config) {
  const app = fastify({ logger: false, bodyLimit: 1024, trustProxy: config.trustProxy ?? false });
  app.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    });
    if (request.url.startsWith('/api/') && request.method === 'POST' && !config.origins.includes(request.headers.origin ?? '')) {
      return httpError(reply, 403, 'origin');
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode;
    if (status && errors[status]) return httpError(reply, status, errors[status]);
    console.error('PeerDrop request failed');
    return httpError(reply, 500, 'server_error');
  });
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0];
    if (path === '/api/transfers') return httpError(reply.header('Allow', 'POST'), 405, 'method_not_allowed');
    if (/^\/ws\/signaling(?:\/[a-f0-9]{32})?$/.test(path)) return httpError(reply.header('Allow', 'GET'), 405, 'method_not_allowed');
    if (path === '/api/config' || path === '/healthz') {
      return httpError(reply.header('Allow', 'GET, HEAD'), 405, 'method_not_allowed');
    }
    return httpError(reply, 404, 'not_found');
  });
  await app.register(websocket, { options: { maxPayload: frameLimit, perMessageDeflate: false }, errorHandler: (_error, socket) => socket.terminate() });
  await app.register(staticFiles, {
    root: fileURLToPath(new URL('../dist/', import.meta.url)), serve: false, cacheControl: false,
  });

  app.get('/', (_request, reply) => reply.sendFile('index.html'));
  app.get('/send', (_request, reply) => reply.sendFile('transfer.html'));
  app.get('/how-it-works', (_request, reply) => reply.sendFile('how-it-works.html'));
  app.get('/privacy', (_request, reply) => reply.sendFile('privacy.html'));
  app.get('/terms', (_request, reply) => reply.sendFile('terms.html'));
  app.get('/vendor/peerjs.min.js', (_request, reply) => reply.type('text/javascript; charset=utf-8').send(createReadStream(peerClient)));
  app.get<{ Params: { id: string } }>('/receive/:id', (request, reply) => {
    if (!idPattern.test(request.params.id) || request.url !== `/receive/${request.params.id}`) return httpError(reply, 400, 'invalid_invite');
    return reply.sendFile('transfer.html');
  });
  for (const path of ['styles.css', 'mark.svg', 'motion.js', 'transfer.js', 'connection.js', 'channel.js', 'receive-storage.js', 'fonts/Geist-Variable.woff2', 'fonts/LICENSE.txt']) {
    app.get(`/${path}`, (_request, reply) => reply.sendFile(path));
  }
  const rateLimit = makeRateLimiter(app, config);
  const signaling = registerFilePizzaPeer(app, config, rateLimit);
  registerSignaling(app, config, rateLimit, signaling);
  return app;
}

async function start() {
  let config: Config;
  try { config = readConfig(); } catch (error) {
    console.error(`PeerDrop configuration error: ${error instanceof Error ? error.message : 'invalid configuration'}`);
    process.exitCode = 1;
    return;
  }
  let app: Awaited<ReturnType<typeof makeServer>> | undefined;
  let relay: Awaited<ReturnType<typeof startLocalTurn>> | undefined;
  try {
    if (config.localTurn) {
      relay = await startLocalTurn();
      config.turnUrls = [relay.url];
      config.turnSecret = relay.secret;
      config.forceRelay = true;
    }
    const server = await makeServer(config);
    app = server;
    const address = await server.listen({ host: config.host, port: config.port });
    console.log(`PeerDrop listening at ${address}`);
    if (relay) {
      console.log('Local TURN relay enabled for transfers on this computer.');
      relay.child.once('exit', () => {
        if (!server.server.listening) return;
        console.error('Local TURN stopped. Restart PeerDrop to restore transfers.');
        process.exitCode = 1;
        void server.close();
      });
    }
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
      void server.close().finally(() => relay?.stop());
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'EADDRINUSE') {
      console.error(`PeerDrop could not start because port ${config.port} is already in use. If PeerDrop is already running, open ${config.origins[0]}. To use another port, update PORT and PUBLIC_ORIGIN together.`);
    } else {
      console.error(config.localTurn && !relay
        ? 'Local TURN could not start. Run npm run build:local-turn.'
        : 'PeerDrop could not start. Check the port and environment settings.');
    }
    process.exitCode = 1;
    await app?.close();
    relay?.stop();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await start();
