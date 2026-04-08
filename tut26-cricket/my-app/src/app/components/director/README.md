# `components/director`

Director console UI lives here.

## Start here

- Stable public entry: `DirectorConsoleClient.jsx`
- Real implementation folder: `console`

## Main entry

- `DirectorConsoleClient.jsx`: stable wrapper used by routes and callers
- `console/DirectorConsoleScreen.jsx`: main director console implementation
- `console/DirectorConsoleChrome.jsx`: reusable director shell pieces
- `console/director-console-utils.js`: pure director helpers
- `console/hooks`: split runtime hooks for auth, session selection, walkie, audio library, and music deck behavior
- `console/panels`: render-only panels that keep the screen shell readable

## Use this folder when

- Changing director-only controls
- Changing music or sound-effect tooling
- Changing session auto-manage behavior
- Changing director walkie behavior

## Run this command

```bash
npm test
```

Need artifact cleanup after a local run:

```bash
npm run artifacts:normalize
npm run artifacts:adopt-root
npm run verify:root
```
