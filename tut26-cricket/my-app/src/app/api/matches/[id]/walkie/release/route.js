import { jsonError } from "../../../../../lib/api-response";
import { parseJsonRequest } from "../../../../../lib/request-security";
import { walkieReleaseSchema } from "../../../../../lib/validators";
import { hasValidWalkieParticipantToken } from "../../../../../lib/walkie-auth";
import {
  hasRegisteredWalkieParticipant,
  registerWalkieParticipantFromToken,
  releaseWalkieSpeaker,
} from "../../../../../lib/walkie-talkie";

export async function POST(req, { params }) {
  const { id } = await params;
  const parsedRequest = await parseJsonRequest(req, walkieReleaseSchema, {
    maxBytes: 2048,
  });

  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
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

  const result = releaseWalkieSpeaker(id, parsedRequest.value);
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
