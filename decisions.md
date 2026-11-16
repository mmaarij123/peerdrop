# Decisions and progress

## Decision log

| ID | Date | Decision | Alternatives and rationale |
| --- | --- | --- | --- |
| 001 | 2026-11-13 | Launch a public informational page with a labeled static transfer preview. | An interactive prototype or live transfer would imply capabilities outside the milestone. The preview explains both devices and clearly states availability. |
| 002 | 2026-11-13 | Use semantic HTML and CSS with native navigation and FAQ controls. Serve `dist/` through Sites. | A frontend framework or custom accordion would add a build or script layer for behavior the browser already supports. |
| 003 | 2026-11-13 | Keep project documentation at the repository root and record every update here. | A single long brief would mix product, implementation, and history. The root documents give each topic an owner file while this log preserves chronology. |
| 004 | 2026-11-13 | Serve the existing HTML and CSS and new browser modules from one Fastify and TypeScript origin. | The static host cannot run the requested persistent Node WebSockets. Reusing the static frontend avoids a framework migration. |
| 005 | 2026-11-13 | Use ordered WebRTC with bounded chunks and in-memory sessions. Provide coturn as the deployment relay. | HTTP file uploads would route file contents through the app server. A database and resumable transfers are outside the current one-file session design. |
| 006 | 2026-11-13 | Balance new invites with Caddy, pin signaling to the owning process, and share request quotas through Redis. | IP or cookie affinity can separate peers on different networks. A session ID prefix routes both peers to the correct process while Redis makes quota decisions consistent across the pool. |
| 007 | 2026-11-14 | Reuse FilePizza's in-memory channel repository and PeerJS signaling behind PeerDrop's invite authorization. | Running upstream unchanged would replace the PeerDrop interface and expose a different channel API. Adapting the backend keeps the existing invite and receive flow while using FilePizza's negotiation stack. |
| 008 | 2026-11-14 | Render Lightswind components and Kubai icons at build time. | Fastify can serve the generated pages on the existing routes, while the native browser modules continue to manage interactive transfer state. |

## Progress log

Add the newest entry first. Record the date, change and reason, verification, and any open work. Only report checks that were run.

### 2026-11-16 · File transfer protocol in the README

- Documented the invite, FilePizza and PeerJS signaling, recipient consent, WebRTC chunks, TURN relay, and delivery confirmation in the README. Checked the explanation against the browser modules and API contract and checked the Markdown links and diff whitespace.

### 2026-11-16 · Project audit and private GitHub handoff

- Fixed a landing-page typo and made download names safe for long Unicode filenames and reserved device names. Removed unused Lightswind component variants and Kubai SVGs and dropped a development dependency used only by those variants.
- Updated the local setup, file-transfer instructions, and project layout in the README. Added an empty `.secrets/.gitkeep` and expanded ignore rules for private configuration and local build and test artifacts.
- Passed clean-snapshot installation and build, the TypeScript check, 11 Node tests, 17 direct Edge scenarios, a forced local TURN download, Caddy validation, Go vet, and local two-node routing and failover checks. Checked staged files and existing Git history for private configuration, local build output, and recognizable credentials. The Linux VPS Compose deployment and transfers across real networks still need verification.

### 2026-11-15 · Drag-and-drop file selection

- Added an outlined drop zone to the sender's file picker. A drop selects one file and applies the same configured size check as browsing. Invalid drops show a message. The sender still selects **Create invite link** to continue.
- The frontend build, TypeScript check, all 11 Node tests, and all 17 Edge scenarios passed. Edge downloaded a dropped file byte for byte and checked multiple-file, folder, outside-zone, and size-limit handling. The browser suite uses a higher test-only join quota because all its browser contexts share one IP.

### 2026-11-15 · Glowing Kubai cursor

- Replaced the dot with Kubai's cobalt pointer SVG. The tip tracks the click position, the glow brightens over controls, and the pointer briefly shrinks when pressed. Native cursors apply to touch, editable fields, disabled controls, reduced motion, and forced colors.
- The frontend build, TypeScript check, script syntax check, and all 16 direct Edge scenarios passed. Separate browser checks verified the glow state, press feedback, clicking through the cursor, native fallbacks, and viewport edges in both themes.

### 2026-11-15 · Reverted the Impeccable redesign

- Restored the previous cobalt layouts and homepage copy at the owner's request, including the side-by-side transfer preview and dedicated sender page. Restored the design documentation and removed the brief introduced by the redesign.
- The frontend build, TypeScript check, motion script syntax check, and diff whitespace check passed. Verified both themes in Edge at 320, 768, and 1440 px and completed a byte-for-byte transfer from the restored sender.

### 2026-11-15 · Impeccable frontend redesign and Unslop copy review

- Used the browser audit to loosen headings, flatten panels, make the example transfer span the homepage, and give the dedicated sender and receiver a clearer form layout. Kept the existing Geist font, cobalt identity, and routes. Added the product brief used by Impeccable.
- Applied Unslop to the revised homepage copy. Replaced the repetitive headline with a description of the tool, clarified the invite and account wording, and fixed a typo. Preservation and hard-phrase checks passed.
- The build, TypeScript check, all 11 Node tests, and all 16 direct Edge scenarios passed, including a byte-for-byte download. Checked light and dark layouts at 320, 768, and 1440 px, and verified focus, reduced motion, and key contrast pairs.

### 2026-11-14 · Restored the cobalt landing page

- Reverted the live-sender homepage redesign at the owner’s request. Restored the cobalt landing page, animated preview, use-case list, and separate sender screen linked through **Send a file**. Restored the previous transfer and reading layouts.
- The frontend build, TypeScript check, and browser script syntax checks passed. All 16 direct Edge scenarios passed, including the byte-for-byte download from the restored landing page. Confirmed the local server on port 4174 serves the restored homepage and sender.

### 2026-11-14 · Live sender on the homepage

- Replaced the marketing headline, extra click to send, and use-case rows with the working file picker and invite controls. Kept the labeled animation as a small reference next to the sender. Reused the same transfer panel on the homepage, `/send`, and receive links. Simplified the FAQ and reading layouts.
- All 11 Node tests and 16 direct browser scenarios passed, including a byte-for-byte download started from the homepage. Checked light and dark layouts at 320, 768, and 1440 px. Verified that `/send` can still create an invite and reflect the receiver’s decision.

### 2026-11-14 · Minimalist frontend redesign

- Used the supplied Dribbble gallery as the visual reference. Rebuilt the landing page with a pale canvas, cobalt accent, animated transfer preview, divided use-case list, and two-column FAQ. Centered the send and receive panels and gave the guide and policy pages a shared reading layout. Updated both themes and recolored the local Kubai SVGs.
- The build, TypeScript check, motion script syntax check, and all 11 Node tests passed. All 16 direct Edge scenarios passed, including a byte-for-byte transfer and a 101 MiB download checked by hash. Checked both themes across the public pages and send screen at 320, 768, and 1440 px, plus focus and reduced motion. Confirmed the local server on port 4174 serves the redesign.

### 2026-11-14 · Restored forest-green background

- Reverted the charcoal change at the owner’s request. The shared dark-mode background and browser theme color are forest green (#101914).
- The frontend build, motion script syntax check, and diff whitespace check passed.

### 2026-11-14 · Charcoal dark-mode background

- Set the shared dark-mode page background and browser theme color to the original PeerDrop charcoal (#0B0D10).
- The frontend build and motion script syntax check passed. Verified both theme colors on the home, send, guide, privacy, and terms pages in Edge at 320, 768, and 1440 px.

### 2026-11-14 · Reverted the Sentry redesign

- Restored the previous cream and forest themes, green Kubai artwork, and preview animation at the owner's request. Removed the added homepage reveals and transfer and reading page entrances.
- The frontend build, TypeScript check, and motion script syntax check passed. Verified light and dark layouts, keyboard operation of the FAQ, and the sender link in Edge at 320, 768, and 1440 px. Checked the preview loop and reduced-motion behavior.

### 2026-11-14 · Sentry-inspired palette and motion

- Chose the Sentry reference from the shared VoltAgent DESIGN.md collection. Applied violet, lavender, and lime across both themes on all public and transfer pages, and recolored the Kubai artwork.
- Added staggered page entrances, homepage section reveals, and motion for key transfer states. The preview loops its lime pulse and drifting dots while visible. Reduced-motion preferences apply throughout.
- The frontend build, TypeScript check, and JavaScript syntax check passed. Verified both themes at 320, 768, and 1440 px, including reduced motion, FAQ keyboard use, and preview playback. All 16 direct Edge scenarios and a separate local relay transfer passed.

### 2026-11-14 · Keyboard focus outline

- Removed the page-sized outline on the main and FAQ landmarks while keeping them focusable for skip links and anchors. Interactive controls retain visible keyboard focus.
- The frontend build passed. Verified skip links, Tab navigation, and FAQ keyboard activation in Edge on mobile, tablet, and desktop widths.

### 2026-11-14 · Two-column FAQ

- Enlarged the FAQ heading and placed it to the left of the accordion on wider screens. At 650 px and below, the heading sits above the questions.
- The frontend build passed. Verified the layout and keyboard controls at 320, 650, 651, 768, and 1440 px in Edge.

### 2026-11-14 · Homepage FAQ alignment

- Aligned the FAQ heading and accordion with the homepage content edges. The FAQ and use cases now share a heading size, heading gap, and section padding.
- The frontend build passed. Verified matching edges, heading scale, and keyboard access at 320, 768, and 1440 px in Edge.

### 2026-11-14 · Button and icon hover

- Restored the visible FAQ heading above the questions and removed the How it works link from the shared header. The full guide remains linked in the footer and homepage actions.
- Replaced the primary button's abrupt background swap with a fading hover highlight. The button stays in place and Kubai artwork moves on pointer hover when reduced motion is off.
- The frontend build and TypeScript check passed. Verified button position and navigation, both hover effects, dark mode and reduced motion, and the header, footer, and FAQ at 320, 768, and 1440 px in Edge.

### 2026-11-14 · FAQ dropdown motion

- Removed the FAQ link from the shared header and the heading beside the homepage questions. Kept an accessible heading for the questions. Answers expand and collapse with a short transition in browsers that support it.
- Passed the frontend build and TypeScript check. Verified both animation directions at 320 and 1440 px, keyboard activation, the shared header, and reduced motion in Edge.

### 2026-11-14 · Dark mode

- Added a shared header toggle with Kubai sun and moon icons and a dark palette for public and transfer pages. PeerDrop follows the device theme until a visitor chooses a mode. The browser stores only the selected theme and syncs it across tabs.
- Passed the frontend build, TypeScript and JavaScript checks, and all 16 direct Edge scenarios. Verified the toggle, cross-tab behavior, and layout on every route at 320, 768, and 1440 px using the existing local server.

### 2026-11-14 · Kubai images on an already-running server

- Reproduced missing icons on port 4174. The running server served the new HTML but returned 404 for the new icon route. The build now embeds exported Kubai SVGs in each page and serves the paper-plane favicon through the existing `/mark.svg` route.
- The build, TypeScript check, and all 15 direct Edge scenarios passed. Verified all five pages and the favicon against the running server without restarting it.

### 2026-11-14 · Lightswind frontend redesign

- Rebuilt the landing page, transfer workspace, guide, privacy policy, and terms around a light paper-and-forest palette. The animated preview uses Kubai device and file artwork. Lightswind cards, raised buttons, and badges provide shared controls and surfaces.
- Added the build-time React templates, Tailwind styles, and local SVG generation. Updated the Docker build to generate and copy the frontend assets.
- The build and TypeScript checks passed. All 11 Node tests, 15 direct Edge scenarios, and a separate forced local relay download passed. Checked all page layouts and local icons at 320, 768, and 1440 px. Docker deployment was not exercised on a VPS.

### 2026-11-14 · Frontend copy edit

- Applied the unslop review to the landing page, guide, transfer screens, and legal drafts. Replaced vague or stiff wording in the transfer prompts and errors, clarified the guide’s file-size wording, and kept the policy and terms provisions intact.
- The strict preservation check passed for both legal pages. TypeScript and JavaScript checks passed, and all 15 direct Edge scenarios passed, including downloads, decline, cancellation, and invite expiry. The copy update is local.

### 2026-11-14 · Removed the preview pause button

- Removed the pause control from the transfer preview. The pulse, receiver highlight, and background dots continue looping while the preview is visible.
- Verified the preview in Edge at 320 and 1440 px, including the looping motion and reduced-motion setting. JavaScript syntax and whitespace checks passed.

### 2026-11-14 · Looping transfer preview

- Removed Replay. The mint pulse, receiver highlight, and gently drifting dot grid loop while the preview is visible. An icon in the caption pauses or resumes the motion. Animations pause offscreen and in hidden tabs. Reduced-motion mode shows the static preview.
- Verified more than two cycles, dot movement, pause and resume by mouse, touch, and keyboard, offscreen and hidden-tab behavior, and reduced motion in Edge at 320, 768, and 1440 px. TypeScript and JavaScript checks passed. The change is local.

### 2026-11-14 · Animated transfer preview

- Added a short animation that sends two mint pulses from the sender to the receiver and highlights the receiver as they arrive. It plays when the preview first enters view. Replay is available when motion is enabled.
- TypeScript and JavaScript checks passed. Verified packet motion, receiver feedback, replay by click, touch, and keyboard, and the static reduced-motion view in Edge at 320, 768, and 1440 px. The change is local.

### 2026-11-14 · Homepage use cases

- Replaced the homepage walkthrough with examples for sharing a video, a project, or a photo album. The header, hero, and footer link to the full How it works guide. From the transfer screen the guide opens in a separate tab.
- TypeScript check passed. Verified the use-case layout at 320, 768, and 1440 px, the guide and FAQ links, and that the guide opens without ending an active invite. The change is local.

### 2026-11-14 · Expanded privacy and terms drafts

- Expanded the Privacy Policy to explain transfer and connection information, what participants and providers can see, retention, temporary browser files, and privacy choices. Expanded the Terms of Service to cover file rights, invite handling, acceptable use, service limits, reports, and changes.
- Added in-page contents lists to both pages. Verified the build, TypeScript check, and all 11 Node tests. Edge checks covered links, keyboard navigation, layout at 320, 768, and 1440 px, and opening both drafts while an invite remained active.
- Before public release, confirm the operator's legal identity and contact channels, hosting and relay details, and applicable legal requirements.

### 2026-11-14 · Public guide and motion

- Added the How it works page, expanded the landing FAQ, and added **Made by Maarij** to all public footers. Removed the landing footer's Back to top link. The transfer footer opens the guide in a separate tab.
- Added brief entrance and control motion and a small mint dot that follows the mouse. The native pointer remains available for touch, reduced motion, forced colors, and form inputs. Rewrote public transfer messages, connection labels, and policy text in plain language.
- Passed the build, TypeScript check, all 11 Node tests, and 15 direct Edge scenarios. A separate forced local relay download matched the source bytes. Verified the guide and footer at 320, 768, and 1440 px and exercised touch, keyboard, reduced motion, and forced colors.
- The changes are in the local project. Public transfer deployment remains pending.

### 2026-11-14 · FilePizza backend integration

- Replaced the custom WebRTC negotiation with FilePizza's PeerJS stack and adapted its channel repository at commit `1e4d02f`. PeerDrop still serves its own screens, consent and cancellation controls, and incremental file protocol. The Fastify gateway authenticates both WebSockets, validates negotiation messages by role and session, and revokes registrations when an invite ends. Caddy routes both sockets to the owning node and filters the PeerJS registration token from request URIs in its logs.
- The TypeScript build and check, 11 Node tests, 14 direct Edge browser cases, and a forced TURN transfer through the normal startup command passed. Edge and Helium exchanged files in both directions through loopback TURN with matching bytes. Local Caddy and Redis verified owner affinity, shared quotas, failover, and a byte-identical browser download through the proxy. The npm audit reported zero vulnerabilities.
- VPS deployment, production coturn, and a transfer across two networks remain to be verified.

### 2026-11-14 · Code audit and cleanup

- Fixed sender recovery, invite visibility before signaling acknowledgment, HTTP requests that could wait indefinitely, and transfer cancellation during receive backpressure. Added safe reclamation for abandoned browser-private files when Web Locks are available. The receiver gives clearer guidance when the full invite link is needed.
- Moved Redis startup after the listener binds, fixed startup cleanup, and removed the redundant Redis-mode sweep timer, validation condition, and transfer state. Enabled TypeScript checks for unused code and kept the transfer status accessible as a heading.
- Verified 11 Node tests, the direct browser suite including the 101 MiB transfer and temporary-file cleanup, a forced TURN/TCP download, the local Caddy/Redis pool with failover, and an occupied-port startup with Redis configured. The dependency audit reported zero vulnerabilities. Caddy validation, Compose YAML parsing, and the coturn shell syntax check passed.
- The Linux Docker Compose deployment and separate-network transfer still require VPS verification. Browsers without Web Locks rely on normal temporary-file disposal or clearing site data.

### 2026-11-14 · Removed the default file-size cap

- Removed the 100 MiB default from the server, local environment, and Compose. An operator can still set `MAX_FILE_MIB` if needed. Receivers stream files over 32 MiB to browser-private temporary storage, with write acknowledgments bounding in-flight data. Updated the app copy, README, protocol notes, and privacy draft.
- All ten Node tests and the direct browser suite passed. A 101 MiB transfer produced matching SHA-256 hashes. Cancelling a disk-backed transfer removed its temporary file and left no downloadable partial file.
- Large transfers depend on compatible browser storage and available space. Restart existing app instances to load the new configuration.

### 2026-11-14 · Privacy Policy and Terms of Service

- Added draft legal pages at `/privacy` and `/terms` and linked them from the landing and transfer screens. The transfer links open in a separate tab so reading the pages preserves the active session.
- The build and all ten Node tests passed. Browser checks verified both routes, footer navigation, keyboard skip links, transfer tab preservation, and no horizontal overflow at 320, 768, and 1440 px.
- Before public release, add the operator’s name and contact details and review the wording for the deployment’s data handling and applicable law. The pages were verified locally and have not been published.

### 2026-11-13 · Cross-browser connection timeout

- Reproduced the local WebRTC timeout with Helium and Edge. Helium gathered no usable candidate in the direct-only test. Updated the connection failure message to distinguish standalone direct connections from a configured TURN relay.
- Edge-to-Edge direct transfer passed. With a temporary local TURN/TCP relay, transfers between Edge and Helium passed in both directions, including byte-for-byte downloads and the Relayed indicator. Verified the direct-only timeout guidance with the local app. The normal localhost setup remains direct-only.

### 2026-11-13 · Local invite creation

- Reproduced a `403 origin` when creating an invite at `127.0.0.1:4174`. Standalone HTTP development now accepts both loopback hostnames on the configured port. The sender shows a specific message when an address is rejected.
- All ten Node tests passed. Two browser transfers on a fresh test instance, one at each loopback hostname, produced byte-for-byte matching downloads. The terminal running PeerDrop on port 4174 needs a restart to load the rebuilt server.

### 2026-11-13 · Local startup conflict

- Found that the earlier preview still occupied port 4174. Added an explicit port-in-use error and documented how to restart a local instance.
- Reproduced the conflict, rebuilt, stopped the preview, and verified a fresh start, health response, and send page. Released port 4174 for the user's terminal.

### 2026-11-13 · Local environment

- Configured the ignored `.env` for standalone development at `http://localhost:4174` because ports 3000 and 4173 were occupied. The local server binds to loopback and uses in-memory rate limits. No Redis or TURN settings are required.
- Built and started PeerDrop with `npm.cmd start`. Verified health, the 100 MiB limit, invite creation with the configured origin, and authenticated WebSocket join and cancellation. Updated the README to preserve an existing `.env` during setup.

### 2026-11-13 · Load balancing and operational safeguards

- Added two-instance routing, shared rate limits, validated environment settings, mounted TURN secrets, explicit HTTP error responses, and browser retry messages. Updated deployment, architecture, protocol, security, and test documentation.
- Local Caddy, Redis, and two Fastify processes verified invite distribution, owner affinity, shared limits, healthy-node failover, and `503` responses for a lost owner or rate store. A browser download through the proxy matched the source bytes. The standalone direct browser suite and nine Node tests passed.
- The Linux Compose rollout, production secret mount, coturn integration, and separate-network verification still need a deployed environment and the human review in [security.md](security.md).

### 2026-11-13 · Full documentation refresh

- Reviewed and updated all 11 project Markdown files against the source and deployment examples. Clarified local origin settings, transfer UI behavior, signaling and buffering limits, TURN credential expiry, and the distinction between the public landing release and locally tested transfers.
- Verified the Markdown inventory and relative links. Reran the TypeScript check, build, and all seven Node tests. Browser results below come from the transfer milestone.
- Public deployment, human review, coturn verification, and the separate-network test remain pending.

### 2026-11-13 · Working file transfer

- Connected the landing CTA to the sender flow and updated the walkthrough and FAQ. Added receiver consent, progress, cancellation, and an explicit save action. Added role-bound signaling, invite lifecycle, TURN credentials, setup, and a VPS deployment example.
- TypeScript build and checks, seven Node protocol and integration tests, and local browser transfers passed. Direct and forced relay downloads matched the original bytes. Browser tests covered decline, cancellation from either side, expiry, a duplicate receiver, oversized and empty files, tab closure mid-transfer, and fresh links. Landing and sender layouts had no horizontal overflow at 320, 768, and 1440 px. The relay test used a local Pion TURN server. The Compose YAML parsed and npm audit found no vulnerabilities.
- Pending: human review of invite authorization and TURN credential handling, then run the provided Compose stack and verify certificates, coturn and firewall setup, and transfers between Wi-Fi and mobile data. The static landing deployment is still the earlier release.

### 2026-11-13 · Project documentation

- Added the product brief, design rules, architecture, conventions, security rules, HTTP contract, data model, testing strategy, agent instructions, and this log so future changes can be tracked alongside the code.
- Verification covers local document links, the documentation inventory, and agreement with the current source and hosting manifest.
- Open item: add the `/design` reference repository when its location is supplied.

### 2026-11-13 · Public landing page

- Published the PeerDrop landing page with the transfer preview, three-step walkthrough, and FAQ. [Live page](https://peerdrop.mmmv716.chatgpt.site/)
- Checked 320, 768, and 1440 px in Edge. Confirmed no horizontal overflow, readable preview filenames, working anchor links, keyboard FAQ controls, 44 px tap targets, and reduced-motion behavior. Sites reported a successful deployment.
- Future milestone: define the transfer flow contracts before implementing the file picker, share links, or browser-to-browser connection.
