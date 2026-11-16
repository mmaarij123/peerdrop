# PeerDrop

PeerDrop sends one file from a sender's browser to a recipient's browser. The sender shares a one-time invite. The recipient reviews the file, accepts, and saves it after transfer. Both tabs stay open until delivery finishes.

The PeerDrop interface runs on a Fastify app that uses FilePizza's channel repository and PeerJS signaling setup. Both WebSocket routes use the same origin and port as the app. [Channel source and adaptations](src/filepizza/README.md) · [Upstream PeerJS server setup](https://github.com/kern/filepizza/blob/1e4d02fa91527d8dc83f4094ca394f8c29a88b56/bin/peerjs.js) · [FilePizza license](licenses/FilePizza.txt)

## Run locally

Install Node.js 24 or newer. From the repository root, run the commands for your shell.

### Windows PowerShell

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd ci
npm.cmd run build
npm.cmd start
```

### Linux or macOS

```sh
test -f .env || cp .env.example .env
npm ci
npm run build
npm start
```

Open the URL set by `PUBLIC_ORIGIN`. The example uses [http://localhost:3000](http://localhost:3000/). If that port is in use, stop the existing server with Ctrl+C or update `PORT` and `PUBLIC_ORIGIN` together. Standalone HTTP development accepts both `localhost` and `127.0.0.1` on the configured port. A remote device needs a reachable HTTPS origin.

1. Open **Send a file**. Drop a file into the outlined area or use the file picker.
2. Click **Create invite link** and open the link in a second browser or a private window.
3. Click **Accept**, wait for **Ready to save**, and click **Save file**. Keep both tabs open until the transfer finishes.

The app serves a transfer guide at `/how-it-works`, a draft Privacy Policy at `/privacy`, and draft Terms of Service at `/terms`. The policy describes what the app and the two browsers handle, what providers may see, and how long the app keeps transfer records. The terms cover using invites, file ownership, acceptable use, service limits, and reporting problems. Before public release, confirm the operator's legal name and contact details, hosting and relay providers, and logging and retention. Review both drafts for the laws that apply to the deployment.

The sample environment uses direct connections. If two browsers on the same computer cannot connect, install Go 1.24 or newer, run `npm run build:local-turn`, set `LOCAL_TURN=true` in `.env`, and restart with `npm start`. Wait for `Local TURN relay enabled` before creating an invite. The relay runs with the app, using a temporary secret and port. For two devices, use the deployment example below to set up HTTPS and a network-accessible relay.

There is no default PeerDrop file-size cap. Transfers over 32 MiB use browser-managed temporary storage on the receiver, so they depend on browser support, the browser's storage quota, and available disk space. Saving a separate copy may need additional space. Zero-byte files are supported. Unused links expire after 10 minutes. A separate two-hour deadline starts once both browsers join. If a transfer fails or either person cancels, create a fresh link. Restarting the owning app instance invalidates its active invites. The receiver's download is available while the completed page remains open.

After an attempt ends, choose **Create a fresh link** to retry the same file or **Choose another file** to start over. Once the receiver has joined, reloading or closing the invite page ends an unfinished transfer.

For several files, use a separate invite for each file or put them in one ZIP.

## Project layout

| Path | Role |
| --- | --- |
| `frontend/` | Page templates, styles, and icon sources |
| `dist/` | Generated pages and CSS, plus source browser modules and bundled fonts |
| `src/` | TypeScript server, signaling, and rate limits |
| `deploy/` | Local TURN helper and the coturn startup script |
| `tests/` | Protocol, server, browser, and load-balancer checks |

`npm run build` compiles the server into `build/` and renders the frontend into `dist/`. After editing the templates or CSS, run `npm run build:ui` and refresh. Keep local settings in `.env` and put deployment secret files in `.secrets/`. Git excludes both, with exceptions for the sample environment and the empty folder marker.

## Configuration

| Setting | Accepted values |
| --- | --- |
| `PUBLIC_ORIGIN` | Browser origin without a trailing slash. The standalone loopback setup also accepts the other local hostname on the configured port. Use HTTPS outside loopback. |
| `MAX_FILE_MIB` | Blank or unset for no app cap. Set a positive whole MiB value to impose an optional cap. Both clients read it from `/api/config`. |
| `INVITE_TTL_SECONDS` | 1–600 seconds from invite creation. |
| `ACTIVE_TTL_SECONDS` | 1–86,400 seconds from both roles joining. |
| `STUN_URLS`, `TURN_URLS` | Comma-separated server URLs. Both can be left blank for a local direct test. |
| `TURN_SHARED_SECRET_FILE`, `FORCE_RELAY` | Use the mounted secret file in production. Local tests may use `TURN_SHARED_SECRET`. Set `FORCE_RELAY=true` for relay-only testing. |
| `LOCAL_TURN` | Set `true` to start the optional built-in loopback TURN relay and force relay in standalone development. Leave external TURN settings and `FORCE_RELAY` unset or at their defaults. |
| `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_CREATE`, `RATE_LIMIT_JOIN` | Default window of 60 seconds, 20 invite creations and 60 WebSocket upgrade attempts per IP. The two WebSocket routes share the same join quota. Redis shares the limits across instances. A standalone process can use memory. |
| `RATE_LIMIT_SIGNAL_BURST`, `RATE_LIMIT_SIGNAL_PER_SECOND` | Defaults of a 100-message burst and replenishment at 25 messages per second per socket. |
| `RATE_LIMIT_REDIS_URL`, `RATE_LIMIT_REDIS_URL_FILE` | Use `redis://` or `rediss://`. Load an authenticated production URL from a secret file. Compose supplies a private, unauthenticated URL by default. |
| `SIGNALING_NODE_ID` | Leave unset for standalone use. Compose sets `01` and `02`. Both nodes require Redis and should use identical settings apart from their node ID. |

## Checks

```sh
npm run check
npm test
npx playwright install chromium
npm run test:e2e -- direct
```

`PEERDROP_BROWSER` can point to an installed Chromium-based browser executable. For a separate relay-only test, start a TURN service reachable by the test browser with TURN REST shared-secret authentication. Set `TURN_URLS` and `TURN_SHARED_SECRET` in the test process environment, then run `npm run test:e2e -- relay`. The test forces relay, checks both browsers report **Assisted connection**, and compares the saved file with the original. The direct suite leaves STUN and TURN unset and checks **Direct connection** on the local machine. See [testing.md](testing.md) for the verification record.

## Linux VPS deployment example

Include the `frontend/` and `dist/` directories in the source you copy to the VPS. The Docker build generates the pages and styles, and copies the browser transfer modules and fonts from `dist/`.

Review [security.md](security.md) before public rollout. This example uses two Fastify instances, Caddy for HTTPS and WSS, private Redis for rate counters, and coturn on the VPS host network. The public static landing release is separate.

1. Point `drop.example.com` and `turn.example.com` A records to the VPS public IPv4 address. Replace the example domains throughout the `.env` values. Use DNS-only records for TURN. On this IPv4 example, publish AAAA records only after configuring and testing IPv6.
2. Open inbound TCP **80 and 443** for Caddy, UDP and TCP **3478** for STUN/TURN, and UDP **49160–49259** for TURN relay allocations. Apply the rules at the VPS and cloud firewall. If the VPS is behind NAT, forward the same ports without translation. Allow coturn to send UDP from the relay range to remote clients. Keep port 3000 internal.
3. Copy `.env.example` to `.env` if needed and set `APP_DOMAIN=drop.example.com`, `PUBLIC_ORIGIN=https://drop.example.com`, `TURN_DOMAIN=turn.example.com`, `TURN_PRIVATE_IP` to the IP on the VPS interface, and `TURN_PUBLIC_IP` to its public IPv4. On a directly addressed host, use the same IP for both. Set `STUN_URLS=stun:turn.example.com:3478` and `TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp`. Leave the inline `TURN_SHARED_SECRET` blank. Create the mounted secret using the commands below.
4. Run the commands below. Caddy requests and renews the app certificate automatically. Keep its named volumes and leave ports 80 and 443 reachable. The provided TURN listener uses UDP and TCP on 3478. Where networks require TURN over TLS, provision a certificate for the TURN hostname separately, configure coturn with that certificate and key, open TCP 5349, and add a `turns:turn.example.com:5349?transport=tcp` URL. The Caddy app certificate does not configure TURN TLS. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https) · [coturn container documentation](https://github.com/coturn/coturn/blob/master/docker/coturn/README.md)

```sh
umask 077
mkdir -p .secrets
# Generate once. Replacing an existing secret is a planned rotation.
test -s .secrets/turn_shared_secret || openssl rand -hex 32 > .secrets/turn_shared_secret
sudo chgrp 1000 .secrets/turn_shared_secret
chmod 0640 .secrets/turn_shared_secret
chmod 0600 .env
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl --fail https://drop.example.com/healthz
```

Keep the two named app instances. Caddy balances new invites across healthy instances and routes the PeerDrop control and PeerJS negotiation WebSockets to the invite's owner. If that instance restarts or stops, the sender needs a new link. Both nodes share rate counters through Redis. Redis has no published port. If Redis is unavailable, new invites and WebSocket upgrade attempts return `503` until it recovers. The example trusts forwarded addresses only from Caddy's fixed Docker IP. If the Compose subnet conflicts with the VPS network, change the subnet and Caddy IP together with `TRUST_PROXY_IP`. The Caddy logger filters the PeerJS registration token from request URIs. Apply the same redaction at other HTTP logging layers. The TURN range and allocation quota bound relay concurrency.

The Compose secret file must be group-readable by GID 1000, which the Node image uses and coturn receives as a supplemental group. Compose mounts the file into each app and coturn. To rotate it, replace the file, restore group and permissions, and recreate all three consumers with `docker compose up -d --force-recreate app app2 coturn`. Existing sessions and TURN credentials can be interrupted. [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)

## Verify across real networks

1. Open the deployed app on a laptop on Wi-Fi. Select a test file and copy the invite. Open it on a phone with Wi-Fi off and mobile data on. Accept, watch the progress, and save the result. Copy the saved file back to the laptop if needed and compare SHA-256 hashes with `sha256sum original.bin received.bin` or PowerShell `Get-FileHash original.bin,received.bin`. Confirm **Delivered** appears after receipt and the connection is labeled **Direct connection** or **Assisted connection** when stats are available.
2. Run a separate relay-only round by setting `FORCE_RELAY=true` and applying it with `docker compose up -d app app2`. Start a fresh transfer, require **Assisted connection** on both devices, and compare hashes again. Set `FORCE_RELAY=false` and run the command again after the test. Recreating both app instances invalidates outstanding invites.
3. Repeat with both devices on the same network if the cross-network attempt uses TURN. To verify a direct path without relay fallback, run the Node app outside this Compose example with `TURN_URLS` unset and `FORCE_RELAY=false`, and require **Direct connection** on both devices. The supplied Compose example requires `TURN_URLS`. Network topology determines whether a direct route is available.

See [architecture.md](architecture.md) for the data flow and [api.md](api.md) for the signaling and DataChannel contracts.
