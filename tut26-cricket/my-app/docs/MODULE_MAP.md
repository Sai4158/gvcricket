# Module Map

This file maps the active top-level folders and the stable entry files a beginner should follow first.

## Framework layer

- `src/app/layout.js`: root shell, metadata, analytics, and global providers
- `src/app/page.js`: landing page entry
- `src/app/**/page.*`: feature page entries
- `src/app/api/**/route.js`: API route handlers

## Stable public wrapper layer

- `src/app/components/director/DirectorConsoleClient.jsx`: stable director console entry
- `src/app/components/match/MatchPageClient.jsx`: stable umpire match entry
- `src/app/components/session-view/SessionViewClient.jsx`: stable spectator live-view entry
- `src/app/components/home/HowItWorksSection.jsx`: stable home explainer entry
- `src/app/components/live/useWalkieTalkie.js`: stable walkie hook entry

These files keep import paths stable and hand work off to smaller internal folders.

## Internal feature implementation folders

- `src/app/components/director/console`
  - `DirectorConsoleScreen.jsx`: director console implementation
  - `DirectorConsoleChrome.jsx`: reusable director console UI shell pieces
  - `director-console-utils.js`: pure director helpers
- `src/app/components/match/page`
  - `MatchPageScreen.jsx`: umpire screen implementation
  - `match-page-helpers.js`: stage flow, sound effect, and local cache helpers
- `src/app/components/session-view/page`
  - `SessionViewScreen.jsx`: spectator live-view implementation
  - `SessionViewIcons.jsx`: shared spectator icons and switch UI
  - `session-view-helpers.js`: announcer timing, stream signature, and score-effect helpers
- `src/app/components/live/walkie`
  - `useWalkieTalkieRuntime.js`: walkie runtime orchestrator
  - `token-lifecycle.js`: walkie token and participant lifecycle helpers
  - `presence-snapshot.js`: authoritative walkie snapshot and presence sync helpers
  - `rtc-transport.js`: RTC audio transport and remote playback helpers
  - `rtm-signaling.js`: RTM signaling session and refresh helpers
  - `runtime-ui.js`: local walkie notice, cue, and cooldown helpers
  - `walkie-talkie-gates.js`: transport and playback gate rules
  - `walkie-talkie-state.js`: token and snapshot state helpers
  - `walkie-talkie-storage.js`: browser storage helpers
  - `walkie-talkie-support.js`: retry, request, and transport support helpers
- `src/app/components/home/how-it-works`
  - `HowItWorksSectionContent.jsx`: main explainer implementation
  - `how-it-works-data.js`: static content and preview frames
  - `how-it-works-motion.js`: motion variants
  - `how-it-works-utils.js`: pure layout and accent helpers

## Shared UI layer

- `src/app/components/home`: home-page sections and animations
- `src/app/components/session`: session setup and listing
- `src/app/components/toss`: toss flow
- `src/app/components/result`: result UI and analytics
- `src/app/components/live`: shared live hooks and browser coordination
- `src/app/components/shared`: reusable UI primitives

## Domain logic layer

- `src/app/lib/match-engine.js`: match state transitions
- `src/app/lib/live-announcements.js`: spectator and umpire announcement copy and live-event builders
- `src/app/lib/server-data.js`: route-facing server data loading
- `src/app/lib/walkie-talkie.js`: server-side walkie state machine
- `src/app/lib/page-audio.js`: browser audio helpers
- `src/app/lib/public-data.js`: safe public serializers
- `src/app/lib/validators.js`: zod validation for client and server payloads

## Persistence layer

- `src/models/Session.js`
- `src/models/Match.js`
- `src/models/AuditLog.js`
- `src/models/WalkieState.js`
- `src/models/WalkieMessage.js`
- `src/models/DirectorSettings.js`
- `src/models/AnnouncerSettings.js`

## Test layer

- `tests/director`: director access, session selection, and director-specific regressions
- `tests/match`: scoring, undo, sound effects, and match regressions
- `tests/security`: validators, access, hardening, commentary, image policy, and walkie safety
- `tests/session`: spectator and session helper coverage
- `tests/smoke`: broader flow and end-to-end-style checks
- `tests/walkie`: client-side walkie transport, preference, and signaling coverage
- `tests/helpers`: shared fixtures only

## Repo support layer

- `scripts/maintenance`: maintenance scripts
- `scripts/verification`: verification and audit scripts
- `artifacts`: generated logs and local reports
