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
import { getBattingTeamBundle, getTotalDismissalsAllowed } from "./team-utils";

const MUTABLE_STATE_KEYS = [
  "tossWinner",
  "tossDecision",
  "score",
  "outs",
  "isOngoing",
  "innings",
  "result",
  "innings1",
  "innings2",
  "balls",
  "lastLiveEvent",
  "lastEventType",
  "lastEventText",
];

const MAX_ACTION_HISTORY = 96;
const MAX_PROCESSED_ACTION_IDS = 256;

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

function toPlainMatch(matchDocument) {
  if (!matchDocument) return null;

  return typeof matchDocument.toObject === "function"
    ? matchDocument.toObject()
    : cloneValue(matchDocument);
}

function getSnapshot(match) {
  const snapshot = {};

  for (const key of MUTABLE_STATE_KEYS) {
    snapshot[key] = cloneValue(match?.[key]);
  }

  return snapshot;
}

function restoreSnapshot(match, snapshot) {
  for (const key of MUTABLE_STATE_KEYS) {
    match[key] = cloneValue(snapshot?.[key]);
  }
}

function appendProcessedActionId(match, actionId) {
  const nextActionIds = [...(match.processedActionIds || []), actionId];
  match.processedActionIds = nextActionIds.slice(-MAX_PROCESSED_ACTION_IDS);
}

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

function getStoredLastEventType(liveEvent) {
  if (!liveEvent?.type) {
    return "";
  }

  return liveEvent.type === "score_update" ? "score" : liveEvent.type;
}

function markLiveEvent(match, liveEvent) {
  match.lastLiveEvent = liveEvent;
  match.lastEventType = getStoredLastEventType(liveEvent);
  match.lastEventText = liveEvent?.summaryText || "";
}

function getActiveInningsKey(match) {
  return match?.innings === "second" ? "innings2" : "innings1";
}

function getActiveHistory(match) {
  return match?.[getActiveInningsKey(match)]?.history || [];
}

function countDismissalsInHistory(history) {
  return (history || [])
    .flatMap((over) => over?.balls || [])
    .filter((ball) => ball?.isOut).length;
}

function getLegalBallsInActiveInnings(match) {
  return countLegalBalls(getActiveHistory(match));
}

function getDismissalLimit(match) {
  return getTotalDismissalsAllowed(match);
}

function hasTossState(match) {
  return Boolean(
    match?.tossWinner &&
      match?.tossDecision &&
      match?.innings1?.team &&
      match?.innings2?.team
  );
}

function hasScoreActivity(match) {
  return (
    Number(match?.score || 0) > 0 ||
    Number(match?.outs || 0) > 0 ||
    (Array.isArray(match?.balls) && match.balls.length > 0) ||
    countLegalBalls(match?.innings1?.history || []) > 0 ||
    countLegalBalls(match?.innings2?.history || []) > 0
  );
}

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

function isTargetChased(match) {
  return (
    match?.innings === "second" &&
    Number(match?.score || 0) > Number(match?.innings1?.score || 0)
  );
}

function isCurrentInningsComplete(match) {
  const oversDone =
    Number(match?.overs || 0) > 0 &&
    getLegalBallsInActiveInnings(match) >= Number(match.overs) * 6;
  const allOut = Number(match?.outs || 0) >= getDismissalLimit(match);

  return oversDone || allOut || isTargetChased(match);
}

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

  const snapshot = getSnapshot(match);
  const nextMatch = toPlainMatch(match);
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

  return nextMatch;
}

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
  const nextMatch = toPlainMatch(match);
  const activeInningsKey = getActiveInningsKey(nextMatch);
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

  addBallToHistory(nextMatch, ball);

  if (isTargetChased(nextMatch)) {
    nextMatch.isOngoing = false;
    nextMatch.result = buildWinByWicketsText(nextMatch, nextMatch.outs);
    markLiveEvent(
      nextMatch,
      createMatchEndLiveEvent(nextMatch, nextMatch.result, {
        ball,
        actionId: action.actionId,
      }),
    );
  } else if (nextMatch.innings === "second" && isCurrentInningsComplete(nextMatch)) {
    nextMatch.isOngoing = false;
    nextMatch.result = buildMatchResult(nextMatch);
    markLiveEvent(
      nextMatch,
      createMatchEndLiveEvent(nextMatch, nextMatch.result, {
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

  return nextMatch;
}

function completeInnings(match, action) {
  if (!hasTossState(match)) {
    throw new MatchEngineError("Set the toss before completing an innings.", 409);
  }

  if (!isCurrentInningsComplete(match) && !match?.result) {
    throw new MatchEngineError("The current innings is not complete yet.", 409);
  }

  const snapshot = getSnapshot(match);
  const nextMatch = toPlainMatch(match);

  if (nextMatch.innings === "first") {
    nextMatch.innings = "second";
    nextMatch.score = Number(nextMatch.innings2?.score || 0);
    nextMatch.outs = 0;
    nextMatch.balls = [];
    nextMatch.result = "";
    nextMatch.isOngoing = true;

    markLiveEvent(
      nextMatch,
      createSystemLiveEvent("innings_change", "Second innings begins.", nextMatch)
    );
    appendActionHistory(nextMatch, action, snapshot);
    appendProcessedActionId(nextMatch, action.actionId);

    return nextMatch;
  }

  nextMatch.isOngoing = false;
  nextMatch.result = buildMatchResult(nextMatch);

  markLiveEvent(nextMatch, createMatchEndLiveEvent(nextMatch, nextMatch.result));
  appendActionHistory(nextMatch, action, snapshot);
  appendProcessedActionId(nextMatch, action.actionId);

  return nextMatch;
}

function undoLastAction(match, action) {
  const history = Array.isArray(match?.actionHistory) ? match.actionHistory : [];
  const previousAction = history.at(-1);

  if (!previousAction?.snapshot) {
    throw new MatchEngineError("There is nothing left to undo.", 409);
  }

  const nextMatch = toPlainMatch(match);
  restoreSnapshot(nextMatch, previousAction.snapshot);
  nextMatch.actionHistory = history.slice(0, -1);
  appendProcessedActionId(nextMatch, action.actionId);
  markLiveEvent(nextMatch, createUndoLiveEvent(nextMatch));

  return nextMatch;
}

export function isProcessedAction(match, actionId) {
  return Array.isArray(match?.processedActionIds)
    ? match.processedActionIds.includes(actionId)
    : false;
}

export function applyMatchAction(matchDocument, action) {
  const match = normalizeLegacyTossState(toPlainMatch(matchDocument));

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

export function applySafeMatchPatch(matchDocument, patch) {
  const currentMatch = toPlainMatch(matchDocument);
  const nextMatch = toPlainMatch(matchDocument);
  const oversChanged =
    typeof patch.overs === "number" &&
    patch.overs !== Number(currentMatch?.overs || 0);
  const innings1ScoreChanged =
    typeof patch.innings1Score === "number" &&
    patch.innings1Score !== Number(currentMatch?.innings1?.score || 0);
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
      nextMatch.isOngoing = false;
      nextMatch.result = buildWinByWicketsText(nextMatch, Number(nextMatch.outs || 0));
      markLiveEvent(nextMatch, createMatchEndLiveEvent(nextMatch, nextMatch.result));
      correctionEndedMatch = true;
    }
  }

  if (patch.teamAName !== undefined) nextMatch.teamAName = nextNames.teamAName;
  if (patch.teamBName !== undefined) nextMatch.teamBName = nextNames.teamBName;
  if (patch.teamA !== undefined) {
    const nextTeamA = [...patch.teamA];
    const currentTeamALength = Array.isArray(currentMatch.teamA)
      ? currentMatch.teamA.length
      : 0;

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
    const currentTeamBLength = Array.isArray(currentMatch.teamB)
      ? currentMatch.teamB.length
      : 0;

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

  if (
    previousNames.teamAName !== nextNames.teamAName ||
    previousNames.teamBName !== nextNames.teamBName
  ) {
    const syncedMatch = syncTeamNamesAcrossMatch(currentMatch, previousNames, nextNames);
    nextMatch.tossWinner = syncedMatch.tossWinner;
    nextMatch.innings1 = syncedMatch.innings1;
    nextMatch.innings2 = syncedMatch.innings2;
  }

  if ((oversChanged || innings1ScoreChanged) && !correctionEndedMatch) {
    markLiveEvent(
      nextMatch,
      createMatchCorrectionLiveEvent(currentMatch, nextMatch, patch)
    );
  }

  validateRosterDismissalState(nextMatch);

  return nextMatch;
}

export function buildSessionMirrorUpdate(matchDocument) {
  const match = toPlainMatch(matchDocument);

  return {
    teamA: Array.isArray(match?.teamA) ? match.teamA : [],
    teamB: Array.isArray(match?.teamB) ? match.teamB : [],
    teamAName: match?.teamAName || "",
    teamBName: match?.teamBName || "",
    overs: match?.overs ?? null,
    tossWinner: match?.tossWinner || "",
    tossDecision: match?.tossDecision || "",
    matchImages: Array.isArray(match?.matchImages) ? match.matchImages : [],
    matchImageUrl: match?.matchImageUrl || "",
    matchImagePublicId: match?.matchImagePublicId || "",
    matchImageUploadedAt: match?.matchImageUploadedAt || null,
    matchImageUploadedBy: match?.matchImageUploadedBy || "",
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
