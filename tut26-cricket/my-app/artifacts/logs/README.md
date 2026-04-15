# `artifacts/logs`

This folder holds generated local log files.

## Naming rule

- Use readable names with no leading `.` and no `tmp-` prefix.
- Split logs use `task-name.out.log` and `task-name.err.log`.
- Single-stream logs use `task-name.log`.

## Folders

- `audit`: audit and probe logs
- `checks`: one-off local verification runs
- `dev`: local dev or production-start logs
- `e2e`: smoke and end-to-end logs
