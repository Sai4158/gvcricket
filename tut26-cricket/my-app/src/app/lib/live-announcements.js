/**
 * File overview:
 * Purpose: Provides shared Live Announcements logic for routes, APIs, and feature code.
 * Main exports: getSpectatorAnnouncementPriority, buildSpectatorBallAnnouncement, buildSpectatorScoreAnnouncement, buildSpectatorOverCompleteAnnouncement, createScoreLiveEvent, createUndoLiveEvent, createMatchCorrectionLiveEvent, createMatchEndLiveEvent, createSoundEffectLiveEvent, createManualScoreAnnouncementLiveEvent, buildSpectatorAnnouncement, buildLiveScoreAnnouncementSequence, buildCurrentScoreAnnouncement, buildUmpireStageAnnouncement, buildUmpireSecondInningsStartSequence, buildUmpireAnnouncement, buildUmpireTapAnnouncement.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Reading guide:
 * - top: small text helpers and score wording helpers
 * - middle: spectator speech and live event builders
 * - bottom: umpire lines like "Umpire has given ..."
 * Read next: ./README.md
 */

import { countLegalBalls } from "./match-scoring";
import { getBattingTeamBundle } from "./team-utils";

// Small text helpers used by both spectator and umpire speech.
function safeNumber(value) {
  return Number(value || 0);
}

// Clean one word so it sounds better when spoken.
function normalizeSpeechToken(token) {
  const safeToken = String(token || "");
  const match = safeToken.match(
    /^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9'-]*)([^A-Za-z0-9]*)$/,
  );
  if (!match) {
    return safeToken;
  }

  const [, prefix, core, suffix] = match;
  const normalizedCore = core
    .split(/([-'])/)
    .map((part) => {
      if (!/^[A-Z]{3,}$/.test(part) || !/[AEIOUY]/.test(part)) {
        return part;
      }

      return `${part.charAt(0)}${part.slice(1).toLowerCase()}`;
    })
    .join("");

  return `${prefix}${normalizedCore}${suffix}`;
}

// Clean names before they are spoken.
function normalizeSpeechName(value) {
  const safeValue = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!safeValue) {
    return "";
  }

  return safeValue
    .split(" ")
    .map((part) => normalizeSpeechToken(part))
    .join(" ");
}

// Clean result text for speech.
function normalizeSpeechResultText(resultText) {
  const result = String(resultText || "").trim();
  if (!result) {
    return "";
  }

  const winnerMatch = result.match(/^(.+?) won by (.+)\.$/i);
  if (!winnerMatch) {
    return result;
  }

  const [, winnerName, margin] = winnerMatch;
  return `${normalizeSpeechName(winnerName)} won by ${margin}.`;
}

// Format run count like "1 run" or "2 runs".
function pluralizeRuns(value) {
  return `${value} run${value === 1 ? "" : "s"}`;
}

// Format player count like "1 player" or "2 players".
function pluralizePlayers(value) {
  return `${value} player${value === 1 ? "" : "s"}`;
}

// Format score like "40 for 2".
function scoreLine(score, outs) {
  return `${score} for ${outs}`;
}

// Build speech text for team-size fixes.
function buildRosterSizeCorrectionSummary(matchBefore, matchAfter, patch) {
  const teamABeforeSize = Array.isArray(matchBefore?.teamA)
    ? matchBefore.teamA.length
    : 0;
  const teamBBeforeSize = Array.isArray(matchBefore?.teamB)
    ? matchBefore.teamB.length
    : 0;
  const teamAAfterSize = Array.isArray(matchAfter?.teamA)
    ? matchAfter.teamA.length
    : 0;
  const teamBAfterSize = Array.isArray(matchAfter?.teamB)
    ? matchAfter.teamB.length
    : 0;
  const teamASizeChanged =
    Array.isArray(patch?.teamA) && teamAAfterSize !== teamABeforeSize;
  const teamBSizeChanged =
    Array.isArray(patch?.teamB) && teamBAfterSize !== teamBBeforeSize;

  if (!teamASizeChanged && !teamBSizeChanged) {
    return "";
  }

  if (teamAAfterSize === teamBAfterSize) {
    return `Both teams now have ${pluralizePlayers(teamAAfterSize)}.`;
  }

  const teamAName = normalizeSpeechName(matchAfter?.teamAName) || "Team A";
  const teamBName = normalizeSpeechName(matchAfter?.teamBName) || "Team B";

  return [
    `${teamAName} now have ${pluralizePlayers(teamAAfterSize)}.`,
    `${teamBName} now have ${pluralizePlayers(teamBAfterSize)}.`,
  ].join(" ");
}

// Builds spoken required-rate text for a chase.
function buildRequiredRateAnnouncementLine(target, overs) {
  const safeTarget = safeNumber(target);
  const safeOvers = safeNumber(overs);
  if (safeTarget <= 0 || safeOvers <= 0) {
    return "";
  }

  const requiredRate = safeTarget / safeOvers;
  if (!Number.isFinite(requiredRate) || requiredRate <= 0) {
    return "";
  }

  if (requiredRate < 1) {
    return "Required rate is under 1 run per over.";
  }

  const roundedRate = Math.round(requiredRate * 100) / 100;
  const fixedRate = roundedRate.toFixed(2);
  const [wholePart, decimalPart = ""] = fixedRate.split(".");

  if (decimalPart === "00") {
    return `Required rate is ${wholePart} ${
      wholePart === "1" ? "run" : "runs"
    } per over.`;
  }

  const trimmedDecimal = decimalPart.replace(/0+$/, "");
  return `Required rate is ${wholePart} point ${trimmedDecimal} runs per over.`;
}

// Turns a legal-ball count into overs-and-balls wording.
function formatOversForAnnouncement(legalBalls) {
  const safeBalls = safeNumber(legalBalls);
  if (safeBalls <= 0) {
    return "";
  }

  const overs = Math.floor(safeBalls / 6);
  const balls = safeBalls % 6;

  if (overs <= 0) {
    return `${balls} ball${balls === 1 ? "" : "s"}`;
  }

  if (balls === 0) {
    return `${overs} over${overs === 1 ? "" : "s"}`;
  }

  return `${overs} over${overs === 1 ? "" : "s"} and ${balls} ball${
    balls === 1 ? "" : "s"
  }`;
}

// Prepares the first-innings summary and chase setup lines.
function buildUmpireFirstInningsTransitionDetails(match) {
  if (!match) {
    return {
      firstInningsTeam: "Innings 1",
      secondInningsTeam: "The chasing side",
      scoreLineText: "",
      oversLine: "",
      targetLine: "",
      chaseLine: "",
      requiredRateLine: "",
      goodLuckLine: "Good luck to both teams.",
    };
  }

  const firstInningsTeam =
    normalizeSpeechName(match?.innings1?.team) || "Innings 1";
  const secondInningsTeam =
    normalizeSpeechName(match?.innings2?.team) || "The chasing side";
  const firstInningsScore = safeNumber(match?.innings1?.score ?? match?.score);
  const firstInningsOuts = safeNumber(match?.innings1?.outs ?? match?.outs);
  const target = firstInningsScore + 1;
  const inningsHistory = match?.innings1?.history ?? [];
  const oversSummary = formatOversForAnnouncement(
    countLegalBalls(inningsHistory),
  );
  const goodLuckLine =
    firstInningsTeam && secondInningsTeam
      ? `Good luck, ${firstInningsTeam} and ${secondInningsTeam}.`
      : "Good luck to both teams.";

  return {
    firstInningsTeam,
    secondInningsTeam,
    scoreLineText: `${firstInningsTeam} posted ${scoreLine(
      firstInningsScore,
      firstInningsOuts,
    )}.`,
    oversLine: oversSummary ? `They batted for ${oversSummary}.` : "",
    targetLine: `Target is ${target}.`,
    chaseLine: `${secondInningsTeam} need ${target} to win.`,
    requiredRateLine: buildRequiredRateAnnouncementLine(target, match?.overs),
    goodLuckLine,
  };
}

// Chooses the current innings key from the match state.
function getActiveInningsKey(match) {
  return match?.innings === "second" ? "innings2" : "innings1";
}

// Returns the current innings history for progress calculations.
function getActiveHistory(match) {
  return match?.[getActiveInningsKey(match)]?.history ?? [];
}

function getCurrentOverBalls(match) {
  if (Array.isArray(match?.activeOverBalls) && match.activeOverBalls.length) {
    return match.activeOverBalls;
  }

  const activeHistory = getActiveHistory(match);
  const activeOver = activeHistory.at(-1);
  return Array.isArray(activeOver?.balls) ? activeOver.balls : [];
}

function countLegalBallsInBalls(balls = []) {
  return (Array.isArray(balls) ? balls : []).filter(
    (ball) => ball?.extraType !== "wide" && ball?.extraType !== "noball",
  ).length;
}

// Counts completed overs in the active innings.
function getCompletedOvers(match) {
  return Math.floor(countLegalBalls(getActiveHistory(match)) / 6);
}

// Counts completed legal balls in the active innings.
function getCompletedLegalBalls(match) {
  const compactLegalBallCount = Number(match?.legalBallCount);
  if (Number.isFinite(compactLegalBallCount) && compactLegalBallCount >= 0) {
    return compactLegalBallCount;
  }

  return countLegalBalls(getActiveHistory(match));
}

// Calculates how many full overs remain in the innings.
function getOversLeft(match) {
  return Math.max(0, safeNumber(match?.overs) - getCompletedOvers(match));
}

// Returns the current legal-ball number within the over.
function getBallNumberInOver(match) {
  const currentOverLegalBalls = countLegalBallsInBalls(
    getCurrentOverBalls(match),
  );
  if (currentOverLegalBalls > 0) {
    return currentOverLegalBalls;
  }

  const legalBalls = getCompletedLegalBalls(match);
  const ballsIntoOver = legalBalls % 6;
  return ballsIntoOver === 0 ? 6 : ballsIntoOver;
}

function getEventBallNumberInOver(event, match) {
  const eventBallNumber = Number(event?.ballNumberInOver);
  if (Number.isFinite(eventBallNumber) && eventBallNumber > 0) {
    return eventBallNumber;
  }

  return getBallNumberInOver(match);
}

// Counts wickets that fell in the current over.
function getWicketsInCurrentOver(match) {
  return getCurrentOverBalls(match).filter((ball) => ball?.isOut).length || 0;
}

// Calculates how many legal balls remain in the innings.
function getBallsRemaining(match) {
  return Math.max(
    0,
    safeNumber(match?.overs) * 6 - countLegalBalls(getActiveHistory(match)),
  );
}

// Format remaining balls like "12 balls".
function formatRemainingBalls(match) {
  const ballsRemaining = getBallsRemaining(match);
  return `${ballsRemaining} ball${ballsRemaining === 1 ? "" : "s"}`;
}

// Formats remaining overs and balls for speech.
function formatRemainingOvers(match) {
  const ballsRemaining = getBallsRemaining(match);
  const overs = Math.floor(ballsRemaining / 6);
  const balls = ballsRemaining % 6;

  if (overs <= 0) {
    return `${balls} ball${balls === 1 ? "" : "s"}`;
  }

  if (balls === 0) {
    return `${overs} over${overs === 1 ? "" : "s"}`;
  }

  return `${overs} over${overs === 1 ? "" : "s"} and ${balls} ball${
    balls === 1 ? "" : "s"
  }`;
}

// Formats how much of the innings has been completed so far.
function formatCompletedProgress(match) {
  const legalBalls = getCompletedLegalBalls(match);
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;

  if (overs <= 0) {
    return `${legalBalls} ball${legalBalls === 1 ? "" : "s"} bowled.`;
  }

  if (balls === 0) {
    return `${overs} over${overs === 1 ? "" : "s"} completed.`;
  }

  return `${overs} over${overs === 1 ? "" : "s"} and ${balls} ball${
    balls === 1 ? "" : "s"
  } bowled.`;
}

// Calculates how many balls remain in the current over.
function getBallsLeftInCurrentOver(match) {
  const ballsRemaining = getBallsRemaining(match);
  if (ballsRemaining <= 0) {
    return 0;
  }

  const currentOverLegalBalls = countLegalBallsInBalls(
    getCurrentOverBalls(match),
  );
  const ballsIntoCurrentOver =
    currentOverLegalBalls > 0
      ? currentOverLegalBalls % 6
      : getCompletedLegalBalls(match) % 6;
  const ballsLeftInCurrentOver =
    ballsIntoCurrentOver === 0 ? 6 : 6 - ballsIntoCurrentOver;

  return Math.min(ballsLeftInCurrentOver, ballsRemaining);
}

// Formats current-over remaining balls for speech.
function formatBallsLeftInCurrentOver(match) {
  const ballsLeftInCurrentOver = getBallsLeftInCurrentOver(match);
  return `${ballsLeftInCurrentOver} ball${
    ballsLeftInCurrentOver === 1 ? "" : "s"
  } left in this over.`;
}

// Combines current-over and innings-remaining progress into one line.
function buildCurrentOverRemainingLine(match) {
  const ballsLeftLine = formatBallsLeftInCurrentOver(match).replace(/\.$/, "");
  const oversLeftLine = formatOversLeftAfterCurrentOver(match);

  if (!oversLeftLine || oversLeftLine === "No overs left.") {
    return `${ballsLeftLine}.`;
  }

  if (oversLeftLine === "Final over.") {
    return `${ballsLeftLine}. ${oversLeftLine}`;
  }

  return `${ballsLeftLine} and ${oversLeftLine.charAt(0).toLowerCase()}${oversLeftLine.slice(1)}`;
}

// Formats overs remaining after the current over finishes.
function formatOversLeftAfterCurrentOver(match) {
  const ballsRemaining = getBallsRemaining(match);
  if (ballsRemaining <= 0) {
    return "No overs left.";
  }

  const ballsLeftInCurrentOver = getBallsLeftInCurrentOver(match);
  const ballsRemainingAfterCurrentOver = Math.max(
    0,
    ballsRemaining - ballsLeftInCurrentOver,
  );
  const oversLeftAfterCurrentOver = Math.floor(
    ballsRemainingAfterCurrentOver / 6,
  );

  if (oversLeftAfterCurrentOver <= 0) {
    return "Final over.";
  }

  return `${oversLeftAfterCurrentOver} over${
    oversLeftAfterCurrentOver === 1 ? "" : "s"
  } left.`;
}

// Cricket event helpers used to decide what should be spoken and how urgent it is.
function isLegalBall(ball) {
  return ball?.extraType !== "wide" && ball?.extraType !== "noball";
}

// Checks whether a legal scoring shot was a boundary.
function isBoundary(ball) {
  return safeNumber(ball?.runs) >= 4 && !ball?.extraType && !ball?.isOut;
}

// Flags events important enough to deserve extra spoken context.
function isImportantEvent(ball) {
  return Boolean(
    ball?.isOut ||
    ball?.extraType === "wide" ||
    ball?.extraType === "noball" ||
    isBoundary(ball),
  );
}

// Higher number means the announcement matters more.
export function getSpectatorAnnouncementPriority(event) {
  if (!event) return 0;
  if (
    event.type === "undo" ||
    event.type === "score_correction" ||
    event.type === "match_end" ||
    event.type === "target_chased"
  ) {
    return 3;
  }

  if (event.overCompleted || event.ball?.isOut) {
    return 3;
  }

  if (
    isBoundary(event.ball) ||
    event.ball?.extraType === "wide" ||
    event.ball?.extraType === "noball"
  ) {
    return 2;
  }

  return 1;
}

// Core ball-to-speech conversion.
// If you are looking for lines like "Umpire has given four runs." start here,
// then also read buildUmpireAnnouncement near the bottom of this file.
function buildRunsCall(runs) {
  return `Umpire has given ${pluralizeRuns(runs)}.`;
}

// Converts one scored ball into the core spoken event line.
function buildBallEventLine(ball) {
  if (!ball) return "";

  if (ball.isOut) {
    if (safeNumber(ball.runs) > 0) {
      return `Umpire has given ${pluralizeRuns(safeNumber(ball.runs))}. Batter is out.`;
    }
    return "Umpire has given the batter out.";
  }

  if (ball.extraType === "wide") {
    const wideRuns = Math.max(safeNumber(ball.runs), 0);
    if (wideRuns > 0) {
      return `Umpire has given a wide. ${pluralizeRuns(wideRuns)} given.`;
    }
    return "Umpire has given a wide.";
  }

  if (ball.extraType === "noball") {
    const noBallRuns = Math.max(safeNumber(ball.runs), 0);
    if (noBallRuns > 0) {
      return `Umpire has given a no ball. ${pluralizeRuns(noBallRuns)} given.`;
    }
    return "Umpire has given a no ball.";
  }

  if (ball.extraType === "bye") {
    return safeNumber(ball.runs) > 0
      ? `Umpire has given bye. ${pluralizeRuns(safeNumber(ball.runs))}.`
      : "Umpire has given bye.";
  }
  if (ball.extraType === "legbye") {
    return safeNumber(ball.runs) > 0
      ? `Umpire has given leg bye. ${pluralizeRuns(safeNumber(ball.runs))}.`
      : "Umpire has given leg bye.";
  }

  if (safeNumber(ball.runs) === 0) return "Umpire has given dot ball.";
  if (isBoundary(ball))
    return `Umpire has given ${pluralizeRuns(safeNumber(ball.runs))}.`;
  return buildRunsCall(safeNumber(ball.runs));
}

// Spoken line used when the umpire undoes the previous ball.
function buildUndoAnnouncementLine() {
  return "Umpire has removed the score for that ball. Umpire will redo this ball.";
}

// Adds simple progress reminders at selected ball numbers.
function buildProgressReminder(event, match) {
  if (!event?.ball || event.overCompleted || !isLegalBall(event.ball)) {
    return "";
  }

  const ballNumber = getEventBallNumberInOver(event, match);
  if (ballNumber === 2) return "Ball 2 completed.";
  if (ballNumber === 3) return "3 balls left.";
  if (ballNumber === 4) return "Ball 4 completed.";
  if (ballNumber === 5) return "One ball left.";
  return "";
}

// Builds the spoken chase equation for second innings.
function buildChaseEquationLine(match) {
  if (match?.innings !== "second") {
    return "";
  }

  const target = safeNumber(match?.innings1?.score) + 1;
  const runsNeeded = Math.max(0, target - safeNumber(match?.score));
  const ballsRemaining = getBallsRemaining(match);

  if (runsNeeded <= 0 || ballsRemaining <= 0) {
    return "";
  }

  return `${runsNeeded} needed from ${formatRemainingBalls(match)}.`;
}

// Decides whether the chase equation is worth reading after an event.
function shouldCallChaseEquation(event, match) {
  if (!event || !buildChaseEquationLine(match)) {
    return false;
  }

  if (
    event.type === "undo" ||
    event.type === "innings_change" ||
    event.type === "match_end" ||
    event.type === "target_chased"
  ) {
    return false;
  }

  if (event.overCompleted) {
    return true;
  }

  if (!event.ball || !isLegalBall(event.ball)) {
    return false;
  }

  const ballNumber = getEventBallNumberInOver(event, match);
  return ballNumber === 3 || ballNumber === 5;
}

// Adds contextual reminders such as chase math or over progress.
function buildSmartScoreReminder(event, match) {
  const chaseEquation = buildChaseEquationLine(match);
  if (shouldCallChaseEquation(event, match) && chaseEquation) {
    return chaseEquation;
  }

  return buildProgressReminder(event, match);
}

// Formats the main spoken score sentence.
function buildScoreSentence(score, outs) {
  return `Score is ${scoreLine(safeNumber(score), safeNumber(outs))}.`;
}

// Returns result text exactly as it should be spoken.
function buildResultLine(resultText) {
  const result = String(resultText || "").trim();
  if (!result) return "";
  const winnerMatch = result.match(/^(.+?) won by (.+)\.$/i);
  if (!winnerMatch) return normalizeSpeechResultText(result);
  const [, winnerName, margin] = winnerMatch;
  return `${normalizeSpeechName(winnerName)} wins by ${margin}.`;
}

// Extracts just the winner name from result text when possible.
function getWinnerName(resultText) {
  const result = String(resultText || "").trim();
  if (!result) return "";
  const winnerMatch = result.match(/^(.+?) won by /i);
  return winnerMatch ? normalizeSpeechName(winnerMatch[1]) : "";
}

// Builds a celebration line for match-winning announcements.
function buildWinnerCelebrationLine(resultText) {
  const winnerName = getWinnerName(resultText);
  return winnerName ? `Congratulations ${winnerName}.` : "";
}

// Spectator speech starts here.
// Builds the first spoken line for spectator live events.
export function buildSpectatorBallAnnouncement(event) {
  if (!event) return "";

  if (event.type === "undo") {
    return buildUndoAnnouncementLine();
  }

  if (event.type === "match_end") {
    return "Match over.";
  }

  return buildBallEventLine(event.ball);
}

// This builds the score-follow-up line after the main event line.
// Example: after "four runs", this can add the score or target reminder.
export function buildSpectatorScoreAnnouncement(event, match) {
  if (!event) return "";

  if (event.type === "undo") {
    return [
      buildScoreSentence(event.score, event.outs),
      buildChaseEquationLine(match),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (event.type === "score_correction") {
    return [
      buildScoreSentence(event.score, event.outs),
      typeof event.nextInnings1Score === "number" && match?.innings === "second"
        ? `Target is now ${safeNumber(match?.innings1?.score) + 1}.`
        : "",
      buildChaseEquationLine(match),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (event.type === "match_end") {
    return [
      buildWinnerCelebrationLine(event.result),
      buildResultLine(event.result),
      `Final score is ${scoreLine(event.score, event.outs)}.`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (event.type === "target_chased") {
    return [
      buildScoreSentence(event.score, event.outs),
      "Match over.",
      buildWinnerCelebrationLine(event.result),
      buildResultLine(event.result),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (event.type === "innings_change") {
    const transition = buildUmpireFirstInningsTransitionDetails(match);

    return [
      transition.targetLine,
      transition.chaseLine,
      transition.requiredRateLine,
      transition.goodLuckLine,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (event.type === "manual_score_announcement") {
    return buildCurrentScoreAnnouncement(match);
  }

  // Over-complete speech is handled by its own function below.
  if (event.overCompleted) {
    return "";
  }

  const parts = [];
  parts.push(buildScoreSentence(event.score, event.outs));

  const reminder = buildSmartScoreReminder(event, match);
  if (reminder) {
    parts.push(reminder);
  }

  return parts.join(" ");
}

// Spoken summary used when an over completes.
export function buildSpectatorOverCompleteAnnouncement(match) {
  if (!match) return "";

  const oversLeft = getOversLeft(match);
  const wicketsInOver = getWicketsInCurrentOver(match);
  const parts = [
    "Over complete.",
    buildScoreSentence(match.score, match.outs),
    formatCompletedProgress(match),
  ];

  if (oversLeft > 0) {
    parts.push(
      oversLeft === 1 ? "1 over is left." : `${oversLeft} overs are left.`,
    );
  }

  const chaseLine = buildChaseEquationLine(match);
  if (chaseLine) {
    parts.push(chaseLine);
  }

  if (wicketsInOver > 0) {
    parts.push(
      wicketsInOver === 1
        ? "1 wicket fell in this over."
        : `${wicketsInOver} wickets fell in this over.`,
    );
  }

  return parts.join(" ");
}

// Live-event factory functions below create the event objects stored on match.lastLiveEvent.
export function createScoreLiveEvent(
  matchBefore,
  matchAfter,
  ball,
  options = {},
) {
  // Use the innings that was active after this ball.
  const activeInningsKey =
    matchAfter.innings === "first" ? "innings1" : "innings2";
  const history = matchAfter[activeInningsKey]?.history ?? [];
  const battingTeam = getBattingTeamBundle(matchAfter);
  const completedLegalBalls = countLegalBalls(history);
  const ballNumberInOver = completedLegalBalls % 6 || 6;
  // A legal ball ends an over when the count reaches a multiple of 6.
  const overCompleted =
    isLegalBall(ball) &&
    completedLegalBalls > 0 &&
    completedLegalBalls % 6 === 0;
  // In second innings, going past the target ends the chase.
  const targetChased =
    matchAfter.innings === "second" &&
    matchAfter.score > (matchBefore?.innings1?.score ?? 0);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: targetChased ? "target_chased" : "score_update",
    ball,
    summaryText: buildBallEventLine(ball),
    score: matchAfter.score,
    outs: matchAfter.outs,
    battingTeam: battingTeam.name,
    overs: `${Math.floor(completedLegalBalls / 6)}.${completedLegalBalls % 6}`,
    ballNumberInOver: isLegalBall(ball) ? ballNumberInOver : null,
    overCompleted,
    targetChased,
    result: matchAfter.result || "",
    actionId: String(options.actionId || "").trim(),
    createdAt: new Date().toISOString(),
  };
}

// Event object for undo operations.
export function createUndoLiveEvent(match) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "undo",
    summaryText: "Undo",
    score: match?.score ?? 0,
    outs: match?.outs ?? 0,
    createdAt: new Date().toISOString(),
  };
}

// Event object for admin score and roster corrections.
export function createMatchCorrectionLiveEvent(matchBefore, matchAfter, patch) {
  // Use the latest innings so the overs text matches the new state.
  const activeInningsKey =
    matchAfter?.innings === "first" ? "innings1" : "innings2";
  const history = matchAfter?.[activeInningsKey]?.history ?? [];
  const rosterSizeSummary = buildRosterSizeCorrectionSummary(
    matchBefore,
    matchAfter,
    patch,
  );
  const correctionSummary = [
    typeof patch?.innings1Score === "number"
      ? matchAfter?.innings === "second"
        ? "Umpire corrected the first innings score."
        : "Umpire corrected the score."
      : "",
    typeof patch?.overs === "number"
      ? `Match is now ${safeNumber(matchAfter?.overs)} overs.`
      : "",
    rosterSizeSummary,
  ]
    .filter(Boolean)
    .join(" ");

  // Keep old and new values so the UI can explain the fix.
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "score_correction",
    summaryText: correctionSummary || "Umpire corrected the score.",
    score: matchAfter?.score ?? 0,
    outs: matchAfter?.outs ?? 0,
    battingTeam: getBattingTeamBundle(matchAfter).name,
    overs: `${Math.floor(countLegalBalls(history) / 6)}.${countLegalBalls(history) % 6}`,
    result: matchAfter?.result || "",
    previousInnings1Score: safeNumber(matchBefore?.innings1?.score),
    nextInnings1Score:
      typeof patch?.innings1Score === "number"
        ? safeNumber(matchAfter?.innings1?.score)
        : null,
    previousOvers: safeNumber(matchBefore?.overs),
    nextOvers:
      typeof patch?.overs === "number" ? safeNumber(matchAfter?.overs) : null,
    previousTeamASize: Array.isArray(matchBefore?.teamA)
      ? matchBefore.teamA.length
      : 0,
    nextTeamASize: Array.isArray(matchAfter?.teamA)
      ? matchAfter.teamA.length
      : 0,
    previousTeamBSize: Array.isArray(matchBefore?.teamB)
      ? matchBefore.teamB.length
      : 0,
    nextTeamBSize: Array.isArray(matchAfter?.teamB)
      ? matchAfter.teamB.length
      : 0,
    createdAt: new Date().toISOString(),
  };
}

// Event object for match completion.
export function createMatchEndLiveEvent(match, resultText, options = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "match_end",
    summaryText: resultText,
    score: match?.score ?? 0,
    outs: match?.outs ?? 0,
    battingTeam: getBattingTeamBundle(match).name,
    result: resultText,
    ball: options?.ball || null,
    actionId: String(options?.actionId || "").trim(),
    createdAt: new Date().toISOString(),
  };
}

// Event object for non-speech sound effects triggered during live play.
export function createSoundEffectLiveEvent(match, effect, options = {}) {
  // This event can mean either play or stop.
  const action = options.action === "stop" ? "stop" : "play";
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "sound_effect",
    summaryText:
      action === "stop"
        ? effect?.label
          ? `${effect.label} sound effect stopped.`
          : "Sound effect stopped."
        : effect?.label
          ? `${effect.label} sound effect.`
          : "Sound effect.",
    score: match?.score ?? 0,
    outs: match?.outs ?? 0,
    effectId: effect?.id || "",
    effectFileName: effect?.fileName || effect?.id || "",
    effectLabel: effect?.label || "",
    effectSrc: effect?.src || "",
    action,
    clientRequestId: options.clientRequestId || "",
    sourceActionId: String(options.sourceActionId || "").trim(),
    resumeAnnouncements: Boolean(options.resumeAnnouncements),
    trigger: options.trigger === "score_boundary" ? "score_boundary" : "manual",
    preAnnouncementText: String(options.preAnnouncementText || "").trim(),
    preAnnouncementDelayMs: Math.max(
      0,
      Number(options.preAnnouncementDelayMs || 0),
    ),
    createdAt: new Date().toISOString(),
  };
}

// Event object for "announce current score now" requests.
export function createManualScoreAnnouncementLiveEvent(match) {
  const history = getActiveHistory(match);
  const legalBalls = countLegalBalls(history);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "manual_score_announcement",
    summaryText: "Umpire requested the current score announcement.",
    score: match?.score ?? 0,
    outs: match?.outs ?? 0,
    battingTeam: getBattingTeamBundle(match).name,
    overs: `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`,
    result: match?.result || "",
    createdAt: new Date().toISOString(),
  };
}

// Picks the spectator-facing primary spoken line for a live event.
export function buildSpectatorAnnouncement(event, match, mode = "full") {
  if (!event || mode === "silent") {
    return "";
  }

  if (event.type === "toss_set") {
    return event.summaryText || "";
  }

  if (event.type === "innings_change") {
    // For innings change, spectators first hear a short end-of-innings summary.
    const transition = buildUmpireFirstInningsTransitionDetails(match);

    return [
      "First innings complete.",
      transition.scoreLineText,
      transition.oversLine,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (event.type === "image_update") {
    return "Match photo updated.";
  }

  if (event.type === "walkie_enabled") {
    return "Umpire turned on walkie-talkie.";
  }

  if (event.type === "walkie_disabled") {
    return "Umpire turned off walkie-talkie.";
  }

  if (event.type === "score_correction") {
    return event.summaryText || "Umpire corrected the score.";
  }

  if (event.type === "sound_effect") {
    return "";
  }

  if (event.type === "manual_score_announcement") {
    // Manual score requests skip the normal event line.
    return "";
  }

  return buildSpectatorBallAnnouncement(event);
}

// Builds the multi-line spectator speech queue for the live announcer hook.
export function buildLiveScoreAnnouncementSequence(
  event,
  match,
  mode = "full",
) {
  // Return an empty queue when there is nothing to say.
  if (!event || mode === "silent") {
    return {
      items: [],
      priority: 0,
      restoreAfterMs: 0,
    };
  }

  if (event.type === "manual_score_announcement") {
    const scoreLine = buildSpectatorScoreAnnouncement(event, match);
    return {
      items: scoreLine
        ? [
            {
              text: scoreLine,
              pauseAfterMs: 0,
              rate: 0.8,
            },
          ]
        : [],
      priority: 3,
      restoreAfterMs: 2400,
    };
  }

  const line = buildSpectatorAnnouncement(event, match, mode);
  if (!line) {
    return {
      items: [],
      priority: 0,
      restoreAfterMs: 0,
    };
  }

  const scoreLine = buildSpectatorScoreAnnouncement(event, match);
  const overSummary = event.overCompleted
    ? buildSpectatorOverCompleteAnnouncement(match)
    : "";

  // Queue order:
  // 1. main event line
  // 2. score line
  // 3. over summary if the over just ended
  return {
    items: [
      {
        text: line,
        pauseAfterMs: scoreLine || overSummary ? 180 : 0,
        rate: 0.78,
      },
      scoreLine
        ? {
            text: scoreLine,
            pauseAfterMs: overSummary ? 220 : 0,
            rate: 0.8,
          }
        : null,
      overSummary
        ? {
            text: overSummary,
            pauseAfterMs: 0,
            rate: 0.8,
          }
        : null,
    ].filter(Boolean),
    priority: getSpectatorAnnouncementPriority(event),
    restoreAfterMs: overSummary ? 3300 : scoreLine ? 2300 : 1500,
  };
}

// Manual score summary used when someone asks to hear the current score right now.
export function buildCurrentScoreAnnouncement(match) {
  if (!match) return "";

  // This is a short "where are we right now?" summary.
  const parts = [buildScoreSentence(match.score, match.outs)];

  if (match?.innings === "second") {
    parts.push(`Target is ${safeNumber(match?.innings1?.score) + 1}.`);
  }

  parts.push(buildCurrentOverRemainingLine(match));

  return parts.join(" ");
}

// Umpire speech starts here.
// Spoken summary for innings transitions and end-of-match stage calls on the umpire side.
export function buildUmpireStageAnnouncement(match) {
  if (!match) {
    return "";
  }

  const displayResult = String(
    match?.pendingResult || match?.result || "",
  ).trim();

  if (displayResult) {
    const winnerName = getWinnerName(displayResult);

    return [
      "Match over.",
      winnerName ? `Congratulations ${winnerName}.` : "",
      normalizeSpeechResultText(displayResult),
      `Final score is ${scoreLine(safeNumber(match.score), safeNumber(match.outs))}.`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (match.innings !== "first") {
    return "";
  }

  const transition = buildUmpireFirstInningsTransitionDetails(match);

  return [
    "First innings complete.",
    transition.scoreLineText,
    transition.oversLine,
    transition.targetLine,
    transition.chaseLine,
    transition.requiredRateLine,
    transition.goodLuckLine,
  ]
    .filter(Boolean)
    .join(" ");
}

// Full multi-line umpire intro for the second innings opening.
export function buildUmpireSecondInningsStartSequence(match) {
  if (!match || match.innings !== "second") {
    return {
      items: [],
      priority: 0,
      restoreAfterMs: 0,
    };
  }

  const transition = buildUmpireFirstInningsTransitionDetails({
    ...match,
    innings2: {
      ...(match?.innings2 || {}),
      team:
        match?.innings2?.team ||
        getBattingTeamBundle(match).name ||
        "The batting team",
    },
  });

  return {
    items: [
      {
        text: "Second innings starts now.",
        pauseAfterMs: 120,
        rate: 0.81,
      },
      {
        text: [transition.scoreLineText, transition.oversLine]
          .filter(Boolean)
          .join(" "),
        pauseAfterMs: 160,
        rate: 0.79,
      },
      {
        text: [
          transition.targetLine,
          transition.chaseLine,
          transition.requiredRateLine,
        ]
          .filter(Boolean)
          .join(" "),
        pauseAfterMs: 0,
        rate: 0.79,
      },
      {
        text: transition.goodLuckLine,
        pauseAfterMs: 0,
        rate: 0.8,
      },
    ],
    priority: 4,
    restoreAfterMs: 3600,
  };
}

// Main umpire speech text builder.
// This is the clearest single place to read the exact "Umpire has given ..."
// phrases for runs, wides, no balls, byes, leg byes, wickets, and dot balls.
export function buildUmpireAnnouncement(event, mode = "simple") {
  if (!event || mode === "silent") {
    return "";
  }

  if (event.type === "undo") {
    return buildUndoAnnouncementLine();
  }

  if (event.type === "match_end") {
    return "Umpire has called match over.";
  }

  const ball = event.ball;
  if (!ball) {
    return "";
  }

  // The checks below pick the exact line for this ball result.
  if (ball.isOut) {
    return safeNumber(ball.runs) > 0
      ? `Umpire has given ${pluralizeRuns(safeNumber(ball.runs))}. Batter is out.`
      : "Umpire has given the batter out.";
  }

  if (ball.extraType === "wide") {
    const wideRuns = Math.max(safeNumber(ball.runs), 0);
    return wideRuns > 0
      ? `Umpire has given a wide. ${pluralizeRuns(wideRuns)} given.`
      : "Umpire has given a wide.";
  }

  if (ball.extraType === "noball") {
    const noBallRuns = Math.max(safeNumber(ball.runs), 0);
    return noBallRuns > 0
      ? `Umpire has given a no ball. ${pluralizeRuns(noBallRuns)} given.`
      : "Umpire has given a no ball.";
  }

  if (ball.extraType === "bye") {
    return safeNumber(ball.runs) > 0
      ? `Umpire has given bye. ${pluralizeRuns(safeNumber(ball.runs))}.`
      : "Umpire has given bye.";
  }

  if (ball.extraType === "legbye") {
    return safeNumber(ball.runs) > 0
      ? `Umpire has given leg bye. ${pluralizeRuns(safeNumber(ball.runs))}.`
      : "Umpire has given leg bye.";
  }

  if (ball.runs === 0) {
    return "Umpire has given dot ball.";
  }

  if (safeNumber(ball.runs) === 4) {
    return "Umpire has given four runs.";
  }

  if (safeNumber(ball.runs) === 6) {
    return "Umpire has given six runs.";
  }

  return `Umpire has given ${pluralizeRuns(safeNumber(ball.runs))}.`;
}

// Alternate umpire call used for simpler tap-to-preview interactions.
export function buildUmpireTapAnnouncement(event, mode = "simple") {
  if (!event || mode === "silent") {
    return "";
  }

  if (event.type === "undo") {
    return "Undo.";
  }

  if (event.type === "match_end") {
    return "Match over.";
  }

  const ball = event.ball;
  if (!ball) {
    return "";
  }

  // This version is shorter than buildUmpireAnnouncement.
  if (ball.isOut) {
    return safeNumber(ball.runs) > 0
      ? `${pluralizeRuns(safeNumber(ball.runs))} and out.`
      : "Out.";
  }

  if (ball.extraType === "wide") {
    const wideRuns = Math.max(safeNumber(ball.runs), 0);
    return wideRuns > 0 ? `Wide, ${pluralizeRuns(wideRuns)} given.` : "Wide.";
  }

  if (ball.extraType === "noball") {
    const noBallRuns = Math.max(safeNumber(ball.runs), 0);
    return noBallRuns > 0
      ? `No ball, ${pluralizeRuns(noBallRuns)} given.`
      : "No ball.";
  }

  if (ball.extraType === "bye") {
    return safeNumber(ball.runs) > 0
      ? `Bye, ${pluralizeRuns(safeNumber(ball.runs))}.`
      : "Bye.";
  }

  if (ball.extraType === "legbye") {
    return safeNumber(ball.runs) > 0
      ? `Leg bye, ${pluralizeRuns(safeNumber(ball.runs))}.`
      : "Leg bye.";
  }

  if (safeNumber(ball.runs) === 0) {
    return "Dot ball.";
  }

  return `${pluralizeRuns(safeNumber(ball.runs))}.`;
}
