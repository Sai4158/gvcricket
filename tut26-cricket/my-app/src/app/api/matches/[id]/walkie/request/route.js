import { jsonError } from "../../../../../lib/api-response";
import { connectDB } from "../../../../../lib/db";
import { parseJsonRequest } from "../../../../../lib/request-security";
import { walkieRequestSchema } from "../../../../../lib/validators";
import { hasValidWalkieParticipantToken } from "../../../../../lib/walkie-auth";
import {
  hasRegisteredWalkieParticipant,
  registerWalkieParticipantFromToken,
  requestWalkieEnable,
} from "../../../../../lib/walkie-talkie";
import Match from "../../../../../../models/Match";

export async function POST(req, { params }) {
  const { id } = await params;
  const parsedRequest = await parseJsonRequest(req, walkieRequestSchema, {
    maxBytes: 2048,
  });

  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  await connectDB();
  const match = await Match.findById(id).select(
    "_id isOngoing result"
  );
  if (!match) {
    return jsonError("Match not found.", 404);
  }

  if (!match.isOngoing || match.result) {
    return jsonError("Walkie-talkie is only available during a live match.", 409);
  }

  const hasValidToken = hasValidWalkieParticipantToken(
    parsedRequest.value.token,
    id,
    parsedRequest.value.participantId,
    parsedRequest.value.role
  );
  const hasRegisteredParticipant = hasRegisteredWalkieParticipant(
    id,
    parsedRequest.value.participantId,
    parsedRequest.value.role
  );

  if (!hasValidToken && !hasRegisteredParticipant) {
    return jsonError("Walkie participant token is invalid.", 403);
  }

  if (hasValidToken && !hasRegisteredParticipant) {
    registerWalkieParticipantFromToken(id, {
      id: parsedRequest.value.participantId,
      role: parsedRequest.value.role,
    });
  }

  const result = requestWalkieEnable(id, parsedRequest.value);
  if (!result.ok) {
    return jsonError(result.message, result.status);
  }

  return Response.json(
    {
      ok: true,
      walkie: result.snapshot,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
