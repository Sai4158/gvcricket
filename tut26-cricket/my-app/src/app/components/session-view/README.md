# `components/session-view`

This folder owns the spectator live-score experience.

## Start here

- Stable public entry: `SessionViewClient.jsx`
- Real implementation folder: `page`

## Main entry

- `SessionViewClient.jsx`: stable wrapper used by routes and callers
- `page/SessionViewScreen.jsx`: spectator live-view implementation
- `page/SessionViewIcons.jsx`: shared spectator controls
- `page/session-view-helpers.js`: stream-signature, announcer timing, and score-effect helpers

## Use this folder when

- Changing live spectator playback
- Changing follow-mode behavior
- Changing spectator walkie access
- Changing spectator announcer timing

## Run this command

```bash
npm test
```
