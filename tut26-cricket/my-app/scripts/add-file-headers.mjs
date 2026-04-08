/**
 * Purpose: Adds a standard "File overview" header to source files that do not already have one.
 * Main exports: none.
 * Major callers: developers running maintenance refactors.
 * Side effects: rewrites source files in place.
 * Read next: ../docs/ONBOARDING.md
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRS = ["src", "tests", "scripts"];
const ROOT_SOURCE_FILES = [
  "eslint.config.mjs",
  "next.config.mjs",
  "postcss.config.mjs",
  "security-headers.mjs",
  "tmp-live-banner-check.mjs",
];
const VALID_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".mts"]);
const DIRECTIVE_RE = /^["']use (client|server)["'];?\s*$/;
const HEADER_MARKER = "File overview:";

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function startCase(value) {
  return String(value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function relativePathLabel(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function featureName(parts) {
  const componentsIndex = parts.indexOf("components");
  if (componentsIndex >= 0 && parts[componentsIndex + 1]) {
    return startCase(parts[componentsIndex + 1]);
  }

  const appIndex = parts.indexOf("app");
  if (appIndex >= 0 && parts[appIndex + 1]) {
    return startCase(parts[appIndex + 1]);
  }

  return "App";
}

function inferPurpose(relativePath, fileName, content) {
  const parts = relativePath.split("/");

  if (relativePath.startsWith("tests/")) {
    return `Automated test coverage for ${startCase(fileName)} behavior and regressions.`;
  }

  if (relativePath.startsWith("scripts/")) {
    return `Developer script for ${startCase(fileName)} maintenance work.`;
  }

  if (relativePath.startsWith("src/models/")) {
    return `Mongoose model definition for ${startCase(fileName)}.`;
  }

  if (fileName === "layout.js") {
    return "Root app shell, metadata, and shared providers.";
  }

  if (/^page\.(js|jsx)$/.test(fileName)) {
    return `App Router page entry for ${featureName(parts)}.`;
  }

  if (/^loading\.(js|jsx)$/.test(fileName)) {
    return `Route loading state for ${featureName(parts)}.`;
  }

  if (/^(opengraph-image|twitter-image)\.(js|jsx)$/.test(fileName)) {
    return `Social image generator for ${featureName(parts)}.`;
  }

  if (fileName === "route.js") {
    return `API route handler for ${featureName(parts)} requests.`;
  }

  if (relativePath.includes("/components/")) {
    if (/^use[A-Z]/.test(fileName)) {
      return `React hook for ${featureName(parts)} behavior and browser state.`;
    }

    return `UI component for ${featureName(parts)} screens and flows.`;
  }

  if (relativePath.includes("/lib/")) {
    return `Shared helper module for ${startCase(fileName)} logic.`;
  }

  if (content.includes("export const metadata")) {
    return "Route metadata configuration for the app.";
  }

  return `Source module for ${startCase(fileName)}.`;
}

function inferExports(content) {
  const matches = [];
  const regexes = [
    /export default function\s+([A-Za-z0-9_]+)/g,
    /export function\s+([A-Za-z0-9_]+)/g,
    /export const\s+([A-Za-z0-9_]+)/g,
    /export class\s+([A-Za-z0-9_]+)/g,
  ];

  for (const regex of regexes) {
    let match = regex.exec(content);
    while (match) {
      matches.push(match[1]);
      match = regex.exec(content);
    }
  }

  if (!matches.length) {
    if (content.includes("export default")) {
      return "default export";
    }

    return "module side effects only";
  }

  return matches.join(", ");
}

function inferCallers(relativePath, fileName) {
  if (relativePath.startsWith("tests/")) {
    return "`npm test` and focused test runs.";
  }

  if (relativePath.startsWith("src/models/")) {
    return "Server loaders, API routes, and data helpers.";
  }

  if (fileName === "route.js") {
    return "Next.js request handlers and client fetch calls.";
  }

  if (/^page\.(js|jsx)$/.test(fileName) || fileName === "layout.js") {
    return "Next.js App Router.";
  }

  if (relativePath.includes("/components/")) {
    return "Feature routes and sibling components.";
  }

  if (relativePath.includes("/lib/")) {
    return "Route loaders, API routes, and feature components.";
  }

  if (relativePath.startsWith("scripts/")) {
    return "Repo maintenance commands.";
  }

  return "Adjacent modules in the same feature area.";
}

function inferSideEffects(relativePath, content) {
  if (relativePath.startsWith("tests/")) {
    return "runs assertions and test-side setup/teardown only";
  }

  if (content.includes("sessionStorage") || content.includes("localStorage")) {
    return "reads or writes browser storage";
  }

  if (content.includes("useEffect") || content.includes('"use client"')) {
    return "uses React hooks and browser APIs";
  }

  if (content.includes("fetch(")) {
    return "performs network requests";
  }

  if (content.includes("mongoose") || content.includes("new Schema")) {
    return "registers or reuses a Mongoose model";
  }

  if (content.includes("cookies(") || content.includes("headers(")) {
    return "reads server request metadata";
  }

  return "none";
}

async function inferReadNext(filePath) {
  const dir = path.dirname(filePath);
  const candidates = [
    path.join(dir, "README.md"),
    path.join(path.dirname(dir), "README.md"),
    path.join(ROOT, "docs", "ONBOARDING.md"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return toPosix(path.relative(path.dirname(filePath), candidate)) || ".";
    } catch {
      // Try next candidate.
    }
  }

  return "docs/ONBOARDING.md";
}

async function gatherFiles() {
  const results = [];

  for (const dir of SOURCE_DIRS) {
    const absoluteDir = path.join(ROOT, dir);
    await walk(absoluteDir, results);
  }

  for (const file of ROOT_SOURCE_FILES) {
    results.push(path.join(ROOT, file));
  }

  return results;
}

async function walk(currentPath, results) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "public") {
      continue;
    }

    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, results);
      continue;
    }

    if (!VALID_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    results.push(fullPath);
  }
}

function alreadyHasHeader(content) {
  const firstChunk = content.slice(0, 800);
  return firstChunk.includes(HEADER_MARKER);
}

function buildHeader({ purpose, exportsSummary, callers, sideEffects, readNext }) {
  return [
    "/**",
    ` * File overview:`,
    ` * Purpose: ${purpose}`,
    ` * Main exports: ${exportsSummary}.`,
    ` * Major callers: ${callers}`,
    ` * Side effects: ${sideEffects}.`,
    ` * Read next: ${readNext}`,
    " */",
    "",
  ].join("\n");
}

function insertHeader(content, header) {
  const lines = content.split("\n");
  let insertAt = 0;

  if (lines[0]?.startsWith("#!")) {
    insertAt = 1;
  }

  while (DIRECTIVE_RE.test(lines[insertAt] || "")) {
    insertAt += 1;
    if (lines[insertAt] === "") {
      insertAt += 1;
    }
  }

  const before = lines.slice(0, insertAt).join("\n");
  const after = lines.slice(insertAt).join("\n");

  if (!before) {
    return `${header}${after}`;
  }

  return `${before}\n\n${header}${after}`;
}

async function main() {
  const files = await gatherFiles();

  for (const filePath of files) {
    const original = await fs.readFile(filePath, "utf8");
    if (alreadyHasHeader(original)) {
      continue;
    }

    const relativePath = relativePathLabel(filePath);
    const fileName = path.basename(filePath);
    const header = buildHeader({
      purpose: inferPurpose(relativePath, fileName, original),
      exportsSummary: inferExports(original),
      callers: inferCallers(relativePath, fileName),
      sideEffects: inferSideEffects(relativePath, original),
      readNext: await inferReadNext(filePath),
    });

    const nextContent = insertHeader(original, header);
    if (nextContent !== original) {
      await fs.writeFile(filePath, nextContent, "utf8");
    }
  }
}

await main();
