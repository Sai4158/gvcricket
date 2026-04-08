/**
 * File overview:
 * Purpose: Renames existing artifact logs and reports to the repo's readable naming convention.
 * Main exports: module side effects only.
 * Major callers: npm run artifacts:normalize.
 * Side effects: renames files under artifacts/logs and artifacts/reports.
 * Read next: ./artifact-name-utils.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  ARTIFACTS_ROOT,
  buildNormalizedArtifactPath,
  nextAvailablePath,
} from "./artifact-name-utils.mjs";

const ROOT = process.cwd();

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const walk = async (directory) => {
  const results = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(entryPath)));
      continue;
    }
    results.push(entryPath);
  }
  return results;
};

async function main() {
  const artifactsRoot = path.join(ROOT, ARTIFACTS_ROOT);
  const allFiles = await walk(artifactsRoot);
  const candidates = allFiles.filter((filePath) => {
    const baseName = path.basename(filePath);
    return baseName !== "README.md" && baseName !== ".gitkeep";
  });

  const renamed = [];
  for (const sourcePath of candidates) {
    const targetPath = buildNormalizedArtifactPath(sourcePath, ROOT);
    if (sourcePath === targetPath) {
      continue;
    }

    const uniqueTargetPath = await nextAvailablePath(targetPath, fileExists);
    await fs.rename(sourcePath, uniqueTargetPath);
    renamed.push({
      from: path.relative(ROOT, sourcePath),
      to: path.relative(ROOT, uniqueTargetPath),
    });
  }

  if (!renamed.length) {
    console.log("Artifact filenames already match the readable naming rule.");
    return;
  }

  console.log("Renamed artifact files:");
  for (const entry of renamed) {
    console.log(`- ${entry.from} -> ${entry.to}`);
  }
}

await main();
