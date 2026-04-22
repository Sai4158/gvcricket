/**
 * File overview:
 * Purpose: Builds deterministic long-match fixtures and generated umpire stress action sequences.
 * Main exports: startLongMatchFixture, generateStressSequence, buildLongMatchReplayScenario.
 * Major callers: automated match-engine, queue, and smoke stress suites.
 * Side effects: none.
 * Read next: ./match-fixtures.js
 */

import { applyMatchAction } from "../../src/app/lib/match-engine.js";
import { countLegalBalls } from "../../src/app/lib/match-scoring.js";
import { buildBaseMatchFixture } from "./match-fixtures.js";

export const LONG_MATCH_OVERS = 15;
export const LONG_MATCH_PLAYERS = 10;
export const GENERATED_STRESS_SEQUENCE_COUNT = 2001;

const SCORING_ACTION_POOL = [
  { category: "score", runs: 0, isOut: false, extraType: null, key: "dot" },
  { category: "score", runs: 1, isOut: false, extraType: null, key: "1" },
  { category: "score", runs: 2, isOut: false, extraType: null, key: "2" },
  { category: "score", runs: 3, isOut: false, extraType: null, key: "3" },
  { category: "score", runs: 4, isOut: false, extraType: null, key: "4" },
  { category: "score", runs: 6, isOut: false, extraType: null, key: "6" },
  { category: "extra", runs: 1, isOut: false, extraType: "wide", key: "wide-1" },
  { category: "extra", runs: 2, isOut: false, extraType: "wide", key: "wide-2" },
  { category: "extra", runs: 1, isOut: false, extraType: "noball", key: "noball-1" },
  { category: "extra", runs: 2, isOut: false, extraType: "noball", key: "noball-2" },
  { category: "wicket", runs: 0, isOut: true, extraType: null, key: "wicket" },
];

function createSeededRng(seed) {
  let state = Math.max(1, Number(seed || 1)) % 2147483647;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function pickOne(values, rng) {
  return values[Math.floor(rng() * values.length)];
}

function nextActionId(seed, label, index) {
  return `stress:${seed}:${label}:${index}`;
}

function getBattingTeamSize(match) {
  if (match?.innings === "second") {
    return Array.isArray(match?.innings2?.team) ? match.innings2.team.length : Math.max(match?.teamA?.length || 0, match?.teamB?.length || 0);
  }
  const inningsTeam = String(match?.innings1?.team || "");
  if (inningsTeam && inningsTeam === String(match?.teamAName || "")) {
    return Array.isArray(match?.teamA) ? match.teamA.length : LONG_MATCH_PLAYERS;
  }
  if (inningsTeam && inningsTeam === String(match?.teamBName || "")) {
    return Array.isArray(match?.teamB) ? match.teamB.length : LONG_MATCH_PLAYERS;
  }
  return Math.max(match?.teamA?.length || 0, match?.teamB?.length || 0, LONG_MATCH_PLAYERS);
}

function getActiveHistory(match) {
  if (match?.innings === "second") {
    return Array.isArray(match?.innings2?.history) ? match.innings2.history : [];
  }

  return Array.isArray(match?.innings1?.history) ? match.innings1.history : [];
}

function getLegalBallsRemaining(match) {
  return Math.max(0, Number(match?.overs || LONG_MATCH_OVERS) * 6 - countLegalBalls(getActiveHistory(match)));
}

function canUndo(match) {
  return (
    Array.isArray(match?.actionHistory) &&
    match.actionHistory.length > 1
  );
}

function canAdvanceInnings(match) {
  if (!match || match.result || match.pendingResult) {
    return false;
  }

  if (String(match.innings || "first") !== "first") {
    return false;
  }

  const battingTeamSize = getBattingTeamSize(match);
  return (
    getLegalBallsRemaining(match) === 0 ||
    Number(match?.outs || 0) >= battingTeamSize
  );
}

function canFinalizePendingResult(match) {
  return Boolean(match?.pendingResult) && !String(match?.result || "");
}

function assertMatchInvariants(match) {
  const innings1History = Array.isArray(match?.innings1?.history) ? match.innings1.history : [];
  const innings2History = Array.isArray(match?.innings2?.history) ? match.innings2.history : [];
  const innings1LegalBalls = countLegalBalls(innings1History);
  const innings2LegalBalls = countLegalBalls(innings2History);
  const maxLegalBalls = Number(match?.overs || LONG_MATCH_OVERS) * 6;

  if (Number(match?.score || 0) < 0) {
    throw new Error("Score went negative.");
  }
  if (Number(match?.outs || 0) < 0) {
    throw new Error("Outs went negative.");
  }
  if (innings1LegalBalls > maxLegalBalls) {
    throw new Error("First innings exceeded legal ball limit.");
  }
  if (innings2LegalBalls > maxLegalBalls) {
    throw new Error("Second innings exceeded legal ball limit.");
  }
  if (String(match?.result || "") && String(match?.pendingResult || "")) {
    throw new Error("Result and pendingResult cannot both be set.");
  }
  if (String(match?.innings || "first") === "first") {
    if (Number(match?.score || 0) !== Number(match?.innings1?.score || 0)) {
      throw new Error("First innings score drifted from main score.");
    }
  } else if (Number(match?.score || 0) !== Number(match?.innings2?.score || 0)) {
    throw new Error("Second innings score drifted from main score.");
  }
  if (Number(match?.outs || 0) > getBattingTeamSize(match)) {
    throw new Error("Out count exceeded batting team size.");
  }
}

function buildScoreAction(seed, index, candidate) {
  return {
    type: "score_ball",
    actionId: nextActionId(seed, candidate.key, index),
    runs: candidate.runs,
    isOut: candidate.isOut,
    extraType: candidate.extraType,
  };
}

export function buildLongMatchFixture(overrides = {}) {
  const teamA = Array.from({ length: LONG_MATCH_PLAYERS }, (_, index) => `Falcon ${index + 1}`);
  const teamB = Array.from({ length: LONG_MATCH_PLAYERS }, (_, index) => `Titan ${index + 1}`);

  return buildBaseMatchFixture({
    _id: "507f1f77bcf86cd799439911",
    sessionId: "507f1f77bcf86cd799439922",
    teamA,
    teamB,
    teamAName: "Falcons",
    teamBName: "Titans",
    overs: LONG_MATCH_OVERS,
    ...overrides,
  });
}

export function startLongMatchFixture(seed = 1, overrides = {}) {
  const baseMatch = buildLongMatchFixture(overrides);
  return applyMatchAction(baseMatch, {
    type: "set_toss",
    tossWinner: baseMatch.teamAName,
    tossDecision: "bat",
    actionId: nextActionId(seed, "toss", 0),
  });
}

function chooseLegalScoreAction(match, rng, seed, index) {
  const battingTeamSize = getBattingTeamSize(match);
  const candidates = SCORING_ACTION_POOL.filter((candidate) => {
    if (candidate.isOut && Number(match?.outs || 0) >= battingTeamSize) {
      return false;
    }
    if (canAdvanceInnings(match) || canFinalizePendingResult(match)) {
      return false;
    }
    return true;
  });

  const weightedCandidates = [
    ...candidates,
    ...candidates.filter((candidate) => candidate.category === "score"),
  ];

  return buildScoreAction(seed, index, pickOne(weightedCandidates, rng));
}

export function generateStressSequence(seed, options = {}) {
  const rng = createSeededRng(seed);
  const maxSteps = Math.max(12, Number(options.maxSteps || 36));
  const actions = [];
  let match = startLongMatchFixture(seed, options.overrides || {});

  for (let index = 1; index <= maxSteps; index += 1) {
    let nextAction = null;

    if (canFinalizePendingResult(match)) {
      nextAction =
        rng() < 0.45 && canUndo(match)
          ? {
              type: "undo_last",
              actionId: nextActionId(seed, "undo-pending", index),
            }
          : {
              type: "complete_innings",
              actionId: nextActionId(seed, "finalize-pending", index),
            };
    } else if (canAdvanceInnings(match)) {
      nextAction =
        rng() < 0.25 && canUndo(match)
          ? {
              type: "undo_last",
              actionId: nextActionId(seed, "undo-innings-ready", index),
            }
          : {
              type: "complete_innings",
              actionId: nextActionId(seed, "complete-innings", index),
            };
    } else if (canUndo(match) && rng() < 0.18) {
      nextAction = {
        type: "undo_last",
        actionId: nextActionId(seed, "undo", index),
      };
    } else {
      nextAction = chooseLegalScoreAction(match, rng, seed, index);
    }

    match = applyMatchAction(match, nextAction);
    actions.push(nextAction);
    assertMatchInvariants(match);

    if (!match.isOngoing && !match.pendingResult && match.result) {
      break;
    }
  }

  return {
    seed,
    actions,
    finalMatch: match,
  };
}

function applyScriptedScoreSeries(match, seed, prefix, count, runsPerBall) {
  const actions = [];
  let nextMatch = match;
  for (let index = 0; index < count; index += 1) {
    const action = {
      type: "score_ball",
      actionId: nextActionId(seed, `${prefix}-${index}`, index),
      runs: typeof runsPerBall === "function" ? runsPerBall(index) : runsPerBall,
      isOut: false,
      extraType: null,
    };
    nextMatch = applyMatchAction(nextMatch, action);
    assertMatchInvariants(nextMatch);
    actions.push(action);
  }

  return {
    match: nextMatch,
    actions,
  };
}

export function buildLongMatchReplayScenario(seed) {
  let match = startLongMatchFixture(seed);
  const actions = [];

  const firstInnings = applyScriptedScoreSeries(match, seed, "long-first", LONG_MATCH_OVERS * 6, 1);
  match = firstInnings.match;
  actions.push(...firstInnings.actions);

  const firstAdvance = {
    type: "complete_innings",
    actionId: nextActionId(seed, "advance-first", actions.length + 1),
  };
  match = applyMatchAction(match, firstAdvance);
  actions.push(firstAdvance);
  assertMatchInvariants(match);

  const secondInnings = applyScriptedScoreSeries(
    match,
    seed,
    "long-second",
    LONG_MATCH_OVERS * 6 - 1,
    1,
  );
  match = secondInnings.match;
  actions.push(...secondInnings.actions);

  const winningBall = {
    type: "score_ball",
    actionId: nextActionId(seed, "winning-ball", actions.length + 1),
    runs: 2,
    isOut: false,
    extraType: null,
  };
  match = applyMatchAction(match, winningBall);
  actions.push(winningBall);
  assertMatchInvariants(match);

  const undoWinningBall = {
    type: "undo_last",
    actionId: nextActionId(seed, "undo-winning-ball", actions.length + 1),
  };
  match = applyMatchAction(match, undoWinningBall);
  actions.push(undoWinningBall);
  assertMatchInvariants(match);

  const losingBall = {
    type: "score_ball",
    actionId: nextActionId(seed, "losing-ball", actions.length + 1),
    runs: 0,
    isOut: false,
    extraType: null,
  };
  match = applyMatchAction(match, losingBall);
  actions.push(losingBall);
  assertMatchInvariants(match);

  const finalizeResult = {
    type: "complete_innings",
    actionId: nextActionId(seed, "finalize-result", actions.length + 1),
  };
  match = applyMatchAction(match, finalizeResult);
  actions.push(finalizeResult);
  assertMatchInvariants(match);

  return {
    seed,
    actions,
    finalMatch: match,
  };
}

export function classifyActionTransition(action, matchBefore = null) {
  if (action?.type === "undo_last") {
    return "undo";
  }
  if (action?.type === "complete_innings") {
    return matchBefore?.pendingResult ? "pending_finalize" : "innings_end";
  }
  if (action?.type === "score_ball") {
    if (action?.isOut) {
      return "wicket";
    }
    if (action?.extraType) {
      return "extra";
    }
    return "score";
  }
  return "other";
}

export function getRequiredTransitionPairs() {
  return [
    "score->score",
    "score->undo",
    "extra->undo",
    "wicket->undo",
    "innings_end->undo",
    "pending_finalize->undo",
  ];
}
