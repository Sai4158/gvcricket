import { cookies } from "next/headers";
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

async function resolveSessionMatches(sessions) {
  const resolvedBySessionId = new Map();
  const unresolvedSessionIds = sessions
    .filter((session) => !session.match?._id && !session.match)
    .map((session) => session._id);

  if (!unresolvedSessionIds.length) {
    return resolvedBySessionId;
  }

  const fallbackMatches = await Promise.all(
    unresolvedSessionIds.map((sessionId) =>
      Match.findOne({ sessionId })
        .select(
          "teamA teamB teamAName teamBName score outs innings innings1 innings2 isOngoing result _id updatedAt sessionId"
        )
        .sort({ updatedAt: -1 })
        .lean()
    )
  );

  fallbackMatches.filter(Boolean).forEach((match) => {
    const sessionId = String(match.sessionId || "");
    if (sessionId && !resolvedBySessionId.has(sessionId)) {
      resolvedBySessionId.set(sessionId, match);
    }
  });

  return resolvedBySessionId;
}

async function findMatchForSession(session) {
  if (!session) return null;

  if (session.match) {
    return Match.findById(session.match).lean();
  }

  return Match.findOne({ sessionId: session._id }).sort({ updatedAt: -1 }).lean();
}

export async function loadSessionsIndexData() {
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

export async function loadSessionViewData(sessionId) {
  await connectDB();

  const session = await Session.findById(sessionId).lean();
  if (!session) {
    return { session: null, match: null, updatedAt: "" };
  }

  const match = await findMatchForSession(session);

  return {
    session: serializePublicSession(session),
    match: serializePublicMatch(match, session),
    updatedAt: new Date(match?.updatedAt || session.updatedAt || Date.now()).toISOString(),
  };
}

export async function loadPublicMatchData(matchId) {
  await connectDB();
  const match = await Match.findById(matchId).lean();
  const fallbackSession =
    match && match.sessionId
      ? await Session.findById(match.sessionId)
          .select("tossWinner tossDecision teamAName teamBName teamA teamB")
          .lean()
      : null;
  return serializePublicMatch(match, fallbackSession);
}

export async function loadTossPageData(matchId) {
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
      authStatus: authorized ? "granted" : "locked",
      match: serializePublicMatch(match),
      sessionId: String(match.sessionId || ""),
      hasCreatedMatch: true,
      actualMatchId: String(match._id),
    };
  }

  const session = await Session.findById(matchId)
    .select("_id name teamA teamB teamAName teamBName overs match isLive tossWinner matchImageUrl matchImagePublicId matchImageUploadedAt matchImageUploadedBy updatedAt createdAt")
    .lean();

  if (!session) {
    return { authStatus: "locked", match: null, sessionId: "", hasCreatedMatch: false, actualMatchId: "" };
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
        authStatus: authorized ? "granted" : "locked",
        match: serializePublicMatch(linkedMatch, session),
        sessionId: String(session._id),
        hasCreatedMatch: true,
        actualMatchId: String(linkedMatch._id),
      };
    }
  }

  return {
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
  await connectDB();
  const match = await Match.findById(matchId)
    .select("_id adminAccessVersion teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result innings1 innings2 balls matchImageUrl announcerEnabled announcerMode lastLiveEvent lastEventType lastEventText createdAt updatedAt actionHistory")
    ;

  if (!match) {
    return { authStatus: "locked", match: null };
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
    authStatus: authorized ? "granted" : "locked",
    match: authorized ? serializePublicMatch(match, fallbackSession) : null,
  };
}

export async function loadHomeLiveBannerData() {
  await connectDB();

  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);

  const sessions = (await Session.find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(12)
    .lean())
    .filter((session) => !session?.isDraft);

  let session = null;
  let match = null;

  for (const candidate of sessions) {
    const createdAt = new Date(candidate.createdAt || 0);
    if (Number.isNaN(createdAt.getTime()) || createdAt < fiveHoursAgo) {
      continue;
    }

    const resolvedMatch = await findMatchForSession(candidate);
    if (resolvedMatch?.isOngoing && !resolvedMatch?.result) {
      session = candidate;
      match = resolvedMatch;
      break;
    }
  }

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

export async function loadDirectorSessionsList() {
  await connectDB();

  const sessions = (await Session.find()
    .populate({
      path: "match",
      select:
        "teamA teamB teamAName teamBName score outs innings innings1 innings2 isOngoing result _id updatedAt sessionId matchImageUrl",
    })
    .sort({ createdAt: -1, _id: -1 })
    .limit(16))
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
