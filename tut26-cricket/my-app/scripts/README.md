# `scripts`

This folder holds repo-maintenance and verification commands.

## Start here

Run scripts through `npm run ...` when a package script exists. That keeps commands stable even if a script file moves.

## Folders

- `maintenance`: repo-maintenance scripts
- `verification`: typecheck, route probes, and repo cleanliness checks

## Scripts

- `maintenance/add-file-headers.mjs`
  - Purpose: adds the standard file-overview header to commentable source files that do not have one yet
  - Run with: `npm run docs:headers`
  - Reads: `src`, `tests`, `scripts`, and selected root source files
  - Writes: source files in place
  - Runtime: Node

- `verification/typecheck.mjs`
  - Purpose: runs Next.js type generation and TypeScript checking with a temporary tsconfig
  - Run with: `npm run typecheck`
  - Reads: `tsconfig.json`, `.next/types`, and project source files
  - Writes: temporary typecheck config and Next typegen outputs under `.next`
  - Runtime: Node

- `verification/audit-probes.ps1`
  - Purpose: probes local auth, session, match, and walkie endpoints and writes a report under `artifacts/reports/smoke`
  - Run with: `npm run verify:audit`
  - Reads: running local app responses
  - Writes: JSON report files in `artifacts/reports/smoke`
  - Runtime: PowerShell

- `verification/check-root-cleanliness.mjs`
  - Purpose: fails if generated log, err, out, or result files appear in the repo root
  - Run with: `npm run verify:root`
  - Reads: repo root file names
  - Writes: none
  - Runtime: Node

- `verification/stress-audit-scratch.cjs`
  - Purpose: saved scratch script for local stress-audit experiments
  - Run with: direct Node execution only when doing manual stress work
  - Reads: local env, database, and local HTTP endpoints
  - Writes: whatever the manual experiment requests
  - Runtime: Node CommonJS
