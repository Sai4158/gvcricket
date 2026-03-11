import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { serializePublicSession } from "../../../../lib/public-data";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { parseJsonRequest } from "../../../../lib/request-security";
import { buildTeamUpdate } from "../../../../lib/team-utils";
import { setupMatchSchema } from "../../../../lib/validators";
import Session from "../../../../../models/Session";

export async function POST(req, { params }) {
  const { id: sessionId } = await params;
  const meta = getRequestMeta(req);

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

  try {
    const parsedRequest = await parseJsonRequest(req, setupMatchSchema, {
      maxBytes: 24 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();

    const { teamAName, teamAPlayers, teamBName, teamBPlayers, overs } =
      parsedRequest.value;
    const normalizedTeamA = buildTeamUpdate(teamAName, teamAPlayers);
    const normalizedTeamB = buildTeamUpdate(teamBName, teamBPlayers);
    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          teamA: normalizedTeamA.players,
          teamB: normalizedTeamB.players,
          teamAName: normalizedTeamA.name,
          teamBName: normalizedTeamB.name,
          overs,
        },
      },
      { new: true }
    );

    if (!updatedSession) {
      throw new Error("SESSION_NOT_FOUND");
    }

    const response = NextResponse.json(serializePublicSession(updatedSession), {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    });

    await writeAuditLog({
      action: "session_setup_draft",
      targetType: "session",
      targetId: String(updatedSession._id),
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

    return jsonError("Could not save the match setup.", 500);
  }
}
