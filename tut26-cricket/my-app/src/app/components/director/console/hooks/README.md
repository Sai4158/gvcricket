# `director/console/hooks`

These hooks own the director console state that used to live in one large screen file.

## Start here

- Main screen: `../DirectorConsoleScreen.jsx`
- Render-only panels: `../panels`

## Main entry

- `useDirectorAuth.js`: PIN auth, logout, and leave-console flow
- `useDirectorSessionSelection.js`: live session loading, refresh, auto-manage, and picker state
- `useDirectorWalkieControls.js`: walkie preferences, notices, request flow, and derived walkie UI state
- `useDirectorAudioLibrary.js`: grouped sound-effect panel state and handlers
- `useDirectorMusicDeck.js`: grouped music-deck and loudspeaker panel state and handlers

## Read this folder when

- You need the owner of a director-specific state machine
- A panel is too small to explain the runtime behind it
- The screen file is only composing existing behavior

## Run this command

```bash
npm run lint
```
