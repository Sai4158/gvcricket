import { cookies } from "next/headers";
import { jsonError } from "../../../../../lib/api-response";
import { connectDB } from "../../../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../../lib/match-access";
import { getRequestMeta } from "../../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../../lib/request-security";
import { walkieClaimSchema } from "../../../../../lib/validators";
import { hasValidWalkieParticipantToken } from "../../../../../lib/walkie-auth";
import { claimWalkieSpeaker } from "../../../../../lib/walkie-talkie";
import Match from "../../../../../../models/Match";

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const parsedRequest = await parseJsonRequest(req, walkieClaimSchema, {
    maxBytes: 4096,
  });

  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  await connectDB();
  const match = await Match.findById(id).select(
    "_id isOngoing result adminAccessVersion"
  );
  if (!match) {
    return jsonError("Match not found.", 404);
  }

  if (!match.isOngoing || match.result) {
    return jsonError("Walkie-talkie is only available during a live match.", 409);
  }

  if (
    !hasValidWalkieParticipantToken(
      parsedRequest.value.token,
      id,
      parsedRequest.value.participantId,
      parsedRequest.value.role
    )
  ) {
    return jsonError("Walkie participant token is invalid.", 403);
  }

  if (parsedRequest.value.role === "umpire") {
    const hasAccess = await hasMatchAccess(id, Number(match.adminAccessVersion || 1));
    if (!hasAccess) {
      return jsonError("Umpire access required.", 403);
    }
  }

  const result = claimWalkieSpeaker(id, parsedRequest.value);
  if (!result.ok) {
    return jsonError(result.message, result.status);
  }

  const meta = getRequestMeta(req);
  return Response.json(
    {
      ok: true,
      walkie: result.snapshot,
      participantIp: meta.ip,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
