import { getTeamBundle } from "./team-utils";
import { getPublicMatchImagePath } from "./match-image-secure";
import { getPublicMatchImages } from "./match-image-gallery";
import { isSafeMatchImageUrl } from "./match-image";
import { hasCompleteTossState, normalizeLegacyTossState } from "./match-toss";

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
  const publicImages = getPublicMatchImages(match, {
    matchId: String(match._id || ""),
  });

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
    tossReady: hasCompleteTossState(match, fallbackState),
    balls: Array.isArray(match.balls) ? match.balls : [],
    matchImageUrl: publicImages[0]?.url || getPublicMatchImagePath(match),
    matchImages: publicImages,
    announcerEnabled: Boolean(match.announcerEnabled),
    announcerMode: match.announcerMode || "",
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
    lastEventType: session.lastEventType || "",
    lastEventText: session.lastEventText || "",
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
  };
}
