import { jsonError } from "../../../../../lib/api-response";
import { connectDB } from "../../../../../lib/db";
import { parseJsonRequest } from "../../../../../lib/request-security";
import { walkieReleaseSchema } from "../../../../../lib/validators";
import { hasValidWalkieParticipantToken } from "../../../../../lib/walkie-auth";
import {
  registerPersistentWalkieParticipant,
  releasePersistentWalkieSpeaker,
} from "../../../../../lib/walkie-store";

export async function POST(req, { params }) {
  const { id } = await params;
  const parsedRequest = await parseJsonRequest(req, walkieReleaseSchema, {
    maxBytes: 2048,
  });

  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  await connectDB();

  const hasValidToken = hasValidWalkieParticipantToken(
    parsedRequest.value.token,
    id,
    parsedRequest.value.participantId,
    parsedRequest.value.role
  );
  if (!hasValidToken) {
    return jsonError("Walkie participant token is invalid.", 403);
  }

  await registerPersistentWalkieParticipant(id, {
    id: parsedRequest.value.participantId,
    role: parsedRequest.value.role,
  });

  const result = await releasePersistentWalkieSpeaker(id, parsedRequest.value);
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
