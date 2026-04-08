# `src/app/components`

This folder contains almost all browser-facing UI, grouped by feature.

- Read the feature folder README before opening the biggest file.
- If a file mixes UI and pure logic, extract the pure logic to an adjacent helper module.
- Shared hooks that span multiple screens live in `live`.
- Reusable primitives live in `shared`.

Feature folders:

- `home`: landing page sections
- `session`: session listing and setup
- `toss`: toss flow
- `match`: umpire screen
- `session-view`: spectator live view
- `director`: director console
- `result`: result and stats UI
