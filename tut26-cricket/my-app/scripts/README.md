# `scripts`

This folder holds repo-maintenance and verification commands.

## Start here

Run scripts through `npm run ...` when a package script exists. That keeps commands stable even if a script file moves.

## Folders

- `maintenance`: repo-maintenance scripts
- `verification`: typecheck, route probes, and repo cleanliness checks

## Scripts

- `maintenance/artifact-name-utils.mjs`
  - Purpose: shared artifact filename and path normalization helpers
  - Run with: imported by the artifact maintenance scripts
  - Reads: file and folder names
  - Writes: none
  - Runtime: Node

- `maintenance/normalize-artifacts.mjs`
  - Purpose: renames existing artifact logs and reports to the readable naming convention
  - Run with: `npm run artifacts:normalize`
  - Reads: `artifacts/logs` and `artifacts/reports`
  - Writes: renames artifact files in place
  - Runtime: Node

- `maintenance/adopt-root-artifacts.mjs`
  - Purpose: moves root-level generated log and result files into `artifacts/logs/checks`
  - Run with: `npm run artifacts:adopt-root`
  - Reads: repo root file names
  - Writes: moves generated files into `artifacts/logs/checks`
  - Runtime: Node

- `maintenance/add-file-headers.mjs`
  - Purpose: adds or refreshes the standard file-overview header on commentable source files
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

- `verification/live-banner-check.mjs`
  - Purpose: manually inspects the home live-banner payload during local verification
  - Run with: direct Node execution only when doing focused live-banner checks
  - Reads: `src/app/lib/server-data.js` and the current database data
  - Writes: none
  - Runtime: Node

- `verification/start-logged-command.ps1`
  - Purpose: starts a local Windows command and writes readable stdout and stderr logs under `artifacts/logs`
  - Run with: direct PowerShell execution for manual runs
  - Reads: the command path, arguments, and artifact log folder
  - Writes: `*.out.log` and `*.err.log` files in the chosen artifact log group
  - Runtime: PowerShell

- `verification/stress-audit-scratch.cjs`
  - Purpose: saved scratch script for local stress-audit experiments
  - Run with: direct Node execution only when doing manual stress work
  - Reads: local env, database, and local HTTP endpoints
  - Writes: whatever the manual experiment requests
  - Runtime: Node CommonJS
