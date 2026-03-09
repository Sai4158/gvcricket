import Session from "../../../models/Session.js";
import { jsonError, jsonRateLimit } from "../../lib/api-response";
import { writeAuditLog } from "../../lib/audit-log";
import { connectDB } from "../../lib/db";
import { getRequestMeta } from "../../lib/request-meta";
import { enforceRateLimit } from "../../lib/rate-limit";
import { getTeamBundle } from "../../lib/team-utils";
import { validateSessionCreatePayload } from "../../lib/validators";

export async function POST(req) {
  try {
    const meta = getRequestMeta(req);
    const createLimit = enforceRateLimit({
      key: `session-create:${meta.ip}`,
      limit: 5,
      windowMs: 60 * 1000,
      blockMs: 60 * 1000,
    });

    if (!createLimit.allowed) {
      await writeAuditLog({
        action: "session_create_rate_limited",
        targetType: "session",
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { retryAfterMs: createLimit.retryAfterMs },
      });

      return jsonRateLimit(
        "Too many session creation attempts. Try again shortly.",
        createLimit.retryAfterMs
      );
    }

    const body = await req.json().catch(() => null);
    const validation = validateSessionCreatePayload(body);

    if (!validation.ok) {
      return jsonError(validation.message, 400);
    }

    await connectDB();
    const doc = await Session.create(validation.value);

    await writeAuditLog({
      action: "session_create",
      targetType: "session",
      targetId: String(doc._id),
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(doc, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    return new Response(
      JSON.stringify({
        message: "Could not create session",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET() {
  await connectDB();

  try {
    const sessions = await Session.find()
      .populate({
        path: "match",
        select:
          "teamA teamB teamAName teamBName score outs innings innings1 innings2 isOngoing result _id updatedAt",
      })
      .sort({ createdAt: -1 });

    const transformedSessions = sessions.map((session) => {
      const isLive = session.match ? session.match.isOngoing : false;
      const teamA = getTeamBundle(session, "teamA");
      const teamB = getTeamBundle(session, "teamB");

      return {
        _id: session._id,
        name: session.name,
        date: session.date || "",
        createdAt: session.createdAt,
        updatedAt: session.match?.updatedAt || session.updatedAt,
        match: session.match ? session.match._id : null,
        isLive,
        result: session.match ? session.match.result : session.result,
        teamA: teamA.players,
        teamB: teamB.players,
        teamAName: teamA.name,
        teamBName: teamB.name,
        overs: session.overs,
        isLiveSessionField: session.isLive,
      };
    });

    return new Response(JSON.stringify(transformedSessions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to retrieve sessions",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
