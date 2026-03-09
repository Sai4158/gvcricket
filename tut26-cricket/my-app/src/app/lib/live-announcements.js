import { countLegalBalls } from "./match-scoring";
import { getBattingTeamBundle } from "./team-utils";

function getOversDisplay(history = []) {
  const legalBalls = countLegalBalls(history);
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function pluralize(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
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

function describeBall(ball) {
  if (!ball) return "Score update";

  if (ball.isOut) {
    if (ball.runs > 0) {
      return `Wicket and ${pluralize(ball.runs, "run")}`;
    }
    return "Wicket";
  }

  if (ball.extraType === "wide") {
    return ball.runs > 1 ? `${pluralize(ball.runs, "wide")}` : "Wide ball";
  }

  if (ball.extraType === "noball") {
    return ball.runs > 1 ? `No ball, ${pluralize(ball.runs, "run")}` : "No ball";
  }

  if (ball.runs === 0) return "Dot ball";
  if (ball.runs === 4) return "Four runs";
  if (ball.runs === 6) return "Six runs";
  return pluralize(ball.runs, "run");
}

export function buildSpectatorAnnouncement(event, match, mode = "full") {
  if (!event || mode === "silent" || event.type === "undo") {
    return "";
  }

  const base =
    event.type === "match_end" && event.result
      ? event.result
      : describeBall(event.ball);

  const scoreLine = `Current score, ${event.score} for ${event.outs}.`;
  const endOfOverLine = event.overCompleted ? "End of over." : "";
  const chaseLine = event.targetChased ? "Target chased." : "";

  if (mode === "simple") {
    return [base, scoreLine, endOfOverLine, chaseLine].filter(Boolean).join(" ");
  }

  const teamLine = event.battingTeam ? `${event.battingTeam} batting.` : "";
  return [teamLine, base, scoreLine, endOfOverLine, chaseLine]
    .filter(Boolean)
    .join(" ");
}

export function buildCurrentScoreAnnouncement(match) {
  if (!match) return "";
  const battingTeam = getBattingTeamBundle(match);
  const activeInningsKey = match.innings === "first" ? "innings1" : "innings2";
  const overs = getOversDisplay(match[activeInningsKey]?.history ?? []);
  return `${battingTeam.name} batting. Current score, ${match.score} for ${match.outs} after ${overs} overs.`;
}

export function buildUmpireAnnouncement(event, mode = "simple") {
  if (!event || mode === "silent" || event.type === "undo" || event.type === "match_end") {
    return "";
  }

  return describeBall(event.ball);
}
