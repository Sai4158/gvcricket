import { cookies } from "next/headers";
import Match from "../../models/Match";
import Session from "../../models/Session";
import { connectDB } from "./db";
import { getMatchAccessCookieName, hasValidMatchAccess } from "./match-access";
import { serializePublicMatch, serializePublicSession } from "./public-data";

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

  const sessions = await Session.find()
    .populate({
      path: "match",
      select:
        "teamA teamB teamAName teamBName score outs innings innings1 innings2 isOngoing result _id updatedAt",
    })
    .sort({ createdAt: -1 });

  const fallbackMatchesBySessionId = await resolveSessionMatches(sessions);

  return sessions.map((session) => {
    const resolvedMatch =
      session.match || fallbackMatchesBySessionId.get(String(session._id)) || null;

    return {
      ...serializePublicSession({
        ...(typeof session.toObject === "function" ? session.toObject() : session),
        match: resolvedMatch?._id || session.match,
      }),
      updatedAt: resolvedMatch?.updatedAt || session.updatedAt,
      isLive: resolvedMatch ? Boolean(resolvedMatch.isOngoing) : Boolean(session.isLive),
      result: resolvedMatch?.result || session.result || "",
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
    match: serializePublicMatch(match),
    updatedAt: new Date(match?.updatedAt || session.updatedAt || Date.now()).toISOString(),
  };
}

export async function loadPublicMatchData(matchId) {
  await connectDB();
  const match = await Match.findById(matchId).lean();
  return serializePublicMatch(match);
}

export async function loadTossPageData(matchId) {
  await connectDB();
  const match = await Match.findById(matchId)
    .select("_id adminAccessVersion teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result innings1 innings2 balls matchImageUrl announcerEnabled announcerMode lastLiveEvent lastEventType lastEventText createdAt updatedAt actionHistory")
    .lean();

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

  return {
    authStatus: authorized ? "granted" : "locked",
    match: serializePublicMatch(match),
  };
}

export async function loadMatchAccessData(matchId) {
  await connectDB();
  const match = await Match.findById(matchId)
    .select("_id adminAccessVersion teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result innings1 innings2 balls matchImageUrl announcerEnabled announcerMode lastLiveEvent lastEventType lastEventText createdAt updatedAt actionHistory")
    .lean();

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

  return {
    authStatus: authorized ? "granted" : "locked",
    match: authorized ? serializePublicMatch(match) : null,
  };
}
