/**
 * File overview:
 * Purpose: Handles the hot scoring path for instant umpire score taps.
 * Main exports: module side effects only.
 * Major callers: Match scoring client queue.
 * Side effects: writes match state, undo snapshots, and live update events.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { Types } from "mongoose";
import { jsonError } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import {
  applyMatchAction,
  buildSessionMirrorUpdate,
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
import { countLegalBalls } from "../../../../lib/match-scoring";
import {
  finalizePendingResultIfExpired,
  isFinalizedMatchComplete,
} from "../../../../lib/pending-match-result";
import { getRequestMeta } from "../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../lib/request-security";
import { invalidateSessionsDataCache } from "../../../../lib/server-data-helpers";
import { matchScoreSchema } from "../../../../lib/validators";
import Match from "../../../../../models/Match";
import MatchUndoEntry from "../../../../../models/MatchUndoEntry";
import Session from "../../../../../models/Session";

const SCORE_MATCH_FIELDS =
  "_id sessionId adminAccessVersion teamA teamB teamAName teamBName overs tossWinner tossDecision score outs isOngoing innings result pendingResult pendingResultAt resultAutoFinalizeAt innings1 innings2 balls activeOverBalls activeOverNumber legalBallCount firstInningsLegalBallCount secondInningsLegalBallCount announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled lastLiveEvent lastEventType lastEventText recentActionIds undoCount undoSequence processedActionIds createdAt updatedAt";
const SCORE_MATCH_PROJECTION = String(SCORE_MATCH_FIELDS)
  .split(/\s+/)
  .filter(Boolean)
  .reduce((projection, field) => {
    projection[field] = 1;
    return projection;
  }, {});
const MAX_SCORE_WRITE_RETRIES = 24;

function isDuplicateKeyError(error) {
  return Number(error?.code || 0) === 11000;
}

function countLegalBallsInBalls(balls = []) {
  let total = 0;

  for (const ball of Array.isArray(balls) ? balls : []) {
    if (ball?.extraType !== "wide" && ball?.extraType !== "noball") {
      total += 1;
    }
  }

  return total;
}

function getStoredLegalBallCount(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
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

function buildScoreWriteOperation(nextState, currentMatch, actionId) {
  const activeInningsKey = currentMatch?.innings === "second" ? "innings2" : "innings1";
  const inactiveInningsKey = activeInningsKey === "innings2" ? "innings1" : "innings2";
  const currentHistory = Array.isArray(currentMatch?.[activeInningsKey]?.history)
    ? currentMatch[activeInningsKey].history
    : [];
  const nextHistory = Array.isArray(nextState?.[activeInningsKey]?.history)
    ? nextState[activeInningsKey].history
    : [];
  const nextBall = Array.isArray(nextState?.balls) ? nextState.balls.at(-1) : null;
  const recentActionIds = buildRecentActionIds(
    currentMatch?.recentActionIds || currentMatch?.processedActionIds || [],
    actionId,
  );
  const processedActionIds = buildRecentActionIds(
    currentMatch?.processedActionIds || currentMatch?.recentActionIds || [],
    actionId,
  );
  const undoCount = getMatchUndoCount(currentMatch) + 1;
  const undoSequence = Math.max(0, Number(currentMatch?.undoSequence || 0)) + 1;
  const updatedAt = new Date();
  const activeOver = nextHistory.at(-1) || null;
  const activeOverBalls = Array.isArray(activeOver?.balls) ? activeOver.balls : [];
  const activeOverNumber = Number(activeOver?.overNumber || 1);
  const currentActiveLegalBallCount = countLegalBallsInBalls(currentMatch?.balls || []);
  const storedFirstInningsLegalBallCount = getStoredLegalBallCount(
    currentMatch?.firstInningsLegalBallCount,
  );
  const storedSecondInningsLegalBallCount = getStoredLegalBallCount(
    currentMatch?.secondInningsLegalBallCount,
  );
  const legalBallCount = currentActiveLegalBallCount +
    (nextBall?.extraType === "wide" || nextBall?.extraType === "noball" ? 0 : 1);
  const firstInningsLegalBallCount = activeInningsKey === "innings1"
    ? legalBallCount
    : storedFirstInningsLegalBallCount ??
      countLegalBalls(currentMatch?.innings1?.history || []);
  const secondInningsLegalBallCount = activeInningsKey === "innings2"
    ? legalBallCount
    : storedSecondInningsLegalBallCount ??
      countLegalBalls(currentMatch?.innings2?.history || []);
  const $set = {
    score: nextState?.score ?? 0,
    outs: nextState?.outs ?? 0,
    isOngoing: Boolean(nextState?.isOngoing),
    innings: nextState?.innings || "first",
    result: nextState?.result || "",
    pendingResult: nextState?.pendingResult || "",
    pendingResultAt: nextState?.pendingResultAt || null,
    resultAutoFinalizeAt: nextState?.resultAutoFinalizeAt || null,
    lastLiveEvent: nextState?.lastLiveEvent || null,
    lastEventType: nextState?.lastEventType || "",
    lastEventText: nextState?.lastEventText || "",
    [`${activeInningsKey}.team`]: nextState?.[activeInningsKey]?.team || "",
    [`${activeInningsKey}.score`]: Number(nextState?.[activeInningsKey]?.score || 0),
    [`${inactiveInningsKey}.team`]: nextState?.[inactiveInningsKey]?.team || "",
    [`${inactiveInningsKey}.score`]: Number(nextState?.[inactiveInningsKey]?.score || 0),
    activeOverBalls,
    activeOverNumber,
    legalBallCount,
    firstInningsLegalBallCount,
    secondInningsLegalBallCount,
    updatedAt,
  };
  const $push = {
    recentActionIds: { $each: [actionId], $slice: -256 },
    processedActionIds: { $each: [actionId], $slice: -256 },
  };
  const $inc = {
    undoCount: 1,
    undoSequence: 1,
  };

  let useFastHistoryWrite = Boolean(nextBall);
  if (useFastHistoryWrite) {
    if (nextHistory.length === currentHistory.length && nextHistory.length > 0) {
      const overIndex = nextHistory.length - 1;
      $push[`${activeInningsKey}.history.${overIndex}.balls`] = nextBall;
    } else if (nextHistory.length === currentHistory.length + 1 && nextHistory.length > 0) {
      $push[`${activeInningsKey}.history`] = nextHistory.at(-1);
    } else {
      useFastHistoryWrite = false;
    }
  }

  if (useFastHistoryWrite) {
    $push.balls = nextBall;
  } else {
    delete $set[`${activeInningsKey}.team`];
    delete $set[`${activeInningsKey}.score`];
    delete $set[`${inactiveInningsKey}.team`];
    delete $set[`${inactiveInningsKey}.score`];
    $set[activeInningsKey] = nextState?.[activeInningsKey] || {
      team: "",
      score: 0,
      history: [],
    };
    $set[inactiveInningsKey] = nextState?.[inactiveInningsKey] || {
      team: "",
      score: 0,
      history: [],
    };
    $set.balls = Array.isArray(nextState?.balls) ? nextState.balls : [];
  }

  return {
    writeOperation: {
      $set,
      $push,
      $inc,
    },
    updatedMatch: {
      ...currentMatch,
      ...nextState,
      activeOverBalls,
      activeOverNumber,
      legalBallCount,
      firstInningsLegalBallCount,
      secondInningsLegalBallCount,
      recentActionIds,
      processedActionIds,
      undoCount,
      undoSequence,
      updatedAt,
    },
  };
}

function buildScoreWriteFilter(match) {
  const filter = {
    _id: match?._id,
  };

  if (match?.updatedAt) {
    filter.updatedAt = match.updatedAt;
  }

  return filter;
}

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

function isMatchCompleted(match) {
  return isFinalizedMatchComplete(match);
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
    if (!Types.ObjectId.isValid(id)) {
      return jsonError("Match not found.", 404);
    }

    let finalizedMatch = null;
    let hasAccess = false;

    for (let attempt = 0; attempt < MAX_SCORE_WRITE_RETRIES; attempt += 1) {
      const match = await Match.collection.findOne(
        { _id: new Types.ObjectId(id) },
        { projection: SCORE_MATCH_PROJECTION },
      );
      if (!match) {
        return jsonError("Match not found.", 404);
      }

      finalizedMatch = await finalizePendingResultIfExpired(match);

      if (attempt === 0) {
        hasAccess = await hasMatchAccess(
          id,
          Number(finalizedMatch.adminAccessVersion || 1),
        );
      }

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

      if (isMatchCompleted(finalizedMatch)) {
        return jsonError("This match is complete. Open the result page instead.", 409);
      }

      if (isProcessedAction(finalizedMatch, parsedRequest.value.actionId)) {
        return Response.json(
          {
            ok: true,
            actionId: parsedRequest.value.actionId,
            replayed: true,
            matchPatch: serializeLiveMatchPatch(finalizedMatch),
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }

      const nextState = applyMatchAction(finalizedMatch, {
        ...parsedRequest.value,
        type: "score_ball",
      });
      const { writeOperation, updatedMatch } = buildScoreWriteOperation(
        nextState,
        finalizedMatch,
        parsedRequest.value.actionId,
      );

      let createdUndoEntryId = null;
      try {
        const createdUndoEntry = await MatchUndoEntry.collection.insertOne({
          matchId: finalizedMatch._id,
          sequence: updatedMatch.undoSequence,
          actionId: parsedRequest.value.actionId,
          type: "score_ball",
          snapshot: createMatchUndoSnapshot(finalizedMatch),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdUndoEntryId = createdUndoEntry?.insertedId || null;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          continue;
        }
        console.error("Could not create score undo snapshot:", error);
        return jsonError("Could not update the match.", 500);
      }

      const scoreUpdateResult = await Match.collection.updateOne(
        buildScoreWriteFilter(finalizedMatch),
        writeOperation,
      );
      if (!scoreUpdateResult?.matchedCount) {
        if (createdUndoEntryId) {
          await MatchUndoEntry.collection
            .deleteOne({ _id: createdUndoEntryId })
            .catch(() => {});
        }
        continue;
      }

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
          console.error("Could not update session score mirror:", error);
        });

      void writeAuditLog({
        action: "match_score_ball",
        targetType: "match",
        targetId: id,
        status: "success",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { actionId: parsedRequest.value.actionId, retries: attempt },
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
    }

    return jsonError("Could not update the match. Please retry.", 409);
  } catch (error) {
    if (error instanceof MatchEngineError) {
      return jsonError(error.message, error.status);
    }

    console.error("Match score update failed:", error);
    return jsonError("Could not update the match.", 500);
  }
}
