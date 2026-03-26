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
  return Math.max(
    0,
    safeNumber(match?.overs) * 6 - countLegalBalls(getActiveHistory(match)),
  );
}

function formatRemainingBalls(match) {
  const ballsRemaining = getBallsRemaining(match);
  return `${ballsRemaining} ball${ballsRemaining === 1 ? "" : "s"}`;
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
    isBoundary(ball),
  );
}

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

  if (ball.extraType === "bye") return "Bye.";
  if (ball.extraType === "legbye") return "Leg bye.";

  if (safeNumber(ball.runs) === 0) return "Dot ball.";
  if (isBoundary(ball))
    return `Umpire has given ${pluralizeRuns(safeNumber(ball.runs))}.`;
  return buildRunsCall(safeNumber(ball.runs));
}

function buildUndoAnnouncementLine() {
  return "Umpire has removed the score for that ball. Umpire will redo this ball.";
}

function buildProgressReminder(event, match) {
  if (!event?.ball || event.overCompleted || !isLegalBall(event.ball)) {
    return "";
  }

  const ballNumber = getBallNumberInOver(match);
  if (ballNumber === 2) return "This is ball 2.";
  if (ballNumber === 4) return "This is ball 4.";
  if (ballNumber === 5) return "One ball to finish the over.";
  return "";
}

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

  const ballNumber = getBallNumberInOver(match);
  return ballNumber === 3 || ballNumber === 5;
}

function buildSmartScoreReminder(event, match) {
  const chaseEquation = buildChaseEquationLine(match);
  if (shouldCallChaseEquation(event, match) && chaseEquation) {
    return chaseEquation;
  }

  return buildProgressReminder(event, match);
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

function getWinnerName(resultText) {
  const result = String(resultText || "").trim();
  if (!result) return "";
  const winnerMatch = result.match(/^(.+?) won by /i);
  return winnerMatch ? winnerMatch[1] : "";
}

function buildWinnerCelebrationLine(resultText) {
  const winnerName = getWinnerName(resultText);
  return winnerName ? `Congratulations ${winnerName}.` : "";
}

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
    const target = safeNumber(match?.innings1?.score) + 1;
    const runsNeeded = Math.max(0, target - safeNumber(match?.score));
    const requiredRate =
      safeNumber(match?.overs) > 0
        ? (target / safeNumber(match?.overs)).toFixed(2)
        : "0.00";

    return [
      runsNeeded > 0
        ? `${runsNeeded} runs needed from ${formatRemainingOvers(match)}.`
        : "",
      `Required rate is ${requiredRate} per over.`,
      "Best of luck to both teams.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (event.type === "manual_score_announcement") {
    return buildCurrentScoreAnnouncement(match);
  }

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

export function createScoreLiveEvent(matchBefore, matchAfter, ball) {
  const activeInningsKey =
    matchAfter.innings === "first" ? "innings1" : "innings2";
  const history = matchAfter[activeInningsKey]?.history ?? [];
  const battingTeam = getBattingTeamBundle(matchAfter);
  const overCompleted =
    isLegalBall(ball) &&
    countLegalBalls(history) > 0 &&
    countLegalBalls(history) % 6 === 0;
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

export function createMatchCorrectionLiveEvent(matchBefore, matchAfter, patch) {
  const activeInningsKey =
    matchAfter?.innings === "first" ? "innings1" : "innings2";
  const history = matchAfter?.[activeInningsKey]?.history ?? [];
  const correctionSummary = [
    typeof patch?.innings1Score === "number"
      ? matchAfter?.innings === "second"
        ? "Umpire corrected the first innings score."
        : "Umpire corrected the score."
      : "",
    typeof patch?.overs === "number"
      ? `Match is now ${safeNumber(matchAfter?.overs)} overs.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

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

export function createSoundEffectLiveEvent(match, effect, options = {}) {
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

export function buildSpectatorAnnouncement(event, match, mode = "full") {
  if (!event || mode === "silent") {
    return "";
  }

  if (event.type === "toss_set") {
    return event.summaryText || "";
  }

  if (event.type === "innings_change") {
    const firstInningsTeam = match?.innings1?.team || "Innings 1";
    const chaseTeam = match?.innings2?.team || getBattingTeamBundle(match).name;
    const firstInningsScore = scoreLine(
      safeNumber(match?.innings1?.score),
      safeNumber(match?.innings1?.outs),
    );
    const target = safeNumber(match?.innings1?.score) + 1;

    return [
      "First innings complete.",
      `${firstInningsTeam} finished on ${firstInningsScore}.`,
      `${chaseTeam} needs ${target} to win.`,
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
    return "";
  }

  return buildSpectatorBallAnnouncement(event);
}

export function buildLiveScoreAnnouncementSequence(
  event,
  match,
  mode = "full",
) {
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

export function buildCurrentScoreAnnouncement(match) {
  if (!match) return "";

  const oversDone = getCompletedOvers(match);
  const oversLeft = getOversLeft(match);
  const parts = [
    buildScoreSentence(match.score, match.outs),
    oversDone === 1 ? "1 over is done." : `${oversDone} overs are done.`,
  ];

  if (oversLeft > 0) {
    parts.push(
      oversLeft === 1 ? "1 over is left." : `${oversLeft} overs are left.`,
    );
  }

  if (match?.innings === "second") {
    const chaseLine = buildChaseEquationLine(match);
    if (chaseLine) {
      parts.push(chaseLine);
    }
  }

  return parts.join(" ");
}

export function buildUmpireAnnouncement(event, mode = "simple") {
  if (!event || mode === "silent") {
    return "";
  }

  if (event.type === "undo") {
    return buildUndoAnnouncementLine();
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
      ? `Umpire says wide ball. ${pluralizeRuns(wideRuns)} given.`
      : "Umpire says wide ball.";
  }

  if (ball.extraType === "noball") {
    const noBallRuns = Math.max(safeNumber(ball.runs), 0);
    return noBallRuns > 0
      ? `Umpire says no ball. ${pluralizeRuns(noBallRuns)} given.`
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
    return "Umpire has given dot ball.";
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
