import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const AUDIO_DIRECTORY = path.join(process.cwd(), "public", "audio", "effects");

function prettifyName(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  try {
    const entries = await readdir(AUDIO_DIRECTORY, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
        .map(async (entry) => {
          const fullPath = path.join(AUDIO_DIRECTORY, entry.name);
          const fileStat = await stat(fullPath);

          return {
            id: entry.name,
            fileName: entry.name,
            label: prettifyName(entry.name),
            src: `/audio/effects/${encodeURIComponent(entry.name)}`,
            extension: path.extname(entry.name).replace(".", "").toLowerCase(),
            size: fileStat.size,
          };
        })
    );

    files.sort((left, right) => left.label.localeCompare(right.label));

    return NextResponse.json(
      { files },
      {
        headers: {
          "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { files: [] },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  }
}
