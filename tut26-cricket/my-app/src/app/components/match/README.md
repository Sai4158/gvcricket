# `components/match`

This folder owns the umpire scoring experience.

## Start here

- Stable public entry: `MatchPageClient.jsx`
- Real implementation folder: `page`

## Main entry

- `MatchPageClient.jsx`: stable wrapper used by routes and callers
- `page/MatchPageScreen.jsx`: main umpire screen implementation
- `page/match-page-helpers.js`: stage logic, sound-effect helpers, and cache helpers
- `page/hooks`: split umpire-screen runtime hooks for stage flow, sound effects, and walkie interruptions
- `useMatch.js`: optimistic match updates and queue behavior

## Use this folder when

- Changing live scoring controls
- Changing match-stage prompts
- Changing umpire sound effects or announcements
- Changing walkie behavior inside the umpire screen

## Run this command

```bash
npm test
```
