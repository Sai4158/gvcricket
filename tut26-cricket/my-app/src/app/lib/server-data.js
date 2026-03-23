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

const SERVER_DATA_CACHE_TTL_MS = 15000;

const globalServerDataCache = globalThis.__gvServerDataCache || {
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

async function resolveSessionMatches(sessions) {
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
        sessionId: 1,
        tossWinner: 1,
        tossDecision: 1,
        matchImageUrl: 1,
      },
    },
    {
      $sort: { updatedAt: -1, _id: -1 },
    },
  ]);

  fallbackMatches.forEach((match) => {
    const sessionId = String(match.sessionId || "");
    if (sessionId && !resolvedBySessionId.has(sessionId)) {
      resolvedBySessionId.set(sessionId, match);
    }
  });

  return resolvedBySessionId;
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
    return Match.findById(session.match).lean();
  }

  return Match.findOne({ sessionId: session._id }).sort({ updatedAt: -1 }).lean();
}

async function readSessionsIndexData() {
  await connectDB();

  const sessions = (await Session.find()
    .populate({
      path: "match",
      select:
        "teamA teamB teamAName teamBName tossWinner tossDecision score outs innings innings1 innings2 isOngoing result _id updatedAt",
    })
    .sort({ createdAt: -1 }))
    .filter((session) => !session?.isDraft);

  const fallbackMatchesBySessionId = await resolveSessionMatches(sessions);

  return sessions.map((session) => {
    let resolvedMatch =
      session.match || fallbackMatchesBySessionId.get(String(session._id)) || null;
    if (resolvedMatch && !hasCompleteTossState(resolvedMatch, session)) {
      resolvedMatch = normalizeLegacyTossState(resolvedMatch, session);
    }
    const publicMatch = serializePublicMatch(resolvedMatch, session);

    return {
      ...serializePublicSession({
        ...(typeof session.toObject === "function" ? session.toObject() : session),
        tossWinner: resolvedMatch?.tossWinner || session.tossWinner || "",
        tossDecision: resolvedMatch?.tossDecision || session.tossDecision || "",
        match: resolvedMatch?._id || session.match,
      }),
      updatedAt: resolvedMatch?.updatedAt || session.updatedAt,
      isLive: resolvedMatch ? Boolean(resolvedMatch.isOngoing) : Boolean(session.isLive),
      result: resolvedMatch?.result || session.result || "",
      tossReady:
        publicMatch?.tossReady ||
        Boolean(
          (resolvedMatch?.tossWinner || session.tossWinner) &&
            (resolvedMatch?.tossDecision || session.tossDecision)
        ),
    };
  });
}

export async function loadSessionsIndexData() {
  return getCachedServerData(
    globalServerDataCache.sessionsIndex,
    readSessionsIndexData
  );
}

export async function loadSessionViewData(sessionId) {
  if (!isValidObjectId(sessionId)) {
    return { found: false, session: null, match: null, updatedAt: "" };
  }

  await connectDB();

  const session = await Session.findById(sessionId).lean();
  if (!session) {
    return { found: false, session: null, match: null, updatedAt: "" };
  }

  const match = await findMatchForSession(session);

  return {
    found: true,
    session: serializePublicSession(session),
    match: serializePublicMatch(match, session),
    updatedAt: new Date(match?.updatedAt || session.updatedAt || Date.now()).toISOString(),
  };
}

export async function loadPublicMatchData(matchId) {
  if (!isValidObjectId(matchId)) {
    return null;
  }

  await connectDB();
  const match = await Match.findById(matchId).lean();
  if (!match) {
    return null;
  }
  const fallbackSession =
    match.sessionId
      ? await Session.findById(match.sessionId)
          .select("tossWinner tossDecision teamAName teamBName teamA teamB")
          .lean()
      : null;
  return serializePublicMatch(match, fallbackSession);
}

export async function loadTossPageData(matchId) {
  if (!isValidObjectId(matchId)) {
    return {
      found: false,
      authStatus: "locked",
      match: null,
      sessionId: "",
      hasCreatedMatch: false,
      actualMatchId: "",
    };
  }

  await connectDB();
  const match = await Match.findById(matchId)
    .select("_id adminAccessVersion teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result innings1 innings2 balls matchImageUrl announcerEnabled announcerMode lastLiveEvent lastEventType lastEventText createdAt updatedAt actionHistory")
    .lean();

  if (match) {
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
        match: serializePublicMatch(match, null, {
          includeActionHistory: true,
        }),
        sessionId: String(match.sessionId || ""),
        hasCreatedMatch: true,
        actualMatchId: String(match._id),
    };
  }

  const session = await Session.findById(matchId)
    .select("_id name teamA teamB teamAName teamBName overs match isLive tossWinner matchImageUrl matchImagePublicId matchImageUploadedAt matchImageUploadedBy updatedAt createdAt")
    .lean();

  if (!session) {
    return {
      found: false,
      authStatus: "locked",
      match: null,
      sessionId: "",
      hasCreatedMatch: false,
      actualMatchId: "",
    };
  }

  if (session.match) {
    const linkedMatch = await Match.findById(session.match)
      .select("_id adminAccessVersion teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result innings1 innings2 balls matchImageUrl announcerEnabled announcerMode lastLiveEvent lastEventType lastEventText createdAt updatedAt actionHistory")
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
        sessionId: String(session._id),
        hasCreatedMatch: true,
        actualMatchId: String(linkedMatch._id),
      };
    }
  }

  return {
    found: true,
    authStatus: "granted",
    match: {
      _id: String(session._id),
      sessionId: String(session._id),
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
    sessionId: String(session._id),
    hasCreatedMatch: false,
    actualMatchId: "",
  };
}

export async function loadMatchAccessData(matchId) {
  if (!isValidObjectId(matchId)) {
    return { found: false, authStatus: "locked", match: null };
  }

  await connectDB();
  const match = await Match.findById(matchId)
    .select("_id adminAccessVersion teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result innings1 innings2 balls matchImageUrl announcerEnabled announcerMode lastLiveEvent lastEventType lastEventText createdAt updatedAt actionHistory")
    ;

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

  const fallbackSession =
    match && match.sessionId
      ? await Session.findById(match.sessionId).select(
          "tossWinner tossDecision teamAName teamBName teamA teamB"
        )
      : null;

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
  await connectDB();

  const match = (await Match.find({ isOngoing: true })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(12)
    .lean())
    .find((candidate) => !candidate?.result);

  if (!match) {
    return null;
  }

  const session = match.sessionId
    ? await Session.findById(match.sessionId).lean()
    : await Session.findOne({ match: match._id }).lean();

  if (!session || !match) {
    return null;
  }

  const teamAName =
    session.teamAName ||
    match.teamAName ||
    (Array.isArray(session.teamA) ? session.teamA[0] : "") ||
    (Array.isArray(match.teamA) ? match.teamA[0] : "") ||
    "Team A";
  const teamBName =
    session.teamBName ||
    match.teamBName ||
    (Array.isArray(session.teamB) ? session.teamB[0] : "") ||
    (Array.isArray(match.teamB) ? match.teamB[0] : "") ||
    "Team B";

  const publicMatch = serializePublicMatch(match, session);
  const publicSession = serializePublicSession(session);

  return {
    sessionId: String(session._id),
    matchId: String(match._id),
    teamAName,
    teamBName,
    score: Number(match.score || 0),
    outs: Number(match.outs || 0),
    matchImageUrl: publicMatch?.matchImageUrl || publicSession?.matchImageUrl || "",
    updatedAt: new Date(match.updatedAt || session.updatedAt || session.createdAt).toISOString(),
  };
}

async function readDirectorSessionsList() {
  await connectDB();

  const sessions = (await Session.find()
    .populate({
      path: "match",
      select:
        "teamA teamB teamAName teamBName score outs innings innings1 innings2 isOngoing result _id updatedAt sessionId matchImageUrl",
    })
    .sort({ createdAt: -1, _id: -1 }))
    .filter((session) => !session?.isDraft);

  const fallbackMatchesBySessionId = await resolveSessionMatches(sessions);

  const mappedSessions = sessions
    .map((session) => {
      const resolvedMatch =
        session.match || fallbackMatchesBySessionId.get(String(session._id)) || null;
      const publicSession = serializePublicSession({
        ...(typeof session.toObject === "function" ? session.toObject() : session),
        match: resolvedMatch?._id || session.match,
      });
      const publicMatch = serializePublicMatch(resolvedMatch, session);

      return {
        session: publicSession,
        match: publicMatch,
        updatedAt: new Date(
          resolvedMatch?.updatedAt ||
            session.updatedAt ||
            session.createdAt ||
            Date.now()
        ).toISOString(),
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
  await connectDB();

  const cookieStore = await cookies();
  const directorToken = cookieStore.get(getDirectorAccessCookieName())?.value;
  const authorized = hasValidDirectorAccess(directorToken);
  const sessions = await loadDirectorSessionsList();

  return {
    authorized,
    sessions,
  };
}
