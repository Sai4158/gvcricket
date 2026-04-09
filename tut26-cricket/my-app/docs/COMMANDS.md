# Commands

This file is the canonical command guide for local development and verification.

## Start here

Run commands from the repo root:

```bash
cd tut26-cricket/my-app
```

## Install

```bash
npm install
```

## Core development loop

Start the local dev server:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Run the full test suite:

```bash
npm test
```

Run type generation plus TypeScript checking:

```bash
npm run typecheck
```

Build the production app:

```bash
npm run build
```

## Verification aliases

These commands mirror the main checks and make the intent clearer when demoing or documenting verification:

```bash
npm run verify:lint
npm run verify:test
npm run verify:typecheck
npm run verify:build
```

## Maintenance commands

Normalize existing artifact names:

```bash
npm run artifacts:normalize
```

Move generated root logs and result files into `artifacts/logs/checks`:

```bash
npm run artifacts:adopt-root
```

Refresh file overview headers:

```bash
npm run docs:headers
```

## Windows audit and cleanliness checks

Run the local security and route probe script:

```powershell
npm run verify:audit
```

Override the target server:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verification\audit-probes.ps1 -BaseUrl http://127.0.0.1:3022
```

Start a manual logged command with readable artifact names:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verification\start-logged-command.ps1 -TaskName next-start-3116 -FilePath npm.cmd -ArgumentList run,start,--,--port,3116 -LogGroup dev
```

Check that generated logs and result files are not leaking back into the repo root:

```powershell
npm run verify:root
```

## Output locations

- Naming rule:
  logs use `task-name.log`, `task-name.out.log`, or `task-name.err.log`
  walkie reports use `walkie-scenario.txt`
  stress reports use `walkie-stress-scenario.txt`
  smoke and audit reports use `probe-name.json`
- Audit probe reports: `artifacts/reports/smoke`
- Audit probe logs: `artifacts/logs/audit`
- Manual dev server logs: `artifacts/logs/dev`
- E2E or smoke logs: `artifacts/logs/e2e`
- Other local check logs: `artifacts/logs/checks`
- Walkie reports: `artifacts/reports/walkie`
- Stress reports: `artifacts/reports/stress`
