# GV Cricket 2.0

GV Cricket 2.0 is a Next.js cricket scoring app that keeps session setup, toss, live umpire scoring, spectator updates, director controls, and results in one flow.

## Start here

Read these files in order if you are new to the repo:

1. `docs/ONBOARDING.md`
2. `docs/COMMANDS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/MODULE_MAP.md`
5. `tests/README.md`

## Main entry points

- `/` -> `src/app/page.js`
- `/session` -> `src/app/session/page.js`
- `/toss/[id]` -> `src/app/toss/[id]/page.js`
- `/match/[id]` -> `src/app/match/[id]/page.js`
- `/session/[id]/view` -> `src/app/session/[id]/view/page.jsx`
- `/director` -> `src/app/director/page.jsx`
- `/result/[id]` -> `src/app/result/[id]/page.jsx`

The route files stay thin. Most work happens in stable public wrappers under `src/app/components/**`, which delegate into smaller internal folders such as `director/console`, `match/page`, `session-view/page`, `live/walkie`, and `home/how-it-works`.

## Run these commands

```bash
npm install
npm run dev
npm run lint
npm test
npm run typecheck
npm run build
```

Useful maintenance and verification commands:

```bash
npm run artifacts:normalize
npm run artifacts:adopt-root
npm run docs:headers
npm run verify:audit
npm run verify:root
```

See `docs/COMMANDS.md` for the full command guide.

## Folder map

- `src/app`: App Router pages, layouts, and API routes
- `src/app/components`: browser-facing feature UI, grouped by feature
- `src/app/lib`: shared domain logic, serializers, validation, audio, and server loaders
- `src/models`: Mongoose models
- `tests`: domain-organized test suites
- `scripts/maintenance`: repo maintenance scripts
- `scripts/verification`: typecheck, audit, and cleanliness checks
- `artifacts`: generated local logs and reports

## Artifacts

Generated logs and reports belong in `artifacts`, not the repo root.

Naming rule:

- logs: `task-name.log`, `task-name.out.log`, `task-name.err.log`
- walkie reports: `walkie-scenario.txt`
- stress reports: `walkie-stress-scenario.txt`
- smoke and audit reports: `probe-name.json`

- `artifacts/logs/dev`
- `artifacts/logs/e2e`
- `artifacts/logs/audit`
- `artifacts/logs/checks`
- `artifacts/reports/smoke`
- `artifacts/reports/stress`
- `artifacts/reports/walkie`

See `artifacts/README.md` for what goes where.

## Product areas

- Umpires: live scoring, undo, commentary, and scoring controls
- Spectators: live score view, speech announcements, and optional walkie access
- Directors: music, sound effects, loudspeaker tools, walkie controls, and session management

## Stack

- Next.js App Router
- React
- MongoDB with Mongoose
- Server-Sent Events
- Framer Motion
- Tailwind CSS
