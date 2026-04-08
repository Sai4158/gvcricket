# Read This First

If you are new to this repo, read in this order:

1. `docs/ARCHITECTURE.md`
2. `src/app/README.md`
3. `src/app/components/README.md`
4. `src/app/lib/README.md`
5. `tests/README.md`

## Fast orientation

- Public landing page: `src/app/page.js`
- Session list/setup: `src/app/session/**`
- Toss flow: `src/app/toss/**`
- Umpire screen: `src/app/match/[id]/page.js`
- Spectator live view: `src/app/session/[id]/view/page.jsx`
- Director console: `src/app/director/page.jsx`
- Result screen: `src/app/result/[id]/page.jsx`

## Development loop

- Install dependencies with `npm install`
- Run the app with `npm run dev`
- Run lint with `npm run lint`
- Run tests with `npm test`
- Run type checks with `npm run typecheck`

## How to debug safely

- Pure business rules usually live in `src/app/lib`.
- Browser-only behavior usually lives in `src/app/components/live` or feature-specific client files.
- If a test imports a UI file directly, check whether the logic should live in an adjacent helper module instead.
- When a file feels too large, extract pure helpers first, then split UI sections or hooks second.

## Beginner navigation tips

- Start from the route file, then follow the main component import.
- Inside a feature folder, look for the README before reading the biggest file.
- In large screens, look for helper modules next to the main client file. Those modules usually hold the pure logic you can understand first.
