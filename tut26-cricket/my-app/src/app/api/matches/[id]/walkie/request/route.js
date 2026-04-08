/**
 * File overview:
 * Purpose: API route handler for Api requests.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: none.
 * Read next: ../../../../../../../docs/ONBOARDING.md
 */
import { jsonError } from "../../../../../lib/api-response";
import { connectDB } from "../../../../../lib/db";
import { parseJsonRequest } from "../../../../../lib/request-security";
import { walkieRequestSchema } from "../../../../../lib/validators";
import { hasValidWalkieParticipantToken } from "../../../../../lib/walkie-auth";
import {
  registerPersistentWalkieParticipant,
  requestPersistentWalkieEnable,
} from "../../../../../lib/walkie-store";
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
  if (!hasValidToken) {
    return jsonError("Walkie participant token is invalid.", 403);
  }

  await registerPersistentWalkieParticipant(id, {
    id: parsedRequest.value.participantId,
    role: parsedRequest.value.role,
  });

  const result = await requestPersistentWalkieEnable(id, parsedRequest.value);
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
