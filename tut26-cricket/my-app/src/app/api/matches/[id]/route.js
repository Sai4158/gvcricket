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
import { serializePublicMatch } from "../../../lib/public-data";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import {
  ensureSameOrigin,
  parseJsonRequest,
} from "../../../lib/request-security";
import { hydrateLegacyTossState } from "../../../lib/match-toss";
import { matchPatchSchema } from "../../../lib/validators";
import Match from "../../../../models/Match";
import Session from "../../../../models/Session";

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    await connectDB();
    const match = await Match.findById(id);

    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const hasAccess = await hasMatchAccess(
      id,
      Number(match.adminAccessVersion || 1)
    );

    const fallbackSession = match.sessionId
      ? await Session.findById(match.sessionId).select(
          "tossWinner tossDecision teamAName teamBName teamA teamB"
        )
      : null;

    if (hydrateLegacyTossState(match, fallbackSession)) {
      await match.save();
      await Session.findByIdAndUpdate(match.sessionId, {
        $set: buildSessionMirrorUpdate(match),
      });
    }

    return Response.json(
      serializePublicMatch(match, fallbackSession, {
        includeActionHistory: hasAccess,
      }),
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

    const hasAccess = await hasMatchAccess(
      id,
      Number(match.adminAccessVersion || 1)
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

    const fallbackSession = match.sessionId
      ? await Session.findById(match.sessionId).select(
          "tossWinner tossDecision teamAName teamBName teamA teamB"
        )
      : null;

    if (hydrateLegacyTossState(match, fallbackSession)) {
      await match.save();
      await Session.findByIdAndUpdate(match.sessionId, {
        $set: buildSessionMirrorUpdate(match),
      });
    }

    const nextState = applySafeMatchPatch(match, parsedRequest.value);
    match.teamA = nextState.teamA;
    match.teamB = nextState.teamB;
    match.teamAName = nextState.teamAName;
    match.teamBName = nextState.teamBName;
    match.overs = nextState.overs;
    match.score = nextState.score;
    match.outs = nextState.outs;
    match.isOngoing = nextState.isOngoing;
    match.innings = nextState.innings;
    match.result = nextState.result;
    match.tossWinner = nextState.tossWinner;
    match.innings1 = nextState.innings1;
    match.innings2 = nextState.innings2;
    match.balls = nextState.balls;
    match.lastLiveEvent = nextState.lastLiveEvent;
    match.lastEventType = nextState.lastEventType;
    match.lastEventText = nextState.lastEventText;
    match.announcerEnabled = nextState.announcerEnabled;
    match.announcerMode = nextState.announcerMode;
    match.announcerScoreSoundEffectsEnabled =
      nextState.announcerScoreSoundEffectsEnabled;
    match.announcerBroadcastScoreSoundEffectsEnabled =
      nextState.announcerBroadcastScoreSoundEffectsEnabled;
    await match.save();

    await Session.findByIdAndUpdate(match.sessionId, {
      $set: buildSessionMirrorUpdate(match),
    });
    publishMatchUpdate(match._id);
    publishSessionUpdate(match.sessionId);

    await writeAuditLog({
      action: "match_patch",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { fields: Object.keys(parsedRequest.value) },
    });

    return Response.json(serializePublicMatch(match, null, { includeActionHistory: true }), {
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
    await Match.findByIdAndDelete(id);
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
