# Testing

## Commands

Use the local setup in [README.md](README.md). Run `npm run check` for strict server and frontend TypeScript, `npm test` for Node integration and protocol checks, and `npm run test:e2e -- direct` for browser checks. Install Chromium with `npx playwright install chromium` or set `PEERDROP_BROWSER` to a compatible browser executable. Use `npm run test:e2e -- relay` with a reachable TURN REST server and its test-only environment settings for a separate forced-relay check.

## What to cover

- Control WebSocket tests cover origin validation, role and session binding, atomic receiver admission, role-specific commands, deadlines, socket timeout, TURN credentials, and frame and traffic limits. PeerJS tests cover role-specific grant validation, duplicate registrations, session-bound forwarding, traffic limits, and registration cleanup.
- Operations tests cover validated environment settings, secret files, HTTP status and error contracts, and invite creation on both standalone loopback addresses. Run `node tests/load-balancer.mjs https://drop.example.com` against a fresh test pool with `RATE_LIMIT_CREATE=4` to check owner routing and shared invite quotas. `PEERDROP_TEST_ORIGIN` can point the browser success test at the pool. Use a private test origin for both commands.
- DataChannel tests cover consent before reading, backpressure and cancellation, negotiated chunk size, malformed metadata, byte-count enforcement, and filename sanitization.
- Browser tests start at the landing CTA, use separate sender and receiver contexts, and compare downloaded bytes or SHA-256 hashes. They cover a 101 MiB disk-backed transfer, cancellation and temporary-file cleanup, zero-byte files, decline, expiry, duplicate joins, and interruption. Tests shorten the invite lifetime and slow file reads for reproducible expiry and interruption.
- The drop test checks hover feedback, ignores drops outside the picker, rejects multiple files, and compares the downloaded file byte for byte.
- The direct suite also checks that the receiver waits for the sender's PeerJS registration, pre-join reload preserves the invite, the sender can choose another file after a decline, and abandoned browser storage is reclaimed while another tab’s download stays available.
- Review layout and keyboard usability at 320, 768, and 1440 px when UI changes. Keep the file picker, invite, state, and progress readable and free of overflow.
- The public page regression checks the shared footer at all three widths, keyboard use of the FAQ, navigation to the guide without closing a transfer tab, and desktop and reduced-motion cursor behavior.
- Theme checks cover the device default, the sun and moon icons, keyboard and pointer activation, persistence across pages and reloads, and fit at 320 px.

## FilePizza integration verification

On November 16, 2026, the audit passed the build and TypeScript check, all 11 Node tests, all 17 direct Edge scenarios, and a forced local TURN transfer. The local Caddy and Redis pool passed owner routing, shared throttling, failover, and a byte-for-byte browser download. Caddy validation, the local TURN build and Go vet, and coturn wrapper syntax also passed. The npm audit reported no known dependency advisories at the time of the check.

On November 14, 2026, the TypeScript build and check and all 11 Node tests passed. Headless Microsoft Edge passed 14 direct-suite scenarios and a separate forced-relay download through a local Pion TURN server started by `npm start`. The test suite checked the selected path label and compared saved file bytes. The direct suite also checked the landing and sender layouts for horizontal overflow at 320, 768, and 1440 px. Edge and Helium completed separate forced-relay transfers in both directions using local TURN. Both browsers showed **Relayed**, and both downloads matched the source bytes.

Caddy configuration validation passed. A local Caddy and Redis pool with two Fastify processes passed owner routing, shared throttling, failover for new invites, and fail-closed behavior when Redis was unavailable. A browser download through that pool matched the original file byte for byte.

Running the public Compose stack, verifying coturn, checking public certificates and firewall rules, and transferring between Wi-Fi and mobile data remain to be verified. Follow the deployment steps in [README.md](README.md).

## Earlier cross-browser verification

Before the FilePizza integration, a direct-only test with Helium and Edge timed out. A local Pion TURN/TCP relay supported Edge-to-Helium and Helium-to-Edge transfers, with byte-for-byte downloads and the Relayed indicator in both directions.
