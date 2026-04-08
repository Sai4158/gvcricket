# GV Cricket Architecture

GV Cricket is a Next.js App Router application for live cricket scoring. The repo keeps the framework-facing shape in `src/app`, then organizes most product code by feature through `components`, `lib`, `models`, and `tests`.

## Request and render flow

1. App Router entry files in `src/app/**/page.*` or `src/app/api/**/route.js` receive the request.
2. Route files stay thin: they load data, enforce access, and pass control to feature components or helpers.
3. Shared server-side loading lives in `src/app/lib`.
4. Mongoose models in `src/models` define persisted session, match, settings, and audit records.
5. Client screens in `src/app/components/**` handle browser interaction, live updates, walkie audio, announcer audio, and UI state.
6. Tests in `tests` validate pure helpers, live flows, security rules, and major regressions.

## Main feature areas

- `src/app/components/home`: public landing page and product storytelling.
- `src/app/components/session`: session list and session setup UI.
- `src/app/components/toss`: toss flow and toss choice UI.
- `src/app/components/match`: umpire scoring screen and related helpers.
- `src/app/components/session-view`: spectator live score screen.
- `src/app/components/director`: director console for walkie, PA audio, music, and effects.
- `src/app/components/live`: shared real-time, speech, mic, and walkie hooks.
- `src/app/components/result`: final result, scorecard, and insights UI.
- `src/app/components/shared`: reusable presentation and interaction primitives.
- `src/app/lib`: cross-feature domain logic, data loading, security, audio, and serialization.

## Data ownership

- `Session` owns setup-time details such as teams, toss data, and live session metadata.
- `Match` owns ball-by-ball live scoring, announcer state, sound-effect settings, and result data.
- `WalkieState`, `WalkieMessage`, `DirectorSettings`, and `AnnouncerSettings` support live communication and director tooling.

## Refactor rules used in this repo

- App Router files keep framework-required names and stay small.
- React components use `PascalCase`; hooks use `useX`; non-React helper files use lowercase kebab-case.
- Large feature files should move pure helpers into adjacent helper modules before deeper UI decomposition.
- Internal import moves should preserve stable behavior through compatibility re-exports when needed.

## Start here by task

- Need a new public page section: start in `src/app/page.js` and `src/app/components/home`.
- Need to change scoring behavior: start in `src/app/lib/match-engine.js`, then `src/app/components/match`.
- Need to change live spectator behavior: start in `src/app/components/session-view` and `src/app/components/live`.
- Need to change director tools: start in `src/app/components/director` and `src/app/components/live`.
- Need to change API behavior: start in `src/app/api/**/route.js` and `src/app/lib`.
