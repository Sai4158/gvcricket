/**
 * File overview:
 * Purpose: Runs Check Root Cleanliness verification checks or local audit support tasks.
 * Main exports: module side effects only.
 * Major callers: Verification commands and local audit runs.
 * Side effects: runs local verification tasks and may write reports or logs.
 * Read next: ../README.md
 */

import fs from "node:fs/promises";

const ROOT = process.cwd();
const ROOT_NOISE_RE =
  /(^\..+\.(log|err|out)(\.log)?$)|(^.+\.(log|err|out)$)|(^.+result\.txt$)|(^.+report\.txt$)/i;
const ALLOWLIST = new Set([
  ".gitignore",
  ".env",
  ".env.example",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next-env.d.ts",
  "next.config.mjs",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "security-headers.mjs",
  "vercel.json",
]);

async function main() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const offenders = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !ALLOWLIST.has(name))
    .filter((name) => ROOT_NOISE_RE.test(name))
    .sort((a, b) => a.localeCompare(b));

  if (!offenders.length) {
    console.log("Repo root is clean. Generated logs and result files are not leaking here.");
    return;
  }

  console.error("Repo root contains generated files that should live under artifacts/:");
  for (const file of offenders) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

await main();

