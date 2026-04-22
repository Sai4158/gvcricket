/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import { connectDB } from "../../../lib/db";
import {
  applySafeMatchPatch,
  buildSessionMirrorUpdate,
  MatchEngineError,
} from "../../../lib/match-engine";
import { publishMatchUpdate, publishSessionUpdate } from "../../../lib/live-updates";
import {
  getClearedMatchAccessCookie,
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../lib/match-access";
import { serializePublicMatch, serializeUmpireBootstrap } from "../../../lib/public-data";
import {
  finalizePendingResultIfExpired,
  isFinalizedMatchComplete,
} from "../../../lib/pending-match-result";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import {
  ensureSameOrigin,
  parseJsonRequest,
} from "../../../lib/request-security";
import { hydrateLegacyTossState } from "../../../lib/match-toss";
import { matchPatchSchema } from "../../../lib/validators";
import { invalidateSessionsDataCache } from "../../../lib/server-data";
import Match from "../../../../models/Match";
import MatchUndoEntry from "../../../../models/MatchUndoEntry";
import Session from "../../../../models/Session";

const FALLBACK_SESSION_FIELDS =
  "tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy updatedAt";

function isMatchCompleted(match) {
  return isFinalizedMatchComplete(match);
}

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const umpireView = req.nextUrl.searchParams.get("view") === "umpire";
    await connectDB();
    const match = await Match.findById(id);

    if (!match) {
      return jsonError("Match not found.", 404);
    }
    const finalizedMatch = await finalizePendingResultIfExpired(match);

    const hasAccess = await hasMatchAccess(
      id,
      Number(finalizedMatch.adminAccessVersion || 1)
    );

    const fallbackSession = finalizedMatch.sessionId
      ? await Session.findById(finalizedMatch.sessionId).select(
          FALLBACK_SESSION_FIELDS
        )
      : null;

    if (hydrateLegacyTossState(finalizedMatch, fallbackSession)) {
      await finalizedMatch.save();
      await Session.findByIdAndUpdate(
        finalizedMatch.sessionId,
        {
          $set: buildSessionMirrorUpdate(finalizedMatch),
        },
        {
          timestamps: false,
        }
      );
    }

    return Response.json(
      umpireView
        ? serializeUmpireBootstrap(finalizedMatch, fallbackSession)
        : serializePublicMatch(finalizedMatch, fallbackSession),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return jsonError("Could not load match.", 500);
  }
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const updateLimit = enforceRateLimit({
    key: `match-admin-patch:${id}:${meta.ip}`,
    limit: 8,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!updateLimit.allowed) {
    await writeAuditLog({
        action: "match_patch_rate_limited",
        targetType: "match",
        targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { retryAfterMs: updateLimit.retryAfterMs },
    });

    return jsonRateLimit(
      "Too many admin updates. Try again shortly.",
      updateLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, matchPatchSchema, {
      maxBytes: 16 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();
    const match = await Match.findById(id);
    if (!match) {
      return jsonError("Match not found.", 404);
    }
    const finalizedMatch = await finalizePendingResultIfExpired(match);

    const hasAccess = await hasMatchAccess(
      id,
      Number(finalizedMatch.adminAccessVersion || 1)
    );
    if (!hasAccess) {
      await writeAuditLog({
        action: "match_patch_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError("Umpire access required.", 403);
    }

    if (isMatchCompleted(finalizedMatch)) {
      await writeAuditLog({
        action: "match_patch_completed_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError("This match is complete. Open the result page instead.", 409);
    }

    const fallbackSession = finalizedMatch.sessionId
      ? await Session.findById(finalizedMatch.sessionId).select(
          FALLBACK_SESSION_FIELDS
        )
      : null;

    if (hydrateLegacyTossState(finalizedMatch, fallbackSession)) {
      await finalizedMatch.save();
      await Session.findByIdAndUpdate(
        finalizedMatch.sessionId,
        {
          $set: buildSessionMirrorUpdate(finalizedMatch),
        },
        {
          timestamps: false,
        }
      );
    }

    const nextState = applySafeMatchPatch(finalizedMatch, parsedRequest.value);
    finalizedMatch.teamA = nextState.teamA;
    finalizedMatch.teamB = nextState.teamB;
    finalizedMatch.teamAName = nextState.teamAName;
    finalizedMatch.teamBName = nextState.teamBName;
    finalizedMatch.overs = nextState.overs;
    finalizedMatch.score = nextState.score;
    finalizedMatch.outs = nextState.outs;
    finalizedMatch.isOngoing = nextState.isOngoing;
    finalizedMatch.innings = nextState.innings;
    finalizedMatch.result = nextState.result;
    finalizedMatch.pendingResult = nextState.pendingResult;
    finalizedMatch.pendingResultAt = nextState.pendingResultAt;
    finalizedMatch.resultAutoFinalizeAt = nextState.resultAutoFinalizeAt;
    finalizedMatch.tossWinner = nextState.tossWinner;
    finalizedMatch.innings1 = nextState.innings1;
    finalizedMatch.innings2 = nextState.innings2;
    finalizedMatch.balls = nextState.balls;
    finalizedMatch.lastLiveEvent = nextState.lastLiveEvent;
    finalizedMatch.lastEventType = nextState.lastEventType;
    finalizedMatch.lastEventText = nextState.lastEventText;
    finalizedMatch.announcerEnabled = nextState.announcerEnabled;
    finalizedMatch.announcerMode = nextState.announcerMode;
    finalizedMatch.announcerScoreSoundEffectsEnabled =
      nextState.announcerScoreSoundEffectsEnabled;
    finalizedMatch.announcerBroadcastScoreSoundEffectsEnabled =
      nextState.announcerBroadcastScoreSoundEffectsEnabled;
    await finalizedMatch.save();

    await Session.findByIdAndUpdate(
      finalizedMatch.sessionId,
      {
        $set: buildSessionMirrorUpdate(finalizedMatch),
      },
      {
        timestamps: false,
      }
    );
    invalidateSessionsDataCache();
    publishMatchUpdate(finalizedMatch._id);
    publishSessionUpdate(finalizedMatch.sessionId);

    await writeAuditLog({
      action: "match_patch",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { fields: Object.keys(parsedRequest.value) },
    });

    return Response.json(serializePublicMatch(finalizedMatch, fallbackSession), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof MatchEngineError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Could not update match.", 500);
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const originCheck = ensureSameOrigin(req);
  if (!originCheck.ok) {
    return jsonError(originCheck.message, originCheck.status);
  }

  const meta = getRequestMeta(req);

  try {
    await connectDB();
    const match = await Match.findById(id);
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const hasAccess = await hasMatchAccess(
      id,
      Number(match.adminAccessVersion || 1)
    );
    if (!hasAccess) {
      await writeAuditLog({
        action: "match_delete_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError("Umpire access required.", 403);
    }

    await Session.findByIdAndUpdate(match.sessionId, {
      $set: {
        match: null,
        isLive: false,
      },
    });
    await MatchUndoEntry.deleteMany({ matchId: match._id });
    await Match.findByIdAndDelete(id);
    invalidateSessionsDataCache();
    publishMatchUpdate(id);
    publishSessionUpdate(match.sessionId);

    await writeAuditLog({
      action: "match_delete",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const response = new NextResponse(null, { status: 204 });
    const clearedCookie = getClearedMatchAccessCookie(id);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(
      clearedCookie.name,
      clearedCookie.value,
      clearedCookie.options
    );
    return response;
  } catch {
    return jsonError("Could not delete match.", 500);
  }
}


