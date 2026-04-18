/**
 * File overview:
 * Purpose: Handles pending match-result state and lazy auto-finalization.
 * Main exports: hasPendingMatchResult, isFinalizedMatchComplete, shouldAutoFinalizePendingResult, buildPendingResultFinalizeFields, finalizePendingResultIfExpired.
 * Major callers: Server loaders, API routes, and feature pages.
 * Side effects: may update Match and Session records when auto-finalizing.
 * Read next: ./README.md
 */

import Match from "../../models/Match";
import Session from "../../models/Session";
import { buildSessionMirrorUpdate } from "./match-engine";
import { publishMatchUpdate, publishSessionUpdate } from "./live-updates";
import { invalidateSessionsDataCache } from "./server-data-helpers";

export function hasPendingMatchResult(match) {
  return (
    Boolean(String(match?.pendingResult || "").trim()) &&
    !Boolean(String(match?.result || "").trim())
  );
}

export function isFinalizedMatchComplete(match) {
  return (
    Boolean(String(match?.result || "").trim()) &&
    !hasPendingMatchResult(match) &&
    !Boolean(match?.isOngoing)
  );
}

export function shouldAutoFinalizePendingResult(match, now = Date.now()) {
  if (!hasPendingMatchResult(match)) {
    return false;
  }

  const deadlineMs = Date.parse(String(match?.resultAutoFinalizeAt || ""));
  return Number.isFinite(deadlineMs) && deadlineMs <= now;
}

export function buildPendingResultFinalizeFields(match) {
  return {
    result: String(match?.pendingResult || "").trim(),
    pendingResult: "",
    pendingResultAt: null,
    resultAutoFinalizeAt: null,
    isOngoing: false,
  };
}

export async function finalizePendingResultIfExpired(matchDocument) {
  if (!shouldAutoFinalizePendingResult(matchDocument)) {
    return matchDocument;
  }

  const matchId = String(matchDocument?._id || "").trim();
  if (!matchId) {
    return matchDocument;
  }

  const updatedMatch = await Match.findOneAndUpdate(
    {
      _id: matchId,
      pendingResult: String(matchDocument?.pendingResult || "").trim(),
      result: { $in: ["", null] },
    },
    {
      $set: buildPendingResultFinalizeFields(matchDocument),
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedMatch) {
    return Match.findById(matchId);
  }

  await Session.findByIdAndUpdate(
    updatedMatch.sessionId,
    {
      $set: buildSessionMirrorUpdate(updatedMatch),
    },
    {
      timestamps: false,
    },
  );
  invalidateSessionsDataCache();
  publishMatchUpdate(updatedMatch._id);
  publishSessionUpdate(updatedMatch.sessionId);

  return updatedMatch;
}
