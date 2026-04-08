# `src/app/lib`

This folder holds cross-feature domain logic.

- Put pure, reusable match rules here before putting them inside large UI files.
- Route loaders, serializers, validation, audio helpers, and security helpers belong here.
- Files in this folder should usually be readable without needing React context.

Common starting points:

- `match-engine.js`: scoring and undo rules
- `server-data.js`: route data loading
- `live-announcements.js`: announcer/event copy
- `walkie-talkie.js`: server-side walkie state
- `validators.js`: payload validation
