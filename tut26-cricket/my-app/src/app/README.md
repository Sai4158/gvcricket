# `src/app`

This folder is the framework entry layer for the app.

## Start here

- Want to trace a URL to the code that renders it: start in this folder.
- Want commands: read `../../docs/COMMANDS.md`.
- Want the full repo map: read `../../docs/MODULE_MAP.md`.

## Main entry files

- `layout.js`: root shell and metadata
- `page.js`: home page
- `session/**`: session list and setup routes
- `toss/**`: toss routes
- `match/**`: umpire routes
- `session/**/view/**`: spectator live-view routes
- `director/**`: director console routes
- `result/**`: result routes
- `api/**/route.js`: API handlers

## Rules

- Route files like `page.js`, `layout.js`, and `api/**/route.js` should stay thin.
- Each page should load data, enforce access, and hand control to a stable feature wrapper.
- Shared route-facing helpers live in `src/app/lib`.
- Feature UI lives in `src/app/components`.

## Run this command

```bash
npm run dev
```
