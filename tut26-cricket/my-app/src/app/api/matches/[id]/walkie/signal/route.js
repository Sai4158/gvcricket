import { cookies } from "next/headers";
import { jsonError } from "../../../../../lib/api-response";
import { connectDB } from "../../../../../lib/db";
import {
  getDirectorAccessCookieName,
  hasValidDirectorAccess,
} from "../../../../../lib/director-access";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../../lib/match-access";
import { parseJsonRequest } from "../../../../../lib/request-security";
import { walkieSignalSchema } from "../../../../../lib/validators";
import { hasValidWalkieParticipantToken } from "../../../../../lib/walkie-auth";
import {
  dispatchPersistentWalkieSignal,
  registerPersistentWalkieParticipant,
} from "../../../../../lib/walkie-store";
import Match from "../../../../../../models/Match";

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

async function hasDirectorAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getDirectorAccessCookieName())?.value;
  return hasValidDirectorAccess(token);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const parsedRequest = await parseJsonRequest(req, walkieSignalSchema, {
    maxBytes: 140 * 1024,
  });

  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  await connectDB();
  const match = await Match.findById(id).select("_id adminAccessVersion");
  if (!match) {
    return jsonError("Match not found.", 404);
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

  const hasAccess = await hasMatchAccess(id, Number(match.adminAccessVersion || 1));
  if (!hasAccess && parsedRequest.value.role === "umpire") {
    return jsonError("Umpire access required.", 403);
  }

  if (parsedRequest.value.role === "director") {
    const hasAccess = await hasDirectorAccess();
    if (!hasAccess) {
      return jsonError("Director access required.", 403);
    }
  }

  const result = await dispatchPersistentWalkieSignal(id, {
    fromId: parsedRequest.value.participantId,
    toId: parsedRequest.value.toId,
    payload: parsedRequest.value.payload,
  });

  if (!result.ok) {
    return jsonError(result.message, result.status);
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
