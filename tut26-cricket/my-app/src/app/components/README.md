# `src/app/components`

This folder contains almost all browser-facing UI, grouped by feature.

## Start here

- Read the feature folder README before opening the biggest file.
- If you see a stable wrapper like `MatchPageClient.jsx`, check whether it delegates into an internal folder such as `page` or `console`.

## Main feature folders

- `home`: landing page sections
- `session`: session listing and setup
- `toss`: toss flow
- `match`: umpire screen
- `session-view`: spectator live view
- `director`: director console
- `result`: result and stats UI
- `live`: shared live hooks and browser coordination
- `shared`: reusable UI primitives

## Rules

- If a file mixes UI and pure logic, extract the pure logic to an adjacent helper module.
- Large stable wrappers should keep public imports stable and move implementation into clearer internal folders.
- Shared hooks that span multiple screens live in `live`.
- Reusable primitives live in `shared`.

## Run this command

```bash
npm test
```
