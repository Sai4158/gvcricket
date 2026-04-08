# `tests`

This folder mixes focused unit tests, regression tests, and smoke tests.

- `*.test.js`: mostly focused unit/regression coverage.
- `*.mts`: mostly smoke-flow or higher-level behavior checks.
- Prefer importing pure helper modules instead of heavy UI files when testing logic.
- If a test file grows too large, split it by domain and move shared fixtures into helpers.

Run everything with `npm test`.
