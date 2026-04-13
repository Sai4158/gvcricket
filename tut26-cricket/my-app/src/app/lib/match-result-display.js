/**
 * File overview:
 * Purpose: Provides shared Match Result Display logic for routes, APIs, and feature code.
 * Main exports: getWinningTeamName, getWinningInningsSummary.
 * Major callers: Result and session card UI.
 * Side effects: none.
 * Read next: ./match-stats.js
 */

import { calculateInningsSummary } from "./match-stats";

function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function countInningsWickets(history = []) {
  return (Array.isArray(history) ? history : []).reduce((total, over) => {
    const balls = Array.isArray(over?.balls) ? over.balls : [];
    return total + balls.filter((ball) => Boolean(ball?.isOut)).length;
  }, 0);
}

export function getWinningTeamName(resultText = "") {
  const safeResult = String(resultText || "").trim();
  const winnerMatch = safeResult.match(/^(.+?)\s+won by\s+/i);
  return winnerMatch?.[1]?.trim() || "";
}

export function getWinningInningsSummary(match = null) {
  if (!match) {
    return null;
  }

  const innings1 = match?.innings1 || { team: "", score: 0, history: [] };
  const innings2 = match?.innings2 || { team: "", score: 0, history: [] };
  const winnerName = getWinningTeamName(match?.result || "");
  const normalizedWinnerName = normalizeTeamName(winnerName);
  const normalizedInnings1Team = normalizeTeamName(innings1?.team);
  const normalizedInnings2Team = normalizeTeamName(innings2?.team);

  let winningInnings = null;

  if (normalizedWinnerName && normalizedWinnerName === normalizedInnings1Team) {
    winningInnings = innings1;
  } else if (
    normalizedWinnerName &&
    normalizedWinnerName === normalizedInnings2Team
  ) {
    winningInnings = innings2;
  } else {
    const innings1Score = Number(innings1?.score || 0);
    const innings2Score = Number(innings2?.score || 0);

    if (
      !normalizedWinnerName &&
      innings1Score <= 0 &&
      innings2Score <= 0
    ) {
      return null;
    }

    winningInnings = innings2Score > innings1Score ? innings2 : innings1;
  }

  const score = Number(winningInnings?.score || 0);
  const wickets = countInningsWickets(winningInnings?.history || []);
  const overs = calculateInningsSummary(winningInnings).overs || "0.0";

  return {
    teamName: winningInnings?.team || winnerName || "",
    score,
    wickets,
    overs,
    scoreline: `${score}/${wickets}`,
  };
}
