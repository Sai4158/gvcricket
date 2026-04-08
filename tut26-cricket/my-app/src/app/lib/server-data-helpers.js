/**
 * File overview:
 * Purpose: Shared projections, cache state, and fallback loaders for server-data routes.
 * Main exports: projection constants, cache helpers, and fallback session/match resolvers.
 * Major callers: server-data.js.
 * Side effects: reads Mongo collections and updates a global in-memory cache.
 * Read next: ./server-data.js
 */

import { Types, isValidObjectId } from "mongoose";
import Match from "../../models/Match";
import Session from "../../models/Session";

export const SERVER_DATA_CACHE_TTL_MS = 15000;
export const PUBLIC_SESSION_FIELDS =
  "_id name date overs isLive isDraft match tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy announcer announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled lastEventType lastEventText createdAt updatedAt";
export const READ_ONLY_PUBLIC_MATCH_FIELDS =
  "_id teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result innings1 innings2 balls matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy announcer announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled lastLiveEvent lastEventType lastEventText createdAt updatedAt";
export const PUBLIC_MATCH_FIELDS = `${READ_ONLY_PUBLIC_MATCH_FIELDS} actionHistory`;
export const SESSION_MATCH_SUMMARY_FIELDS =
  "_id teamA teamB teamAName teamBName tossWinner tossDecision score outs innings innings1 innings2 isOngoing result updatedAt sessionId matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy createdAt";
export const FALLBACK_SESSION_FIELDS =
  "tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy updatedAt";
export const NON_DRAFT_SESSION_COLLECTION_FILTER = {
  isDraft: { $ne: true },
};

function buildProjection(fields) {
  return String(fields || "")
    .split(/\s+/)
    .filter(Boolean)
    .reduce((projection, field) => {
      projection[field] = 1;
      return projection;
    }, {});
}

export const PUBLIC_SESSION_PROJECTION = buildProjection(PUBLIC_SESSION_FIELDS);
export const SESSION_MATCH_SUMMARY_PROJECTION = buildProjection(SESSION_MATCH_SUMMARY_FIELDS);

export const globalServerDataCache = globalThis.__gvServerDataCache || {
  sessionsIndex: {
    value: null,
    expiresAt: 0,
    pending: null,
  },
  directorSessions: {
    value: null,
    expiresAt: 0,
    pending: null,
  },
};

if (!globalThis.__gvServerDataCache) {
  globalThis.__gvServerDataCache = globalServerDataCache;
}

export function invalidateSessionsDataCache() {
  globalServerDataCache.sessionsIndex.value = null;
  globalServerDataCache.sessionsIndex.expiresAt = 0;
  globalServerDataCache.sessionsIndex.pending = null;
  globalServerDataCache.directorSessions.value = null;
  globalServerDataCache.directorSessions.expiresAt = 0;
  globalServerDataCache.directorSessions.pending = null;
}

export function getPublicId(value) {
  return String(value?._id || value || "");
}

export function getIsoTimestamp(...values) {
  return new Date(values.find(Boolean) || Date.now()).toISOString();
}

export function buildLockedTossPageData() {
  return {
    found: false,
    authStatus: "locked",
    match: null,
    sessionId: "",
    hasCreatedMatch: false,
    actualMatchId: "",
  };
}

export async function loadFallbackSession(sessionId, fields = FALLBACK_SESSION_FIELDS) {
  const normalizedSessionId = getPublicId(sessionId);

  if (!isValidObjectId(normalizedSessionId)) {
    return null;
  }

  return Session.findById(normalizedSessionId).select(fields).lean();
}

export async function resolveSessionMatches(sessions) {
  const resolvedBySessionId = new Map();
  const unresolvedSessionIds = sessions
    .filter((session) => !session.match?._id && !session.match)
    .map((session) => session._id);

  if (!unresolvedSessionIds.length) {
    return resolvedBySessionId;
  }

  const fallbackMatchSessionIds = unresolvedSessionIds
    .map((sessionId) => String(sessionId || ""))
    .filter((sessionId) => isValidObjectId(sessionId))
    .map((sessionId) => new Types.ObjectId(sessionId));

  if (!fallbackMatchSessionIds.length) {
    return resolvedBySessionId;
  }

  const fallbackMatches = await Match.aggregate([
    {
      $match: {
        sessionId: { $in: fallbackMatchSessionIds },
      },
    },
    {
      $project: {
        teamA: 1,
        teamB: 1,
        teamAName: 1,
        teamBName: 1,
        score: 1,
        outs: 1,
        innings: 1,
        innings1: 1,
        innings2: 1,
        isOngoing: 1,
        result: 1,
        updatedAt: 1,
        createdAt: 1,
        sessionId: 1,
        matchImages: 1,
        matchImageUrl: 1,
        matchImagePublicId: 1,
        matchImageStorageUrlEnc: 1,
        matchImageStorageUrlHash: 1,
        matchImageUploadedAt: 1,
        matchImageUploadedBy: 1,
      },
    },
    {
      $sort: {
        updatedAt: -1,
        createdAt: -1,
      },
    },
  ]);

  for (const match of fallbackMatches) {
    const sessionId = getPublicId(match.sessionId);
    if (sessionId && !resolvedBySessionId.has(sessionId)) {
      resolvedBySessionId.set(sessionId, match);
    }
  }

  return resolvedBySessionId;
}
