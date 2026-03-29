import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const binDir = path.join(cwd, "node_modules", ".bin");
const nextBin = path.join(binDir, process.platform === "win32" ? "next.cmd" : "next");
const tscBin = path.join(binDir, process.platform === "win32" ? "tsc.cmd" : "tsc");
const cacheLifeTypesPath = path.join(cwd, ".next", "types", "cache-life.d.ts");
const tsconfigPath = path.join(cwd, "tsconfig.json");
const tempTsconfigPath = path.join(cwd, ".tmp.typecheck.tsconfig.json");

function ensureNextCacheLifeTypes() {
  if (!existsSync(cacheLifeTypesPath)) {
    mkdirSync(path.dirname(cacheLifeTypesPath), { recursive: true });
    writeFileSync(cacheLifeTypesPath, "export {};\n", "utf8");
  }
}

function buildTypecheckTsconfig() {
  const source = JSON.parse(readFileSync(tsconfigPath, "utf8"));
  const existingNextIncludes = [
    ".next/types/routes.d.ts",
    ".next/types/validator.ts",
    ".next/dev/types/**/*.ts",
  ].filter((entry) => {
    if (entry.includes("*")) {
      return true;
    }

    return existsSync(path.join(cwd, entry));
  });

  const include = Array.from(
    new Set([
      "next-env.d.ts",
      "**/*.ts",
      "**/*.tsx",
      ...existingNextIncludes,
    ])
  );

  return {
    ...source,
    include,
  };
}

function run(bin, args) {
  const result = spawnSync(bin, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

ensureNextCacheLifeTypes();
run(nextBin, ["typegen"]);
ensureNextCacheLifeTypes();
writeFileSync(
  tempTsconfigPath,
  `${JSON.stringify(buildTypecheckTsconfig(), null, 2)}\n`,
  "utf8"
);

try {
  run(tscBin, ["--project", tempTsconfigPath, "--noEmit", "--incremental", "false"]);
} finally {
  if (existsSync(tempTsconfigPath)) {
    unlinkSync(tempTsconfigPath);
  }
}
