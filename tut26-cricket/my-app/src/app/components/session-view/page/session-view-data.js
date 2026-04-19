/**
 * File overview:
 * Purpose: Renders Session View UI for the app's screens and flows.
 * Main exports: buildSessionViewTrackerHistory, buildSessionViewInningsCards.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { addBallToHistory } from "../../../lib/match-scoring";
import { formatOversLeftLocal } from "./session-view-helpers";

export function buildSessionViewTrackerHistory(match, historyDetail = null) {
  const inningsKey = match?.innings === "second" ? "innings2" : "innings1";
  const detailedHistory = Array.isArray(historyDetail?.[inningsKey]?.history)
    ? historyDetail[inningsKey].history
    : [];

  if (detailedHistory.length) {
    return detailedHistory;
  }

  const activeInningsHistory =
    match?.innings === "second"
      ? match?.innings2?.history || []
      : match?.innings1?.history || [];
  const hasRecordedOvers = activeInningsHistory.some(
    (over) => Array.isArray(over?.balls) && over.balls.length > 0,
  );

  if (
    hasRecordedOvers ||
    !Array.isArray(match?.balls) ||
    match.balls.length === 0
  ) {
    return activeInningsHistory;
  }

  const reconstructedMatch = {
    innings: match?.innings === "second" ? "second" : "first",
    innings1: { history: [] },
    innings2: { history: [] },
  };

  for (const ball of match.balls) {
    addBallToHistory(reconstructedMatch, ball);
  }

  return reconstructedMatch[inningsKey]?.history || activeInningsHistory;
}

export function buildSessionViewInningsCards({
  match,
  teamA,
  teamB,
  isLiveMatch,
  historyDetail = null,
  historyLoading = false,
}) {
  const innings1Complete =
    match?.innings === "second" || Boolean(match?.result);
  const innings2Complete = match?.innings === "second" && !isLiveMatch;
  const targetRuns = Number(match?.innings1?.score || 0) + 1;
  const runsNeeded = Math.max(
    0,
    targetRuns - Number(match?.innings2?.score || 0),
  );
  const innings1Data = historyDetail?.innings1 || match?.innings1;
  const innings2Data = historyDetail?.innings2 || match?.innings2;
  const safeInnings1Data = {
    team: innings1Data?.team || "",
    score: Number(innings1Data?.score || 0),
    history: Array.isArray(innings1Data?.history) ? innings1Data.history : [],
  };
  const safeInnings2Data = {
    team: innings2Data?.team || "",
    score: Number(innings2Data?.score || 0),
    history: Array.isArray(innings2Data?.history) ? innings2Data.history : [],
  };

  if (match?.innings === "second") {
    return [
      {
        key: "innings2",
        title: safeInnings2Data.team || teamB.name,
        inningsData: safeInnings2Data,
        statusLabel: innings2Complete ? "Innings completed" : "Live",
        targetSummary:
          Number(match?.innings1?.score || 0) > 0
            ? runsNeeded > 0
              ? `Target ${targetRuns} • Need ${runsNeeded} • ${formatOversLeftLocal(match)}`
              : `Target ${targetRuns}`
            : "",
        loadingHistory: historyLoading,
      },
      {
        key: "innings1",
        title: safeInnings1Data.team || teamA.name,
        inningsData: safeInnings1Data,
        statusLabel: innings1Complete ? "Innings completed" : "",
        targetSummary:
          Number(match?.innings1?.score || 0) > 0
            ? `Target set: ${targetRuns}`
            : "",
        loadingHistory: historyLoading,
      },
    ];
  }

  return [
    {
      key: "innings1",
      title: safeInnings1Data.team || teamA.name,
      inningsData: safeInnings1Data,
      statusLabel: isLiveMatch
        ? "Live"
        : innings1Complete
          ? "Innings completed"
          : "",
      targetSummary: "",
      loadingHistory: historyLoading,
    },
    {
      key: "innings2",
      title: safeInnings2Data.team || teamB.name,
      inningsData: safeInnings2Data,
      statusLabel: innings2Complete ? "Innings completed" : "",
      targetSummary: "",
      loadingHistory: historyLoading,
    },
  ];
}
