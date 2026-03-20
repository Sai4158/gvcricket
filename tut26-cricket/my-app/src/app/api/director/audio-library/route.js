import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { connectDB } from "../../../lib/db";
import DirectorSettings from "../../../../models/DirectorSettings";

const AUDIO_DIRECTORY = path.join(process.cwd(), "public", "audio", "effects");
const DIRECTOR_SETTINGS_KEY = "global";

function prettifyName(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readDirectorAudioOrder() {
  try {
    await connectDB();
    const settings = await DirectorSettings.findOne({ key: DIRECTOR_SETTINGS_KEY })
      .select("audioLibraryOrder")
      .lean();
    return Array.isArray(settings?.audioLibraryOrder) ? settings.audioLibraryOrder : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const entries = await readdir(AUDIO_DIRECTORY, { withFileTypes: true });
    const audioLibraryOrder = await readDirectorAudioOrder();
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

    const orderMap = new Map(audioLibraryOrder.map((id, index) => [id, index]));
    files.sort((left, right) => {
      const leftIndex = orderMap.has(left.id) ? orderMap.get(left.id) : Number.MAX_SAFE_INTEGER;
      const rightIndex = orderMap.has(right.id) ? orderMap.get(right.id) : Number.MAX_SAFE_INTEGER;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.label.localeCompare(right.label);
    });

    return NextResponse.json(
      { files, order: audioLibraryOrder },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { files: [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const nextOrder = Array.isArray(body?.order)
      ? body.order.filter((value) => typeof value === "string" && value.trim())
      : null;

    if (!nextOrder) {
      return NextResponse.json(
        { message: "Order must be an array of file ids." },
        { status: 400 }
      );
    }

    await connectDB();
    await DirectorSettings.findOneAndUpdate(
      { key: DIRECTOR_SETTINGS_KEY },
      { $set: { audioLibraryOrder: nextOrder } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ ok: true, order: nextOrder });
  } catch {
    return NextResponse.json(
      { message: "Could not save the audio library order." },
      { status: 500 }
    );
  }
}
