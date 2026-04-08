# Read This First

If you are new to this repo, read these files in order:

1. `README.md`
2. `docs/COMMANDS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/MODULE_MAP.md`
5. `src/app/README.md`
6. `src/app/components/README.md`
7. `src/app/lib/README.md`
8. `tests/README.md`

## Fast orientation

- Public landing page: `src/app/page.js`
- Session list and setup: `src/app/session/**`
- Toss flow: `src/app/toss/**`
- Umpire screen route: `src/app/match/[id]/page.js`
- Spectator live-view route: `src/app/session/[id]/view/page.jsx`
- Director console route: `src/app/director/page.jsx`
- Result screen route: `src/app/result/[id]/page.jsx`

## Main wrapper pattern

Most feature routes hand off to a stable public wrapper, then that wrapper hands off again to an internal folder.

Examples:

- `src/app/components/director/DirectorConsoleClient.jsx` -> `src/app/components/director/console`
- `src/app/components/match/MatchPageClient.jsx` -> `src/app/components/match/page`
- `src/app/components/session-view/SessionViewClient.jsx` -> `src/app/components/session-view/page`
- `src/app/components/live/useWalkieTalkie.js` -> `src/app/components/live/walkie`
- `src/app/components/home/HowItWorksSection.jsx` -> `src/app/components/home/how-it-works`

If you want the real implementation, open the internal folder README after the wrapper file.

## Development loop

- Install dependencies with `npm install`
- Run the app with `npm run dev`
- Run lint with `npm run lint`
- Run tests with `npm test`
- Run type checks with `npm run typecheck`
- Build the production app with `npm run build`

## How to debug safely

- Pure business rules usually live in `src/app/lib`.
- Browser-only behavior usually lives in `src/app/components/live` or feature-specific client files.
- If a test imports a UI file directly, check whether the logic should live in an adjacent helper module instead.
- When a file feels too large, extract pure helpers or isolated render sections first, then split deeper hook logic second.
- Generated logs and local reports belong in `artifacts`, not the repo root.

## Beginner navigation tips

- Start from the route file, then follow the main component import.
- Inside a feature folder, read the README before opening the largest file.
- In large screens, look for adjacent helper modules or internal folders first. They usually explain the feature faster than the main screen file.
