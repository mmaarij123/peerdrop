# Working on PeerDrop

Build and maintain PeerDrop within the milestone agreed with the owner. Read [context.md](context.md) and [decisions.md](decisions.md) first. Use the table below to find the docs that govern the change. Favor DRY, KISS, and YAGNI. Follow the build-time React, browser module, and TypeScript service patterns. Run the checks in [testing.md](testing.md) that cover the change.

## Documentation is part of every update

For each project change, including docs-only changes, update [decisions.md](decisions.md) in the same change. Add a dated progress entry with what changed, why, verification and its result, and any open work. Record significant choices in the decision log with the alternatives considered and the rationale.

Update every document whose facts, instructions, or scope changed. If only implementation details changed, the progress entry is sufficient. If implementation and documentation disagree, check the milestone and the code, then correct the relevant source of truth before calling the work complete.

| Change | Update |
| --- | --- |
| Install, startup, configuration, or operator instructions | [README.md](README.md) |
| Product scope, audience, or milestone | [context.md](context.md) |
| UI, copy patterns, responsive layout, or accessibility | [design.md](design.md) |
| Modules, data flow, hosting, or deployment | [architecture.md](architecture.md) |
| Project structure, code standards, or tooling | [conventions.md](conventions.md) |
| Trust boundaries, secrets, authorization, or sensitive data | [security.md](security.md) |
| Routes, payloads, statuses, or compatibility | [api.md](api.md) |
| Persistence, entities, relationships, or migrations | [data-model.md](data-model.md) |
| Test commands, coverage expectations, or acceptance checks | [testing.md](testing.md) |
| Agent workflow or documentation maintenance rules | [AGENTS.md](AGENTS.md) |

For a full documentation refresh, read every project-owned Markdown file and compare commands, defaults, limits, state transitions, and deployment claims with the source and test evidence. Distinguish checks run during the refresh from earlier results and pending deployment checks.

## Decisions that need the owner

Ask before expanding the agreed milestone, changing the site's audience, introducing a paid service, or making an irreversible change to user data. Follow the human-review requirements in [security.md](security.md). Use judgment for routine reversible edits, and include relevant checks and unresolved gaps in the handoff.
