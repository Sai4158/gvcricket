import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { hasValidDirectorAccess, getDirectorAccessCookieName } from "../../../lib/director-access";

const AUDIO_DIRECTORY = path.join(process.cwd(), "public", "audio", "effects");

function prettifyName(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getDirectorAccessCookieName())?.value;

  if (!hasValidDirectorAccess(token)) {
    return NextResponse.json(
      { message: "Director access required." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

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
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { files: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
