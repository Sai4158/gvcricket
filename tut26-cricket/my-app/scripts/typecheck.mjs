import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const binDir = path.join(cwd, "node_modules", ".bin");
const nextBin = path.join(binDir, process.platform === "win32" ? "next.cmd" : "next");
const tscBin = path.join(binDir, process.platform === "win32" ? "tsc.cmd" : "tsc");
const cacheLifeTypesPath = path.join(cwd, ".next", "types", "cache-life.d.ts");

function ensureNextCacheLifeTypes() {
  if (!existsSync(cacheLifeTypesPath)) {
    mkdirSync(path.dirname(cacheLifeTypesPath), { recursive: true });
    writeFileSync(cacheLifeTypesPath, "export {};\n", "utf8");
  }
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
run(tscBin, ["--noEmit", "--incremental", "false"]);
