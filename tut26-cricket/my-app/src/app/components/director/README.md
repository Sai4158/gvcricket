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

## Use this folder when

- Changing director-only controls
- Changing music or sound-effect tooling
- Changing session auto-manage behavior
- Changing director walkie behavior

## Run this command

```bash
npm test
```
