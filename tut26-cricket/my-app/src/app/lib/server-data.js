/**
 * File overview:
 * Purpose: Provides shared Server Data logic for routes, APIs, and feature code.
 * Main exports: module side effects only.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: ./README.md
 */

import { cookies } from "next/headers";
import { Types, isValidObjectId } from "mongoose";
import Match from "../../models/Match";
import Session from "../../models/Session";
import { connectDB } from "./db";
import {
  getDirectorAccessCookieName,
  hasValidDirectorAccess,
} from "./director-access";
import { getMatchAccessCookieName, hasValidMatchAccess } from "./match-access";
import { serializePublicMatch, serializePublicSession } from "./public-data";
import { hasCompleteTossState, hydrateLegacyTossState, normalizeLegacyTossState } from "./match-toss";
import {
  buildLockedTossPageData,
  FALLBACK_SESSION_FIELDS,
  getIsoTimestamp,
  getPublicId,
  globalServerDataCache,
  invalidateSessionsDataCache,
  loadFallbackSession,
  NON_DRAFT_SESSION_COLLECTION_FILTER,
  PUBLIC_MATCH_FIELDS,
  PUBLIC_SESSION_FIELDS,
  PUBLIC_SESSION_PROJECTION,
  READ_ONLY_PUBLIC_MATCH_FIELDS,
  resolveSessionMatches,
  SERVER_DATA_CACHE_TTL_MS,
  SESSION_MATCH_SUMMARY_PROJECTION,
} from "./server-data-helpers";

export { invalidateSessionsDataCache } from "./server-data-helpers";

async function hydrateLinkedSessionMatches(sessions) {
  const linkedMatchIds = sessions
    .map((session) => getPublicId(session.match))
    .filter((matchId) => isValidObjectId(matchId))
    .map((matchId) => new Types.ObjectId(matchId));

  if (!linkedMatchIds.length) {
    return sessions;
  }

  const linkedMatches = await Match.collection
    .find(
      {
        _id: { $in: linkedMatchIds },
      },
      {
        projection: SESSION_MATCH_SUMMARY_PROJECTION,
      }
    )
    .toArray();

  const linkedMatchesById = new Map(
    linkedMatches.map((match) => [getPublicId(match._id), match])
  );

  return sessions.map((session) => {
    const linkedMatch = linkedMatchesById.get(getPublicId(session.match));
    if (!linkedMatch) {
      return session;
    }

    return {
      ...session,
      match: linkedMatch,
    };
  });
}

async function readVisibleSessionsWithMatches(sort = { createdAt: -1, _id: -1 }) {
  const sessions = await Session.collection
    .find(NON_DRAFT_SESSION_COLLECTION_FILTER, {
      projection: PUBLIC_SESSION_PROJECTION,
    })
    .sort(sort)
    .toArray();

  return hydrateLinkedSessionMatches(sessions);
}

async function getCachedServerData(cacheEntry, loader) {
  const now = Date.now();

  if (cacheEntry.value && cacheEntry.expiresAt > now) {
    return cacheEntry.value;
  }

  if (cacheEntry.pending) {
    return cacheEntry.pending;
  }

  cacheEntry.pending = loader()
    .then((value) => {
      cacheEntry.value = value;
      cacheEntry.expiresAt = Date.now() + SERVER_DATA_CACHE_TTL_MS;
      return value;
    })
    .finally(() => {
      cacheEntry.pending = null;
    });

  return cacheEntry.pending;
}

async function findMatchForSession(session) {
  if (!session) return null;

  if (session.match) {
    return Match.findById(session.match).select(READ_ONLY_PUBLIC_MATCH_FIELDS).lean();
  }

  return Match.findOne({ sessionId: session._id })
    .select(READ_ONLY_PUBLIC_MATCH_FIELDS)
    .sort({ updatedAt: -1 })
    .lean();
}

async function readSessionsIndexPageData() {
  await connectDB();

  const [sessions, totalCount] = await Promise.all([
    readVisibleSessionsWithMatches({ createdAt: -1 }),
    Session.collection.countDocuments(NON_DRAFT_SESSION_COLLECTION_FILTER),
  ]);

  const fallbackMatchesBySessionId = await resolveSessionMatches(sessions);

  const mappedSessions = sessions.map((session) => {
    let resolvedMatch =
      session.match || fallbackMatchesBySessionId.get(String(session._id)) || null;
    if (resolvedMatch && !hasCompleteTossState(resolvedMatch, session)) {
      resolvedMatch = normalizeLegacyTossState(resolvedMatch, session);
    }
    const publicMatch = serializePublicMatch(resolvedMatch, session);
    const publicSession = serializePublicSession({
      ...session,
      tossWinner: resolvedMatch?.tossWinner || session.tossWinner || "",
      tossDecision: resolvedMatch?.tossDecision || session.tossDecision || "",
      match: resolvedMatch?._id || session.match,
    });

    return {
      ...publicSession,
      matchImageUrl: publicMatch?.matchImageUrl || publicSession.matchImageUrl || "",
      matchImages:
        publicMatch?.matchImages?.length > 0
          ? publicMatch.matchImages
          : publicSession.matchImages || [],
      updatedAt: resolvedMatch?.updatedAt || session.updatedAt,
      isLive: resolvedMatch ? Boolean(resolvedMatch.isOngoing) : Boolean(session.isLive),
      score: Number(publicMatch?.score || 0),
      outs: Number(publicMatch?.outs || 0),
      innings: publicMatch?.innings || "",
      innings1: publicMatch?.innings1 || null,
      innings2: publicMatch?.innings2 || null,
      result: resolvedMatch?.result || session.result || "",
      tossReady:
        publicMatch?.tossReady ||
        Boolean(
          (resolvedMatch?.tossWinner || session.tossWinner) &&
            (resolvedMatch?.tossDecision || session.tossDecision)
        ),
    };
  });

  return {
    sessions: mappedSessions,
    totalCount: Number(totalCount || 0),
  };
}

export async function loadSessionsIndexPageData(options = {}) {
  if (options?.forceFresh) {
    return readSessionsIndexPageData();
  }

  return getCachedServerData(
    globalServerDataCache.sessionsIndex,
    readSessionsIndexPageData
  );
}

export async function loadSessionsIndexData(options = {}) {
  const data = await loadSessionsIndexPageData(options);
  return data.sessions;
}

export async function loadSessionViewData(sessionId) {
  if (!isValidObjectId(sessionId)) {
    return { found: false, session: null, match: null, updatedAt: "" };
  }

  await connectDB();

  const session = await Session.findById(sessionId)
    .select(PUBLIC_SESSION_FIELDS)
    .lean();
  if (!session) {
    return { found: false, session: null, match: null, updatedAt: "" };
  }

  const match = await findMatchForSession(session);

  return {
    found: true,
    session: serializePublicSession(session),
    match: serializePublicMatch(match, session),
    updatedAt: getIsoTimestamp(match?.updatedAt, session.updatedAt),
  };
}

export async function loadPublicMatchData(matchId) {
  if (!isValidObjectId(matchId)) {
    return null;
  }

  await connectDB();
  const match = await Match.findById(matchId)
    .select(READ_ONLY_PUBLIC_MATCH_FIELDS)
    .lean();
  if (!match) {
    return null;
  }
  const fallbackSession = await loadFallbackSession(match.sessionId);
  return serializePublicMatch(match, fallbackSession);
}

export async function loadTossPageData(matchId) {
  if (!isValidObjectId(matchId)) {
    return buildLockedTossPageData();
  }

  await connectDB();
  const match = await Match.findById(matchId)
    .select(`adminAccessVersion ${PUBLIC_MATCH_FIELDS}`)
    .lean();

  if (match) {
    const fallbackSession = await loadFallbackSession(match.sessionId);
    const cookieStore = await cookies();
    const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
    const authorized = hasValidMatchAccess(
      matchId,
      token,
      Number(match.adminAccessVersion || 1)
    );

    return {
      found: true,
      authStatus: authorized ? "granted" : "locked",
      match: serializePublicMatch(match, fallbackSession, {
        includeActionHistory: true,
      }),
      sessionId: getPublicId(match.sessionId),
      hasCreatedMatch: true,
      actualMatchId: getPublicId(match._id),
    };
  }

  const session = await Session.findById(matchId)
    .select(PUBLIC_SESSION_FIELDS)
    .lean();

  if (!session) {
    return buildLockedTossPageData();
  }

  if (session.match) {
    const linkedMatch = await Match.findById(session.match)
      .select(`adminAccessVersion ${PUBLIC_MATCH_FIELDS}`)
      .lean();

    if (linkedMatch) {
      const cookieStore = await cookies();
      const token = cookieStore.get(getMatchAccessCookieName(String(linkedMatch._id)))?.value;
      const authorized = hasValidMatchAccess(
        String(linkedMatch._id),
        token,
        Number(linkedMatch.adminAccessVersion || 1)
      );

      return {
        found: true,
        authStatus: authorized ? "granted" : "locked",
        match: serializePublicMatch(linkedMatch, session, {
          includeActionHistory: true,
        }),
        sessionId: getPublicId(session._id),
        hasCreatedMatch: true,
        actualMatchId: getPublicId(linkedMatch._id),
      };
    }
  }

  return {
    found: true,
    authStatus: "granted",
    match: {
      _id: getPublicId(session._id),
      sessionId: getPublicId(session._id),
      teamA: Array.isArray(session.teamA) ? session.teamA : [],
      teamB: Array.isArray(session.teamB) ? session.teamB : [],
      teamAName: session.teamAName || "Team A",
      teamBName: session.teamBName || "Team B",
      overs: Number(session.overs || 6),
      tossWinner: "",
      tossDecision: "",
      score: 0,
      outs: 0,
      isOngoing: false,
      innings: "first",
      result: "",
      innings1: { team: "", score: 0, history: [] },
      innings2: { team: "", score: 0, history: [] },
      balls: [],
      matchImageUrl: session.matchImageUrl || "",
      createdAt: session.createdAt || null,
      updatedAt: session.updatedAt || null,
    },
    sessionId: getPublicId(session._id),
    hasCreatedMatch: false,
    actualMatchId: "",
  };
}

export async function loadMatchAccessData(matchId) {
  if (!isValidObjectId(matchId)) {
    return { found: false, authStatus: "locked", match: null };
  }

  await connectDB();
  const match = await Match.findById(matchId).select(
    `adminAccessVersion ${PUBLIC_MATCH_FIELDS}`
  );

  if (!match) {
    return { found: false, authStatus: "locked", match: null };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  const authorized = hasValidMatchAccess(
    matchId,
    token,
    Number(match.adminAccessVersion || 1)
  );

  const fallbackSession = await loadFallbackSession(match.sessionId);

  if (authorized && hydrateLegacyTossState(match, fallbackSession)) {
    await match.save();
  }

  return {
    found: true,
    authStatus: authorized ? "granted" : "locked",
    match: authorized
      ? serializePublicMatch(match, fallbackSession, {
          includeActionHistory: true,
        })
      : null,
  };
}

export async function loadHomeLiveBannerData() {
  const { sessions } = await readSessionsIndexPageData();
  const visibleSessions = Array.isArray(sessions) ? sessions : [];

  if (!visibleSessions.length) {
    return null;
  }

  const sessionsByRecentUpdate = [...visibleSessions].sort((left, right) => {
    const leftUpdatedAt = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
    const rightUpdatedAt = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
    return rightUpdatedAt - leftUpdatedAt;
  });

  const latestLiveSession = sessionsByRecentUpdate.find((session) => session?.isLive);
  const latestScoredSession = sessionsByRecentUpdate.find((session) => {
    const score = Number(session?.score || 0);
    const outs = Number(session?.outs || 0);
    const result = String(session?.result || "").trim();
    return score > 0 || outs > 0 || Boolean(result);
  });
  const selectedSession =
    latestLiveSession || latestScoredSession || sessionsByRecentUpdate[0] || null;

  if (!selectedSession) {
    return null;
  }

  const matchId = getPublicId(selectedSession.match);
  const isLive = Boolean(selectedSession.isLive);

  return {
    sessionId: getPublicId(selectedSession._id),
    matchId,
    teamAName: selectedSession.teamAName || "Team A",
    teamBName: selectedSession.teamBName || "Team B",
    score: Number(selectedSession.score || 0),
    outs: Number(selectedSession.outs || 0),
    isLive,
    matchImageUrl: selectedSession.matchImageUrl || "",
    updatedAt: getIsoTimestamp(
      selectedSession.updatedAt,
      selectedSession.createdAt
    ),
  };
}

async function readDirectorSessionsList() {
  await connectDB();

  const sessions = await readVisibleSessionsWithMatches({
    createdAt: -1,
    _id: -1,
  });

  const fallbackMatchesBySessionId = await resolveSessionMatches(sessions);

  const mappedSessions = sessions
    .map((session) => {
      const resolvedMatch =
        session.match || fallbackMatchesBySessionId.get(String(session._id)) || null;
      const publicSession = serializePublicSession({
        ...session,
        match: resolvedMatch?._id || session.match,
      });
      const publicMatch = serializePublicMatch(resolvedMatch, session);

      return {
        session: publicSession,
        match: publicMatch,
        updatedAt: getIsoTimestamp(
          resolvedMatch?.updatedAt,
          session.updatedAt,
          session.createdAt
        ),
        isLive: Boolean(resolvedMatch?.isOngoing && !resolvedMatch?.result),
      };
    })
    .sort((left, right) => {
      if (left.isLive !== right.isLive) {
        return left.isLive ? -1 : 1;
      }

      return (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    });

  return mappedSessions;
}

export async function loadDirectorSessionsList() {
  return getCachedServerData(
    globalServerDataCache.directorSessions,
    readDirectorSessionsList
  );
}

export async function loadDirectorConsoleData() {
  const cookieStore = await cookies();
  const directorToken = cookieStore.get(getDirectorAccessCookieName())?.value;
  const authorized = hasValidDirectorAccess(directorToken);
  const sessions = authorized ? await loadDirectorSessionsList() : [];

  return {
    authorized,
    sessions,
  };
}


