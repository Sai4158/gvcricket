/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import {
  applyMatchAction,
  buildSessionMirrorUpdate,
  isProcessedAction,
  MatchEngineError,
} from "../../../../lib/match-engine";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { serializePublicMatch } from "../../../../lib/public-data";
import { getRequestMeta } from "../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../lib/request-security";
import { hydrateLegacyTossState } from "../../../../lib/match-toss";
import { matchActionSchema } from "../../../../lib/validators";
import { invalidateSessionsDataCache } from "../../../../lib/server-data";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

const FALLBACK_SESSION_FIELDS =
  "tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy updatedAt";

const MUTABLE_ACTION_KEYS = [
  "tossWinner",
  "tossDecision",
  "score",
  "outs",
  "isOngoing",
  "innings",
  "result",
  "innings1",
  "innings2",
  "balls",
  "lastLiveEvent",
  "lastEventType",
  "lastEventText",
  "processedActionIds",
  "actionHistory",
];

function isMatchCompleted(match) {
  return Boolean(String(match?.result || "").trim()) && !Boolean(match?.isOngoing);
}

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);

  try {
    const parsedRequest = await parseJsonRequest(req, matchActionSchema, {
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
      Number(match.adminAccessVersion || 1)
    );
    if (!hasAccess) {
      await writeAuditLog({
        action: "match_action_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { type: parsedRequest.value.type },
      });

      return jsonError("Umpire access required.", 403);
    }

    if (isMatchCompleted(match)) {
      await writeAuditLog({
        action: "match_action_completed_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { type: parsedRequest.value.type },
      });

      return jsonError("This match is complete. Open the result page instead.", 409);
    }

    const fallbackSession = match.sessionId
      ? await Session.findById(match.sessionId).select(
          FALLBACK_SESSION_FIELDS
        )
      : null;

    if (hydrateLegacyTossState(match, fallbackSession)) {
      await match.save();
      await Session.findByIdAndUpdate(match.sessionId, {
        $set: buildSessionMirrorUpdate(match),
      });
    }

    if (isProcessedAction(match, parsedRequest.value.actionId)) {
      return Response.json(
        {
          match: serializePublicMatch(match, fallbackSession, {
            includeActionHistory: true,
          }),
          replayed: true,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const nextState = applyMatchAction(match, parsedRequest.value);
    const updatePayload = {};
    for (const key of MUTABLE_ACTION_KEYS) {
      updatePayload[key] = nextState[key];
    }

    const updatedMatch = await Match.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    );
    if (!updatedMatch) {
      return jsonError("Match not found.", 404);
    }

    await Session.findByIdAndUpdate(updatedMatch.sessionId, {
      $set: buildSessionMirrorUpdate(updatedMatch),
    });
    invalidateSessionsDataCache();
    publishMatchUpdate(updatedMatch._id);
    publishSessionUpdate(updatedMatch.sessionId);

    await writeAuditLog({
      action: parsedRequest.value.type,
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { actionId: parsedRequest.value.actionId },
    });

    return Response.json(
        {
          match: serializePublicMatch(updatedMatch, fallbackSession, {
            includeActionHistory: true,
          }),
        },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof MatchEngineError) {
      await writeAuditLog({
        action: "match_action_rejected",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { error: error.message },
      });

      return jsonError(error.message, error.status);
    }

    return jsonError("Could not update the match.", 500);
  }
}


