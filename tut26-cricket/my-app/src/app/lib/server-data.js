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
import {
  serializePublicMatch,
  serializePublicSession,
  serializeSessionCard,
  serializeSessionViewBootstrap,
  serializeSessionViewHistory,
  serializeSessionViewMedia,
  serializeSessionViewSession,
  serializeUmpireBootstrap,
} from "./public-data";
import {
  finalizePendingResultIfExpired,
  isFinalizedMatchComplete,
} from "./pending-match-result";
import { getWinningTeamName } from "./match-result-display";
import {
  hasCompleteTossState,
  hydrateLegacyTossState,
  normalizeLegacyTossState,
} from "./match-toss";
import {
  buildLockedTossPageData,
  FALLBACK_SESSION_FIELDS,
  HOME_LIVE_BANNER_MATCH_PROJECTION,
  HOME_LIVE_BANNER_SESSION_PROJECTION,
  getIsoTimestamp,
  getPublicId,
  globalServerDataCache,
  invalidateSessionsDataCache,
  loadFallbackSession,
  NON_DRAFT_SESSION_COLLECTION_FILTER,
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

function getStableCreatedTimestamp(...values) {
  return getIsoTimestamp(...values);
}

function getStableCreatedTimeMs(value) {
  return new Date(value || 0).getTime();
}

function getStableSessionSortTimestamp(sessionDate, ...fallbacks) {
  const parsedSessionDate = new Date(String(sessionDate || ""));
  if (!Number.isNaN(parsedSessionDate.getTime())) {
    return parsedSessionDate.toISOString();
  }

  return getStableCreatedTimestamp(...fallbacks);
}

function getHomeLiveBannerMatchQueryOptions(limit = 1) {
  return {
    projection: HOME_LIVE_BANNER_MATCH_PROJECTION,
    sort: { updatedAt: -1, _id: -1 },
    limit,
  };
}

const DEFAULT_SESSIONS_PAGE_LIMIT = 28;
const MAX_SESSIONS_PAGE_LIMIT = 68;
const DEFAULT_SESSIONS_SORT = "live-newest";
const DEFAULT_SESSIONS_FILTER = "all";
const SESSION_VIEW_MATCH_FIELDS =
  "_id teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result pendingResult pendingResultAt resultAutoFinalizeAt innings1.team innings1.score innings2.team innings2.score balls matchImageUrl announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled walkieTalkieEnabled mediaUpdatedAt lastLiveEvent lastEventType lastEventText updatedAt";
const SESSION_VIEW_MATCH_DETAIL_FIELDS =
  "_id teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result pendingResult pendingResultAt resultAutoFinalizeAt innings1 innings2 balls matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy mediaUpdatedAt lastLiveEvent lastEventType lastEventText updatedAt";

function buildInningsWicketsProjection(historyFieldPath) {
  return {
    $reduce: {
      input: { $ifNull: [historyFieldPath, []] },
      initialValue: 0,
      in: {
        $add: [
          "$$value",
          {
            $size: {
              $filter: {
                input: { $ifNull: ["$$this.balls", []] },
                as: "ball",
                cond: { $eq: ["$$ball.isOut", true] },
              },
            },
          },
        ],
      },
    },
  };
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSessionsIndexQuery({ search = "", filter = DEFAULT_SESSIONS_FILTER } = {}) {
  const query = { ...NON_DRAFT_SESSION_COLLECTION_FILTER };
  const normalizedFilter = String(filter || DEFAULT_SESSIONS_FILTER).trim();
  const searchTerms = normalizeSearchValue(search).split(/\s+/).filter(Boolean);

  if (normalizedFilter === "live") {
    query.isLive = true;
  } else if (normalizedFilter === "completed") {
    query.isLive = false;
  }

  if (searchTerms.length) {
    query.$and = searchTerms.map((term) => {
      const pattern = new RegExp(escapeRegex(term), "i");
      return {
        $or: [
          { name: pattern },
          { teamAName: pattern },
          { teamBName: pattern },
          { date: pattern },
        ],
      };
    });
  }

  return query;
}

function getSessionsIndexSort(sortValue = DEFAULT_SESSIONS_SORT) {
  switch (String(sortValue || DEFAULT_SESSIONS_SORT).trim()) {
    case "newest":
      return { createdAt: -1, _id: -1 };
    case "oldest":
      return { createdAt: 1, _id: 1 };
    case "recent-ended":
      return { isLive: 1, createdAt: -1, _id: -1 };
    case "a-z":
      return { name: 1, createdAt: -1, _id: -1 };
    case "z-a":
      return { name: -1, createdAt: -1, _id: -1 };
    case "live-newest":
    default:
      return { isLive: -1, createdAt: -1, _id: -1 };
  }
}

async function getCachedServerData(cacheEntry, loader) {
  if (!cacheEntry) {
    return loader();
  }

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

async function findMatchForSession(
  session,
  fields = READ_ONLY_PUBLIC_MATCH_FIELDS,
) {
  if (!session) return null;

  if (session.match) {
    const match = await Match.findById(session.match).select(fields);
    return finalizePendingResultIfExpired(match);
  }

  const match = await Match.findOne({ sessionId: session._id })
    .select(fields)
    .sort({ updatedAt: -1 });
  return finalizePendingResultIfExpired(match);
}

async function resolveSessionsIndexCards(sessions) {
  const linkedMatchIds = sessions
    .map((session) => getPublicId(session.match))
    .filter((matchId) => isValidObjectId(matchId))
    .map((matchId) => new Types.ObjectId(matchId));
  const unresolvedSessionIds = sessions
    .filter((session) => !session.match)
    .map((session) => getPublicId(session._id))
    .filter((sessionId) => isValidObjectId(sessionId))
    .map((sessionId) => new Types.ObjectId(sessionId));

  const matchQuery = [];
  if (linkedMatchIds.length) {
    matchQuery.push({ _id: { $in: linkedMatchIds } });
  }
  if (unresolvedSessionIds.length) {
    matchQuery.push({ sessionId: { $in: unresolvedSessionIds } });
  }

  const relatedMatches = matchQuery.length
    ? await Match.collection
        .aggregate([
          {
            $match: matchQuery.length === 1 ? matchQuery[0] : { $or: matchQuery },
          },
          {
            $sort: { updatedAt: -1, createdAt: -1, _id: -1 },
          },
          {
            $project: {
              _id: 1,
              sessionId: 1,
              teamAName: 1,
              teamBName: 1,
              tossWinner: 1,
              tossDecision: 1,
              score: 1,
              outs: 1,
              innings: 1,
              isOngoing: 1,
              result: 1,
              pendingResult: 1,
              matchImageUrl: 1,
              innings1Team: "$innings1.team",
              innings1Score: "$innings1.score",
              innings1Wickets: buildInningsWicketsProjection("$innings1.history"),
              innings2Team: "$innings2.team",
              innings2Score: "$innings2.score",
              innings2Wickets: buildInningsWicketsProjection("$innings2.history"),
              createdAt: 1,
              updatedAt: 1,
              matchImageCount: {
                $size: {
                  $ifNull: ["$matchImages", []],
                },
              },
            },
          },
        ])
        .toArray()
    : [];

  const linkedMatchesById = new Map();
  const fallbackMatchesBySessionId = new Map();

  for (const match of relatedMatches) {
    const matchId = getPublicId(match._id);
    const sessionId = getPublicId(match.sessionId);

    if (matchId && !linkedMatchesById.has(matchId)) {
      linkedMatchesById.set(matchId, match);
    }

    if (sessionId && !fallbackMatchesBySessionId.has(sessionId)) {
      fallbackMatchesBySessionId.set(sessionId, match);
    }
  }

  return sessions.map((session) => {
    const linkedMatchId = getPublicId(session.match);
    let resolvedMatch =
      linkedMatchesById.get(linkedMatchId) ||
      fallbackMatchesBySessionId.get(getPublicId(session._id)) ||
      null;
    if (resolvedMatch && !hasCompleteTossState(resolvedMatch, session)) {
      resolvedMatch = normalizeLegacyTossState(resolvedMatch, session);
    }

    const coverImageUrl =
      resolvedMatch?.matchImageUrl || session.matchImageUrl || "";
    const resultText = resolvedMatch?.result || session.result || "";
    const winnerName = getWinningTeamName(resultText);
    const resultLower = String(resultText || "").toLowerCase();
    const firstInningsWon = resultLower.includes(" won by ") && resultLower.includes(" runs");
    const secondInningsWon =
      resultLower.includes(" won by ") && resultLower.includes(" wickets");
    const winningScore = firstInningsWon
      ? Number(resolvedMatch?.innings1Score || 0)
      : secondInningsWon
        ? Number(
            resolvedMatch?.innings2Score ??
              resolvedMatch?.score ??
              0
          )
        : Number(resolvedMatch?.score || 0);
    const winningWickets = firstInningsWon
      ? Number(resolvedMatch?.innings1Wickets || 0)
      : secondInningsWon
        ? Number(
            resolvedMatch?.innings2Wickets ??
              resolvedMatch?.outs ??
              0
          )
        : Number(resolvedMatch?.outs || 0);
    const imageCount = Math.max(
      Number(session?.sessionImageCount || 0),
      Number(resolvedMatch?.matchImageCount || 0),
      coverImageUrl ? 1 : 0,
    );

    return serializeSessionCard({
      _id: getPublicId(session._id),
      name: session.name || "",
      date: session.date || "",
      isLive: resolvedMatch ? Boolean(resolvedMatch.isOngoing) : Boolean(session.isLive),
      match: getPublicId(resolvedMatch?._id || session.match) || null,
      teamAName: resolvedMatch?.teamAName || session.teamAName || "",
      teamBName: resolvedMatch?.teamBName || session.teamBName || "",
      matchImageUrl: coverImageUrl,
      coverImageUrl,
      updatedAt: session.updatedAt || session.createdAt,
      createdAt: session.createdAt || null,
      score: Number(resolvedMatch?.score || 0),
      outs: Number(resolvedMatch?.outs || 0),
      innings: resolvedMatch?.innings || "",
      result: resolvedMatch?.result || session.result || "",
      winningTeamName:
        winnerName ||
        (firstInningsWon
          ? resolvedMatch?.innings1Team || ""
          : secondInningsWon
            ? resolvedMatch?.innings2Team || ""
            : ""),
      winningScore,
      winningWickets,
      tossReady:
        Boolean(
          (resolvedMatch?.tossWinner || session.tossWinner) &&
            (resolvedMatch?.tossDecision || session.tossDecision)
        ),
      imageCount,
    });
  });
}

async function readHomeLiveBannerData() {
  await connectDB();

  const [meaningfulLiveMatches, scoredMatches, liveMatches, latestSession] = await Promise.all([
    Match.collection.find(
      {
        isOngoing: true,
        $or: [
          { score: { $gt: 0 } },
          { outs: { $gt: 0 } },
          { lastEventType: { $exists: true, $nin: ["", null] } },
          { lastEventText: { $exists: true, $nin: ["", null] } },
        ],
      },
      getHomeLiveBannerMatchQueryOptions(8)
    ).toArray(),
    Match.collection.find(
      {
        $or: [
          { score: { $gt: 0 } },
          { outs: { $gt: 0 } },
          { result: { $exists: true, $nin: ["", null] } },
        ],
      },
      getHomeLiveBannerMatchQueryOptions(8)
    ).toArray(),
    Match.collection.find(
      {
        isOngoing: true,
      },
      getHomeLiveBannerMatchQueryOptions(8)
    ).toArray(),
    Session.collection.findOne(NON_DRAFT_SESSION_COLLECTION_FILTER, {
      projection: HOME_LIVE_BANNER_SESSION_PROJECTION,
      sort: { createdAt: -1, _id: -1 },
    }),
  ]);

  const candidateMatches = [...meaningfulLiveMatches, ...scoredMatches, ...liveMatches];
  const uniqueCandidateMatches = [];
  const seenMatchIds = new Set();

  for (const candidateMatch of candidateMatches) {
    const candidateMatchId = getPublicId(candidateMatch?._id);
    if (!candidateMatchId || seenMatchIds.has(candidateMatchId)) {
      continue;
    }

    seenMatchIds.add(candidateMatchId);
    uniqueCandidateMatches.push(candidateMatch);
  }

  const candidateSessionIds = uniqueCandidateMatches
    .map((match) => getPublicId(match?.sessionId))
    .filter((sessionId) => isValidObjectId(sessionId))
    .map((sessionId) => new Types.ObjectId(sessionId));

  const candidateSessions = candidateSessionIds.length
    ? await Session.collection
        .find(
          {
            ...NON_DRAFT_SESSION_COLLECTION_FILTER,
            _id: { $in: candidateSessionIds },
          },
          {
            projection: HOME_LIVE_BANNER_SESSION_PROJECTION,
          }
        )
        .toArray()
    : [];

  const sessionsById = new Map(
    candidateSessions.map((session) => [getPublicId(session._id), session])
  );

  const selectedMatch =
    uniqueCandidateMatches.find((candidateMatch) => {
      if (!candidateMatch) {
        return false;
      }

      if (!candidateMatch.isOngoing) {
        return Boolean(getPublicId(candidateMatch._id));
      }

      return sessionsById.has(getPublicId(candidateMatch.sessionId));
    }) || null;

  if (selectedMatch) {
    const fallbackSession =
      sessionsById.get(getPublicId(selectedMatch.sessionId)) ||
      (await loadFallbackSession(selectedMatch.sessionId, FALLBACK_SESSION_FIELDS));

    return {
      sessionId: getPublicId(selectedMatch.sessionId),
      matchId: getPublicId(selectedMatch._id),
      teamAName:
        selectedMatch.teamAName || fallbackSession?.teamAName || "Team A",
      teamBName:
        selectedMatch.teamBName || fallbackSession?.teamBName || "Team B",
      score: Number(selectedMatch.score || 0),
      outs: Number(selectedMatch.outs || 0),
      isLive: Boolean(selectedMatch.isOngoing),
      matchImageUrl:
        selectedMatch.matchImageUrl || fallbackSession?.matchImageUrl || "",
      updatedAt: getIsoTimestamp(
        selectedMatch.updatedAt,
        selectedMatch.createdAt,
        fallbackSession?.updatedAt
      ),
    };
  }

  if (!latestSession) {
    return null;
  }

  const latestSessionMatchId = getPublicId(latestSession.match);
  if (!latestSessionMatchId) {
    return null;
  }

  return {
    sessionId: getPublicId(latestSession._id),
    matchId: latestSessionMatchId,
    teamAName: latestSession.teamAName || "Team A",
    teamBName: latestSession.teamBName || "Team B",
    score: 0,
    outs: 0,
    isLive: false,
    matchImageUrl: latestSession.matchImageUrl || "",
    updatedAt: getIsoTimestamp(latestSession.updatedAt, latestSession.createdAt),
  };
}

export async function loadSessionsIndexPageData(options = {}) {
  await connectDB();

  const normalizedLimit = Math.min(
    MAX_SESSIONS_PAGE_LIMIT,
    Math.max(1, Number(options?.limit || DEFAULT_SESSIONS_PAGE_LIMIT)),
  );
  const requestedPage = Math.max(1, Number(options?.page || 1));
  const normalizedFilter = String(options?.filter || DEFAULT_SESSIONS_FILTER).trim();
  const normalizedSort = String(options?.sort || DEFAULT_SESSIONS_SORT).trim();
  const normalizedSearch = normalizeSearchValue(options?.search || "");
  const query = buildSessionsIndexQuery({
    search: normalizedSearch,
    filter: normalizedFilter,
  });
  const sort = getSessionsIndexSort(normalizedSort);

  const [totalCount, unfilteredTotalCount] = await Promise.all([
    Session.collection.countDocuments(query),
    Session.collection.countDocuments(NON_DRAFT_SESSION_COLLECTION_FILTER),
  ]);

  const totalPages = totalCount > 0 ? Math.ceil(totalCount / normalizedLimit) : 1;
  const page = Math.min(requestedPage, totalPages);
  const skip = Math.max(0, (page - 1) * normalizedLimit);

  const pageSessions = await Session.collection
    .aggregate([
      {
        $match: query,
      },
      {
        $sort: sort,
      },
      {
        $skip: skip,
      },
      {
        $limit: normalizedLimit,
      },
      {
        $project: {
          _id: 1,
          name: 1,
          date: 1,
          isLive: 1,
          match: 1,
          tossWinner: 1,
          tossDecision: 1,
          teamAName: 1,
          teamBName: 1,
          matchImageUrl: 1,
          createdAt: 1,
          updatedAt: 1,
          sessionImageCount: {
            $size: {
              $ifNull: ["$matchImages", []],
            },
          },
        },
      },
    ])
    .toArray();

  const sessions = await resolveSessionsIndexCards(pageSessions);

  return {
    sessions,
    page,
    limit: normalizedLimit,
    totalCount: Number(totalCount || 0),
    totalPages,
    unfilteredTotalCount: Number(unfilteredTotalCount || 0),
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
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

  const match = await findMatchForSession(session, SESSION_VIEW_MATCH_FIELDS);

  return {
    found: true,
    session: serializeSessionViewSession(session),
    match: serializeSessionViewBootstrap(match, session),
    updatedAt: getIsoTimestamp(match?.updatedAt, session.updatedAt),
  };
}

export async function loadSessionViewHistoryData(sessionId) {
  if (!isValidObjectId(sessionId)) {
    return { found: false, history: null, updatedAt: "" };
  }

  await connectDB();
  const session = await Session.findById(sessionId)
    .select(PUBLIC_SESSION_FIELDS)
    .lean();
  if (!session) {
    return { found: false, history: null, updatedAt: "" };
  }

  const match = await findMatchForSession(session, SESSION_VIEW_MATCH_DETAIL_FIELDS);
  return {
    found: true,
    history: serializeSessionViewHistory(match, session),
    updatedAt: getIsoTimestamp(match?.updatedAt, session.updatedAt),
  };
}

export async function loadSessionViewMediaData(sessionId) {
  if (!isValidObjectId(sessionId)) {
    return { found: false, media: null, updatedAt: "" };
  }

  await connectDB();
  const session = await Session.findById(sessionId)
    .select(PUBLIC_SESSION_FIELDS)
    .lean();
  if (!session) {
    return { found: false, media: null, updatedAt: "" };
  }

  const match = await findMatchForSession(session, SESSION_VIEW_MATCH_DETAIL_FIELDS);
  return {
    found: true,
    media: serializeSessionViewMedia(match, session),
    updatedAt: getIsoTimestamp(match?.updatedAt, session.updatedAt),
  };
}

export async function loadPublicMatchData(matchId) {
  if (!isValidObjectId(matchId)) {
    return null;
  }

  await connectDB();
  const match = await Match.findById(matchId).select(READ_ONLY_PUBLIC_MATCH_FIELDS);
  if (!match) {
    return null;
  }
  const finalizedMatch = await finalizePendingResultIfExpired(match);
  const fallbackSession = await loadFallbackSession(finalizedMatch.sessionId);
  return serializePublicMatch(finalizedMatch, fallbackSession);
}

export async function loadTossPageData(matchId) {
  if (!isValidObjectId(matchId)) {
    return buildLockedTossPageData();
  }

  await connectDB();
  const match = await Match.findById(matchId)
    .select(`adminAccessVersion ${READ_ONLY_PUBLIC_MATCH_FIELDS}`)
    .lean();

  if (match) {
    const finalizedMatch = await finalizePendingResultIfExpired(match);
    const fallbackSession = await loadFallbackSession(finalizedMatch.sessionId);
    const cookieStore = await cookies();
    const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
    const authorized = hasValidMatchAccess(
      matchId,
      token,
      Number(finalizedMatch.adminAccessVersion || 1)
    );

    return {
      found: true,
      authStatus: authorized ? "granted" : "locked",
      match: serializePublicMatch(finalizedMatch, fallbackSession),
      sessionId: getPublicId(finalizedMatch.sessionId),
      hasCreatedMatch: true,
      actualMatchId: getPublicId(finalizedMatch._id),
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
      .select(`adminAccessVersion ${READ_ONLY_PUBLIC_MATCH_FIELDS}`)
      .lean();

    if (linkedMatch) {
      const finalizedLinkedMatch = await finalizePendingResultIfExpired(linkedMatch);
      const cookieStore = await cookies();
      const token = cookieStore.get(getMatchAccessCookieName(String(finalizedLinkedMatch._id)))?.value;
      const authorized = hasValidMatchAccess(
        String(finalizedLinkedMatch._id),
        token,
        Number(finalizedLinkedMatch.adminAccessVersion || 1)
      );

      return {
        found: true,
        authStatus: authorized ? "granted" : "locked",
        match: serializePublicMatch(finalizedLinkedMatch, session),
        sessionId: getPublicId(session._id),
        hasCreatedMatch: true,
        actualMatchId: getPublicId(finalizedLinkedMatch._id),
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
    `adminAccessVersion ${READ_ONLY_PUBLIC_MATCH_FIELDS}`
  );

  if (!match) {
    return { found: false, authStatus: "locked", match: null };
  }
  const finalizedMatch = await finalizePendingResultIfExpired(match);

  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  const authorized = hasValidMatchAccess(
    matchId,
    token,
    Number(finalizedMatch.adminAccessVersion || 1)
  );

  const fallbackSession = await loadFallbackSession(finalizedMatch.sessionId);

  if (authorized && hydrateLegacyTossState(finalizedMatch, fallbackSession)) {
    await finalizedMatch.save();
  }

  return {
    found: true,
    authStatus: authorized ? "granted" : "locked",
    match: authorized ? serializeUmpireBootstrap(finalizedMatch, fallbackSession) : null,
  };
}

export async function loadHomeLiveBannerData() {
  return getCachedServerData(
    globalServerDataCache.homeLiveBanner,
    readHomeLiveBannerData
  );
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
        sortCreatedAt: getStableSessionSortTimestamp(
          publicSession.date,
          resolvedMatch?.createdAt,
          session.createdAt,
        ),
        updatedAt: getIsoTimestamp(
          resolvedMatch?.updatedAt,
          session.updatedAt,
          session.createdAt
        ),
        isLive: Boolean(
          resolvedMatch?.isOngoing && !isFinalizedMatchComplete(resolvedMatch)
        ),
      };
    })
    .sort((left, right) => {
      if (left.isLive !== right.isLive) {
        return left.isLive ? -1 : 1;
      }

      return getStableCreatedTimeMs(right.sortCreatedAt) -
        getStableCreatedTimeMs(left.sortCreatedAt);
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


