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
  buildRecentActionIds,
  buildSessionMirrorUpdate,
  getMatchUndoCount,
  isProcessedAction,
  MatchEngineError,
  restoreMatchUndoSnapshot,
} from "../../../../lib/match-engine";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { serializeLiveMatchPatch, serializePublicMatch } from "../../../../lib/public-data";
import {
  finalizePendingResultIfExpired,
  isFinalizedMatchComplete,
} from "../../../../lib/pending-match-result";
import { getRequestMeta } from "../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../lib/request-security";
import { hydrateLegacyTossState } from "../../../../lib/match-toss";
import { createUndoLiveEvent } from "../../../../lib/live-announcements";
import { matchActionSchema } from "../../../../lib/validators";
import { invalidateSessionsDataCache } from "../../../../lib/server-data";
import Match from "../../../../../models/Match";
import MatchUndoEntry from "../../../../../models/MatchUndoEntry";
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
  "pendingResult",
  "pendingResultAt",
  "resultAutoFinalizeAt",
  "innings1",
  "innings2",
  "balls",
  "lastLiveEvent",
  "lastEventType",
  "lastEventText",
  "recentActionIds",
  "undoCount",
  "undoSequence",
  "processedActionIds",
  "actionHistory",
];

function isMatchCompleted(match) {
  return isFinalizedMatchComplete(match);
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
    const finalizedMatch = await finalizePendingResultIfExpired(match);

    const hasAccess = await hasMatchAccess(
      id,
      Number(finalizedMatch.adminAccessVersion || 1)
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

    if (isMatchCompleted(finalizedMatch)) {
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

    const fallbackSession = finalizedMatch.sessionId
      ? await Session.findById(finalizedMatch.sessionId).select(
          FALLBACK_SESSION_FIELDS
        )
      : null;

    if (hydrateLegacyTossState(finalizedMatch, fallbackSession)) {
      await finalizedMatch.save();
      await Session.findByIdAndUpdate(finalizedMatch.sessionId, {
        $set: buildSessionMirrorUpdate(finalizedMatch),
      });
    }

    if (isProcessedAction(finalizedMatch, parsedRequest.value.actionId)) {
      return Response.json(
        {
          match: serializePublicMatch(finalizedMatch, fallbackSession),
          replayed: true,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (parsedRequest.value.type === "score_ball") {
      return jsonError("Score taps must use the dedicated score route.", 409);
    }

    let updatePayload = {};

    if (parsedRequest.value.type === "undo_last") {
      const latestUndoEntry = await MatchUndoEntry.findOne({
        matchId: finalizedMatch._id,
      })
        .sort({ sequence: -1, createdAt: -1 })
        .lean();

      if (latestUndoEntry?.snapshot) {
        const restoredMatch = restoreMatchUndoSnapshot(finalizedMatch, latestUndoEntry.snapshot);
        const undoEvent = createUndoLiveEvent(restoredMatch);

        updatePayload = {
          tossWinner: restoredMatch.tossWinner,
          tossDecision: restoredMatch.tossDecision,
          score: restoredMatch.score,
          outs: restoredMatch.outs,
          isOngoing: restoredMatch.isOngoing,
          innings: restoredMatch.innings,
          result: restoredMatch.result,
          pendingResult: restoredMatch.pendingResult,
          pendingResultAt: restoredMatch.pendingResultAt,
          resultAutoFinalizeAt: restoredMatch.resultAutoFinalizeAt,
          innings1: restoredMatch.innings1,
          innings2: restoredMatch.innings2,
          balls: restoredMatch.balls,
          lastLiveEvent: undoEvent,
          lastEventType: undoEvent.type,
          lastEventText: undoEvent.summaryText,
          recentActionIds: buildRecentActionIds(
            finalizedMatch.recentActionIds || finalizedMatch.processedActionIds || [],
            parsedRequest.value.actionId,
          ),
          processedActionIds: buildRecentActionIds(
            finalizedMatch.processedActionIds || finalizedMatch.recentActionIds || [],
            parsedRequest.value.actionId,
          ),
          undoCount: Math.max(0, getMatchUndoCount(finalizedMatch) - 1),
          undoSequence: Math.max(0, Number(finalizedMatch.undoSequence || 0)),
        };

        const updatedMatch = await Match.findByIdAndUpdate(
          id,
          { $set: updatePayload },
          { new: true, runValidators: true },
        );
        if (!updatedMatch) {
          return jsonError("Match not found.", 404);
        }

        await MatchUndoEntry.findByIdAndDelete(latestUndoEntry._id);

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
            matchPatch: serializeLiveMatchPatch(updatedMatch),
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }
    }

    const nextState = applyMatchAction(finalizedMatch, parsedRequest.value);
    updatePayload = {
      recentActionIds: buildRecentActionIds(
        finalizedMatch.recentActionIds || finalizedMatch.processedActionIds || [],
        parsedRequest.value.actionId,
      ),
      processedActionIds: buildRecentActionIds(
        finalizedMatch.processedActionIds || finalizedMatch.recentActionIds || [],
        parsedRequest.value.actionId,
      ),
      undoCount: Array.isArray(nextState.actionHistory)
        ? nextState.actionHistory.length
        : getMatchUndoCount(finalizedMatch),
      undoSequence: Math.max(
        Number(finalizedMatch.undoSequence || 0),
        Number(nextState.undoSequence || 0),
      ),
    };
    for (const key of MUTABLE_ACTION_KEYS) {
      if (key in nextState) {
        updatePayload[key] = nextState[key];
      }
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
          match: serializePublicMatch(updatedMatch, fallbackSession),
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


