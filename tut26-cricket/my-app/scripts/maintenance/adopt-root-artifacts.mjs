/**
 * File overview:
 * Purpose: Moves root-level generated logs and result files into artifacts/logs/checks using the readable naming rule.
 * Main exports: module side effects only.
 * Major callers: npm run artifacts:adopt-root.
 * Side effects: moves generated root files into artifacts/logs/checks and exits non-zero on locked files.
 * Read next: ../verification/check-root-cleanliness.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  buildNormalizedArtifactPath,
  nextAvailablePath,
} from "./artifact-name-utils.mjs";

const ROOT = process.cwd();
const DESTINATION_DIRECTORY = path.join(ROOT, "artifacts", "logs", "checks");
const ROOT_NOISE_RE =
  /(^\..+\.(log|err|out)(\.log)?$)|(^.+\.(log|err|out)$)|(^.+result\.txt$)|(^.+report\.txt$)/i;

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

async function main() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && ROOT_NOISE_RE.test(entry.name))
    .map((entry) => path.join(ROOT, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (!candidates.length) {
    console.log("No generated root files needed to be moved into artifacts/logs/checks.");
    return;
  }

  const moved = [];
  const locked = [];

  await fs.mkdir(DESTINATION_DIRECTORY, { recursive: true });

  for (const sourcePath of candidates) {
    const baseTargetPath = buildNormalizedArtifactPath(
      path.join(DESTINATION_DIRECTORY, path.basename(sourcePath)),
      ROOT,
    );
    const targetPath = await nextAvailablePath(baseTargetPath, fileExists);

    try {
      await fs.rename(sourcePath, targetPath);
      moved.push({
        from: path.relative(ROOT, sourcePath),
        to: path.relative(ROOT, targetPath),
      });
    } catch (error) {
      if (
        error &&
        ["EPERM", "EBUSY", "EACCES"].includes(String(error.code || ""))
      ) {
        locked.push(path.relative(ROOT, sourcePath));
        continue;
      }
      throw error;
    }
  }

  if (moved.length) {
    console.log("Moved generated root files into artifacts/logs/checks:");
    for (const entry of moved) {
      console.log(`- ${entry.from} -> ${entry.to}`);
    }
  }

  if (locked.length) {
    console.error("Could not move locked root files. Stop the active process and rerun npm run artifacts:adopt-root:");
    for (const filePath of locked) {
      console.error(`- ${filePath}`);
    }
    process.exit(1);
  }
}

await main();
