/**
 * File overview:
 * Purpose: Shared artifact path and filename normalization helpers for local maintenance scripts.
 * Main exports: artifact roots, folder groups, and filename/path normalization helpers.
 * Major callers: normalize-artifacts.mjs and adopt-root-artifacts.mjs.
 * Side effects: none in this helper module.
 * Read next: ./normalize-artifacts.mjs
 */

import path from "node:path";

export const ARTIFACTS_ROOT = "artifacts";
export const ARTIFACT_LOG_GROUPS = ["audit", "checks", "dev", "e2e"];
export const ARTIFACT_REPORT_GROUPS = ["smoke", "stress", "walkie"];

const DOT_PREFIX_RE = /^\.+/;
const TMP_PREFIX_RE = /^tmp-+/i;

const collapseArtifactDelimiters = (value) =>
  String(value || "")
    .replace(/[ _]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const stripArtifactNoise = (value) => {
  let next = String(value || "");
  next = next.replace(DOT_PREFIX_RE, "");
  while (TMP_PREFIX_RE.test(next)) {
    next = next.replace(TMP_PREFIX_RE, "");
  }
  return collapseArtifactDelimiters(next);
};

const normalizeLogLeafName = (fileName) => {
  let next = stripArtifactNoise(fileName);
  if (!next) {
    return "";
  }

  if (/\.err$/i.test(next) || /\.out$/i.test(next)) {
    next = `${next}.log`;
  } else if (!/\.[a-z0-9]+$/i.test(next)) {
    next = `${next}.log`;
  }

  return next
    .replace(/-result(?=\.[^.]+$)/i, "")
    .replace(/-report(?=\.[^.]+$)/i, "");
};

const normalizeWalkieReportLeafName = (fileName) => {
  let next = stripArtifactNoise(fileName)
    .replace(/-result(?=\.txt$)/i, "")
    .replace(/-report(?=\.txt$)/i, "")
    .replace(/^walkie-final-stress(?=\.txt$)/i, "walkie-stress-final");

  if (!next) {
    return "";
  }

  if (!/\.txt$/i.test(next)) {
    next = `${next}.txt`;
  }

  if (!/^walkie-/i.test(next)) {
    next = `walkie-${next.replace(/^walkie-?/i, "")}`;
  }

  return collapseArtifactDelimiters(next.replace(/\.txt$/i, "")) + ".txt";
};

const normalizeStressReportLeafName = (fileName) => {
  let next = normalizeWalkieReportLeafName(fileName).replace(/^walkie-/i, "");
  next = next.replace(/^final-stress(?=\.txt$)/i, "stress-final");
  next = next.replace(/^stress-(.+)$/i, "stress-$1");
  next = next.replace(/^(?!stress-)/i, "stress-");
  next = next.replace(/^stress-walkie-/i, "walkie-stress-");
  if (!/^walkie-stress-/i.test(next)) {
    next = next.replace(/^stress-/i, "walkie-stress-");
  }
  return next;
};

const normalizeSmokeReportLeafName = (fileName) => {
  let next = stripArtifactNoise(fileName)
    .replace(/-result(?=\.json$)/i, "")
    .replace(/-report(?=\.json$)/i, "");
  if (!next) {
    return "";
  }
  if (!/\.json$/i.test(next)) {
    next = `${next}.json`;
  }
  return collapseArtifactDelimiters(next.replace(/\.json$/i, "")) + ".json";
};

export const normalizeArtifactLeafName = (fileName, relativeDirectory = "") => {
  const normalizedDirectory = String(relativeDirectory || "")
    .replace(/\\/g, "/")
    .toLowerCase();

  if (normalizedDirectory.startsWith("artifacts/reports/stress")) {
    return normalizeStressReportLeafName(fileName);
  }

  if (normalizedDirectory.startsWith("artifacts/reports/walkie")) {
    return normalizeWalkieReportLeafName(fileName);
  }

  if (normalizedDirectory.startsWith("artifacts/reports/smoke")) {
    return normalizeSmokeReportLeafName(fileName);
  }

  return normalizeLogLeafName(fileName);
};

export const buildNormalizedArtifactPath = (filePath, repoRoot) => {
  const sourcePath = path.resolve(repoRoot, filePath);
  const sourceDirectory = path.dirname(sourcePath);
  const relativeDirectory = path.relative(repoRoot, sourceDirectory);
  const normalizedLeaf = normalizeArtifactLeafName(
    path.basename(sourcePath),
    relativeDirectory,
  );

  return normalizedLeaf
    ? path.join(sourceDirectory, normalizedLeaf)
    : sourcePath;
};

export const nextAvailablePath = async (filePath, exists) => {
  if (!(await exists(filePath))) {
    return filePath;
  }

  const parsed = path.parse(filePath);
  let counter = 2;
  while (true) {
    const nextPath = path.join(
      parsed.dir,
      `${parsed.name}-${counter}${parsed.ext}`,
    );
    if (!(await exists(nextPath))) {
      return nextPath;
    }
    counter += 1;
  }
};
