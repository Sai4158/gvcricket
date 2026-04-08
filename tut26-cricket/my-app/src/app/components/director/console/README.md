# `director/console`

Director-only console internals.

## Main entry

- `DirectorConsoleScreen.jsx`: main director console implementation
- `DirectorConsoleChrome.jsx`: reusable director console chrome and small UI building blocks
- `director-console-utils.js`: pure helpers for caching, playlist parsing, and session selection
- `hooks`: logic split by responsibility such as auth, session selection, walkie, sound-effect library, and music deck runtime
- `panels`: render-only sections that keep the screen shell focused on composition
- Public entry files stay one folder up so existing imports keep working

## Run this command

```bash
npm test
```
