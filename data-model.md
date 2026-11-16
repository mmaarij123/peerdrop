# Data model

PeerDrop has no persistent transfer records, file storage, or migrations. Each signaling process owns its own sessions and recent outcomes. Restarting that process clears both. In the load-balanced setup the two-character ID prefix identifies the owner.

| Record | Fields and lifecycle |
| --- | --- |
| Session | Random ID, role token hashes, one control socket slot per role, FilePizza channel reference, receiver PeerJS ID, deadline, and stage (`waiting`, `ready`, `peer_ready`). Created by `POST /api/transfers` and removed at a terminal outcome. Both role slots filling replaces the invite deadline with the active deadline. |
| FilePizza channel | Uploader PeerJS ID, short and long aliases, a renewal secret, and a shared expiration time. The invite routes use PeerDrop's session ID. The channel starts with the invite deadline, renews once both participants join, and is removed with the session. Aliases and the renewal secret stay server-side. |
| PeerJS grant | A registration token hash, paired peer ID, socket slot, and message allowance for each participant. Granted after both roles authenticate and revoked when the session ends. PeerJS keeps temporary client registration state during negotiation. |
| Recent terminal invite | Role token hashes, outcome, and purge time. Distinguishes expiry from reuse for valid holders. Kept for up to 10 minutes with a 5,000-record cap. |
| Socket and rate counters | Heartbeat and traffic allowance for control sockets. HTTP creation and upgrade counters live in local memory or in Redis, with separate buckets and an expiry set on the first request. Both WebSocket routes share the upgrade bucket. |
| Browser transfer | Sender `File`, validated metadata and byte counts, and receiver data grouped into blocks of up to 256 KiB. For files over 32 MiB, blocks go to a temporary file in origin-private browser storage. The receiver checks the byte count before offering a download. It revokes the download URL and requests deletion of the temporary file on page exit or failure. |

When Web Locks are available, the receiver holds a lock for each temporary file until disposal. Starting another disk-backed transfer can reclaim abandoned files created under this scheme. Active transfers and pending downloads in other tabs retain their locks and are skipped.

The primary lookup is by session ID. The terminal cache evicts the oldest entry when it reaches capacity. Standalone mode keeps up to 10,000 unexpired bucket entries in memory. Shared Redis keys contain a hash of the IP and expire after the configured window. The Compose Redis service disables persistence. The signaling service never stores the filename, MIME type, or file bytes.

The theme toggle writes only `light` or `dark` to the browser's local site storage. The setting stays in that browser and is never sent to the server. Clearing site data restores the device theme.
