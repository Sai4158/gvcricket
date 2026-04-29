/**
 * File overview:
 * Purpose: Provides shared Match Engine logic for routes, APIs, and feature code.
 * Main exports: isProcessedAction, applyMatchAction, applySafeMatchPatch, buildSessionMirrorUpdate, buildRecentActionIds, createMatchUndoSnapshot, restoreMatchUndoSnapshot, getMatchUndoCount, MatchEngineError.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Reading guide:
 * - top: copy helpers, saved state, and small match helpers
 * - middle: toss, scoring, innings end, and undo
 * - bottom: main exported functions used by the app
 * Read next: ./README.md
 */

import {
  addBallToHistory,
  buildWinByWicketsText,
  countLegalBalls,
  syncTeamNamesAcrossMatch,
} from "./match-scoring";
import { normalizeLegacyTossState } from "./match-toss";
import {
  createMatchCorrectionLiveEvent,
  createMatchEndLiveEvent,
  createScoreLiveEvent,
  createUndoLiveEvent,
} from "./live-announcements";
import {
  getWinningTeamName,
  isTiedMatchResult,
  normalizeMatchResultText,
} from "./match-result-display";
import { getBattingTeamBundle, getTotalDismissalsAllowed } from "./team-utils";

// These are the match fields we save for undo and fixes.
const MUTABLE_STATE_KEYS = [
  "tossWinner",
  "tossDecision",
  "score",
  "outs",
  "isOngoing",
  "innings",
  "result",
  "pendingResult",
  "pendingResultAt",
  "resultAutoFinalizeAt",
  "innings1",
  "innings2",
  "balls",
  "lastLiveEvent",
  "lastEventType",
  "lastEventText",
];

export const SOFT_MATCH_RESULT_TIMEOUT_MS = 10 * 60 * 1000;

// Keep only a limited number of old actions.
const MAX_ACTION_HISTORY = 96;
// Keep only a limited number of processed ids.
const MAX_PROCESSED_ACTION_IDS = 256;

// Custom error for bad match actions.
export class MatchEngineError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "MatchEngineError";
    this.status = status;
  }
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function countInningsWickets(history = []) {
  return (Array.isArray(history) ? history : []).reduce((total, over) => {
    const balls = Array.isArray(over?.balls) ? over.balls : [];
    return total + balls.filter((ball) => Boolean(ball?.isOut)).length;
  }, 0);
}

function countLegalBallsInBalls(balls = []) {
  let total = 0;

  for (const ball of Array.isArray(balls) ? balls : []) {
    if (ball?.extraType !== "wide" && ball?.extraType !== "noball") {
      total += 1;
    }
  }

  return total;
}

function cloneBallsArray(balls = []) {
  return Array.isArray(balls) ? balls.slice() : [];
}

function cloneInningsShell(innings = null) {
  return innings
    ? {
        ...innings,
        history: Array.isArray(innings.history) ? innings.history : [],
      }
    : {
        team: "",
        score: 0,
        history: [],
      };
}

function cloneOver(over = null) {
  if (!over) {
    return null;
  }

  return {
    ...over,
    balls: cloneBallsArray(over.balls),
  };
}

function rebuildHistoryFromBalls(balls = []) {
  const history = [];
  let currentOver = null;
  let legalBallsInCurrentOver = 0;

  for (const ball of Array.isArray(balls) ? balls : []) {
    if (!currentOver || legalBallsInCurrentOver >= 6) {
      currentOver = {
        overNumber: history.length + 1,
        balls: [],
      };
      history.push(currentOver);
      legalBallsInCurrentOver = 0;
    }

    currentOver.balls.push(ball);
    if (ball?.extraType !== "wide" && ball?.extraType !== "noball") {
      legalBallsInCurrentOver += 1;
    }
  }

  return history;
}

// Turn a Mongoose document into a plain object we can safely edit.
function toPlainMatch(matchDocument) {
  if (!matchDocument) return null;

  return typeof matchDocument.toObject === "function"
    ? matchDocument.toObject()
    : cloneValue(matchDocument);
}

function createMutableHotMatch(match, { cloneBalls = false, cloneActiveHistory = false } = {}) {
  if (!match) {
    return null;
  }

  const nextMatch = {
    ...match,
    innings1: cloneInningsShell(match.innings1),
    innings2: cloneInningsShell(match.innings2),
  };

  if (cloneBalls) {
    nextMatch.balls = cloneBallsArray(match.balls);
  }

  if (cloneActiveHistory) {
    const activeInningsKey = getActiveInningsKey(match);
    const sourceHistory = Array.isArray(match?.[activeInningsKey]?.history)
      ? match[activeInningsKey].history
      : [];
    const nextHistory = sourceHistory.slice();
    const lastIndex = nextHistory.length - 1;

    if (lastIndex >= 0) {
      nextHistory[lastIndex] = cloneOver(sourceHistory[lastIndex]);
    }

    nextMatch[activeInningsKey] = {
      ...nextMatch[activeInningsKey],
      history: nextHistory,
    };
  }

  return nextMatch;
}

function getKnownInningsLegalBallCount(match, inningsKey) {
  const compactKey =
    inningsKey === "second"
      ? "secondInningsLegalBallCount"
      : "firstInningsLegalBallCount";
  const explicitCount = Number(match?.[compactKey]);

  if (Number.isFinite(explicitCount) && explicitCount >= 0) {
    return explicitCount;
  }

  const history = Array.isArray(match?.[inningsKey]?.history)
    ? match[inningsKey].history
    : [];

  if (history.length) {
    return countLegalBalls(history);
  }

  if (getActiveInningsKey(match) === inningsKey) {
    return countLegalBallsInBalls(match?.balls);
  }

  return 0;
}

function assignCompactMatchState(match, overrides = {}) {
  const activeInningsKey = getActiveInningsKey(match);
  const activeHistory = Array.isArray(match?.[activeInningsKey]?.history)
    ? match[activeInningsKey].history
    : [];
  const currentOver = activeHistory.at(-1) || null;
  const activeOverBalls = Array.isArray(overrides.activeOverBalls)
    ? overrides.activeOverBalls
    : Array.isArray(currentOver?.balls)
      ? currentOver.balls
      : [];
  const explicitOverNumber = Number(overrides.activeOverNumber);
  const resolvedLegalBallCount = Number(overrides.legalBallCount);
  const firstInningsLegalBallCount = Number(overrides.firstInningsLegalBallCount);
  const secondInningsLegalBallCount = Number(overrides.secondInningsLegalBallCount);

  match.activeOverBalls = cloneBallsArray(activeOverBalls);
  match.activeOverNumber =
    Number.isFinite(explicitOverNumber) && explicitOverNumber > 0
      ? explicitOverNumber
      : Number(currentOver?.overNumber || 1);
  match.legalBallCount =
    Number.isFinite(resolvedLegalBallCount) && resolvedLegalBallCount >= 0
      ? resolvedLegalBallCount
      : getKnownInningsLegalBallCount(match, activeInningsKey);
  match.firstInningsLegalBallCount =
    Number.isFinite(firstInningsLegalBallCount) && firstInningsLegalBallCount >= 0
      ? firstInningsLegalBallCount
      : activeInningsKey === "first"
        ? match.legalBallCount
        : getKnownInningsLegalBallCount(match, "first");
  match.secondInningsLegalBallCount =
    Number.isFinite(secondInningsLegalBallCount) && secondInningsLegalBallCount >= 0
      ? secondInningsLegalBallCount
      : activeInningsKey === "second"
        ? match.legalBallCount
        : getKnownInningsLegalBallCount(match, "second");

  return match;
}

// Save the current match state so undo can go back to it.
function getSnapshot(match) {
  const activeInningsKey = getActiveInningsKey(match);
  const currentLegalBallCount = getKnownInningsLegalBallCount(match, activeInningsKey);

  return {
    snapshotVersion: 3,
    tossWinner: cloneValue(match?.tossWinner),
    tossDecision: cloneValue(match?.tossDecision),
    score: cloneValue(match?.score),
    outs: cloneValue(match?.outs),
    isOngoing: cloneValue(match?.isOngoing),
    innings: cloneValue(match?.innings),
    result: cloneValue(match?.result),
    pendingResult: cloneValue(match?.pendingResult),
    pendingResultAt: cloneValue(match?.pendingResultAt),
    resultAutoFinalizeAt: cloneValue(match?.resultAutoFinalizeAt),
    innings1: {
      team: cloneValue(match?.innings1?.team || ""),
      score: cloneValue(match?.innings1?.score || 0),
      history:
        activeInningsKey === "second"
          ? cloneValue(match?.innings1?.history || [])
          : [],
    },
    innings2: {
      team: cloneValue(match?.innings2?.team || ""),
      score: cloneValue(match?.innings2?.score || 0),
      history: [],
    },
    balls: cloneValue(match?.balls || []),
    activeOverNumber: cloneValue(match?.activeOverNumber || 1),
    activeOverBalls: cloneValue(match?.activeOverBalls || []),
    legalBallCount: cloneValue(match?.legalBallCount ?? currentLegalBallCount),
    firstInningsLegalBallCount: cloneValue(
      match?.firstInningsLegalBallCount ??
        (activeInningsKey === "first"
          ? currentLegalBallCount
          : getKnownInningsLegalBallCount(match, "first")),
    ),
    secondInningsLegalBallCount: cloneValue(
      match?.secondInningsLegalBallCount ??
        (activeInningsKey === "second"
          ? currentLegalBallCount
          : getKnownInningsLegalBallCount(match, "second")),
    ),
    lastLiveEvent: cloneValue(match?.lastLiveEvent),
    lastEventType: cloneValue(match?.lastEventType),
    lastEventText: cloneValue(match?.lastEventText),
  };
}

// Put back the saved match state.
function restoreSnapshot(match, snapshot) {
  if (Number(snapshot?.snapshotVersion || 0) >= 2) {
    match.tossWinner = cloneValue(snapshot?.tossWinner);
    match.tossDecision = cloneValue(snapshot?.tossDecision);
    match.score = cloneValue(snapshot?.score);
    match.outs = cloneValue(snapshot?.outs);
    match.isOngoing = cloneValue(snapshot?.isOngoing);
    match.innings = cloneValue(snapshot?.innings);
    match.result = cloneValue(snapshot?.result);
    match.pendingResult = cloneValue(snapshot?.pendingResult);
    match.pendingResultAt = cloneValue(snapshot?.pendingResultAt);
    match.resultAutoFinalizeAt = cloneValue(snapshot?.resultAutoFinalizeAt);
    match.innings1 = {
      team: cloneValue(snapshot?.innings1?.team || ""),
      score: cloneValue(snapshot?.innings1?.score || 0),
      history: cloneValue(snapshot?.innings1?.history || []),
    };
    match.innings2 = {
      team: cloneValue(snapshot?.innings2?.team || ""),
      score: cloneValue(snapshot?.innings2?.score || 0),
      history: [],
    };
    match.balls = cloneValue(snapshot?.balls || []);
    match.activeOverNumber = cloneValue(snapshot?.activeOverNumber || 1);
    match.activeOverBalls = cloneValue(snapshot?.activeOverBalls || []);
    match.legalBallCount = cloneValue(snapshot?.legalBallCount);
    match.firstInningsLegalBallCount = cloneValue(snapshot?.firstInningsLegalBallCount);
    match.secondInningsLegalBallCount = cloneValue(snapshot?.secondInningsLegalBallCount);
    match.lastLiveEvent = cloneValue(snapshot?.lastLiveEvent);
    match.lastEventType = cloneValue(snapshot?.lastEventType);
    match.lastEventText = cloneValue(snapshot?.lastEventText);
    const rebuiltHistory = rebuildHistoryFromBalls(match.balls);
    if (match.innings === "second") {
      match.innings2.history = rebuiltHistory;
    } else {
      match.innings1.history = rebuiltHistory;
    }
    if (
      !Number.isFinite(Number(match?.legalBallCount)) ||
      !Array.isArray(match?.activeOverBalls)
    ) {
      assignCompactMatchState(match);
    }
    return;
  }

  for (const key of MUTABLE_STATE_KEYS) {
    match[key] = cloneValue(snapshot?.[key]);
  }
}

export function createMatchUndoSnapshot(matchDocument) {
  return getSnapshot(matchDocument);
}

export function restoreMatchUndoSnapshot(matchDocument, snapshot, options = {}) {
  const shouldClone = options.clone !== false;
  const nextMatch = shouldClone ? createMutableHotMatch(matchDocument) : matchDocument;
  restoreSnapshot(nextMatch, snapshot);
  return nextMatch;
}

export function buildRecentActionIds(existingActionIds = [], actionId = "") {
  const safeActionId = String(actionId || "").trim();
  const currentIds = Array.isArray(existingActionIds) ? existingActionIds : [];
  if (!safeActionId) {
    return currentIds.slice(-MAX_PROCESSED_ACTION_IDS);
  }

  return [...currentIds, safeActionId].slice(-MAX_PROCESSED_ACTION_IDS);
}

export function getMatchUndoCount(match) {
  if (Number.isFinite(Number(match?.undoCount))) {
    return Math.max(0, Number(match.undoCount || 0));
  }

  return Array.isArray(match?.actionHistory) ? match.actionHistory.length : 0;
}

// Save an action id so the same action is not used twice.
function appendProcessedActionId(match, actionId) {
  const nextActionIds = buildRecentActionIds(match.processedActionIds, actionId);
  match.processedActionIds = nextActionIds;
  match.recentActionIds = buildRecentActionIds(match.recentActionIds, actionId);
}

// Save the old state before an action, so undo can use it later.
function appendActionHistory(match, action, snapshot) {
  const nextHistory = [
    ...(match.actionHistory || []),
    {
      actionId: action.actionId,
      type: action.type,
      snapshot,
      createdAt: new Date().toISOString(),
    },
  ];

  match.actionHistory = nextHistory.slice(-MAX_ACTION_HISTORY);
}

// Store a simpler event type name for the UI.
function getStoredLastEventType(liveEvent) {
  if (!liveEvent?.type) {
    return "";
  }

  return liveEvent.type === "score_update" ? "score" : liveEvent.type;
}

// Save the latest live event onto the match.
function markLiveEvent(match, liveEvent) {
  match.lastLiveEvent = liveEvent;
  match.lastEventType = getStoredLastEventType(liveEvent);
  match.lastEventText = liveEvent?.summaryText || "";
}

// Pick first or second innings.
function getActiveInningsKey(match) {
  return match?.innings === "second" ? "innings2" : "innings1";
}

// Get the over history for the current innings.
function getActiveHistory(match) {
  return match?.[getActiveInningsKey(match)]?.history || [];
}

// Count wickets already stored in the history.
function countDismissalsInHistory(history) {
  return (history || [])
    .flatMap((over) => over?.balls || [])
    .filter((ball) => ball?.isOut).length;
}

// Count only legal balls in the current innings.
function getLegalBallsInActiveInnings(match) {
  return countLegalBalls(getActiveHistory(match));
}

// Get the max wickets allowed from the team size.
function getDismissalLimit(match) {
  return getTotalDismissalsAllowed(match);
}

// Check if toss setup is done and scoring can start.
function hasTossState(match) {
  return Boolean(
    match?.tossWinner &&
      match?.tossDecision &&
      match?.innings1?.team &&
      match?.innings2?.team
  );
}

// Check if the match already has score activity.
function hasScoreActivity(match) {
  return (
    Number(match?.score || 0) > 0 ||
    Number(match?.outs || 0) > 0 ||
    (Array.isArray(match?.balls) && match.balls.length > 0) ||
    countLegalBalls(match?.innings1?.history || []) > 0 ||
    countLegalBalls(match?.innings2?.history || []) > 0
  );
}

// Do not allow team size changes that break wicket history.
function validateRosterDismissalState(match) {
  const teamAName = match?.teamAName || "Team A";
  const teamBName = match?.teamBName || "Team B";
  const teamASize = Array.isArray(match?.teamA) ? match.teamA.length : 0;
  const teamBSize = Array.isArray(match?.teamB) ? match.teamB.length : 0;
  const inningsChecks = [
    {
      inningsKey: "innings1",
      team: match?.innings1?.team || "",
      dismissals: countDismissalsInHistory(match?.innings1?.history || []),
    },
    {
      inningsKey: "innings2",
      team: match?.innings2?.team || "",
      dismissals: countDismissalsInHistory(match?.innings2?.history || []),
    },
  ];

  for (const inningsCheck of inningsChecks) {
    const rosterSize =
      inningsCheck.team === teamAName
        ? teamASize
        : inningsCheck.team === teamBName
          ? teamBSize
          : 0;

    if (!rosterSize) {
      continue;
    }

    const dismissalLimit = Math.max(1, rosterSize);
    if (inningsCheck.dismissals > dismissalLimit) {
      throw new MatchEngineError(
        `${inningsCheck.team} cannot be reduced below the wickets already recorded in ${inningsCheck.inningsKey === "innings1" ? "the first innings" : "the second innings"}.`,
        409
      );
    }
  }
}

// In second innings, only the batting team can change player count.
function getRosterEditPermissions(match) {
  if (match?.innings !== "second") {
    return { teamA: true, teamB: true };
  }

  const secondInningsTeam = match?.innings2?.team || "";
  const teamAName = match?.teamAName || "Team A";
  const teamBName = match?.teamBName || "Team B";

  return {
    teamA: secondInningsTeam === teamAName,
    teamB: secondInningsTeam === teamBName,
  };
}

// Check if the chasing team has passed the target.
function isTargetChased(match) {
  return (
    match?.innings === "second" &&
    Number(match?.score || 0) > Number(match?.innings1?.score || 0)
  );
}

// Check if the innings should end.
function isCurrentInningsComplete(match) {
  const oversDone =
    Number(match?.overs || 0) > 0 &&
    getLegalBallsInActiveInnings(match) >= Number(match.overs) * 6;
  const allOut = Number(match?.outs || 0) >= getDismissalLimit(match);

  return oversDone || allOut || isTargetChased(match);
}

// Build the final result text.
function buildMatchResult(match) {
  const firstInningsScore = Number(match?.innings1?.score || 0);
  const secondInningsScore = Number(match?.score || 0);

  if (secondInningsScore > firstInningsScore) {
    return buildWinByWicketsText(match, Number(match?.outs || 0));
  }

  if (firstInningsScore > secondInningsScore) {
    const runsMargin = firstInningsScore - secondInningsScore;
    return `${match.innings1.team} won by ${runsMargin} ${
      runsMargin === 1 ? "run" : "runs"
    }.`;
  }

  return "Match Tied";
}

function clearPendingResultFields(match) {
  match.pendingResult = "";
  match.pendingResultAt = null;
  match.resultAutoFinalizeAt = null;
}

function setPendingMatchResult(match, resultText) {
  clearPendingResultFields(match);
  match.isOngoing = false;
  match.result = "";
  match.pendingResult = String(resultText || "").trim();
  match.pendingResultAt = new Date().toISOString();
  match.resultAutoFinalizeAt = new Date(
    Date.now() + SOFT_MATCH_RESULT_TIMEOUT_MS,
  ).toISOString();
}

export function finalizePendingMatchResult(matchDocument) {
  const nextMatch = toPlainMatch(matchDocument);
  const pendingResult = String(nextMatch?.pendingResult || "").trim();

  if (!pendingResult) {
    return nextMatch;
  }

  nextMatch.isOngoing = false;
  nextMatch.result = pendingResult;
  clearPendingResultFields(nextMatch);
  return nextMatch;
}

// Make a simple system event like toss set or innings change.
function createSystemLiveEvent(type, summaryText, match) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    summaryText,
    score: Number(match?.score || 0),
    outs: Number(match?.outs || 0),
    createdAt: new Date().toISOString(),
  };
}

// Set the toss result and decide who bats first.
function setToss(match, action) {
  const teamAName = match.teamAName || "Team A";
  const teamBName = match.teamBName || "Team B";
  const validTeams = new Set([teamAName, teamBName]);

  if (!validTeams.has(action.tossWinner)) {
    throw new MatchEngineError("Toss winner is invalid.", 400);
  }

  if (hasScoreActivity(match)) {
    throw new MatchEngineError("Toss cannot change after scoring begins.", 409);
  }

  // Save the old state so undo can come back here.
  const snapshot = getSnapshot(match);
  const nextMatch = createMutableHotMatch(match);
  const battingFirst =
    action.tossDecision === "bat"
      ? action.tossWinner
      : action.tossWinner === teamAName
      ? teamBName
      : teamAName;
  const bowlingFirst = battingFirst === teamAName ? teamBName : teamAName;

  nextMatch.tossWinner = action.tossWinner;
  nextMatch.tossDecision = action.tossDecision;
  nextMatch.innings1 = {
    ...(nextMatch.innings1 || { score: 0, history: [] }),
    team: battingFirst,
  };
  nextMatch.innings2 = {
    ...(nextMatch.innings2 || { score: 0, history: [] }),
    team: bowlingFirst,
  };

  markLiveEvent(
    nextMatch,
    createSystemLiveEvent(
      "toss_set",
      `${action.tossWinner} won the toss and chose to ${action.tossDecision}.`,
      nextMatch
    )
  );
  appendActionHistory(nextMatch, action, snapshot);
  appendProcessedActionId(nextMatch, action.actionId);
  assignCompactMatchState(nextMatch, {
    activeOverBalls: [],
    activeOverNumber: 1,
    legalBallCount: 0,
    firstInningsLegalBallCount: 0,
    secondInningsLegalBallCount: 0,
  });

  return nextMatch;
}

// Main scoring function.
// Read this for runs, wides, no balls, wickets, and match end checks.
function scoreBall(match, action) {
  if (!hasTossState(match)) {
    throw new MatchEngineError("Set the toss before scoring starts.", 409);
  }

  if (!match?.isOngoing || match?.result) {
    throw new MatchEngineError("This match is already finished.", 409);
  }

  if (action.extraType && action.isOut) {
    throw new MatchEngineError("That scoring combination is not supported.", 400);
  }

  if (action.extraType === "wide" && Number(action.runs || 0) < 0) {
    throw new MatchEngineError("Wides cannot remove runs.", 400);
  }

  if (action.extraType === "noball" && Number(action.runs || 0) < 0) {
    throw new MatchEngineError("No balls cannot remove runs.", 400);
  }

  if (!action.extraType && Number(action.runs || 0) > 6) {
    throw new MatchEngineError("A legal ball cannot add more than 6 runs.", 400);
  }

  if (isCurrentInningsComplete(match)) {
    throw new MatchEngineError("The current innings is already complete.", 409);
  }

  const snapshot = getSnapshot(match);
  const nextMatch = createMutableHotMatch(match, {
    cloneBalls: true,
    cloneActiveHistory: true,
  });
  clearPendingResultFields(nextMatch);
  const activeInningsKey = getActiveInningsKey(nextMatch);
  const previousLegalBallCount = getKnownInningsLegalBallCount(match, activeInningsKey);
  const firstInningsLegalBallCount = getKnownInningsLegalBallCount(match, "first");
  const secondInningsLegalBallCount = getKnownInningsLegalBallCount(match, "second");
  // This ball object is what gets saved in history.
  const ball = {
    runs: Number(action.runs || 0),
    isOut: Boolean(action.isOut),
    extraType: action.extraType || null,
  };

  nextMatch[activeInningsKey] = nextMatch[activeInningsKey] || {
    team: "",
    score: 0,
    history: [],
  };
  nextMatch[activeInningsKey].score =
    Number(nextMatch[activeInningsKey].score || 0) + ball.runs;
  nextMatch.score = nextMatch[activeInningsKey].score;
  nextMatch.outs = Number(nextMatch.outs || 0) + (ball.isOut ? 1 : 0);
  nextMatch.balls = [...(nextMatch.balls || []), ball];

  // This also updates over history and legal-ball count.
  addBallToHistory(nextMatch, ball);

  // After scoring the ball, check if the match is over.
  if (isTargetChased(nextMatch)) {
    const pendingResult = buildWinByWicketsText(nextMatch, nextMatch.outs);
    setPendingMatchResult(nextMatch, pendingResult);
    markLiveEvent(
      nextMatch,
      createMatchEndLiveEvent(nextMatch, pendingResult, {
        ball,
        actionId: action.actionId,
      }),
    );
  } else if (nextMatch.innings === "second" && isCurrentInningsComplete(nextMatch)) {
    const pendingResult = buildMatchResult(nextMatch);
    setPendingMatchResult(nextMatch, pendingResult);
    markLiveEvent(
      nextMatch,
      createMatchEndLiveEvent(nextMatch, pendingResult, {
        ball,
        actionId: action.actionId,
      }),
    );
  } else {
    markLiveEvent(
      nextMatch,
      createScoreLiveEvent(match, nextMatch, ball, {
        actionId: action.actionId,
      }),
    );
  }
  appendActionHistory(nextMatch, action, snapshot);
  appendProcessedActionId(nextMatch, action.actionId);
  const currentOver = nextMatch[activeInningsKey]?.history?.at(-1) || null;
  const nextLegalBallCount =
    previousLegalBallCount +
    (ball.extraType === "wide" || ball.extraType === "noball" ? 0 : 1);
  assignCompactMatchState(nextMatch, {
    activeOverBalls: currentOver?.balls || [],
    activeOverNumber: Number(currentOver?.overNumber || 1),
    legalBallCount: nextLegalBallCount,
    firstInningsLegalBallCount:
      activeInningsKey === "first"
        ? nextLegalBallCount
        : firstInningsLegalBallCount,
    secondInningsLegalBallCount:
      activeInningsKey === "second"
        ? nextLegalBallCount
        : secondInningsLegalBallCount,
  });

  return nextMatch;
}

// Move from first innings to second innings, or finish the match.
function completeInnings(match, action) {
  if (!hasTossState(match)) {
    throw new MatchEngineError("Set the toss before completing an innings.", 409);
  }

  if (!isCurrentInningsComplete(match) && !match?.result) {
    throw new MatchEngineError("The current innings is not complete yet.", 409);
  }

  const snapshot = getSnapshot(match);
  const nextMatch = createMutableHotMatch(match, {
    cloneBalls: true,
  });

  if (nextMatch.innings === "first") {
    // Reset the live score view for the chase.
    nextMatch.innings = "second";
    nextMatch.score = Number(nextMatch.innings2?.score || 0);
    nextMatch.outs = 0;
    nextMatch.balls = [];
    nextMatch.result = "";
    clearPendingResultFields(nextMatch);
    nextMatch.isOngoing = true;

    markLiveEvent(
      nextMatch,
      createSystemLiveEvent("innings_change", "Second innings begins.", nextMatch)
    );
    appendActionHistory(nextMatch, action, snapshot);
    appendProcessedActionId(nextMatch, action.actionId);
    assignCompactMatchState(nextMatch, {
      activeOverBalls: [],
      activeOverNumber: 1,
      legalBallCount: getKnownInningsLegalBallCount(nextMatch, "second"),
      firstInningsLegalBallCount: getKnownInningsLegalBallCount(match, "first"),
      secondInningsLegalBallCount: getKnownInningsLegalBallCount(nextMatch, "second"),
    });

    return nextMatch;
  }

  if (String(nextMatch.pendingResult || "").trim()) {
    const finalizedMatch = finalizePendingMatchResult(nextMatch);
    appendActionHistory(finalizedMatch, action, snapshot);
    appendProcessedActionId(finalizedMatch, action.actionId);
    assignCompactMatchState(finalizedMatch);
    return finalizedMatch;
  }

  nextMatch.isOngoing = false;
  nextMatch.result = buildMatchResult(nextMatch);
  clearPendingResultFields(nextMatch);

  markLiveEvent(nextMatch, createMatchEndLiveEvent(nextMatch, nextMatch.result));
  appendActionHistory(nextMatch, action, snapshot);
  appendProcessedActionId(nextMatch, action.actionId);
  assignCompactMatchState(nextMatch);

  return nextMatch;
}

// Undo goes back to the last saved state.
function undoLastAction(match, action) {
  const history = Array.isArray(match?.actionHistory) ? match.actionHistory : [];
  const previousAction = history.at(-1);

  if (!previousAction?.snapshot) {
    throw new MatchEngineError("There is nothing left to undo.", 409);
  }

  const nextMatch = createMutableHotMatch(match);
  restoreSnapshot(nextMatch, previousAction.snapshot);
  nextMatch.actionHistory = history.slice(0, -1);
  appendProcessedActionId(nextMatch, action.actionId);
  markLiveEvent(nextMatch, createUndoLiveEvent(nextMatch));

  return nextMatch;
}

// Check if this action id was already used.
export function isProcessedAction(match, actionId) {
  const safeActionId = String(actionId || "").trim();
  if (!safeActionId) {
    return false;
  }

  if (Array.isArray(match?.recentActionIds) && match.recentActionIds.includes(safeActionId)) {
    return true;
  }

  return Array.isArray(match?.processedActionIds)
    ? match.processedActionIds.includes(safeActionId)
    : false;
}

// Main entry point for toss, score, innings end, and undo.
export function applyMatchAction(matchDocument, action) {
  const match = normalizeLegacyTossState(matchDocument);

  if (!match?._id) {
    throw new MatchEngineError("Match not found.", 404);
  }

  switch (action.type) {
    case "set_toss":
      return setToss(match, action);
    case "score_ball":
      return scoreBall(match, action);
    case "complete_innings":
      return completeInnings(match, action);
    case "undo_last":
      return undoLastAction(match, action);
    default:
      throw new MatchEngineError("Unsupported match action.", 400);
  }
}

// Use this for manual fixes outside normal ball-by-ball scoring.
export function applySafeMatchPatch(matchDocument, patch) {
  // Old state before the fix.
  const currentMatch = toPlainMatch(matchDocument);
  // Working copy that gets the new values.
  const nextMatch = toPlainMatch(matchDocument);
  const currentTeamALength = Array.isArray(currentMatch.teamA)
    ? currentMatch.teamA.length
    : 0;
  const currentTeamBLength = Array.isArray(currentMatch.teamB)
    ? currentMatch.teamB.length
    : 0;
  const nextTeamALength = Array.isArray(patch.teamA)
    ? patch.teamA.length
    : currentTeamALength;
  const nextTeamBLength = Array.isArray(patch.teamB)
    ? patch.teamB.length
    : currentTeamBLength;
  const oversChanged =
    typeof patch.overs === "number" &&
    patch.overs !== Number(currentMatch?.overs || 0);
  const innings1ScoreChanged =
    typeof patch.innings1Score === "number" &&
    patch.innings1Score !== Number(currentMatch?.innings1?.score || 0);
  const teamASizeChanged =
    Array.isArray(patch.teamA) && nextTeamALength !== currentTeamALength;
  const teamBSizeChanged =
    Array.isArray(patch.teamB) && nextTeamBLength !== currentTeamBLength;
  let correctionEndedMatch = false;
  const rosterPermissions = getRosterEditPermissions(currentMatch);
  const previousNames = {
    teamAName: currentMatch.teamAName || "Team A",
    teamBName: currentMatch.teamBName || "Team B",
  };
  const nextNames = {
    teamAName: patch.teamAName ?? currentMatch.teamAName,
    teamBName: patch.teamBName ?? currentMatch.teamBName,
  };

  // Do not let overs go below what has already been bowled.
  if (typeof patch.overs === "number") {
    const firstInningsOversPlayed = Math.ceil(
      countLegalBalls(currentMatch.innings1?.history || []) / 6
    );
    const currentOverNumber = Math.ceil(
      countLegalBalls(getActiveHistory(currentMatch)) / 6
    );
    const minAllowedOvers =
      currentMatch.innings === "first"
        ? Math.max(1, currentOverNumber)
        : Math.max(1, firstInningsOversPlayed, currentOverNumber);

    if (patch.overs < minAllowedOvers) {
      throw new MatchEngineError(
        `Overs cannot be reduced below ${minAllowedOvers}.`,
        400
      );
    }

    nextMatch.overs = patch.overs;
  }

  // A first-innings score fix can end the chase right away.
  if (typeof patch.innings1Score === "number") {
    nextMatch.innings1 = nextMatch.innings1 || {
      team: "",
      score: 0,
      history: [],
    };
    nextMatch.innings1.score = patch.innings1Score;

    if (nextMatch.innings === "first") {
      nextMatch.score = patch.innings1Score;
    } else if (
      nextMatch.innings === "second" &&
      nextMatch.isOngoing &&
      !nextMatch.result &&
      isTargetChased(nextMatch)
    ) {
      const pendingResult = buildWinByWicketsText(
        nextMatch,
        Number(nextMatch.outs || 0),
      );
      setPendingMatchResult(nextMatch, pendingResult);
      markLiveEvent(nextMatch, createMatchEndLiveEvent(nextMatch, pendingResult));
      correctionEndedMatch = true;
    }
  }

  // These are the fields that can be changed by a manual fix.
  if (patch.teamAName !== undefined) nextMatch.teamAName = nextNames.teamAName;
  if (patch.teamBName !== undefined) nextMatch.teamBName = nextNames.teamBName;
  if (patch.teamA !== undefined) {
    const nextTeamA = [...patch.teamA];
    if (!rosterPermissions.teamA && nextTeamA.length !== currentTeamALength) {
      throw new MatchEngineError(
        `Only ${currentMatch.innings2?.team || "the second innings batting team"} can add or remove players after the first innings.`,
        409
      );
    }

    nextMatch.teamA = nextTeamA;
  }
  if (patch.teamB !== undefined) {
    const nextTeamB = [...patch.teamB];
    if (!rosterPermissions.teamB && nextTeamB.length !== currentTeamBLength) {
      throw new MatchEngineError(
        `Only ${currentMatch.innings2?.team || "the second innings batting team"} can add or remove players after the first innings.`,
        409
      );
    }

    nextMatch.teamB = nextTeamB;
  }
  if (patch.announcerEnabled !== undefined) {
    nextMatch.announcerEnabled = patch.announcerEnabled;
  }
  if (patch.announcerMode !== undefined) {
    nextMatch.announcerMode = patch.announcerMode;
  }
  if (patch.announcerScoreSoundEffectsEnabled !== undefined) {
    nextMatch.announcerScoreSoundEffectsEnabled =
      patch.announcerScoreSoundEffectsEnabled;
  }
  if (patch.announcerBroadcastScoreSoundEffectsEnabled !== undefined) {
    nextMatch.announcerBroadcastScoreSoundEffectsEnabled =
      patch.announcerBroadcastScoreSoundEffectsEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "liveStream")) {
    nextMatch.liveStream = patch.liveStream || null;
  }

  // If team names change, update the same names in toss and innings too.
  if (
    previousNames.teamAName !== nextNames.teamAName ||
    previousNames.teamBName !== nextNames.teamBName
  ) {
    const syncedMatch = syncTeamNamesAcrossMatch(currentMatch, previousNames, nextNames);
    nextMatch.tossWinner = syncedMatch.tossWinner;
    nextMatch.innings1 = syncedMatch.innings1;
    nextMatch.innings2 = syncedMatch.innings2;
    nextMatch.result = syncedMatch.result;
    nextMatch.pendingResult = syncedMatch.pendingResult;
  }

  // Only real score or roster changes should create a correction event.
  if (
    (oversChanged || innings1ScoreChanged || teamASizeChanged || teamBSizeChanged) &&
    !correctionEndedMatch
  ) {
    markLiveEvent(
      nextMatch,
      createMatchCorrectionLiveEvent(currentMatch, nextMatch, patch)
    );
  }

  // Last safety check for team size and wickets.
  validateRosterDismissalState(nextMatch);

  return nextMatch;
}

// Build the smaller match data object used on session screens.
export function buildSessionMirrorUpdate(matchDocument) {
  const match = toPlainMatch(matchDocument);
  const resultText = normalizeMatchResultText(match, match?.result || "");
  const isTied = isTiedMatchResult(resultText);
  const winnerName = getWinningTeamName(resultText);
  const resultLower = resultText.toLowerCase();
  const firstInningsWon = resultLower.includes(" won by ") && resultLower.includes(" runs");
  const secondInningsWon =
    resultLower.includes(" won by ") && resultLower.includes(" wickets");
  const innings1 = match?.innings1 || { team: "", score: 0, history: [] };
  const innings2 = match?.innings2 || { team: "", score: 0, history: [] };

  // Only include the fields needed by session pages.
  return {
    teamA: Array.isArray(match?.teamA) ? match.teamA : [],
    teamB: Array.isArray(match?.teamB) ? match.teamB : [],
    teamAName: match?.teamAName || "",
    teamBName: match?.teamBName || "",
    overs: match?.overs ?? null,
    tossWinner: match?.tossWinner || "",
    tossDecision: match?.tossDecision || "",
    score: Number(match?.score || 0),
    outs: Number(match?.outs || 0),
    innings: match?.innings || "",
    result: resultText,
    pendingResult: normalizeMatchResultText(match, match?.pendingResult || ""),
    winningTeamName:
      isTied
        ? ""
        : winnerName ||
      (firstInningsWon ? innings1.team || "" : secondInningsWon ? innings2.team || "" : ""),
    winningScore: isTied
      ? 0
      : firstInningsWon
      ? Number(innings1.score || 0)
      : secondInningsWon
        ? Number(innings2.score ?? match?.score ?? 0)
        : Number(match?.score || 0),
    winningWickets: isTied
      ? 0
      : firstInningsWon
      ? countInningsWickets(innings1.history)
      : secondInningsWon
        ? countInningsWickets(innings2.history)
        : Number(match?.outs || 0),
    matchImages: Array.isArray(match?.matchImages) ? match.matchImages : [],
    sessionImageCount: Math.max(
      Array.isArray(match?.matchImages) ? match.matchImages.length : 0,
      match?.matchImageUrl ? 1 : 0,
    ),
    matchImageUrl: match?.matchImageUrl || "",
    matchImagePublicId: match?.matchImagePublicId || "",
    matchImageUploadedAt: match?.matchImageUploadedAt || null,
    matchImageUploadedBy: match?.matchImageUploadedBy || "",
    liveStream: match?.liveStream || null,
    announcerEnabled: Boolean(match?.announcerEnabled),
    announcerMode: match?.announcerMode || "",
    announcerScoreSoundEffectsEnabled:
      match?.announcerScoreSoundEffectsEnabled !== false,
    announcerBroadcastScoreSoundEffectsEnabled:
      match?.announcerBroadcastScoreSoundEffectsEnabled !== false,
    lastEventType: match?.lastEventType || "",
    lastEventText: match?.lastEventText || "",
    adminAccessVersion: Number(match?.adminAccessVersion || 1),
    isLive: Boolean(match?.isOngoing),
  };
}


