# `components/live`

Shared live transport, announcer, mic, and walkie logic lives here.

## Start here

- Stable walkie entry: `useWalkieTalkie.js`
- Walkie implementation folder: `walkie`

## Main entry

- `useWalkieTalkie.js`: stable public hook
- `walkie/useWalkieTalkieRuntime.js`: walkie runtime orchestrator
- `walkie/token-lifecycle.js`: walkie token and participant lifecycle helpers
- `walkie/presence-snapshot.js`: walkie presence and metadata sync helpers
- `walkie/rtc-transport.js`: walkie RTC transport helpers
- `walkie/rtm-signaling.js`: walkie RTM signaling helpers
- `walkie/runtime-ui.js`: walkie notice, cooldown, and cue helpers
- `walkie/*.js`: transport, state, storage, and support helpers

## Use this folder when

- A hook is shared by umpire, spectator, and director screens
- Browser audio, speech, or SSE coordination needs to change
- Walkie transport or browser preference logic needs to change

## Run this command

```bash
npm test
```
