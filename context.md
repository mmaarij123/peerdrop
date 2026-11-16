# PeerDrop project brief

PeerDrop sends a file from one person's browser to another. It is for people who want to share one file with a specific recipient through a link.

## Current milestone · Browser file transfer

The runnable project includes the landing page at `/`, a plain-language guide at `/how-it-works`, the sender screen at `/send`, and a receiver page reached through an invite. The frontend uses Lightswind components rendered to HTML at build time, Tailwind CSS, Kubai Icons, browser JavaScript, and local Geist. Node.js and TypeScript Fastify instances serve the app, manage one-time invites, and run the FilePizza channel repository and PeerJS signaling. The VPS example uses two instances with Caddy and shared Redis rate counters. Local checks are documented in [testing.md](testing.md). Public transfer deployment and verification on separate networks are pending. The public URL serves the earlier static landing release. [Public landing page](https://peerdrop.mmmv716.chatgpt.site/)

1. The sender drops a file into the send panel or uses the file picker, then creates an invite link.
2. The receiver opens the link, reviews the filename and size, and accepts or declines.
3. After acceptance, both browsers show progress. The receiver saves the complete file and the sender sees Delivered after acknowledgment. Both tabs stay open until transfer finishes, and either person can cancel while it is in progress.

Each invite is for one file, one sender, and one receiver. PeerDrop has no default file-size cap. Large transfers depend on the receiver's available browser storage. An unused invite expires after 10 minutes, and the active transfer gets a separate two-hour deadline once both tabs join. If an attempt fails, the sender can create a fresh invite. PeerDrop has no accounts, persistent transfer records, resumable transfers, or server file storage. Keep the UI usable at 320, 768, and 1440 px. Only claim behavior the implementation supports.

See [architecture.md](architecture.md) for implementation and [decisions.md](decisions.md) for dated progress.
