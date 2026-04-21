/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { Types } from "mongoose";
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
import { countLegalBalls } from "../../../../lib/match-scoring";
import { matchActionSchema } from "../../../../lib/validators";
import { invalidateSessionsDataCache } from "../../../../lib/server-data-helpers";
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
const UNDO_MATCH_FIELDS =
  "_id sessionId adminAccessVersion teamA teamB teamAName teamBName overs tossWinner tossDecision score outs isOngoing innings result pendingResult pendingResultAt resultAutoFinalizeAt innings1 innings2 balls announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled lastLiveEvent lastEventType lastEventText recentActionIds undoCount undoSequence processedActionIds createdAt updatedAt";
const UNDO_MATCH_PROJECTION = String(UNDO_MATCH_FIELDS)
  .split(/\s+/)
  .filter(Boolean)
  .reduce((projection, field) => {
    projection[field] = 1;
    return projection;
  }, {});

function countLegalBallsInBalls(balls = []) {
  let total = 0;

  for (const ball of Array.isArray(balls) ? balls : []) {
    if (ball?.extraType !== "wide" && ball?.extraType !== "noball") {
      total += 1;
    }
  }

  return total;
}

function buildHotSessionMirrorUpdate(match) {
  const resultText = String(match?.result || "").trim();
  const pendingResultText = String(match?.pendingResult || "").trim();

  if (resultText || pendingResultText) {
    return buildSessionMirrorUpdate(match);
  }

  return {
    teamA: Array.isArray(match?.teamA) ? match.teamA : [],
    teamB: Array.isArray(match?.teamB) ? match.teamB : [],
    teamAName: match?.teamAName || "",
    teamBName: match?.teamBName || "",
    overs: match?.overs ?? null,
    tossWinner: match?.tossWinner || "",
    tossDecision: match?.tossDecision || "",
    score: Number(match?.score || 0),
    outs: Number(match?.outs || 0),
    innings: match?.innings || "",
    result: "",
    pendingResult: "",
    lastEventType: match?.lastEventType || "",
    lastEventText: match?.lastEventText || "",
    adminAccessVersion: Number(match?.adminAccessVersion || 1),
    isLive: Boolean(match?.isOngoing),
  };
}

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
    const shouldUseFastUndoPath = parsedRequest.value.type === "undo_last";
    if (!Types.ObjectId.isValid(id)) {
      return jsonError("Match not found.", 404);
    }

    const match = shouldUseFastUndoPath
      ? await Match.collection.findOne(
          { _id: new Types.ObjectId(id) },
          { projection: UNDO_MATCH_PROJECTION },
        )
      : await Match.findById(id);
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

    if (isProcessedAction(finalizedMatch, parsedRequest.value.actionId)) {
      const fallbackSession = finalizedMatch.sessionId
        ? await Session.findById(finalizedMatch.sessionId).select(
            FALLBACK_SESSION_FIELDS
          )
        : null;

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
      const deletedUndoEntry = await MatchUndoEntry.collection.findOneAndDelete(
        {
          matchId: finalizedMatch._id,
        },
        {
          projection: {
            _id: 1,
            matchId: 1,
            sequence: 1,
            actionId: 1,
            type: 1,
            snapshot: 1,
            createdAt: 1,
            updatedAt: 1,
          },
          sort: { sequence: -1, createdAt: -1 },
        },
      );
      const latestUndoEntry =
        deletedUndoEntry?.value ??
        deletedUndoEntry ??
        null;

      if (latestUndoEntry?.snapshot) {
        const restoredMatch = restoreMatchUndoSnapshot(
          finalizedMatch,
          latestUndoEntry.snapshot,
          { clone: false },
        );
        const undoEvent = createUndoLiveEvent(restoredMatch);
        const activeInningsKey =
          restoredMatch?.innings === "second" ? "innings2" : "innings1";
        const activeHistory = Array.isArray(restoredMatch?.[activeInningsKey]?.history)
          ? restoredMatch[activeInningsKey].history
          : [];
        const activeOver = activeHistory.at(-1) || null;
        const activeOverBalls = Array.isArray(activeOver?.balls) ? activeOver.balls : [];
        const activeOverNumber = Number(activeOver?.overNumber || 1);
        const legalBallCount = countLegalBallsInBalls(restoredMatch?.balls || []);
        const firstInningsLegalBallCount = restoredMatch?.innings === "first"
          ? legalBallCount
          : countLegalBalls(restoredMatch?.innings1?.history || []);
        const secondInningsLegalBallCount = restoredMatch?.innings === "second"
          ? legalBallCount
          : 0;
        const responseCompactState = {
          activeOverBalls,
          activeOverNumber,
          legalBallCount,
          firstInningsLegalBallCount,
          secondInningsLegalBallCount,
        };

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

        const updatedAt = new Date();
        const undoUpdateResult = await Match.collection.updateOne(
          { _id: finalizedMatch._id },
          {
            $set: {
              ...updatePayload,
              updatedAt,
            },
          },
        );
        if (!undoUpdateResult?.matchedCount) {
          await MatchUndoEntry.collection
            .insertOne(latestUndoEntry)
            .catch(() => {});
          return jsonError("Match not found.", 404);
        }

        const updatedMatch = {
          ...restoredMatch,
          ...updatePayload,
          ...responseCompactState,
          updatedAt,
        };

        invalidateSessionsDataCache();
        publishMatchUpdate(updatedMatch._id);

        void Session.findByIdAndUpdate(
          updatedMatch.sessionId,
          {
            $set: buildHotSessionMirrorUpdate(updatedMatch),
          },
          {
            timestamps: false,
          },
        )
          .then(() => {
            publishSessionUpdate(updatedMatch.sessionId);
          })
          .catch((error) => {
            console.error("Could not update session undo mirror:", error);
          });

        void writeAuditLog({
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

    console.error("Match action update failed:", error);
    return jsonError("Could not update the match.", 500);
  }
}


