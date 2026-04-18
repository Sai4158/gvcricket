/**
 * File overview:
 * Purpose: Provides shared Server Data Helpers logic for routes, APIs, and feature code.
 * Main exports: invalidateSessionsDataCache, getPublicId, getIsoTimestamp, buildLockedTossPageData, SERVER_DATA_CACHE_TTL_MS, PUBLIC_SESSION_FIELDS, READ_ONLY_PUBLIC_MATCH_FIELDS, PUBLIC_MATCH_FIELDS, SESSION_MATCH_SUMMARY_FIELDS, FALLBACK_SESSION_FIELDS, NON_DRAFT_SESSION_COLLECTION_FILTER, PUBLIC_SESSION_PROJECTION, SESSION_MATCH_SUMMARY_PROJECTION, globalServerDataCache.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: ./README.md
 */

import { Types, isValidObjectId } from "mongoose";
import Match from "../../models/Match";
import Session from "../../models/Session";

export const SERVER_DATA_CACHE_TTL_MS = 15000;
export const PUBLIC_SESSION_FIELDS =
  "_id name date overs isLive isDraft match tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy announcer announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled lastEventType lastEventText createdAt updatedAt";
export const READ_ONLY_PUBLIC_MATCH_FIELDS =
  "_id teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result innings1 innings2 balls matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy announcer announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled lastLiveEvent lastEventType lastEventText recentActionIds undoCount undoSequence createdAt updatedAt";
export const PUBLIC_MATCH_FIELDS = `${READ_ONLY_PUBLIC_MATCH_FIELDS} actionHistory processedActionIds`;
export const SESSION_MATCH_SUMMARY_FIELDS =
  "_id teamA teamB teamAName teamBName tossWinner tossDecision score outs innings innings1 innings2 isOngoing result updatedAt sessionId matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy createdAt";
export const FALLBACK_SESSION_FIELDS =
  "tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy updatedAt";
export const HOME_LIVE_BANNER_SESSION_FIELDS =
  "_id match teamAName teamBName matchImageUrl createdAt updatedAt";
export const HOME_LIVE_BANNER_MATCH_FIELDS =
  "_id sessionId teamAName teamBName score outs isOngoing result matchImageUrl lastEventType lastEventText createdAt updatedAt";
export const SESSIONS_INDEX_SESSION_FIELDS =
  "_id name date isLive match tossWinner tossDecision teamAName teamBName matchImages matchImageUrl createdAt updatedAt";
export const SESSIONS_INDEX_MATCH_FIELDS =
  "_id sessionId teamAName teamBName tossWinner tossDecision score outs innings innings1 innings2 isOngoing result matchImages matchImageUrl createdAt updatedAt";
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
export const HOME_LIVE_BANNER_SESSION_PROJECTION = buildProjection(
  HOME_LIVE_BANNER_SESSION_FIELDS
);
export const HOME_LIVE_BANNER_MATCH_PROJECTION = buildProjection(
  HOME_LIVE_BANNER_MATCH_FIELDS
);
export const SESSIONS_INDEX_SESSION_PROJECTION = buildProjection(
  SESSIONS_INDEX_SESSION_FIELDS
);
export const SESSIONS_INDEX_MATCH_PROJECTION = buildProjection(
  SESSIONS_INDEX_MATCH_FIELDS
);

function createServerDataCacheEntry() {
  return {
    value: null,
    expiresAt: 0,
    pending: null,
  };
}

function ensureServerDataCacheShape(cache) {
  const nextCache = cache || {};

  if (!nextCache.sessionsIndex) {
    nextCache.sessionsIndex = createServerDataCacheEntry();
  }

  if (!nextCache.directorSessions) {
    nextCache.directorSessions = createServerDataCacheEntry();
  }

  if (!nextCache.homeLiveBanner) {
    nextCache.homeLiveBanner = createServerDataCacheEntry();
  }

  return nextCache;
}

export const globalServerDataCache = ensureServerDataCacheShape(
  globalThis.__gvServerDataCache
);

if (!globalThis.__gvServerDataCache) {
  globalThis.__gvServerDataCache = globalServerDataCache;
} else {
  ensureServerDataCacheShape(globalThis.__gvServerDataCache);
}

export function invalidateSessionsDataCache() {
  globalServerDataCache.sessionsIndex.value = null;
  globalServerDataCache.sessionsIndex.expiresAt = 0;
  globalServerDataCache.sessionsIndex.pending = null;
  globalServerDataCache.directorSessions.value = null;
  globalServerDataCache.directorSessions.expiresAt = 0;
  globalServerDataCache.directorSessions.pending = null;
  globalServerDataCache.homeLiveBanner.value = null;
  globalServerDataCache.homeLiveBanner.expiresAt = 0;
  globalServerDataCache.homeLiveBanner.pending = null;
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


