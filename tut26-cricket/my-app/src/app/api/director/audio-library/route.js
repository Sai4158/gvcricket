import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { connectDB } from "../../../lib/db";
import {
  getDirectorAccessCookieName,
  hasValidDirectorAccess,
} from "../../../lib/director-access";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { parseJsonRequest } from "../../../lib/request-security";
import DirectorSettings from "../../../../models/DirectorSettings";

const AUDIO_DIRECTORY = path.join(process.cwd(), "public", "audio", "effects");
const DIRECTOR_SETTINGS_KEY = "global";
const AUDIO_LIBRARY_CACHE_TTL_MS = 60_000;
const audioLibraryOrderSchema = z
  .object({
    order: z.array(
      z
        .string()
        .trim()
        .min(1)
        .max(160)
        .regex(/^[^<>:"/\\|?*\u0000-\u001F]+$/, "Audio file id is invalid.")
    ),
  })
  .strict();
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
  const meta = getRequestMeta(req);
  const reorderLimit = enforceRateLimit({
    key: `director-audio-order:${meta.ip}`,
    limit: 20,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!reorderLimit.allowed) {
    return jsonRateLimit(
      "Too many audio library changes. Try again shortly.",
      reorderLimit.retryAfterMs
    );
  }

  try {
    const cookieStore = await cookies();
    const directorToken = cookieStore.get(getDirectorAccessCookieName())?.value;
    if (!hasValidDirectorAccess(directorToken)) {
      return jsonError("Director access required.", 403);
    }

    const parsedRequest = await parseJsonRequest(req, audioLibraryOrderSchema, {
      maxBytes: 16 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    const nextOrder = [...new Set(parsedRequest.value.order)];
    const snapshot = await getCachedDirectorAudioLibrarySnapshot();
    const validIds = new Set(snapshot.files.map((file) => file.id));
    const filteredOrder = nextOrder.filter((value) => validIds.has(value));

    await connectDB();
    await DirectorSettings.findOneAndUpdate(
      { key: DIRECTOR_SETTINGS_KEY },
      { $set: { audioLibraryOrder: filteredOrder } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    globalAudioLibraryCache.order = filteredOrder;
    globalAudioLibraryCache.expiresAt = 0;
    globalAudioLibraryCache.pending = null;

    return NextResponse.json({ ok: true, order: filteredOrder });
  } catch {
    return jsonError("Could not save the audio library order.", 500);
  }
}
