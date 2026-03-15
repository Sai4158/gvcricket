import { countLegalBalls } from "./match-scoring";
import { getBattingTeamBundle } from "./team-utils";

function safeNumber(value) {
  return Number(value || 0);
}

function pluralizeRuns(value) {
  return `${value} run${value === 1 ? "" : "s"}`;
}

function scoreLine(score, outs) {
  return `${score} for ${outs}`;
}

function getActiveInningsKey(match) {
  return match?.innings === "second" ? "innings2" : "innings1";
}

function getActiveHistory(match) {
  return match?.[getActiveInningsKey(match)]?.history ?? [];
}

function getCompletedOvers(match) {
  return Math.floor(countLegalBalls(getActiveHistory(match)) / 6);
}

function getOversLeft(match) {
  return Math.max(0, safeNumber(match?.overs) - getCompletedOvers(match));
}

function getBallNumberInOver(match) {
  const legalBalls = countLegalBalls(getActiveHistory(match));
  const ballsIntoOver = legalBalls % 6;
  return ballsIntoOver === 0 ? 6 : ballsIntoOver;
}

function getWicketsInCurrentOver(match) {
  const history = getActiveHistory(match);
  const over = history.at(-1);
  return over?.balls?.filter((ball) => ball?.isOut).length || 0;
}

function getBallsRemaining(match) {
  return Math.max(0, safeNumber(match?.overs) * 6 - countLegalBalls(getActiveHistory(match)));
}

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

function isLegalBall(ball) {
  return ball?.extraType !== "wide" && ball?.extraType !== "noball";
}

function isBoundary(ball) {
  return safeNumber(ball?.runs) >= 4 && !ball?.extraType && !ball?.isOut;
}

function isImportantEvent(ball) {
  return Boolean(
    ball?.isOut ||
      ball?.extraType === "wide" ||
      ball?.extraType === "noball" ||
      isBoundary(ball)
  );
}

export function getSpectatorAnnouncementPriority(event) {
  if (!event) return 0;
  if (
    event.type === "undo" ||
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

function buildRunsCall(runs) {
  return `Umpire has given ${pluralizeRuns(runs)}.`;
}

function buildBallEventLine(ball) {
  if (!ball) return "";

  if (ball.isOut) {
    if (safeNumber(ball.runs) > 0) {
      return `Umpire has given ${pluralizeRuns(safeNumber(ball.runs))}. Batter is out.`;
    }
    return "Umpire has given 1 out.";
  }

  if (ball.extraType === "wide") {
    const wideRuns = Math.max(safeNumber(ball.runs), 0);
    if (wideRuns > 0) {
      return `Umpire has given a wide. ${pluralizeRuns(wideRuns)} taken.`;
    }
    return "Umpire has given a wide.";
  }

  if (ball.extraType === "noball") {
    const noBallRuns = Math.max(safeNumber(ball.runs), 0);
    if (noBallRuns > 0) {
      return `Umpire has given a no ball. ${pluralizeRuns(noBallRuns)} taken.`;
    }
    return "Umpire has given a no ball.";
  }

  if (ball.extraType === "bye") return "Bye.";
  if (ball.extraType === "legbye") return "Leg bye.";

  if (safeNumber(ball.runs) === 0) return "Dot ball.";
  if (isBoundary(ball)) return `Umpire has given ${pluralizeRuns(safeNumber(ball.runs))}.`;
  return buildRunsCall(safeNumber(ball.runs));
}

function buildProgressReminder(event, match) {
  if (!event?.ball || event.overCompleted || !isLegalBall(event.ball)) {
    return "";
  }

  const ballNumber = getBallNumberInOver(match);
  if (ballNumber === 2) return "This is ball 2.";
  if (ballNumber === 4) return "This is ball 4.";
  if (ballNumber === 5) return "This is the last ball of the over.";
  return "";
}

function buildScoreSentence(score, outs) {
  return `Score is ${scoreLine(safeNumber(score), safeNumber(outs))}.`;
}

function buildResultLine(resultText) {
  const result = String(resultText || "").trim();
  if (!result) return "";
  const winnerMatch = result.match(/^(.+?) won by (.+)\.$/i);
  if (!winnerMatch) return result;
  const [, winnerName, margin] = winnerMatch;
  return `${winnerName} wins by ${margin}.`;
}

export function buildSpectatorBallAnnouncement(event) {
  if (!event) return "";

  if (event.type === "undo") {
    return "Umpire has undone the last ball.";
  }

  if (event.type === "match_end") {
    return "Match over.";
  }

  return buildBallEventLine(event.ball);
}

export function buildSpectatorScoreAnnouncement(event, match) {
  if (!event) return "";

  if (event.type === "undo") {
    return "";
  }

  if (event.type === "match_end") {
    return [
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
      buildResultLine(event.result),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (event.overCompleted) {
    return "";
  }

  const parts = [];
  parts.push(buildScoreSentence(event.score, event.outs));

  const reminder = buildProgressReminder(event, match);
  if (reminder) {
    parts.push(reminder);
  }

  return parts.join(" ");
}

export function buildSpectatorOverCompleteAnnouncement(match) {
  if (!match) return "";

  const oversDone = getCompletedOvers(match);
  const oversLeft = getOversLeft(match);
  const wicketsInOver = getWicketsInCurrentOver(match);
  const parts = [
    "Over complete.",
    buildScoreSentence(match.score, match.outs),
    oversDone === 1 ? "1 over is done." : `${oversDone} overs are done.`,
  ];

  if (oversLeft > 0) {
    parts.push(oversLeft === 1 ? "1 over is left." : `${oversLeft} overs are left.`);
  }

  if (wicketsInOver > 0) {
    parts.push(
      wicketsInOver === 1
        ? "1 wicket fell in this over."
        : `${wicketsInOver} wickets fell in this over.`
    );
  }

  return parts.join(" ");
}

export function createScoreLiveEvent(matchBefore, matchAfter, ball) {
  const activeInningsKey =
    matchAfter.innings === "first" ? "innings1" : "innings2";
  const history = matchAfter[activeInningsKey]?.history ?? [];
  const battingTeam = getBattingTeamBundle(matchAfter);
  const overCompleted =
    isLegalBall(ball) && countLegalBalls(history) > 0 && countLegalBalls(history) % 6 === 0;
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
    overs: `${Math.floor(countLegalBalls(history) / 6)}.${countLegalBalls(history) % 6}`,
    overCompleted,
    targetChased,
    result: matchAfter.result || "",
    createdAt: new Date().toISOString(),
  };
}

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

export function createMatchEndLiveEvent(match, resultText) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "match_end",
    summaryText: resultText,
    score: match?.score ?? 0,
    outs: match?.outs ?? 0,
    battingTeam: getBattingTeamBundle(match).name,
    result: resultText,
    createdAt: new Date().toISOString(),
  };
}

export function buildSpectatorAnnouncement(event, match, mode = "full") {
  if (!event || mode === "silent") {
    return "";
  }

  if (event.type === "toss_set") {
    return event.summaryText || "";
  }

  if (event.type === "innings_change") {
    return event.summaryText || "";
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

  return buildSpectatorBallAnnouncement(event);
}

export function buildCurrentScoreAnnouncement(match) {
  if (!match) return "";

  const oversDone = getCompletedOvers(match);
  const oversLeft = getOversLeft(match);
  const parts = [
    buildScoreSentence(match.score, match.outs),
    oversDone === 1 ? "1 over is done." : `${oversDone} overs are done.`,
  ];

  if (oversLeft > 0) {
    parts.push(oversLeft === 1 ? "1 over is left." : `${oversLeft} overs are left.`);
  }

  if (match?.innings === "second") {
    const target = safeNumber(match?.innings1?.score) + 1;
    const runsNeeded = Math.max(0, target - safeNumber(match?.score));
    if (runsNeeded > 0) {
      parts.push(`${runsNeeded} needed from ${formatRemainingOvers(match)}.`);
    }
  }

  return parts.join(" ");
}

export function buildUmpireAnnouncement(event, mode = "simple") {
  if (!event || mode === "silent") {
    return "";
  }

  if (event.type === "undo") {
    return "Umpire has undone the last ball. The score for that ball has been removed. Umpire will redo this ball.";
  }

  if (event.type === "match_end") {
    return "Umpire says match over.";
  }

  const ball = event.ball;
  if (!ball) {
    return "";
  }

  if (ball.isOut) {
    return safeNumber(ball.runs) > 0
      ? `Umpire gives ${pluralizeRuns(safeNumber(ball.runs))}, and batter is out.`
      : "Umpire has decided, out.";
  }

  if (ball.extraType === "wide") {
    const wideRuns = Math.max(safeNumber(ball.runs), 0);
    return wideRuns > 0
      ? `Umpire says wide ball. ${pluralizeRuns(wideRuns)} more taken.`
      : "Umpire says wide ball.";
  }

  if (ball.extraType === "noball") {
    const noBallRuns = Math.max(safeNumber(ball.runs), 0);
    return noBallRuns > 0
      ? `Umpire says no ball. ${pluralizeRuns(noBallRuns)} more taken.`
      : "Umpire says no ball.";
  }

  if (ball.extraType === "bye") {
    return safeNumber(ball.runs) > 0
      ? `Umpire gives bye. ${pluralizeRuns(safeNumber(ball.runs))}.`
      : "Umpire gives bye.";
  }

  if (ball.extraType === "legbye") {
    return safeNumber(ball.runs) > 0
      ? `Umpire gives leg bye. ${pluralizeRuns(safeNumber(ball.runs))}.`
      : "Umpire gives leg bye.";
  }

  if (ball.runs === 0) {
    return "Umpire says dot ball.";
  }

  if (safeNumber(ball.runs) === 4) {
    return "Umpire gives four runs.";
  }

  if (safeNumber(ball.runs) === 6) {
    return "Umpire gives six runs.";
  }

  return `Umpire gives ${pluralizeRuns(safeNumber(ball.runs))}.`;
}

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

  if (ball.isOut) {
    return safeNumber(ball.runs) > 0
      ? `${pluralizeRuns(safeNumber(ball.runs))} and out.`
      : "Out.";
  }

  if (ball.extraType === "wide") {
    const wideRuns = Math.max(safeNumber(ball.runs), 0);
    return wideRuns > 0 ? `Wide, ${pluralizeRuns(wideRuns)} taken.` : "Wide.";
  }

  if (ball.extraType === "noball") {
    const noBallRuns = Math.max(safeNumber(ball.runs), 0);
    return noBallRuns > 0 ? `No ball, ${pluralizeRuns(noBallRuns)} taken.` : "No ball.";
  }

  if (ball.extraType === "bye") {
    return safeNumber(ball.runs) > 0 ? `Bye, ${pluralizeRuns(safeNumber(ball.runs))}.` : "Bye.";
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
