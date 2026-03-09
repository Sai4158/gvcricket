import { jsonError } from "../../../../../lib/api-response";
import { parseJsonRequest } from "../../../../../lib/request-security";
import { walkieReleaseSchema } from "../../../../../lib/validators";
import { hasValidWalkieParticipantToken } from "../../../../../lib/walkie-auth";
import { releaseWalkieSpeaker } from "../../../../../lib/walkie-talkie";

export async function POST(req, { params }) {
  const { id } = await params;
  const parsedRequest = await parseJsonRequest(req, walkieReleaseSchema, {
    maxBytes: 2048,
  });

  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
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
