/**
 * File overview:
 * Purpose: API route handler for Api requests.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */
import { cookies } from "next/headers";
import { z } from "zod";
import { jsonError } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { getRequestMeta } from "../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../lib/request-security";
import {
  RANDOM_SCORE_EFFECT_ID,
  SCORE_SOUND_EFFECT_KEYS,
  normalizeScoreSoundEffectMap,
} from "../../../../lib/score-sound-effects";
import AnnouncerSettings from "../../../../../models/AnnouncerSettings";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

const UMPIRE_ANNOUNCER_SETTINGS_KEY = "umpire-global";

const scoreSoundEffectIdSchema = z
  .string()
  .trim()
  .max(180)
  .refine(
    (value) =>
      !value ||
      value === RANDOM_SCORE_EFFECT_ID ||
      (!value.includes("..") && !/[\\/]/.test(value)),
    "scoreSoundEffectMap is invalid."
  );

const scoreSoundEffectMapSchema = z
  .object(
    Object.fromEntries(
      SCORE_SOUND_EFFECT_KEYS.map((key) => [key, scoreSoundEffectIdSchema.optional()])
    )
  )
  .partial()
  .strict();

const announcerSettingsPatchSchema = z
  .object({
    scoreSoundEffectMap: scoreSoundEffectMapSchema,
  })
  .strict();

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

async function readStoredScoreSoundEffectMap(match) {
  const storedSettings = await AnnouncerSettings.findOne({
    key: UMPIRE_ANNOUNCER_SETTINGS_KEY,
  })
    .select("scoreSoundEffectMap")
    .lean();

  if (storedSettings?.scoreSoundEffectMap) {
    return normalizeScoreSoundEffectMap(storedSettings.scoreSoundEffectMap);
  }

  const matchMap = match?.announcer?.scoreSoundEffectMap;
  if (matchMap && typeof matchMap === "object") {
    return normalizeScoreSoundEffectMap(matchMap);
  }

  const sessionId = String(match?.sessionId || "");
  if (!sessionId) {
    return normalizeScoreSoundEffectMap();
  }

  const session = await Session.findById(sessionId)
    .select("announcer")
    .lean();
  const sessionMap = session?.announcer?.scoreSoundEffectMap;
  return normalizeScoreSoundEffectMap(sessionMap || {});
}

export async function GET(_req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(_req);

  try {
    await connectDB();
    const match = await Match.findById(id).select("adminAccessVersion sessionId announcer");
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const hasAccess = await hasMatchAccess(id, Number(match.adminAccessVersion || 1));
    if (!hasAccess) {
      await writeAuditLog({
        action: "announcer_settings_read_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return jsonError("Umpire access required.", 403);
    }

    return Response.json(
      {
        scoreSoundEffectMap: await readStoredScoreSoundEffectMap(match),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Could not load announcer settings:", error);
    return jsonError("Could not load announcer settings.", 500);
  }
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);

  try {
    const parsedRequest = await parseJsonRequest(req, announcerSettingsPatchSchema, {
      maxBytes: 16 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();
    const match = await Match.findById(id).select("adminAccessVersion sessionId announcer");
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const hasAccess = await hasMatchAccess(id, Number(match.adminAccessVersion || 1));
    if (!hasAccess) {
      await writeAuditLog({
        action: "announcer_settings_write_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return jsonError("Umpire access required.", 403);
    }

    const normalizedScoreSoundEffectMap = normalizeScoreSoundEffectMap(
      parsedRequest.value.scoreSoundEffectMap
    );

    await AnnouncerSettings.findOneAndUpdate(
      { key: UMPIRE_ANNOUNCER_SETTINGS_KEY },
      {
        $set: {
          key: UMPIRE_ANNOUNCER_SETTINGS_KEY,
          role: "umpire",
          scoreSoundEffectMap: normalizedScoreSoundEffectMap,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    await Match.findByIdAndUpdate(id, {
      $set: {
        announcer: {
          ...(match.announcer && typeof match.announcer === "object"
            ? match.announcer
            : {}),
          scoreSoundEffectMap: normalizedScoreSoundEffectMap,
        },
      },
    });

    if (match.sessionId) {
      const session = await Session.findById(match.sessionId)
        .select("announcer")
        .lean();
      await Session.findByIdAndUpdate(match.sessionId, {
        $set: {
          announcer: {
            ...(session?.announcer && typeof session.announcer === "object"
              ? session.announcer
              : {}),
            scoreSoundEffectMap: normalizedScoreSoundEffectMap,
          },
        },
      });
    }

    await writeAuditLog({
      action: "announcer_settings_write",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        scope: "umpire_global_score_sound_map",
      },
    });

    return Response.json(
      {
        ok: true,
        scoreSoundEffectMap: normalizedScoreSoundEffectMap,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Could not save announcer settings:", error);
    return jsonError("Could not save announcer settings.", 500);
  }
}
