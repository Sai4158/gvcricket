# `tests`

This folder is organized by domain so the test tree is easier to scan.

## Start here

- Need a high-level regression run: start with `npm test`.
- Need a feature-specific suite: open the matching folder below.

## Test folders

- `director`: director access, session selection, and director walkie behavior
- `match`: score flow, queueing, sound effects, and match regressions
- `security`: validators, access control, hardening, commentary, image policy, and server-side walkie safety
- `session`: session helper behavior such as relative-time and deferred image uploads
- `smoke`: broader end-to-end-style flow coverage
- `walkie`: pure walkie transport, preference, and signaling logic
- `helpers`: shared fixtures only

## Rules

- Prefer importing pure helper modules instead of heavy UI files when testing logic.
- If a test file grows too large, split it by domain and move shared fixtures into `helpers`.
- Keep test titles readable in console output so failures explain themselves.

## Run this command

```bash
npm test
```
