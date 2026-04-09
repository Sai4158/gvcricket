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

export function buildSessionViewTrackerHistory(match) {
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

  const inningsKey = match?.innings === "second" ? "innings2" : "innings1";
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

export function buildSessionViewInningsCards({ match, teamA, teamB, isLiveMatch }) {
  const innings1Complete =
    match?.innings === "second" || Boolean(match?.result);
  const innings2Complete = match?.innings === "second" && !isLiveMatch;
  const targetRuns = Number(match?.innings1?.score || 0) + 1;
  const runsNeeded = Math.max(
    0,
    targetRuns - Number(match?.innings2?.score || 0),
  );

  if (match?.innings === "second") {
    return [
      {
        key: "innings2",
        title: match.innings2?.team || teamB.name,
        inningsData: match.innings2,
        statusLabel: innings2Complete ? "Innings completed" : "Live",
        targetSummary:
          Number(match?.innings1?.score || 0) > 0
            ? runsNeeded > 0
              ? `Target ${targetRuns} • Need ${runsNeeded} • ${formatOversLeftLocal(match)}`
              : `Target ${targetRuns}`
            : "",
      },
      {
        key: "innings1",
        title: match.innings1?.team || teamA.name,
        inningsData: match.innings1,
        statusLabel: innings1Complete ? "Innings completed" : "",
        targetSummary:
          Number(match?.innings1?.score || 0) > 0
            ? `Target set: ${targetRuns}`
            : "",
      },
    ];
  }

  return [
    {
      key: "innings1",
      title: match.innings1?.team || teamA.name,
      inningsData: match.innings1,
      statusLabel: isLiveMatch
        ? "Live"
        : innings1Complete
          ? "Innings completed"
          : "",
      targetSummary: "",
    },
    {
      key: "innings2",
      title: match.innings2?.team || teamB.name,
      inningsData: match.innings2,
      statusLabel: innings2Complete ? "Innings completed" : "",
      targetSummary: "",
    },
  ];
}


