import { getTeamBundle } from "./team-utils";

export function serializePublicMatch(matchDocument) {
  if (!matchDocument) return null;

  const match =
    typeof matchDocument.toObject === "function"
      ? matchDocument.toObject()
      : matchDocument;

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
    innings1: match.innings1 || { team: "", score: 0, history: [] },
    innings2: match.innings2 || { team: "", score: 0, history: [] },
    balls: Array.isArray(match.balls) ? match.balls : [],
    matchImageUrl: match.matchImageUrl || "",
    announcerEnabled: Boolean(match.announcerEnabled),
    announcerMode: match.announcerMode || "",
    lastLiveEvent: match.lastLiveEvent || null,
    lastEventType: match.lastEventType || "",
    lastEventText: match.lastEventText || "",
    undoCount: Array.isArray(match.actionHistory) ? match.actionHistory.length : 0,
    createdAt: match.createdAt || null,
    updatedAt: match.updatedAt || null,
  };
}

export function serializePublicSession(sessionDocument) {
  if (!sessionDocument) return null;

  const session =
    typeof sessionDocument.toObject === "function"
      ? sessionDocument.toObject()
      : sessionDocument;

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
    teamAName: teamA.name,
    teamBName: teamB.name,
    teamA: teamA.players,
    teamB: teamB.players,
    matchImageUrl: session.matchImageUrl || "",
    announcerEnabled: Boolean(session.announcerEnabled),
    announcerMode: session.announcerMode || "",
    lastEventType: session.lastEventType || "",
    lastEventText: session.lastEventText || "",
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
  };
}
