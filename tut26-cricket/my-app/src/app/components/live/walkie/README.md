# `live/walkie`

Internal walkie-talkie runtime modules.

## Main entry

- `useWalkieTalkieRuntime.js`: main hook implementation
- `token-lifecycle.js`: participant ID, token refresh, and countdown helpers
- `presence-snapshot.js`: authoritative snapshot, presence, and metadata sync helpers
- `rtc-transport.js`: RTC join, publish, remote playback, and cleanup helpers
- `rtm-signaling.js`: RTM login, listeners, cleanup, and signal refresh helpers
- `runtime-ui.js`: notice, cooldown, and local cue helpers
- `walkie-talkie-gates.js`: transport and playback gate decisions
- `walkie-talkie-state.js`: snapshot and token state helpers
- `walkie-talkie-storage.js`: browser storage helpers
- `walkie-talkie-support.js`: RTC/RTM support, retry, and request helpers
- Public compatibility files stay one folder up for stable imports

## Run this command

```bash
npm test
```
