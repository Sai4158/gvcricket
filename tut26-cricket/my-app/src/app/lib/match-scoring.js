/**
 * File overview:
 * Purpose: Provides shared Match Scoring logic for routes, APIs, and feature code.
 * Main exports: countLegalBalls, addBallToHistory, buildWinByWicketsText, syncTeamNamesAcrossMatch.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { getBattingTeamBundle, getTotalDismissalsAllowed } from "./team-utils";

export function countLegalBalls(history = []) {
  let total = 0;

  for (const over of Array.isArray(history) ? history : []) {
    const balls = Array.isArray(over?.balls) ? over.balls : [];
    for (const ball of balls) {
      if (ball?.extraType !== "wide" && ball?.extraType !== "noball") {
        total += 1;
      }
    }
  }

  return total;
}

export function addBallToHistory(match, ball) {
  const activeInningsKey = match.innings === "first" ? "innings1" : "innings2";
  const innings = match[activeInningsKey];

  if (!innings.history) innings.history = [];

  const history = innings.history;
  const lastOver = history.at(-1);
  const legalBallsInLastOver = Array.isArray(lastOver?.balls)
    ? lastOver.balls.reduce(
        (total, entry) =>
          entry?.extraType === "wide" || entry?.extraType === "noball"
            ? total
            : total + 1,
        0,
      )
    : 0;

  // Once an over already has 6 legal balls, any next scoring event belongs
  // to the next over, including wides and no-balls.
  if (!lastOver || legalBallsInLastOver >= 6) {
    history.push({
      overNumber: (lastOver?.overNumber ?? 0) + 1,
      balls: [ball],
    });
    return;
  }

  lastOver.balls.push(ball);
}

export function buildWinByWicketsText(match, outs) {
  const battingTeam = getBattingTeamBundle(match);
  const wicketsLeft = Math.max(getTotalDismissalsAllowed(match) - outs, 1);

  return `${battingTeam.name} won by ${wicketsLeft} ${
    wicketsLeft === 1 ? "wicket" : "wickets"
  }.`;
}

function replaceLeadingTeamName(resultText, previousNames, nextNames) {
  const safeResult = String(resultText || "").trim();
  if (!safeResult) {
    return "";
  }

  const winnerMatch = safeResult.match(/^(.+?)\s+won by\s+/i);
  const winnerName = String(winnerMatch?.[1] || "").trim();
  if (!winnerName) {
    return safeResult;
  }

  let nextWinnerName = winnerName;
  if (winnerName === previousNames.teamAName) {
    nextWinnerName = nextNames.teamAName;
  } else if (winnerName === previousNames.teamBName) {
    nextWinnerName = nextNames.teamBName;
  }

  if (nextWinnerName === winnerName) {
    return safeResult;
  }

  return `${nextWinnerName}${safeResult.slice(winnerName.length)}`;
}

export function syncTeamNamesAcrossMatch(match, previousNames, nextNames) {
  const updated = structuredClone(match);

  if (updated.tossWinner === previousNames.teamAName) {
    updated.tossWinner = nextNames.teamAName;
  } else if (updated.tossWinner === previousNames.teamBName) {
    updated.tossWinner = nextNames.teamBName;
  }

  if (updated.innings1?.team === previousNames.teamAName) {
    updated.innings1.team = nextNames.teamAName;
  } else if (updated.innings1?.team === previousNames.teamBName) {
    updated.innings1.team = nextNames.teamBName;
  }

  if (updated.innings2?.team === previousNames.teamAName) {
    updated.innings2.team = nextNames.teamAName;
  } else if (updated.innings2?.team === previousNames.teamBName) {
    updated.innings2.team = nextNames.teamBName;
  }

  updated.result = replaceLeadingTeamName(
    updated.result,
    previousNames,
    nextNames,
  );
  updated.pendingResult = replaceLeadingTeamName(
    updated.pendingResult,
    previousNames,
    nextNames,
  );

  return updated;
}


