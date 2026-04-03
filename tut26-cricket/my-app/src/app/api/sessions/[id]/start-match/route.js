import { NextResponse } from "next/server";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";
import { connectDB } from "../../../../lib/db";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { getMatchAccessCookie } from "../../../../lib/match-access";
import {
  applyStoredMatchImages,
  getStoredMatchImages,
  rebaseStoredMatchImagesForMatch,
} from "../../../../lib/match-image-gallery";
import { serializePublicMatch } from "../../../../lib/public-data";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { parseJsonRequest } from "../../../../lib/request-security";
import { hasValidDraftToken } from "../../../../lib/session-draft";
import { invalidateSessionsDataCache } from "../../../../lib/server-data";
import { setupMatchSchema } from "../../../../lib/validators";
import { z } from "zod";

const startMatchSchema = setupMatchSchema
  .extend({
    tossWinner: z.string().trim().min(1).max(80),
    tossDecision: z.enum(["bat", "bowl"]),
  })
  .strict();

export async function POST(req, { params }) {
  const { id: sessionId } = await params;
  const meta = getRequestMeta(req);
  let transactionSession;

  const startLimit = enforceRateLimit({
    key: `start-match:${sessionId}:${meta.ip}`,
    limit: 4,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!startLimit.allowed) {
    return jsonRateLimit(
      "Too many match start attempts. Try again shortly.",
      startLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, startMatchSchema, {
      maxBytes: 28 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();

    const {
      teamAName,
      teamAPlayers,
      teamBName,
      teamBPlayers,
      overs,
      tossWinner,
      tossDecision,
    } = parsedRequest.value;
    const battingFirst =
      tossDecision === "bat"
        ? tossWinner
        : tossWinner === teamAName
          ? teamBName
          : teamAName;
    const bowlingFirst = battingFirst === teamAName ? teamBName : teamAName;
    let sessionGalleryImages = [];

    let finalMatch = null;
    transactionSession = await Match.startSession();

    await transactionSession.withTransaction(async () => {
      const session = await Session.findById(sessionId).session(transactionSession);
      if (!session) {
        throw new Error("SESSION_NOT_FOUND");
      }

      if (session.isDraft && !hasValidDraftToken(session, parsedRequest.value.draftToken)) {
        throw new Error("DRAFT_ACCESS_DENIED");
      }

      sessionGalleryImages = getStoredMatchImages(session);

      const existingMatch = session.match
        ? await Match.findById(session.match).session(transactionSession)
        : null;

      if (existingMatch) {
        existingMatch.teamA = teamAPlayers;
        existingMatch.teamB = teamBPlayers;
        existingMatch.teamAName = teamAName;
        existingMatch.teamBName = teamBName;
        existingMatch.overs = overs;
        existingMatch.tossWinner = tossWinner;
        existingMatch.tossDecision = tossDecision;
        existingMatch.score = 0;
        existingMatch.outs = 0;
        existingMatch.isOngoing = true;
        existingMatch.innings = "first";
        existingMatch.result = "";
        existingMatch.balls = [];
        existingMatch.innings1 = {
          team: battingFirst,
          score: 0,
          history: [],
        };
        existingMatch.innings2 = {
          team: bowlingFirst,
          score: 0,
          history: [],
        };
        existingMatch.processedActionIds = [];
        existingMatch.actionHistory = [];
        existingMatch.lastLiveEvent = null;
        existingMatch.lastEventType = "";
        existingMatch.lastEventText = "";
        const existingMatchImages = rebaseStoredMatchImagesForMatch(
          String(existingMatch._id),
          sessionGalleryImages
        );
        applyStoredMatchImages(existingMatch, existingMatchImages, {
          matchId: String(existingMatch._id),
        });
        await existingMatch.save({ session: transactionSession });
        finalMatch = existingMatch;
      } else {
        [finalMatch] = await Match.create(
          [
            {
              teamA: teamAPlayers,
              teamB: teamBPlayers,
              teamAName,
              teamBName,
              overs,
              sessionId,
              tossWinner,
              tossDecision,
              isOngoing: true,
              innings: "first",
              score: 0,
              outs: 0,
              result: "",
              balls: [],
              matchImages: [],
              innings1: { team: battingFirst, score: 0, history: [] },
              innings2: { team: bowlingFirst, score: 0, history: [] },
            },
          ],
          { session: transactionSession }
        );
      }

      if (finalMatch) {
        const nextMatchImages = rebaseStoredMatchImagesForMatch(
          String(finalMatch._id),
          sessionGalleryImages
        );
        applyStoredMatchImages(finalMatch, nextMatchImages, {
          matchId: String(finalMatch._id),
        });
        await finalMatch.save({ session: transactionSession });
      }

      session.teamA = teamAPlayers;
      session.teamB = teamBPlayers;
      session.teamAName = teamAName;
      session.teamBName = teamBName;
      session.overs = overs;
      session.tossWinner = tossWinner;
      session.tossDecision = tossDecision;
      session.match = finalMatch._id;
      session.isLive = true;
      session.isDraft = false;
      session.draftTokenHash = "";
      await session.save({ session: transactionSession });
    });

    const response = NextResponse.json(
      { match: serializePublicMatch(finalMatch) },
      {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    });
    const matchCookie = getMatchAccessCookie(
      finalMatch._id,
      Number(finalMatch.adminAccessVersion || 1)
    );
    response.cookies.set(matchCookie.name, matchCookie.value, matchCookie.options);
    invalidateSessionsDataCache();
    publishMatchUpdate(finalMatch._id);
    publishSessionUpdate(sessionId);

    await writeAuditLog({
      action: "match_started_from_toss",
      targetType: "match",
      targetId: String(finalMatch._id),
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { sessionId },
    });

    return response;
  } catch (error) {
    if (error.message === "SESSION_NOT_FOUND") {
      return jsonError("Session not found.", 404);
    }

    if (error.message === "DRAFT_ACCESS_DENIED") {
      return jsonError("Draft access denied.", 403);
    }

    return jsonError("Could not start the match.", 500);
  } finally {
    if (transactionSession) {
      await transactionSession.endSession();
    }
  }
}
