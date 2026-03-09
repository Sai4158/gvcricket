import { countLegalBalls } from "./match-scoring";
import { getBattingTeamBundle, getTotalDismissalsAllowed } from "./team-utils";

function getOversDisplay(history = []) {
  const legalBalls = countLegalBalls(history);
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function getActiveInningsKey(match) {
  return match?.innings === "second" ? "innings2" : "innings1";
}

function getActiveHistory(match) {
  return match?.[getActiveInningsKey(match)]?.history ?? [];
}

function pluralize(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function scoreLine(score, outs) {
  return `${score} for ${outs}`;
}

function scoreDetailLine(score, outs) {
  return `${score} run${score === 1 ? "" : "s"} and ${outs} wicket${
    outs === 1 ? "" : "s"
  }`;
}

function spokenOutsLine(outs) {
  return `${outs} out${outs === 1 ? "" : "s"}`;
}

function safeNumber(value) {
  return Number(value || 0);
}

function getBallsRemaining(match) {
  return Math.max(
    0,
    safeNumber(match?.overs) * 6 - countLegalBalls(getActiveHistory(match))
  );
}

function getBallsLeftInCurrentOver(match) {
  const legalBalls = countLegalBalls(getActiveHistory(match));
  const ballsIntoOver = legalBalls % 6;
  return ballsIntoOver === 0 ? 0 : 6 - ballsIntoOver;
}

function getCompletedOvers(match) {
  return Math.floor(countLegalBalls(getActiveHistory(match)) / 6);
}

function formatRemainingOvers(match) {
  const ballsRemaining = getBallsRemaining(match);
  const overs = Math.floor(ballsRemaining / 6);
  const balls = ballsRemaining % 6;

  if (overs <= 0) {
    return `${balls} ball${balls === 1 ? "" : "s"} left`;
  }

  if (balls === 0) {
    return `${overs} over${overs === 1 ? "" : "s"} left`;
  }

  return `${overs} over${overs === 1 ? "" : "s"} and ${balls} ball${
    balls === 1 ? "" : "s"
  } left`;
}

function shouldReadFullScore(ball) {
  return true;
}

function describeBall(ball) {
  if (!ball) return "Score update";

  if (ball.isOut) {
    return "1 out this ball.";
  }

  if (ball.extraType === "wide") {
    const extraRuns = Math.max(Number(ball.runs || 0) - 1, 0);
    if (extraRuns === 0) return "Wide ball this ball.";
    return `Wide ball and ${pluralize(extraRuns, "extra run")} this ball.`;
  }

  if (ball.extraType === "noball") {
    const extraRuns = Math.max(Number(ball.runs || 0) - 1, 0);
    if (extraRuns === 0) return "No ball this ball.";
    return `No ball and ${pluralize(extraRuns, "extra run")} this ball.`;
  }

  if (ball.runs === 0) return "Dot ball.";
  return `Scored ${pluralize(ball.runs, "run")} this ball.`;
}

function buildBallsLeftLine(match) {
  const ballsLeft = getBallsLeftInCurrentOver(match);
  if (ballsLeft <= 0) {
    return "";
  }

  if (ballsLeft === 1) {
    return "This is the last ball for this over.";
  }

  return `${ballsLeft} ball${ballsLeft === 1 ? "" : "s"} left in the over.`;
}

function buildChaseEquation(match) {
  if (match?.innings !== "second") return "";

  const target = safeNumber(match?.innings1?.score) + 1;
  const runsNeeded = Math.max(0, target - safeNumber(match?.score));
  const ballsRemaining = getBallsRemaining(match);
  const wicketsLeft = Math.max(
    1,
    getTotalDismissalsAllowed(match) - safeNumber(match?.outs)
  );

  if (runsNeeded <= 0) {
    return "Target chased.";
  }

  return `Need ${runsNeeded}. ${formatRemainingOvers(match)}. ${wicketsLeft} ${
    wicketsLeft === 1 ? "wicket" : "wickets"
  } left.`;
}

function buildScoreSentence(event) {
  return `The total score is ${event.score} run${event.score === 1 ? "" : "s"}.`;
}

export function buildSpectatorBallAnnouncement(event) {
  if (!event?.ball) return "";
  return describeBall(event.ball);
}

export function buildSpectatorScoreAnnouncement(event, match) {
  if (!event) return "";
  return [buildScoreSentence(event), buildBallsLeftLine(match)].filter(Boolean).join(" ");
}

export function buildSpectatorOverCompleteAnnouncement(match) {
  if (!match) return "";

  const oversCompleted = getCompletedOvers(match);
  const parts = [
    `The total score is ${safeNumber(match.score)} run${
      safeNumber(match.score) === 1 ? "" : "s"
    }.`,
    oversCompleted === 1
      ? "1 over has been completed."
      : `${oversCompleted} overs have been completed.`,
  ];

  if (safeNumber(match.outs) > 0) {
    parts.push(
      safeNumber(match.outs) === 1
        ? "1 batter was out."
        : `${safeNumber(match.outs)} batters were out.`
    );
  }

  const ballsRemaining = getBallsRemaining(match);
  if (ballsRemaining > 0) {
    parts.push(`${formatRemainingOvers(match)}.`);
  }

  return parts.join(" ");
}

export function createScoreLiveEvent(matchBefore, matchAfter, ball) {
  const activeInningsKey =
    matchAfter.innings === "first" ? "innings1" : "innings2";
  const history = matchAfter[activeInningsKey]?.history ?? [];
  const battingTeam = getBattingTeamBundle(matchAfter);
  const overCompleted =
    ball.extraType !== "wide" &&
    ball.extraType !== "noball" &&
    countLegalBalls(history) > 0 &&
    countLegalBalls(history) % 6 === 0;
  const targetChased =
    matchAfter.innings === "second" &&
    matchAfter.score > (matchBefore?.innings1?.score ?? 0);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: targetChased ? "target_chased" : "score_update",
    ball,
    summaryText: describeBall(ball),
    score: matchAfter.score,
    outs: matchAfter.outs,
    battingTeam: battingTeam.name,
    overs: getOversDisplay(history),
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
  if (!event || mode === "silent" || event.type === "undo") {
    return "";
  }

  if (event.type === "match_end" && event.result) {
    return event.result;
  }

  if (event.type === "target_chased" && event.result) {
    return [buildSpectatorBallAnnouncement(event), buildSpectatorScoreAnnouncement(event, match), event.result]
      .filter(Boolean)
      .join(" ");
  }

  if (event.type === "toss_set") {
    const targetPreview =
      match?.innings2?.team && match?.innings1?.team
        ? `${match.innings1.team} will bat first.`
        : "";
    return [event.summaryText, targetPreview].filter(Boolean).join(" ");
  }

  if (event.type === "innings_change") {
    return [event.summaryText, buildChaseEquation(match)].filter(Boolean).join(" ");
  }

  if (event.type === "image_update") {
    return "Match photo updated.";
  }

  if (mode === "simple") {
    return buildSpectatorBallAnnouncement(event);
  }

  return buildSpectatorBallAnnouncement(event);
}

export function buildCurrentScoreAnnouncement(match) {
  if (!match) return "";

  const battingTeam = getBattingTeamBundle(match);
  const parts = [
    `The current score for ${battingTeam.name} is ${safeNumber(match.score)} run${
      safeNumber(match.score) === 1 ? "" : "s"
    }.`,
  ];

  if (safeNumber(match.outs) > 0) {
    parts.push(`${safeNumber(match.outs)} out${safeNumber(match.outs) === 1 ? "" : "s"}.`);
  }

  const chaseLine = formatRemainingOvers(match);
  if (chaseLine) {
    parts.push(`${chaseLine}.`);
  }

  return parts.join(" ");
}

export function buildUmpireAnnouncement(event, mode = "simple") {
  if (!event || mode === "silent" || event.type === "undo" || event.type === "match_end") {
    return "";
  }

  const ball = event.ball;
  if (!ball) {
    return "";
  }

  if (ball.isOut) {
    return ball.runs > 0
      ? `${ball.runs} run${ball.runs === 1 ? "" : "s"} and out`
      : "Out";
  }

  if (ball.extraType === "wide") {
    const extraRuns = Math.max(Number(ball.runs || 0) - 1, 0);
    return extraRuns > 0 ? `Wide plus ${extraRuns}` : "Wide";
  }

  if (ball.extraType === "noball") {
    const extraRuns = Math.max(Number(ball.runs || 0) - 1, 0);
    return extraRuns > 0 ? `No ball plus ${extraRuns}` : "No ball";
  }

  if (ball.runs === 0) {
    return "Dot";
  }

  return `${ball.runs} run${ball.runs === 1 ? "" : "s"}`;
}
