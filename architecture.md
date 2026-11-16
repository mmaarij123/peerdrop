# Architecture

```text
Sender browser ── HTTPS/WSS ── Caddy ── Fastify 01 or 02
Receiver browser ─ HTTPS/WSS ──┘          ├── local FilePizza channels and PeerJS signaling
                                          └── shared Redis rate counters
Sender browser ═════════ ordered WebRTC DataChannel ═════════ Receiver browser
                                optional coturn relay
```

Fastify serves `dist/` and two WebSocket routes on one origin. The PeerDrop control socket pairs separate sender and receiver role tokens, renews the in-memory FilePizza channel when both join, and gives each role its own PeerJS registration credentials. The embedded PeerJS server carries SDP and ICE for the registered pair. Once the sender registers, the receiver initiates the PeerJS connection and the sender answers. [Vendored FilePizza source and adaptations](src/filepizza/README.md)

Both browsers fetch the optional file-size limit from `/api/config` and get ICE settings through the authenticated control socket. They exchange consent, file metadata, binary chunks, an end marker, and an acknowledgment through a reliable, ordered WebRTC DataChannel. The receiver verifies the byte count, prepares the complete file, and acknowledges receipt. The sender reports completion over the control socket. The server invalidates the invite and broadcasts the outcome. The sender can still report delivery if the receiver disconnects after its acknowledgment arrives. A failed transfer requires a fresh invite.

| Path | Responsibility |
| --- | --- |
| `frontend/` | Build-time React pages, Lightswind components, styles, and Kubai SVG artwork |
| `dist/` | Generated HTML with embedded icons and CSS served by Fastify |
| `dist/motion.js`, `dist/transfer.js` | Browser motion, transfer UI and shared state model |
| `dist/connection.js` | Control socket, PeerJS client, raw DataChannel setup, and connection stats |
| `dist/channel.js` | Consent, chunking, backpressure, validation, and Blob creation |
| `dist/receive-storage.js` | Browser-private temporary files and cleanup for large downloads |
| `src/local-turn.ts`, `deploy/local-turn/` | Optional development-only TURN/TCP relay bound to IPv4 loopback |
| `src/server.ts`, `src/config.ts` | HTTP and WebSocket service and environment validation |
| `src/signaling.ts`, `src/protocol.ts` | Invite sessions, role checks, control messages, and temporary TURN credentials |
| `src/filepizza/`, `src/filepizza-peer.ts` | FilePizza's channel repository and the PeerJS session-authenticated adapter |
| `src/rate-limit.ts`, `src/http-errors.ts` | Shared or local request quotas and consistent HTTP error responses |
| `Dockerfile`, `compose.yaml`, `Caddyfile` | VPS deployment example |
| `.openai/hosting.json` | Legacy static deployment identity |

Run a single app locally or two named nodes with the VPS example. Caddy checks `/healthz` and balances unpinned HTTP requests. Each session ID begins with its owner's two-digit node ID. Both peers connect to that owner through `/ws/signaling/<sessionId>` and `/peerjs/<nodeId>/filepizza/peerjs`. A lost node invalidates its in-memory sessions and channels. Healthy nodes can still create invites when Redis is available. Redis holds rate counters. Its outage blocks new creations and WebSocket upgrades while established connections can continue.

Each Fastify process caps live sessions at 500 and control sockets at 1,200. Each session can register two PeerJS participants. File bytes travel over WebRTC. TURN bandwidth, ports, and allocation quotas constrain relayed connections. The receiver assembles files up to 32 MiB in memory and streams larger files into the browser's origin-private file system. The sender waits for write acknowledgments to bound queued data. The legacy static hosting manifest describes the landing-only deployment. See [README.md](README.md) for local and VPS commands.
