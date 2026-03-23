import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { connectDB } from "../../../lib/db";
import DirectorSettings from "../../../../models/DirectorSettings";

const AUDIO_DIRECTORY = path.join(process.cwd(), "public", "audio", "effects");
const DIRECTOR_SETTINGS_KEY = "global";
const AUDIO_LIBRARY_CACHE_TTL_MS = 60_000;
const globalAudioLibraryCache = globalThis.__gvDirectorAudioLibraryCache || {
  files: [],
  order: [],
  expiresAt: 0,
  pending: null,
};
globalThis.__gvDirectorAudioLibraryCache = globalAudioLibraryCache;

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

async function readDirectorAudioLibrarySnapshot() {
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

  return { files, order: audioLibraryOrder };
}

async function getCachedDirectorAudioLibrarySnapshot() {
  if (globalAudioLibraryCache.expiresAt > Date.now()) {
    return {
      files: globalAudioLibraryCache.files,
      order: globalAudioLibraryCache.order,
    };
  }

  if (globalAudioLibraryCache.pending) {
    return globalAudioLibraryCache.pending;
  }

  globalAudioLibraryCache.pending = (async () => {
    try {
      const snapshot = await readDirectorAudioLibrarySnapshot();
      globalAudioLibraryCache.files = snapshot.files;
      globalAudioLibraryCache.order = snapshot.order;
      globalAudioLibraryCache.expiresAt = Date.now() + AUDIO_LIBRARY_CACHE_TTL_MS;
      return snapshot;
    } finally {
      globalAudioLibraryCache.pending = null;
    }
  })();

  return globalAudioLibraryCache.pending;
}

export async function GET() {
  try {
    const { files, order } = await getCachedDirectorAudioLibrarySnapshot();

    return NextResponse.json(
      { files, order },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { files: [] },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
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

    globalAudioLibraryCache.order = nextOrder;
    globalAudioLibraryCache.expiresAt = 0;
    globalAudioLibraryCache.pending = null;

    return NextResponse.json({ ok: true, order: nextOrder });
  } catch {
    return NextResponse.json(
      { message: "Could not save the audio library order." },
      { status: 500 }
    );
  }
}
