import { connectDB } from "../../../../lib/db";
import { NextResponse } from "next/server";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { getMatchAccessCookie } from "../../../../lib/match-access";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { buildTeamUpdate } from "../../../../lib/team-utils";
import { validateSetupMatchPayload } from "../../../../lib/validators";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

export async function POST(req, { params }) {
  const { id: sessionId } = params;
  let transactionSession;
  const meta = getRequestMeta(req);

  try {
    const setupLimit = enforceRateLimit({
      key: `setup-match:${sessionId}:${meta.ip}`,
      limit: 4,
      windowMs: 60 * 1000,
      blockMs: 60 * 1000,
    });

    if (!setupLimit.allowed) {
      await writeAuditLog({
        action: "match_setup_rate_limited",
        targetType: "session",
        targetId: sessionId,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { retryAfterMs: setupLimit.retryAfterMs },
      });

      return jsonRateLimit(
        "Too many match setup attempts. Try again shortly.",
        setupLimit.retryAfterMs
      );
    }

    await connectDB();
    const body = await req.json().catch(() => null);
    const validation = validateSetupMatchPayload(body);

    if (!validation.ok) {
      return jsonError(validation.message, 400);
    }

    const { teamAName, teamAPlayers, teamBName, teamBPlayers, overs } =
      validation.value;
    const normalizedTeamA = buildTeamUpdate(teamAName, teamAPlayers);
    const normalizedTeamB = buildTeamUpdate(teamBName, teamBPlayers);

    if (
      !normalizedTeamA.name ||
      !normalizedTeamB.name ||
      !normalizedTeamA.players.length ||
      !normalizedTeamB.players.length ||
      !overs ||
      !sessionId
    ) {
      return jsonError("Missing required fields.", 400);
    }

    let createdMatch = null;
    transactionSession = await Match.startSession();

    await transactionSession.withTransaction(async () => {
      const existingSession = await Session.findById(sessionId).session(
        transactionSession
      );

      if (!existingSession) {
        throw new Error("SESSION_NOT_FOUND");
      }

      [createdMatch] = await Match.create(
        [
          {
            teamA: normalizedTeamA.players,
            teamB: normalizedTeamB.players,
            teamAName: normalizedTeamA.name,
            teamBName: normalizedTeamB.name,
            overs,
            sessionId,
            isOngoing: true,
            innings1: { score: 0, history: [] },
            innings2: { score: 0, history: [] },
          },
        ],
        { session: transactionSession }
      );

      await Session.findByIdAndUpdate(
        sessionId,
        {
          $set: {
            match: createdMatch._id,
            teamA: normalizedTeamA.players,
            teamB: normalizedTeamB.players,
            teamAName: normalizedTeamA.name,
            teamBName: normalizedTeamB.name,
            overs,
            isLive: true,
          },
        },
        { new: true, session: transactionSession }
      );
    });

    const response = NextResponse.json(createdMatch, { status: 201 });
    const matchCookie = getMatchAccessCookie(createdMatch._id);
    response.cookies.set(matchCookie.name, matchCookie.value, matchCookie.options);

    await writeAuditLog({
      action: "match_setup",
      targetType: "match",
      targetId: String(createdMatch._id),
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { sessionId },
    });

    return response;
  } catch (error) {
    if (error.message === "SESSION_NOT_FOUND") {
      return jsonError("Session not found", 404);
    }

    console.error("Error setting up match:", error);
    return jsonError("Error setting up match", 500, { error: error.message });
  } finally {
    if (transactionSession) {
      await transactionSession.endSession();
    }
  }
}
