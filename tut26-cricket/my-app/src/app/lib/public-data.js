/**
 * File overview:
 * Purpose: Provides shared Public Data logic for routes, APIs, and feature code.
 * Main exports: serializePublicMatch, serializeLiveMatchPatch, serializePublicSession.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { getTeamBundle } from "./team-utils";
import { getPublicMatchImagePath } from "./match-image-secure";
import { getPublicMatchImages } from "./match-image-gallery";
import { isSafeMatchImageUrl } from "./match-image";
import { hasCompleteTossState, normalizeLegacyTossState } from "./match-toss";
import { normalizeScoreSoundEffectMap } from "./score-sound-effects";
import { addBallToHistory, countLegalBalls } from "./match-scoring";

function getPublicMatchImagesWithFallback(match, fallbackState = null) {
  const matchId = String(match?._id || "");
  const directImages = getPublicMatchImages(match, {
    matchId,
  });

  if (directImages.length || !fallbackState) {
    return directImages;
  }

  return getPublicMatchImages(fallbackState, {
    matchId,
  });
}

function getPublicUndoCount(match) {
  const numericUndoCount = Number(match?.undoCount || 0);
  const historyUndoCount = Array.isArray(match?.actionHistory)
    ? match.actionHistory.length
    : 0;

  return Math.max(
    0,
    Number.isFinite(numericUndoCount) ? numericUndoCount : 0,
    historyUndoCount,
  );
}

function getPublicRecentActionIds(match) {
  if (Array.isArray(match?.recentActionIds) && match.recentActionIds.length) {
    return match.recentActionIds;
  }

  if (Array.isArray(match?.processedActionIds) && match.processedActionIds.length) {
    return match.processedActionIds;
  }

  if (!Array.isArray(match?.actionHistory)) {
    return [];
  }

  return match.actionHistory
    .map((entry) => String(entry?.actionId || "").trim())
    .filter(Boolean)
    .slice(-256);
}

function getHistoryVersion(match) {
  return match?.updatedAt || null;
}

function getMediaVersion(match) {
  return (
    match?.mediaUpdatedAt ||
    match?.matchImageUploadedAt ||
    null
  );
}

function getActiveInningsKey(match) {
  return match?.innings === "second" ? "innings2" : "innings1";
}

function getCompactOverState(match) {
  const activeInningsKey = getActiveInningsKey(match);
  const activeHistory = Array.isArray(match?.[activeInningsKey]?.history)
    ? match[activeInningsKey].history
    : [];
  const activeOver = activeHistory.at(-1) || null;

  return {
    activeHistory,
    activeOver,
    activeOverBalls: Array.isArray(activeOver?.balls) ? activeOver.balls : [],
    activeOverNumber: Number(activeOver?.overNumber || 1),
    legalBallCount: countLegalBalls(activeHistory),
    firstInningsLegalBallCount: countLegalBalls(match?.innings1?.history || []),
    secondInningsLegalBallCount: countLegalBalls(match?.innings2?.history || []),
  };
}

function getCompactOverStateFromBalls(match) {
  const innings = match?.innings === "second" ? "second" : "first";
  const reconstructedMatch = {
    innings,
    innings1: { history: [] },
    innings2: { history: [] },
  };

  for (const ball of Array.isArray(match?.balls) ? match.balls : []) {
    addBallToHistory(reconstructedMatch, ball);
  }

  const activeInningsKey = getActiveInningsKey({ innings });
  const activeHistory = Array.isArray(reconstructedMatch?.[activeInningsKey]?.history)
    ? reconstructedMatch[activeInningsKey].history
    : [];
  const activeOver = activeHistory.at(-1) || null;

  return {
    activeOverBalls: Array.isArray(activeOver?.balls) ? activeOver.balls : [],
    activeOverNumber: Number(activeOver?.overNumber || 1),
    legalBallCount: countLegalBalls(activeHistory),
  };
}

function buildUmpireInnings(match, inningsKey, includeHistory) {
  const source = match?.[inningsKey] || {};
  const innings = {
    team: source.team || "",
    score: Number(source.score || 0),
  };

  if (includeHistory) {
    innings.history = Array.isArray(source.history) ? source.history : [];
  }

  return innings;
}

function buildCompactInnings(match, inningsKey) {
  const source = match?.[inningsKey] || {};
  return {
    team: source.team || "",
    score: Number(source.score || 0),
  };
}

function getPublicMatchImageUrl(match, fallbackState = null) {
  const publicImages = getPublicMatchImagesWithFallback(match, fallbackState);
  return publicImages[0]?.url || getPublicMatchImagePath(match);
}

export function serializeLiveMatchPatch(matchDocument) {
  if (!matchDocument) {
    return null;
  }

  const match =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;
  const compactOverState = getCompactOverState(match);

  return {
    score: match?.score ?? 0,
    outs: match?.outs ?? 0,
    innings: match?.innings || "first",
    innings1: buildUmpireInnings(match, "innings1", false),
    innings2: buildUmpireInnings(match, "innings2", false),
    result: match?.result || "",
    pendingResult: match?.pendingResult || "",
    pendingResultAt: match?.pendingResultAt || null,
    resultAutoFinalizeAt: match?.resultAutoFinalizeAt || null,
    isOngoing: Boolean(match?.isOngoing),
    undoCount: getPublicUndoCount(match),
    recentActionIds: getPublicRecentActionIds(match),
    legalBallCount: compactOverState.legalBallCount,
    activeOverNumber: compactOverState.activeOverNumber,
    activeOverBalls: compactOverState.activeOverBalls,
    firstInningsLegalBallCount: compactOverState.firstInningsLegalBallCount,
    secondInningsLegalBallCount: compactOverState.secondInningsLegalBallCount,
    historyVersion: getHistoryVersion(match),
    mediaVersion: getMediaVersion(match),
    lastLiveEvent: match?.lastLiveEvent || null,
    lastEventType: match?.lastEventType || "",
    lastEventText: match?.lastEventText || "",
    updatedAt: match?.updatedAt || null,
  };
}

export function serializeUmpireHistory(matchDocument) {
  if (!matchDocument) {
    return null;
  }

  const match =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;

  return {
    innings1: buildUmpireInnings(match, "innings1", true),
    innings2: buildUmpireInnings(match, "innings2", true),
    historyVersion: getHistoryVersion(match),
    updatedAt: match?.updatedAt || null,
  };
}

export function serializeMatchMediaPatch(matchDocument, fallbackState = null) {
  if (!matchDocument) {
    return null;
  }

  const rawMatch =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;
  const match = normalizeLegacyTossState(rawMatch, fallbackState);
  const publicImages = getPublicMatchImagesWithFallback(match, fallbackState);

  return {
    matchImageUrl: publicImages[0]?.url || getPublicMatchImagePath(match),
    matchImages: publicImages,
    mediaVersion: getMediaVersion(match),
    lastLiveEvent: match?.lastLiveEvent || null,
    lastEventType: match?.lastEventType || "",
    lastEventText: match?.lastEventText || "",
    updatedAt: match?.updatedAt || null,
  };
}

export function serializeUmpireBootstrap(matchDocument, fallbackState = null) {
  if (!matchDocument) {
    return null;
  }

  const rawMatch =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;
  const match = normalizeLegacyTossState(rawMatch, fallbackState);
  const compactOverState = getCompactOverState(match);
  const activeInningsKey = getActiveInningsKey(match);
  const publicImages = getPublicMatchImagesWithFallback(match, fallbackState);
  const announcerScoreSoundEffectMap = normalizeScoreSoundEffectMap(
    match?.announcer?.scoreSoundEffectMap ||
      fallbackState?.announcer?.scoreSoundEffectMap ||
      {},
  );

  return {
    _id: String(match._id),
    teamA: Array.isArray(match.teamA) ? match.teamA : [],
    teamB: Array.isArray(match.teamB) ? match.teamB : [],
    teamAName: match.teamAName || "",
    teamBName: match.teamBName || "",
    overs: match.overs ?? 0,
    sessionId: match.sessionId
      ? String(match.sessionId?._id || match.sessionId)
      : "",
    tossWinner: match.tossWinner || "",
    tossDecision: match.tossDecision || "",
    tossReady: hasCompleteTossState(match, fallbackState),
    score: match.score ?? 0,
    outs: match.outs ?? 0,
    isOngoing: Boolean(match.isOngoing),
    innings: match.innings || "first",
    result: match.result || "",
    pendingResult: match.pendingResult || "",
    pendingResultAt: match.pendingResultAt || null,
    resultAutoFinalizeAt: match.resultAutoFinalizeAt || null,
    innings1: buildUmpireInnings(match, "innings1", activeInningsKey === "innings1"),
    innings2: buildUmpireInnings(match, "innings2", activeInningsKey === "innings2"),
    balls: Array.isArray(match.balls) ? match.balls : [],
    legalBallCount: compactOverState.legalBallCount,
    activeOverNumber: compactOverState.activeOverNumber,
    activeOverBalls: compactOverState.activeOverBalls,
    firstInningsLegalBallCount: compactOverState.firstInningsLegalBallCount,
    secondInningsLegalBallCount: compactOverState.secondInningsLegalBallCount,
    historyVersion: getHistoryVersion(match),
    mediaVersion: getMediaVersion(match),
    matchImageUrl: publicImages[0]?.url || getPublicMatchImagePath(match),
    matchImages: [],
    announcerEnabled: Boolean(match.announcerEnabled),
    announcerMode: match.announcerMode || "",
    announcerScoreSoundEffectsEnabled:
      match.announcerScoreSoundEffectsEnabled !== false,
    announcerBroadcastScoreSoundEffectsEnabled:
      match.announcerBroadcastScoreSoundEffectsEnabled !== false,
    announcerScoreSoundEffectMap,
    walkieTalkieEnabled: Boolean(match.walkieTalkieEnabled),
    recentActionIds: getPublicRecentActionIds(match),
    lastLiveEvent: match.lastLiveEvent || null,
    lastEventType: match.lastEventType || "",
    lastEventText: match.lastEventText || "",
    undoCount: getPublicUndoCount(match),
    createdAt: match.createdAt || null,
    updatedAt: match.updatedAt || null,
  };
}

export function serializePublicMatch(
  matchDocument,
  fallbackState = null,
  options = {}
) {
  if (!matchDocument) return null;

  const rawMatch =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;
  const match = normalizeLegacyTossState(rawMatch, fallbackState);
  const includeActionHistory = Boolean(options.includeActionHistory);
  const publicImages = getPublicMatchImagesWithFallback(match, fallbackState);
  const announcerScoreSoundEffectMap = normalizeScoreSoundEffectMap(
    match?.announcer?.scoreSoundEffectMap ||
      fallbackState?.announcer?.scoreSoundEffectMap ||
      {},
  );

  return {
    _id: String(match._id),
    teamA: Array.isArray(match.teamA) ? match.teamA : [],
    teamB: Array.isArray(match.teamB) ? match.teamB : [],
    teamAName: match.teamAName || "",
    teamBName: match.teamBName || "",
    overs: match.overs ?? 0,
    sessionId: match.sessionId
      ? String(match.sessionId?._id || match.sessionId)
      : "",
    tossWinner: match.tossWinner || "",
    tossDecision: match.tossDecision || "",
    score: match.score ?? 0,
    outs: match.outs ?? 0,
    isOngoing: Boolean(match.isOngoing),
    innings: match.innings || "first",
    result: match.result || "",
    pendingResult: match.pendingResult || "",
    pendingResultAt: match.pendingResultAt || null,
    resultAutoFinalizeAt: match.resultAutoFinalizeAt || null,
    innings1: match.innings1 || { team: "", score: 0, history: [] },
    innings2: match.innings2 || { team: "", score: 0, history: [] },
    tossReady: hasCompleteTossState(match, fallbackState),
    balls: Array.isArray(match.balls) ? match.balls : [],
    matchImageUrl: publicImages[0]?.url || getPublicMatchImagePath(match),
    matchImages: publicImages,
    announcerEnabled: Boolean(match.announcerEnabled),
    announcerMode: match.announcerMode || "",
    announcerScoreSoundEffectsEnabled:
      match.announcerScoreSoundEffectsEnabled !== false,
    announcerBroadcastScoreSoundEffectsEnabled:
      match.announcerBroadcastScoreSoundEffectsEnabled !== false,
    announcerScoreSoundEffectMap,
    recentActionIds: getPublicRecentActionIds(match),
    lastLiveEvent: match.lastLiveEvent || null,
    lastEventType: match.lastEventType || "",
    lastEventText: match.lastEventText || "",
    ...(includeActionHistory
      ? {
          actionHistory: Array.isArray(match.actionHistory)
            ? match.actionHistory
            : [],
        }
      : {}),
    undoCount: getPublicUndoCount(match),
    createdAt: match.createdAt || null,
    updatedAt: match.updatedAt || null,
  };
}

export function serializeSessionCard(sessionDocument) {
  if (!sessionDocument) {
    return null;
  }

  const session =
    typeof sessionDocument.toObject === "function"
      ? sessionDocument.toObject()
      : sessionDocument;

  const publicImages = getPublicMatchImages(session, {
    matchId: String(session.match?._id || session.match || ""),
  }).slice(0, 6);

  return {
    _id: String(session._id),
    name: session.name || "",
    date: session.date || "",
    isLive: Boolean(session.isLive),
    match: session.match ? String(session.match?._id || session.match) : null,
    teamAName: session.teamAName || "",
    teamBName: session.teamBName || "",
    score: Number(session.score || 0),
    outs: Number(session.outs || 0),
    innings: session.innings || "",
    result: session.result || "",
    tossReady: Boolean(session.tossReady),
    coverImageUrl: session.coverImageUrl || session.matchImageUrl || "",
    matchImageUrl: session.matchImageUrl || "",
    matchImages: publicImages,
    imageCount: Math.max(0, Number(session.imageCount || 0)),
    winningTeamName: session.winningTeamName || "",
    winningScore: Number(session.winningScore || 0),
    winningWickets: Number(session.winningWickets || 0),
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
  };
}

export function serializeSessionViewSession(sessionDocument) {
  if (!sessionDocument) {
    return null;
  }

  const session =
    typeof sessionDocument.toObject === "function"
      ? sessionDocument.toObject()
      : sessionDocument;

  return {
    _id: String(session._id),
    name: session.name || "",
    teamAName: session.teamAName || "",
    teamBName: session.teamBName || "",
    match: session.match ? String(session.match?._id || session.match) : null,
    updatedAt: session.updatedAt || null,
  };
}

export function serializeSessionViewBootstrap(
  matchDocument,
  fallbackState = null,
) {
  if (!matchDocument) {
    return null;
  }

  const rawMatch =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;
  const match = normalizeLegacyTossState(rawMatch, fallbackState);
  const compactOverState = getCompactOverStateFromBalls(match);

  return {
    _id: String(match._id),
    teamA: Array.isArray(match.teamA) ? match.teamA : [],
    teamB: Array.isArray(match.teamB) ? match.teamB : [],
    teamAName: match.teamAName || "",
    teamBName: match.teamBName || "",
    overs: Number(match.overs || 0),
    sessionId: match.sessionId
      ? String(match.sessionId?._id || match.sessionId)
      : "",
    score: Number(match.score || 0),
    outs: Number(match.outs || 0),
    isOngoing: Boolean(match.isOngoing),
    innings: match.innings || "first",
    result: match.result || "",
    pendingResult: match.pendingResult || "",
    pendingResultAt: match.pendingResultAt || null,
    resultAutoFinalizeAt: match.resultAutoFinalizeAt || null,
    innings1: buildCompactInnings(match, "innings1"),
    innings2: buildCompactInnings(match, "innings2"),
    matchImageUrl: getPublicMatchImageUrl(match, fallbackState),
    legalBallCount: compactOverState.legalBallCount,
    activeOverNumber: compactOverState.activeOverNumber,
    activeOverBalls: compactOverState.activeOverBalls,
    historyVersion: getHistoryVersion(match),
    mediaVersion: getMediaVersion(match),
    lastLiveEvent: match.lastLiveEvent || null,
    lastEventType: match.lastEventType || "",
    lastEventText: match.lastEventText || "",
    announcerEnabled: Boolean(match.announcerEnabled),
    announcerMode: match.announcerMode || "",
    announcerScoreSoundEffectsEnabled:
      match.announcerScoreSoundEffectsEnabled !== false,
    announcerBroadcastScoreSoundEffectsEnabled:
      match.announcerBroadcastScoreSoundEffectsEnabled !== false,
    walkieTalkieEnabled: Boolean(match.walkieTalkieEnabled),
    updatedAt: match.updatedAt || null,
  };
}

export function serializeSessionViewHistory(matchDocument, fallbackState = null) {
  if (!matchDocument) {
    return null;
  }

  const rawMatch =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;
  const match = normalizeLegacyTossState(rawMatch, fallbackState);

  return {
    innings1: buildUmpireInnings(match, "innings1", true),
    innings2: buildUmpireInnings(match, "innings2", true),
    historyVersion: getHistoryVersion(match),
    updatedAt: match.updatedAt || null,
  };
}

export function serializeSessionViewMedia(matchDocument, fallbackState = null) {
  if (!matchDocument) {
    return null;
  }

  const rawMatch =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;
  const match = normalizeLegacyTossState(rawMatch, fallbackState);
  const publicImages = getPublicMatchImagesWithFallback(match, fallbackState);

  return {
    matchImageUrl: publicImages[0]?.url || getPublicMatchImagePath(match),
    matchImages: publicImages,
    mediaVersion: getMediaVersion(match),
    updatedAt: match.updatedAt || null,
  };
}

export function serializePublicSession(sessionDocument) {
  if (!sessionDocument) return null;

  const session =
    typeof sessionDocument.toObject === "function"
      ? sessionDocument.toObject()
      : sessionDocument;
  const publicImages = getPublicMatchImages(session, {
    matchId: String(session.match?._id || session.match || ""),
  });

  const teamA = getTeamBundle(session, "teamA");
  const teamB = getTeamBundle(session, "teamB");

  return {
    _id: String(session._id),
    name: session.name || "",
    date: session.date || "",
    overs: session.overs ?? null,
    isLive: Boolean(session.isLive),
    match: session.match ? String(session.match?._id || session.match) : null,
    tossWinner: session.tossWinner || "",
    tossDecision: session.tossDecision || "",
    tossReady: Boolean(session.tossWinner && session.tossDecision),
    teamAName: teamA.name,
    teamBName: teamB.name,
    teamA: teamA.players,
    teamB: teamB.players,
    matchImageUrl:
      publicImages[0]?.url ||
      (isSafeMatchImageUrl(session.matchImageUrl || "")
        ? session.matchImageUrl || ""
        : getPublicMatchImagePath({
          _id: session.match?._id || session.match || "",
          matchImageUrl: session.matchImageUrl || "",
          matchImageStorageUrlEnc: session.matchImageStorageUrlEnc || "",
          matchImageStorageUrlHash: session.matchImageStorageUrlHash || "",
          matchImagePublicId: session.matchImagePublicId || "",
          matchImageUploadedAt: session.matchImageUploadedAt || null,
          updatedAt: session.updatedAt || null,
        })),
    matchImages: publicImages,
    announcerEnabled: Boolean(session.announcerEnabled),
    announcerMode: session.announcerMode || "",
    announcerScoreSoundEffectsEnabled:
      session.announcerScoreSoundEffectsEnabled !== false,
    announcerBroadcastScoreSoundEffectsEnabled:
      session.announcerBroadcastScoreSoundEffectsEnabled !== false,
    lastEventType: session.lastEventType || "",
    lastEventText: session.lastEventText || "",
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
  };
}


