/**
 * File overview:
 * Purpose: Handles the hot scoring path for instant umpire score taps.
 * Main exports: module side effects only.
 * Major callers: Match scoring client queue.
 * Side effects: writes match state, undo snapshots, and live update events.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { jsonError } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import {
  applyMatchAction,
  buildRecentActionIds,
  createMatchUndoSnapshot,
  getMatchUndoCount,
  isProcessedAction,
  MatchEngineError,
} from "../../../../lib/match-engine";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { serializeLiveMatchPatch } from "../../../../lib/public-data";
import { getRequestMeta } from "../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../lib/request-security";
import { invalidateSessionsDataCache } from "../../../../lib/server-data";
import { matchScoreSchema } from "../../../../lib/validators";
import Match from "../../../../../models/Match";
import MatchUndoEntry from "../../../../../models/MatchUndoEntry";
import Session from "../../../../../models/Session";

const SCORE_MUTABLE_KEYS = [
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
];

function buildScoreUpdatePayload(nextState, currentMatch, actionId) {
  const updatePayload = {};

  for (const key of SCORE_MUTABLE_KEYS) {
    updatePayload[key] = nextState[key];
  }

  updatePayload.recentActionIds = buildRecentActionIds(
    currentMatch?.recentActionIds || currentMatch?.processedActionIds || [],
    actionId,
  );
  updatePayload.processedActionIds = buildRecentActionIds(
    currentMatch?.processedActionIds || currentMatch?.recentActionIds || [],
    actionId,
  );
  updatePayload.undoCount = getMatchUndoCount(currentMatch) + 1;
  updatePayload.undoSequence = Math.max(
    0,
    Number(currentMatch?.undoSequence || 0),
  ) + 1;

  return updatePayload;
}

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

function isMatchCompleted(match) {
  return Boolean(String(match?.result || "").trim()) && !Boolean(match?.isOngoing);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);

  try {
    const parsedRequest = await parseJsonRequest(req, matchScoreSchema, {
      maxBytes: 4 * 1024,
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
      void writeAuditLog({
        action: "match_score_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { actionId: parsedRequest.value.actionId },
      });
      return jsonError("Umpire access required.", 403);
    }

    if (isMatchCompleted(match)) {
      return jsonError("This match is complete. Open the result page instead.", 409);
    }

    if (isProcessedAction(match, parsedRequest.value.actionId)) {
      return Response.json(
        {
          ok: true,
          actionId: parsedRequest.value.actionId,
          replayed: true,
          matchPatch: serializeLiveMatchPatch(match),
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const nextState = applyMatchAction(match, {
      ...parsedRequest.value,
      type: "score_ball",
    });
    const updatePayload = buildScoreUpdatePayload(
      nextState,
      match,
      parsedRequest.value.actionId,
    );

    let createdUndoEntry = null;
    try {
      createdUndoEntry = await MatchUndoEntry.create({
        matchId: match._id,
        sequence: updatePayload.undoSequence,
        actionId: parsedRequest.value.actionId,
        type: "score_ball",
        snapshot: createMatchUndoSnapshot(match),
      });
    } catch (error) {
      console.error("Could not create score undo snapshot:", error);
      return jsonError("Could not update the match.", 500);
    }

    const updatedMatch = await Match.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true },
    );
    if (!updatedMatch) {
      if (createdUndoEntry?._id) {
        void MatchUndoEntry.findByIdAndDelete(createdUndoEntry._id).catch(() => {});
      }
      return jsonError("Match not found.", 404);
    }

    invalidateSessionsDataCache();
    publishMatchUpdate(updatedMatch._id);

    void Session.findByIdAndUpdate(
      updatedMatch.sessionId,
      {
        $set: {
          isLive: Boolean(updatedMatch.isOngoing),
          lastEventType: updatedMatch.lastEventType || "",
          lastEventText: updatedMatch.lastEventText || "",
        },
      },
      {
        timestamps: false,
      },
    )
      .then(() => {
        publishSessionUpdate(updatedMatch.sessionId);
      })
      .catch((error) => {
        console.error("Could not update session score mirror:", error);
      });

    void writeAuditLog({
      action: "match_score_ball",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { actionId: parsedRequest.value.actionId },
    });

    return Response.json(
      {
        ok: true,
        actionId: parsedRequest.value.actionId,
        matchPatch: serializeLiveMatchPatch(updatedMatch),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof MatchEngineError) {
      return jsonError(error.message, error.status);
    }

    console.error("Match score update failed:", error);
    return jsonError("Could not update the match.", 500);
  }
}
