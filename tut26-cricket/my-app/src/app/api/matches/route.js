import { z } from "zod";
import { jsonError, jsonRateLimit } from "../../lib/api-response";
import { writeAuditLog } from "../../lib/audit-log";
import { connectDB } from "../../lib/db";
import { serializePublicMatch } from "../../lib/public-data";
import { getRequestMeta } from "../../lib/request-meta";
import { enforceRateLimit } from "../../lib/rate-limit";
import { parseJsonRequest } from "../../lib/request-security";
import { buildTeamUpdate } from "../../lib/team-utils";
import { oversSchema } from "../../lib/validators";
import Match from "../../../models/Match";

const createMatchSchema = z
  .object({
    sessionId: z.string().regex(/^[a-f0-9]{24}$/i, "sessionId is invalid."),
    teamAName: z.string().min(1).max(80),
    teamBName: z.string().min(1).max(80),
    teamA: z.array(z.string().min(1).max(48)).min(1).max(15),
    teamB: z.array(z.string().min(1).max(48)).min(1).max(15),
    overs: oversSchema,
  })
  .strict();

export async function POST(req) {
  const meta = getRequestMeta(req);
  const createLimit = enforceRateLimit({
    key: `match-create:${meta.ip}`,
    limit: 3,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!createLimit.allowed) {
    return jsonRateLimit(
      "Too many match creation attempts. Try again shortly.",
      createLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, createMatchSchema, {
      maxBytes: 24 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();

    const normalizedTeamA = buildTeamUpdate(
      parsedRequest.value.teamAName,
      parsedRequest.value.teamA
    );
    const normalizedTeamB = buildTeamUpdate(
      parsedRequest.value.teamBName,
      parsedRequest.value.teamB
    );

    const newMatch = await Match.create({
      teamA: normalizedTeamA.players,
      teamB: normalizedTeamB.players,
      teamAName: normalizedTeamA.name,
      teamBName: normalizedTeamB.name,
      overs: parsedRequest.value.overs,
      sessionId: parsedRequest.value.sessionId,
      isOngoing: true,
      innings1: {
        score: 0,
        history: [],
      },
      innings2: {
        score: 0,
        history: [],
      },
    });

    await writeAuditLog({
      action: "match_create_direct",
      targetType: "match",
      targetId: String(newMatch._id),
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(serializePublicMatch(newMatch), {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Could not create the match.", 500);
  }
}

export async function GET() {
  try {
    await connectDB();
    const matches = await Match.find().sort({ createdAt: -1 });

    return Response.json(matches.map((match) => serializePublicMatch(match)), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Could not load matches.", 500);
  }
}
