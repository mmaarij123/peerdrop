# HTTP routes and protocols

| Method and path | Contract |
| --- | --- |
| `GET /`, `GET /send`, `GET /receive/:id` | HTML. The browser reads the receiver token from the URL fragment and removes it after signaling acknowledges the authenticated join. |
| `GET /privacy`, `GET /terms` | Public HTML pages for the Privacy Policy and Terms of Service. |
| `GET /how-it-works` | Public HTML guide to sending, receiving, saving, and getting help. |
| `GET /healthz` | `200` with `{ "status": "ok" }`. This checks Fastify. |
| `GET /api/config` | `200` with `{ "maxFileBytes": null }` by default, or a positive byte count when the operator sets a cap. |
| `POST /api/transfers` | Same-origin and empty body. Returns `201` with `{ sessionId, senderToken, inviteUrl, expiresAt }`. The ID is 32 lowercase hex characters, tokens are 64, and the expiry is ISO 8601. The URL points to `/receive/<id>#<receiverToken>`. |
| `GET /ws/signaling/:id` | Same-origin control WebSocket. The route ID must match the first message. JSON text frames up to 24 KiB. Standalone mode also accepts `/ws/signaling`. |
| `GET /peerjs[/<nodeId>]/filepizza/peerjs` | Same-origin PeerJS negotiation WebSocket with text frames up to 24 KiB. The authenticated control socket supplies the path prefix and role-specific credentials. The standalone path omits the node ID. |

HTTP API errors use `{ "error": "code" }`. Each successful creation makes a fresh invite. Coordinate breaking changes across both clients and server.

| HTTP status | Error codes and behavior |
| --- | --- |
| `400` | `invalid_request` for malformed input, `unexpected_input` for a creation body or query, or `invalid_invite` for malformed invite or signaling paths. |
| `403` | `origin` when the browser origin is missing or outside the allowlist, or `invalid_peer` when a PeerJS registration credential is invalid. Standalone HTTP development accepts `localhost` and `127.0.0.1` on the configured port. |
| `404` | `not_found` for unknown routes or a signaling route owned by another node. |
| `405` | `method_not_allowed` on API and health routes, with an `Allow` header. |
| `409` | `peer_registered` when a PeerJS registration already has an open socket. |
| `413`, `415` | `payload_too_large` or `unsupported_media_type`. Fastify's request body limit is 1 KiB. |
| `426` | `upgrade_required` with `Upgrade: websocket` for an ordinary GET on a valid WebSocket route. |
| `429` | `rate_limit`, with `Retry-After` in seconds until the window resets. |
| `500` | `server_error`, with no internal diagnostic details in the response. |
| `503` | `capacity`, `rate_store_unavailable`, or proxy `upstream_unavailable`, with `Retry-After: 5`. |

## Control WebSocket

- The first message is `{ type: 'auth', sessionId, token }`. The server replies `{ type: 'joined', role }` and sends `{ type: 'ready', rtc, peerPath, uploaderPeerID, peerId, peerToken, transferKey }` to each role once both join. `peerPath` is the PeerJS path prefix, `peerToken` is specific to the role's `peerId`, and both roles receive the same `transferKey`. The RTC configuration includes temporary TURN credentials when configured.
- After its PeerJS socket registers, the sender sends `{ type: 'peer_ready' }`. The server forwards the event to the receiver, which waits until its own PeerJS socket registers before opening the connection.
- Either role can send `{ type: 'end', outcome }` for cancellation or failure. After sender readiness, only the receiver can send `declined` and only the sender can send `completed`. The server broadcasts `{ type: 'ended', outcome }`, with `disconnected` set to the departing role when a control socket drop ended the session. It then closes both control sockets.
- Rejections use `{ type: 'error', code }`. Valid holders of a recently closed invite see `expired` or `used`. Unknown, stale, or invalid invites get `unavailable`.
- A control socket has five seconds to authenticate. Authenticated and unauthenticated messages share the same per-socket allowance, which starts at 100 and replenishes at 25 messages per second by default. The server checks control socket liveness with a ping every 15 seconds.

## PeerJS negotiation WebSocket

- The same-origin PeerJS client registers with `id`, `token`, and `key=peerjs` in its upgrade query. The first two values come from `peerId` and `peerToken` in `ready`. The server admits one registration socket per grant and restricts data-connection offers, answers, and ICE candidates to the opposite participant in that session.
- The receiver makes the offer, the sender answers, and both use PeerJS to exchange ICE candidates. The sender checks the shared `transferKey` in the incoming DataConnection metadata before using its raw DataChannel.
- The default limits are 20 invite creations and 60 WebSocket upgrade attempts per IP in each one-minute window. Both WebSocket routes share the upgrade quota and the pool shares the counters through Redis. PeerJS messages also use the configured 100-message burst and 25-message-per-second replenishment by default.

## DataChannel

The reliable ordered channel is `peerdrop-file`. Commands carry `transferId`. The sender sends `metadata` with `name`, `size` in bytes, and `mime`. The sender sanitizes the filename and shortens it to fit common filesystem limits. The receiver validates the metadata and sanitizes the name again before offering a download. The receiver sends `accept` or `decline`. Only after `accept` does the sender send binary chunks and then `end`. The receiver checks the count, prepares a Blob, and sends `ack`. Either side can send `cancel` when the channel is open. Signaling also carries terminal outcomes so cancellation works while the channel is connecting.

The sender slices at up to 16 KiB, bounded by the negotiated SCTP message size when available. At 512 KiB of queued data, it waits for the buffer to reach the 128 KiB low threshold. Cancellation or channel closure aborts the wait. The receiver rejects excess bytes and an early `end`. An empty file uses `end` and `ack` without binary chunks.

For a disk-backed transfer, the sender advertises `flowControl: true` in `metadata` and the receiver includes `window: 1048576` in `accept`. As the receiver writes blocks, it sends `credit` with the cumulative bytes written. The sender keeps uncredited bytes within the agreed window. The final `ack` follows a successful close and byte-count check of the stored file.
