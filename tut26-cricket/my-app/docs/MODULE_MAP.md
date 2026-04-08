# Module Map

## Framework layer

- `src/app/layout.js`: root shell, metadata, analytics, and global providers.
- `src/app/page.js`: landing page entry.
- `src/app/**/page.*`: feature page entries.
- `src/app/api/**/route.js`: API route handlers.

## Feature UI layer

- `src/app/components/home`: home-page sections and animations.
- `src/app/components/session`: session setup and listing.
- `src/app/components/toss`: toss flow.
- `src/app/components/match`: umpire match controls.
- `src/app/components/session-view`: spectator live view.
- `src/app/components/director`: director console.
- `src/app/components/result`: final result and analytics.
- `src/app/components/live`: shared live hooks and transport helpers.
- `src/app/components/shared`: reusable UI primitives.

## Domain logic layer

- `src/app/lib/match-engine.js`: match state transitions.
- `src/app/lib/live-announcements.js`: spectator and umpire announcement copy/event builders.
- `src/app/lib/server-data.js`: route-facing server data loading.
- `src/app/lib/walkie-talkie.js`: server-side walkie state machine.
- `src/app/lib/page-audio.js`: browser audio helpers.
- `src/app/lib/public-data.js`: safe public serializers.
- `src/app/lib/validators.js`: zod validation for client/server payloads.

## Persistence layer

- `src/models/Session.js`
- `src/models/Match.js`
- `src/models/AuditLog.js`
- `src/models/WalkieState.js`
- `src/models/WalkieMessage.js`
- `src/models/DirectorSettings.js`
- `src/models/AnnouncerSettings.js`

## Test layer

- `tests/security.test.js`: broad legacy security and regression coverage.
- `tests/*smoke*.mts`: end-to-end or high-level flow coverage.
- `tests/*console*.test.js`, `tests/*walkie*.test.js`, `tests/*sound*.test.js`: feature-focused unit and regression coverage.
