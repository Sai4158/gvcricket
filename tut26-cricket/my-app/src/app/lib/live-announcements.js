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

function describeBall(ball) {
  if (!ball) return "Score update";

  if (ball.isOut) {
    if (ball.runs > 0) {
      return `Wicket. ${pluralize(ball.runs, "run")} completed`;
    }
    return "Wicket";
  }

  if (ball.extraType === "wide") {
    if (ball.runs === 1) return "Wide ball";
    return `Wide. ${pluralize(ball.runs, "run")} added`;
  }

  if (ball.extraType === "noball") {
    if (ball.runs === 1) return "No ball";
    return `No ball. ${pluralize(ball.runs, "run")} added`;
  }

  if (ball.runs === 0) return "Dot ball";
  if (ball.runs === 1) return "Single";
  if (ball.runs === 2) return "Two runs";
  if (ball.runs === 3) return "Three runs";
  if (ball.runs === 4) return "Four runs";
  if (ball.runs === 6) return "Six runs";
  return pluralize(ball.runs, "run");
}

function buildChaseEquation(match) {
  if (match?.innings !== "second") return "";

  const target = Number(match?.innings1?.score || 0) + 1;
  const runsNeeded = Math.max(0, target - Number(match?.score || 0));
  const ballsRemaining = Math.max(
    0,
    Number(match?.overs || 0) * 6 - countLegalBalls(getActiveHistory(match))
  );
  const wicketsLeft = Math.max(
    1,
    getTotalDismissalsAllowed(match) - Number(match?.outs || 0)
  );

  if (runsNeeded <= 0) {
    return "Target chased.";
  }

  return `Need ${runsNeeded} from ${ballsRemaining} with ${wicketsLeft} ${
    wicketsLeft === 1 ? "wicket" : "wickets"
  } in hand.`;
}

function buildOverLine(event) {
  if (!event?.overCompleted) return "";
  return `End of over. ${event.battingTeam || "Batting side"} now ${scoreLine(
    event.score,
    event.outs
  )}.`;
}

function buildFullBallCommentary(event, match) {
  const base = describeBall(event.ball);
  const currentScore = `The score is ${scoreLine(event.score, event.outs)} after ${
    event.overs || getOversDisplay(getActiveHistory(match))
  } overs.`;
  const chaseLine = buildChaseEquation(match);
  const overLine = buildOverLine(event);

  return [base, currentScore, overLine, chaseLine].filter(Boolean).join(" ");
}

function buildSimpleBallCommentary(event) {
  return [describeBall(event.ball), `Score now ${scoreLine(event.score, event.outs)}.`]
    .filter(Boolean)
    .join(" ");
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
    return `${buildFullBallCommentary(event, match)} ${event.result}`;
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
    return buildSimpleBallCommentary(event);
  }

  const teamLine = event.battingTeam ? `${event.battingTeam} batting.` : "";
  return [teamLine, buildFullBallCommentary(event, match)].filter(Boolean).join(" ");
}

export function buildCurrentScoreAnnouncement(match) {
  if (!match) return "";

  const battingTeam = getBattingTeamBundle(match);
  const activeInningsKey = match.innings === "first" ? "innings1" : "innings2";
  const overs = getOversDisplay(match[activeInningsKey]?.history ?? []);
  const chaseLine = buildChaseEquation(match);

  return [
    `${battingTeam.name} batting.`,
    `The score is ${scoreLine(match.score, match.outs)} after ${overs} overs.`,
    chaseLine,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildUmpireAnnouncement(event, mode = "simple") {
  if (!event || mode === "silent" || event.type === "undo" || event.type === "match_end") {
    return "";
  }

  return describeBall(event.ball);
}
