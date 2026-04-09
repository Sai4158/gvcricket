# `src/app/lib`

This folder holds cross-feature domain logic.

## Start here

- Open this folder first when the behavior is a rule, validator, serializer, loader, or audio helper instead of UI.

## Common starting points

- `match-engine.js`: scoring and undo rules
- `server-data.js`: route data loading
- `live-announcements.js`: announcer and live-event copy
- `walkie-talkie.js`: server-side walkie state
- `validators.js`: payload validation

## Rules

- Put pure reusable rules here before putting them inside large UI files.
- Route loaders, serializers, validation, audio helpers, and security helpers belong here.
- Files in this folder should usually be readable without needing React context.

## Run this command

```bash
npm run verify:typecheck
```
