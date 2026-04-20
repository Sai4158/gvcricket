/**
 * File overview:
 * Purpose: Provides the lightweight session index loader used by the hot `/api/sessions` path.
 * Main exports: loadSessionsIndexPageData plus shared paging constants.
 * Major callers: session list APIs and lightweight session-page loaders.
 * Side effects: none.
 * Read next: ./server-data.js
 */

import Session from "../../models/Session";
import { connectDB } from "./db";
import { serializeSessionCard } from "./public-data";
import { NON_DRAFT_SESSION_COLLECTION_FILTER } from "./server-data-helpers";

export const DEFAULT_SESSIONS_PAGE_LIMIT = 28;
export const MAX_SESSIONS_PAGE_LIMIT = 68;
export const DEFAULT_SESSIONS_SORT = "live-newest";
export const DEFAULT_SESSIONS_FILTER = "all";
const SESSIONS_INDEX_CACHE_TTL_MS = 15 * 1000;
const sessionsIndexCache = globalThis.__gvSessionsIndexCache || new Map();
if (!globalThis.__gvSessionsIndexCache) {
  globalThis.__gvSessionsIndexCache = sessionsIndexCache;
}

function getSessionsIndexCacheKey(type, options = {}) {
  return JSON.stringify({
    type,
    page: Number(options?.page || 1),
    limit: Number(options?.limit || DEFAULT_SESSIONS_PAGE_LIMIT),
    search: normalizeSearchValue(options?.search || ""),
    filter: String(options?.filter || DEFAULT_SESSIONS_FILTER).trim(),
    sort: String(options?.sort || DEFAULT_SESSIONS_SORT).trim(),
    includeCounts: options?.includeCounts !== false,
  });
}

async function readCachedSessionsIndex(cacheKey, loader, bypassCache = false) {
  const now = Date.now();
  const cachedEntry = sessionsIndexCache.get(cacheKey);

  if (!bypassCache && cachedEntry?.value && cachedEntry.expiresAt > now) {
    return cachedEntry.value;
  }

  if (!bypassCache && cachedEntry?.pending) {
    return cachedEntry.pending;
  }

  const pending = loader()
    .then((value) => {
      sessionsIndexCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + SESSIONS_INDEX_CACHE_TTL_MS,
        pending: null,
      });
      return value;
    })
    .catch((error) => {
      sessionsIndexCache.delete(cacheKey);
      throw error;
    });

  sessionsIndexCache.set(cacheKey, {
    value: cachedEntry?.value || null,
    expiresAt: cachedEntry?.expiresAt || 0,
    pending,
  });

  return pending;
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSessionsIndexQuery({
  search = "",
  filter = DEFAULT_SESSIONS_FILTER,
} = {}) {
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

function toSessionCard(session) {
  const imageCount = Math.max(
    Number(session?.sessionImageCount || 0),
    session?.matchImageUrl ? 1 : 0,
  );

  return serializeSessionCard({
    _id: String(session?._id || ""),
    name: session?.name || "",
    date: session?.date || "",
    isLive: Boolean(session?.isLive),
    match: session?.match ? String(session.match) : null,
    teamAName: session?.teamAName || "",
    teamBName: session?.teamBName || "",
    score: Number(session?.score || 0),
    outs: Number(session?.outs || 0),
    innings: session?.innings || "",
    result: session?.result || "",
    tossReady: Boolean(session?.tossWinner && session?.tossDecision),
    coverImageUrl: session?.matchImageUrl || "",
    matchImageUrl: session?.matchImageUrl || "",
    imageCount,
    winningTeamName: session?.winningTeamName || "",
    winningScore: Number(session?.winningScore || 0),
    winningWickets: Number(session?.winningWickets || 0),
    createdAt: session?.createdAt || null,
    updatedAt: session?.updatedAt || null,
  });
}

export async function loadSessionsIndexPageData(options = {}) {
  const cacheKey = getSessionsIndexCacheKey("cards", options);
  return readCachedSessionsIndex(
    cacheKey,
    async () => {
      await connectDB();

      const includeCounts = options?.includeCounts !== false;
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

      let totalCount = null;
      let unfilteredTotalCount = null;
      let totalPages = 1;

      if (includeCounts) {
        [totalCount, unfilteredTotalCount] = await Promise.all([
          Session.collection.countDocuments(query),
          Session.collection.countDocuments(NON_DRAFT_SESSION_COLLECTION_FILTER),
        ]);
        totalPages = totalCount > 0 ? Math.ceil(totalCount / normalizedLimit) : 1;
      }

      const page = includeCounts ? Math.min(requestedPage, totalPages) : requestedPage;
      const skip = Math.max(0, (page - 1) * normalizedLimit);

      const pageSessionsWithPeek = await Session.collection
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
            $limit: includeCounts ? normalizedLimit : normalizedLimit + 1,
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
              score: 1,
              outs: 1,
              innings: 1,
              result: 1,
              winningTeamName: 1,
              winningScore: 1,
              winningWickets: 1,
              teamAName: 1,
              teamBName: 1,
              sessionImageCount: 1,
              matchImageUrl: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ])
        .toArray();

      const hasPeekSession =
        !includeCounts && pageSessionsWithPeek.length > normalizedLimit;
      const pageSessions = includeCounts
        ? pageSessionsWithPeek
        : pageSessionsWithPeek.slice(0, normalizedLimit);

      return {
        sessions: pageSessions.map(toSessionCard),
        page,
        limit: normalizedLimit,
        totalCount: includeCounts ? Number(totalCount || 0) : null,
        totalPages: includeCounts
          ? totalPages
          : Math.max(1, page + (hasPeekSession ? 1 : 0)),
        unfilteredTotalCount: includeCounts ? Number(unfilteredTotalCount || 0) : null,
        hasNextPage: includeCounts ? page < totalPages : hasPeekSession,
        hasPreviousPage: page > 1,
        countsPending: !includeCounts,
      };
    },
    Boolean(options?.bypassCache),
  );
}

export async function loadSessionsIndexCounts(options = {}) {
  const cacheKey = getSessionsIndexCacheKey("counts", options);
  return readCachedSessionsIndex(
    cacheKey,
    async () => {
      await connectDB();

      const normalizedLimit = Math.min(
        MAX_SESSIONS_PAGE_LIMIT,
        Math.max(1, Number(options?.limit || DEFAULT_SESSIONS_PAGE_LIMIT)),
      );
      const requestedPage = Math.max(1, Number(options?.page || 1));
      const normalizedFilter = String(options?.filter || DEFAULT_SESSIONS_FILTER).trim();
      const normalizedSearch = normalizeSearchValue(options?.search || "");
      const query = buildSessionsIndexQuery({
        search: normalizedSearch,
        filter: normalizedFilter,
      });

      const [totalCount, unfilteredTotalCount] = await Promise.all([
        Session.collection.countDocuments(query),
        Session.collection.countDocuments(NON_DRAFT_SESSION_COLLECTION_FILTER),
      ]);
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / normalizedLimit) : 1;
      const page = Math.min(requestedPage, totalPages);

      return {
        page,
        limit: normalizedLimit,
        totalCount: Number(totalCount || 0),
        totalPages,
        unfilteredTotalCount: Number(unfilteredTotalCount || 0),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        countsPending: false,
      };
    },
    Boolean(options?.bypassCache),
  );
}
