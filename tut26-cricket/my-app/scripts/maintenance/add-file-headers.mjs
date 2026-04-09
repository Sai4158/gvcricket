

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRS = ["src", "tests", "scripts"];
const ROOT_SOURCE_FILES = [
  "eslint.config.mjs",
  "next.config.mjs",
  "postcss.config.mjs",
  "security-headers.mjs",
];
const VALID_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".cjs",
  ".ts",
  ".tsx",
]);
const DIRECTIVE_RE = /^["']use (client|server)["'];?\s*$/;
const HEADER_MARKER = "File overview:";
const FILE_OVERVIEW_BLOCK_RE = /\/\*\*[\s\S]*?\*\//g;
const BYTE_ORDER_MARK = "\uFEFF";
const MISENCODED_BOM = "";

const ROOT_PURPOSES = new Map([
  ["layout.js", "Defines the root app shell, shared metadata, and global providers."],
  ["page.js", "Renders the public landing page for the app."],
  ["not-found.jsx", "Renders the custom not-found experience for unknown app routes."],
  ["robots.js", "Declares crawler rules, sitemap location, and host metadata for search engines."],
  ["sitemap.js", "Builds the public sitemap entries for the app, sessions, and matches."],
  ["twitter-image.js", "Generates the default app-wide Twitter social preview image."],
  ["opengraph-image.js", "Generates the default app-wide Open Graph social preview image."],
]);
const SPECIAL_PURPOSES = new Map([
  [
    "scripts/verification/live-banner-check.mjs",
    "Manually inspects the home live-banner payload during local verification.",
  ],
  [
    "src/app/components/home/how-it-works/HowItWorksSectionContent.jsx",
    "Renders the home-page how-it-works explainer section and its motion-driven layouts.",
  ],
  [
    "src/app/components/home/how-it-works/card-shells.jsx",
    "Provides the reusable card shells for the home-page how-it-works previews.",
  ],
  [
    "src/app/components/home/how-it-works/feature-previews.jsx",
    "Renders interactive feature-preview cards for the home-page how-it-works section.",
  ],
  [
    "src/app/components/home/how-it-works/journey-previews.jsx",
    "Renders the journey-step previews used in the home-page how-it-works section.",
  ],
  [
    "src/app/components/session-view/page/SessionViewScreen.jsx",
    "Renders the spectator session-view screen, live data hydration, and result navigation.",
  ],
]);

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

function stripByteOrderMark(value) {
  return value.replaceAll(BYTE_ORDER_MARK, "").replaceAll(MISENCODED_BOM, "");
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

function explicitRelativePath(fromDirectory, targetPath) {
  const relativePath = toPosix(path.relative(fromDirectory, targetPath)) || ".";
  if (
    relativePath === "." ||
    relativePath.startsWith("./") ||
    relativePath.startsWith("../")
  ) {
    return relativePath;
  }

  return `./${relativePath}`;
}

function inferScriptPurpose(relativePath, fileName) {
  if (relativePath.startsWith("scripts/verification/")) {
    return `Runs ${startCase(fileName)} verification checks or local audit support tasks.`;
  }

  if (relativePath.startsWith("scripts/maintenance/")) {
    return `Handles ${startCase(fileName)} maintenance work for repo consistency and cleanup.`;
  }

  return `Runs ${startCase(fileName)} developer tasks for the repo.`;
}

function inferPurpose(relativePath, fileName, content) {
  const parts = relativePath.split("/");

  if (SPECIAL_PURPOSES.has(relativePath)) {
    return SPECIAL_PURPOSES.get(relativePath);
  }

  if (relativePath.startsWith("tests/")) {
    return `Covers ${startCase(fileName)} behavior and regression cases in the automated test suite.`;
  }

  if (relativePath.startsWith("scripts/")) {
    return inferScriptPurpose(relativePath, fileName);
  }

  if (relativePath.startsWith("src/models/")) {
    return `Defines the Mongoose schema and model wiring for ${startCase(fileName)} data.`;
  }

  if (ROOT_PURPOSES.has(fileName) && relativePath.startsWith("src/app/")) {
    return ROOT_PURPOSES.get(fileName);
  }

  if (/^page\.(js|jsx|ts|tsx)$/.test(fileName)) {
    return `Renders the App Router page entry for ${featureName(parts)}.`;
  }

  if (/^loading\.(js|jsx|ts|tsx)$/.test(fileName)) {
    return `Renders the route loading state for ${featureName(parts)}.`;
  }

  if (/^(opengraph-image|twitter-image)\.(js|jsx|ts|tsx)$/.test(fileName)) {
    return `Generates the social preview image for ${featureName(parts)} sharing routes.`;
  }

  if (fileName === "route.js") {
    return `Handles ${featureName(parts)} API requests for the app.`;
  }

  if (relativePath.includes("/components/")) {
    if (content.includes("ReactLenis")) {
      return "Wraps app content with Lenis-based smooth scrolling for client-rendered pages.";
    }

    if (/^use[A-Z]/.test(fileName)) {
      return `Encapsulates ${featureName(parts)} browser state, effects, and runtime coordination.`;
    }

    return `Renders ${featureName(parts)} UI for the app's screens and flows.`;
  }

  if (relativePath.includes("/lib/")) {
    return `Provides shared ${startCase(fileName)} logic for routes, APIs, and feature code.`;
  }

  if (content.includes("export const metadata")) {
    return "Declares route metadata and sharing defaults for the app.";
  }

  return `Defines ${startCase(fileName)} behavior used by the app.`;
}

function inferExports(content) {
  const matches = [];
  const exportNames = new Set();
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
      exportNames.add(match[1]);
      match = regex.exec(content);
    }
  }

  const exportListRegex = /export\s*{\s*([^}]+)\s*}/gs;
  let exportListMatch = exportListRegex.exec(content);
  while (exportListMatch) {
    const names = exportListMatch[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/\s+as\s+/i, " as ").split(" as ").pop())
      .filter(Boolean);

    for (const name of names) {
      exportNames.add(name);
    }

    exportListMatch = exportListRegex.exec(content);
  }

  if (exportNames.size) {
    const orderedNames = [...matches, ...[...exportNames].filter((name) => !matches.includes(name))];
    if (orderedNames.length > 6) {
      return `${orderedNames.slice(0, 5).join(", ")}, and related helpers`;
    }

    return orderedNames.join(", ");
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

  if (relativePath.startsWith("scripts/verification/")) {
    return "Verification commands and local audit runs.";
  }

  if (relativePath.startsWith("scripts/maintenance/")) {
    return "Repo maintenance commands.";
  }

  if (relativePath.startsWith("scripts/")) {
    return "Developer scripts.";
  }

  return "Adjacent modules in the same feature area.";
}

function inferSideEffects(relativePath, content) {
  if (relativePath.startsWith("tests/")) {
    return "runs assertions and test-side setup/teardown only";
  }

  if (relativePath.startsWith("scripts/maintenance/")) {
    return "reads or writes repo files";
  }

  if (relativePath.startsWith("scripts/verification/")) {
    return "runs local verification tasks and may write reports or logs";
  }

  if (relativePath.startsWith("scripts/")) {
    return "runs local developer tasks";
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
      return explicitRelativePath(path.dirname(filePath), candidate);
    } catch {
      // Try next candidate.
    }
  }

  return explicitRelativePath(path.dirname(filePath), path.join(ROOT, "docs", "ONBOARDING.md"));
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
  const firstChunk = content.slice(0, 1200);
  return firstChunk.includes(HEADER_MARKER);
}

function buildHeader({ purpose, exportsSummary, callers, sideEffects, readNext }) {
  return [
    "",
    "",
  ].join("\n");
}

function findInsertIndex(lines) {
  let insertAt = 0;

  if (stripByteOrderMark(lines[0] || "").startsWith("#!")) {
    insertAt = 1;
  }

  while (DIRECTIVE_RE.test(stripByteOrderMark(lines[insertAt] || ""))) {
    insertAt += 1;
    if (lines[insertAt] === "") {
      insertAt += 1;
    }
  }

  return insertAt;
}

function stripFileOverviewBlocks(content) {
  return content.replace(FILE_OVERVIEW_BLOCK_RE, (block) =>
    block.includes(HEADER_MARKER) ? "" : block
  );
}

function insertOrReplaceHeader(content, header) {
  const hasTrailingNewline = content.endsWith("\n");
  const normalizedContent = stripFileOverviewBlocks(stripByteOrderMark(content));
  const lines = normalizedContent.split("\n");
  const insertAt = findInsertIndex(lines);
  const before = lines.slice(0, insertAt).join("\n").replace(/\n+$/u, "");
  const afterLines = lines.slice(insertAt);

  while (afterLines[0] === "") {
    afterLines.shift();
  }

  const parts = [];
  if (before) {
    parts.push(before);
  }
  parts.push(header.trimEnd());
  if (afterLines.length) {
    parts.push(afterLines.join("\n"));
  }

  const nextContent = parts.join("\n\n");
  return hasTrailingNewline ? `${nextContent}\n` : nextContent;
}

async function main() {
  const files = await gatherFiles();

  for (const filePath of files) {
    const original = await fs.readFile(filePath, "utf8");
    const relativePath = relativePathLabel(filePath);
    const fileName = path.basename(filePath);
    const header = buildHeader({
      purpose: inferPurpose(relativePath, fileName, original),
      exportsSummary: inferExports(original),
      callers: inferCallers(relativePath, fileName),
      sideEffects: inferSideEffects(relativePath, original),
      readNext: await inferReadNext(filePath),
    });

    const nextContent = insertOrReplaceHeader(original, header);
    if (nextContent !== original && nextContent.includes(HEADER_MARKER)) {
      await fs.writeFile(filePath, nextContent, "utf8");
    }
  }
}

await main();

