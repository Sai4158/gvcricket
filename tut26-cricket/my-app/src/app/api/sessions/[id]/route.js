/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { z } from "zod";
import Session from "../../../../models/Session";
import Match from "../../../../models/Match";
import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import { connectDB } from "../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
  isValidManagePin,
  isValidUmpirePin,
} from "../../../lib/match-access";
import { serializePublicSession } from "../../../lib/public-data";
import { enforceSmartPinRateLimit } from "../../../lib/pin-attempt-server";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { parseJsonRequest } from "../../../lib/request-security";
import { hasValidDraftToken } from "../../../lib/session-draft";
import { invalidateSessionsDataCache } from "../../../lib/server-data";
import { syncTeamNamesAcrossMatch } from "../../../lib/match-scoring";
import { buildSessionMirrorUpdate } from "../../../lib/match-engine";
import {
  pinSchema,
  sessionPatchObjectSchema,
  secretPinSchema,
} from "../../../lib/validators";

const sessionAdminPatchSchema = z
  .object({
    pin: z.union([pinSchema, secretPinSchema]).optional(),
  })
  .extend(sessionPatchObjectSchema.shape)
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "pin"), {
    message: "No valid session fields provided.",
  });

const sessionDeleteSchema = z
  .object({
    draftToken: z.string().trim().optional(),
    pin: secretPinSchema.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.draftToken || value.pin), {
    message: "A draft token or manage PIN is required.",
  });

async function hasSessionAdminAccess(session) {
  const matchId = session?.match ? String(session.match) : "";
  if (!matchId) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;

  return hasValidMatchAccess(
    matchId,
    token,
    Number(session.adminAccessVersion || 1)
  );
}

export async function GET(_req, { params }) {
  const { id } = await params;
  await connectDB();
  const session = await Session.findById(id);
  if (!session) {
    return jsonError("Session not found.", 404);
  }

  return Response.json(serializePublicSession(session), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const patchLimit = enforceRateLimit({
    key: `session-patch:${id}:${meta.ip}`,
    limit: 6,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!patchLimit.allowed) {
    return jsonRateLimit(
      "Too many admin update attempts. Try again shortly.",
      patchLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, sessionAdminPatchSchema, {
      maxBytes: 16 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }
    const pinValue = String(parsedRequest.value.pin || "").trim();
    if (pinValue) {
      const pinAttemptLimit = enforceSmartPinRateLimit({
        key: `session-patch-pin:${id}:${meta.ip}`,
        longLimit: 5,
        longWindowMs: 5 * 60 * 1000,
        longBlockMs: 2 * 60 * 1000,
      });

      if (!pinAttemptLimit.allowed) {
        return jsonRateLimit(
          "Too many PIN attempts. Try again shortly.",
          pinAttemptLimit.retryAfterMs,
        );
      }
    }

    await connectDB();
    const session = await Session.findById(id);
    if (!session) {
      return jsonError("Session not found.", 404);
    }

    const hasCookieAccess = await hasSessionAdminAccess(session);
    const hasPinAccess = pinValue
      ? isValidUmpirePin(pinValue) || isValidManagePin(pinValue)
      : false;

    if (!hasCookieAccess && !hasPinAccess) {
      await writeAuditLog({
        action: "session_patch_denied",
        targetType: "session",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError("Admin access required.", 403);
    }

    const { pin: _pin, ...safePatch } = parsedRequest.value;
    const previousNames = {
      teamAName: String(session.teamAName || "").trim(),
      teamBName: String(session.teamBName || "").trim(),
    };
    const nextNames = {
      teamAName:
        safePatch.teamAName !== undefined
          ? String(safePatch.teamAName || "").trim()
          : previousNames.teamAName,
      teamBName:
        safePatch.teamBName !== undefined
          ? String(safePatch.teamBName || "").trim()
          : previousNames.teamBName,
    };
    const normalizedSessionPatch = { ...safePatch };

    if (session.tossWinner === previousNames.teamAName) {
      normalizedSessionPatch.tossWinner = nextNames.teamAName;
    } else if (session.tossWinner === previousNames.teamBName) {
      normalizedSessionPatch.tossWinner = nextNames.teamBName;
    }

    const nextIsLive = normalizedSessionPatch.isLive ?? session.isLive;
    const preserveEndedTimestamp = Boolean(session.match && !nextIsLive);

    const updatedSession = await Session.findByIdAndUpdate(
      id,
      {
        $set: normalizedSessionPatch,
      },
      {
        new: true,
        runValidators: true,
        ...(preserveEndedTimestamp ? { timestamps: false } : {}),
      }
    );
    if (!updatedSession) {
      return jsonError("Session not found.", 404);
    }

    if (updatedSession.match) {
      const linkedMatch = await Match.findById(updatedSession.match)
        .select("teamA teamB teamAName teamBName overs tossWinner tossDecision score outs isOngoing innings result pendingResult innings1 innings2 matchImages matchImageUrl matchImagePublicId matchImageUploadedAt matchImageUploadedBy liveStream announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled lastEventType lastEventText adminAccessVersion")
        .lean();
      const syncedMatch = linkedMatch
        ? syncTeamNamesAcrossMatch(linkedMatch, previousNames, nextNames)
        : null;
      const linkedMatchUpdate = {
        teamA: updatedSession.teamA,
        teamB: updatedSession.teamB,
        teamAName: updatedSession.teamAName,
        teamBName: updatedSession.teamBName,
        overs: updatedSession.overs,
        tossWinner: syncedMatch?.tossWinner || updatedSession.tossWinner,
        tossDecision: syncedMatch?.tossDecision || updatedSession.tossDecision,
        score: syncedMatch?.score,
        outs: syncedMatch?.outs,
        isOngoing: syncedMatch?.isOngoing,
        innings: syncedMatch?.innings,
        result: syncedMatch?.result,
        pendingResult: syncedMatch?.pendingResult,
        matchImages: updatedSession.matchImages,
        matchImageUrl: updatedSession.matchImageUrl,
        matchImagePublicId: updatedSession.matchImagePublicId,
        matchImageUploadedAt: updatedSession.matchImageUploadedAt,
        matchImageUploadedBy: updatedSession.matchImageUploadedBy,
        announcerEnabled: updatedSession.announcerEnabled,
        announcerMode: updatedSession.announcerMode,
        lastEventType: updatedSession.lastEventType,
        lastEventText: updatedSession.lastEventText,
        adminAccessVersion: updatedSession.adminAccessVersion,
      };

      if (syncedMatch?.innings1) {
        linkedMatchUpdate.innings1 = syncedMatch.innings1;
      }

      if (syncedMatch?.innings2) {
        linkedMatchUpdate.innings2 = syncedMatch.innings2;
      }

      const updatedMatch = await Match.findByIdAndUpdate(
        updatedSession.match,
        {
          $set: linkedMatchUpdate,
        },
        {
          new: true,
          runValidators: true,
          ...(preserveEndedTimestamp ? { timestamps: false } : {}),
        },
      );

      if (updatedMatch) {
        Object.assign(updatedSession, buildSessionMirrorUpdate(updatedMatch));
        await updatedSession.save(
          preserveEndedTimestamp ? { timestamps: false } : undefined,
        );
      }
    }

    invalidateSessionsDataCache();
    {
      const { publishMatchUpdate, publishSessionUpdate } = await import(
        "../../../lib/live-updates"
      );
      if (updatedSession.match) {
        publishMatchUpdate(String(updatedSession.match));
      }
      publishSessionUpdate(id);
    }

    await writeAuditLog({
      action: "session_patch",
      targetType: "session",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { fields: Object.keys(normalizedSessionPatch) },
    });

    return Response.json(serializePublicSession(updatedSession), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Could not update the session.", 500);
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const deleteLimit = enforceRateLimit({
    key: `session-delete:${id}:${meta.ip}`,
    limit: 6,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!deleteLimit.allowed) {
    return jsonRateLimit(
      "Too many delete attempts. Try again shortly.",
      deleteLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, sessionDeleteSchema, {
      maxBytes: 4096,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }
    const pinValue = String(parsedRequest.value.pin || "").trim();
    if (pinValue) {
      const pinAttemptLimit = enforceSmartPinRateLimit({
        key: `session-delete-pin:${id}:${meta.ip}`,
        longLimit: 5,
        longWindowMs: 5 * 60 * 1000,
        longBlockMs: 2 * 60 * 1000,
      });

      if (!pinAttemptLimit.allowed) {
        return jsonRateLimit(
          "Too many PIN attempts. Try again shortly.",
          pinAttemptLimit.retryAfterMs,
        );
      }
    }

    await connectDB();
    const session = await Session.findById(id).lean();
    if (!session) {
      return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (
      session.isDraft &&
      !session.match &&
      !session.isLive &&
      parsedRequest.value.draftToken
    ) {
      if (!hasValidDraftToken(session, parsedRequest.value.draftToken)) {
        return jsonError("Draft access denied.", 403);
      }

      await Session.deleteOne({ _id: id });
      invalidateSessionsDataCache();
      const { publishSessionUpdate } = await import("../../../lib/live-updates");
      publishSessionUpdate(id);

      await writeAuditLog({
        action: "session_draft_delete",
        targetType: "session",
        targetId: id,
        status: "success",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return Response.json(
        { ok: true },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const hasCookieAccess = await hasSessionAdminAccess(session);
    const hasPinAccess = pinValue ? isValidManagePin(pinValue) : false;

    if (!hasCookieAccess && !hasPinAccess) {
      return jsonError("Manage access denied.", 403);
    }

    const matchId = session.match ? String(session.match) : "";
    if (matchId) {
      await Match.deleteOne({ _id: matchId });
    }
    await Session.deleteOne({ _id: id });
    invalidateSessionsDataCache();

    await writeAuditLog({
      action: "session_delete",
      targetType: "session",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    {
      const { publishMatchUpdate, publishSessionUpdate } = await import(
        "../../../lib/live-updates"
      );
      if (matchId) {
        publishMatchUpdate(matchId);
      }
      publishSessionUpdate(id);
    }

    return Response.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return jsonError("Could not remove the session.", 500);
  }
}


