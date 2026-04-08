# GV Cricket Architecture

GV Cricket is a Next.js App Router application for live cricket scoring. The repo keeps framework-required files in `src/app`, then pushes most product behavior into feature folders under `components`, shared domain helpers under `lib`, persisted models under `src/models`, and domain-organized tests under `tests`.

## Start here

- Need the fastest repo walkthrough: `docs/ONBOARDING.md`
- Need commands: `docs/COMMANDS.md`
- Need a map of active folders and entry files: `docs/MODULE_MAP.md`

## Request and render flow

1. App Router entry files in `src/app/**/page.*`, `layout.js`, or `src/app/api/**/route.js` receive the request.
2. Route files stay thin: they load data, enforce access, and pass control to a stable public wrapper component or helper.
3. Stable public wrappers live in feature folders such as `src/app/components/director/DirectorConsoleClient.jsx` and `src/app/components/match/MatchPageClient.jsx`.
4. Large implementations are split behind those wrappers into internal folders such as `director/console`, `match/page`, `session-view/page`, `live/walkie`, and `home/how-it-works`.
5. Shared server-side loading and cross-feature rules live in `src/app/lib`.
6. Mongoose models in `src/models` define persisted session, match, settings, and audit records.
7. Tests in `tests` validate pure helpers, live flows, security rules, and regression coverage by domain.

## Main feature areas

- `src/app/components/home`: landing page sections and product storytelling
- `src/app/components/session`: session list and session setup UI
- `src/app/components/toss`: toss flow and toss choice UI
- `src/app/components/match`: umpire scoring screen and related helpers
- `src/app/components/session-view`: spectator live score screen
- `src/app/components/director`: director console for walkie, PA audio, music, and effects
- `src/app/components/live`: shared real-time, speech, mic, and walkie hooks
- `src/app/components/result`: final result, scorecard, and insights UI
- `src/app/components/shared`: reusable presentation and interaction primitives
- `src/app/lib`: cross-feature domain logic, data loading, validation, audio, and serialization

## Naming and split rules

- App Router files keep framework-required names and stay small.
- Public wrapper components keep stable names such as `DirectorConsoleClient`, `MatchPageClient`, `SessionViewClient`, and `HowItWorksSection`.
- Internal React components use `PascalCase`.
- Hooks use `useX`.
- Non-React helper files use lowercase kebab-case.
- Folders use lowercase kebab-case.
- Large feature files should extract pure helpers or isolated render sections before deeper logic changes.
- Internal import moves should preserve stable behavior through compatibility re-exports when needed.

## Data ownership

- `Session` owns setup-time details such as teams, toss data, and live session metadata.
- `Match` owns ball-by-ball live scoring, announcer state, sound-effect settings, and result data.
- `WalkieState`, `WalkieMessage`, `DirectorSettings`, and `AnnouncerSettings` support live communication and director tooling.

## Repo support layers

- `scripts/maintenance`: repo maintenance scripts such as file-header refresh
- `scripts/verification`: typecheck, route probes, and repo cleanliness checks
- `artifacts`: generated local logs and reports. New runtime logs should go here, not the repo root

## Start here by task

- Need a new public page section: start in `src/app/page.js` and `src/app/components/home`
- Need to change scoring behavior: start in `src/app/lib/match-engine.js`, then `src/app/components/match`
- Need to change live spectator behavior: start in `src/app/components/session-view` and `src/app/components/live`
- Need to change director tools: start in `src/app/components/director` and `src/app/components/live`
- Need to change API behavior: start in `src/app/api/**/route.js` and `src/app/lib`
- Need to verify or audit locally: start in `docs/COMMANDS.md` and `scripts/verification`
