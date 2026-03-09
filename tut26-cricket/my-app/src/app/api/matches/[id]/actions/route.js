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
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { serializePublicMatch } from "../../../../lib/public-data";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { parseJsonRequest } from "../../../../lib/request-security";
import { matchActionSchema } from "../../../../lib/validators";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

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

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const actionLimit = enforceRateLimit({
    key: `match-action:${id}:${meta.ip}`,
    limit: 10,
    windowMs: 1000,
    blockMs: 3000,
  });

  if (!actionLimit.allowed) {
    await writeAuditLog({
        action: "match_action_rate_limited",
        targetType: "match",
        targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { retryAfterMs: actionLimit.retryAfterMs },
    });

    return jsonRateLimit(
      "Too many scoring actions. Slow down briefly.",
      actionLimit.retryAfterMs
    );
  }

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

    if (isProcessedAction(match, parsedRequest.value.actionId)) {
      return Response.json(
        {
          match: serializePublicMatch(match),
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
    for (const key of MUTABLE_ACTION_KEYS) {
      match[key] = nextState[key];
    }
    await match.save();

    await Session.findByIdAndUpdate(match.sessionId, {
      $set: buildSessionMirrorUpdate(match),
    });

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
        match: serializePublicMatch(match),
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
