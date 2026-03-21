import { cookies } from "next/headers";
import path from "node:path";
import { stat } from "node:fs/promises";
import { z } from "zod";
import { jsonError } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import { createSoundEffectLiveEvent } from "../../../../lib/live-announcements";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { publishMatchUpdate } from "../../../../lib/live-updates";
import { getRequestMeta } from "../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../lib/request-security";
import Match from "../../../../../models/Match";

const SOUND_EFFECTS_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "audio",
  "effects",
);

const soundEffectRequestSchema = z
  .object({
    effectId: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .refine(
        (value) =>
          !value.includes("..") &&
          !/[\\/]/.test(value),
        "effectId is invalid.",
      ),
    clientRequestId: z
      .string()
      .trim()
      .min(8)
      .max(120)
      .regex(/^[a-zA-Z0-9._:-]+$/, "clientRequestId is invalid.")
      .optional(),
  })
  .strict();

function prettifyName(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

async function resolveSoundEffect(effectId) {
  const safeEffectId = String(effectId || "").trim();
  if (!safeEffectId) {
    return null;
  }

  const fullPath = path.join(SOUND_EFFECTS_DIRECTORY, safeEffectId);
  if (!fullPath.startsWith(SOUND_EFFECTS_DIRECTORY)) {
    return null;
  }

  try {
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) {
      return null;
    }

    return {
      id: safeEffectId,
      fileName: safeEffectId,
      label: prettifyName(safeEffectId),
      src: `/audio/effects/${encodeURIComponent(safeEffectId)}`,
    };
  } catch {
    return null;
  }
}

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);

  try {
    const parsedRequest = await parseJsonRequest(req, soundEffectRequestSchema, {
      maxBytes: 8 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();
    const match = await Match.findById(id);
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const hasAccess = await hasMatchAccess(
      id,
      Number(match.adminAccessVersion || 1),
    );
    if (!hasAccess) {
      await writeAuditLog({
        action: "match_sound_effect_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return jsonError("Umpire access required.", 403);
    }

    if (!match.isOngoing || match.result) {
      return jsonError("Sound effects only work during a live match.", 409);
    }

    const effect = await resolveSoundEffect(parsedRequest.value.effectId);
    if (!effect) {
      return jsonError("Sound effect not found.", 404);
    }

    const liveEvent = createSoundEffectLiveEvent(match, effect, {
      clientRequestId: parsedRequest.value.clientRequestId || "",
    });
    match.lastLiveEvent = liveEvent;
    match.lastEventType = liveEvent.type;
    match.lastEventText = liveEvent.summaryText;
    await match.save();

    publishMatchUpdate(match._id);

    await writeAuditLog({
      action: "match_sound_effect",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { effectId: effect.id },
    });

    return Response.json(
      {
        ok: true,
        eventId: liveEvent.id,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return jsonError("Could not play that sound effect.", 500);
  }
}
