import { NextResponse } from "next/server";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";
import { connectDB } from "../../../../lib/db";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { getMatchAccessCookie } from "../../../../lib/match-access";
import { serializePublicMatch } from "../../../../lib/public-data";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { parseJsonRequest } from "../../../../lib/request-security";
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

    let finalMatch = null;
    transactionSession = await Match.startSession();

    await transactionSession.withTransaction(async () => {
      const session = await Session.findById(sessionId).session(transactionSession);
      if (!session) {
        throw new Error("SESSION_NOT_FOUND");
      }

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
        existingMatch.isOngoing = true;
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
              innings1: { score: 0, history: [] },
              innings2: { score: 0, history: [] },
            },
          ],
          { session: transactionSession }
        );
      }

      session.teamA = teamAPlayers;
      session.teamB = teamBPlayers;
      session.teamAName = teamAName;
      session.teamBName = teamBName;
      session.overs = overs;
      session.tossWinner = tossWinner;
      session.match = finalMatch._id;
      session.isLive = true;
      await session.save({ session: transactionSession });
    });

    const response = NextResponse.json(serializePublicMatch(finalMatch), {
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

    return jsonError("Could not start the match.", 500);
  } finally {
    if (transactionSession) {
      await transactionSession.endSession();
    }
  }
}
