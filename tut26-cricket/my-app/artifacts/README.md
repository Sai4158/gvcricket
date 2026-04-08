# `artifacts`

This folder holds generated local logs and reports.

## Start here

Nothing in this folder should affect product behavior. These files are local outputs only.

## Layout

- `logs/dev`: local dev-server logs
- `logs/e2e`: smoke or end-to-end run logs
- `logs/audit`: route-probe and audit logs
- `logs/checks`: one-off local verification logs
- `reports/smoke`: smoke and audit result files
- `reports/stress`: stress-test result files
- `reports/walkie`: walkie-specific result files

## Rules

- New generated logs should go here, not the repo root.
- Keep tracked docs or placeholders only when they help explain the layout.
- Everything else in this folder is safe to regenerate locally.
