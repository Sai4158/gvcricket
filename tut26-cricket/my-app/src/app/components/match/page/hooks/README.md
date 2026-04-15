# `match/page/hooks`

Internal umpire-screen hooks live here.

## Start here

- Stable public entry: `../../MatchPageClient.jsx`
- Internal screen: `../MatchPageScreen.jsx`

## Main entry

- `useMatchStageCardFlow.js`: toss, stage-card, and result-navigation flow
- `useMatchScoreSoundEffects.js`: score-preview, announcer, and sound-effect runtime
- `useMatchWalkieInterruptions.js`: walkie-triggered interruption state

## Read this folder when

- Match flow logic is too large for the screen component
- You need the real runtime behind a match panel or stage transition
- You need the hook that owns a specific umpire-screen behavior

## Run this command

```bash
npm test
```
