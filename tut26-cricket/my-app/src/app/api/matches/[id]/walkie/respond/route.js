/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { jsonError } from "../../../../../lib/api-response";
import { connectDB } from "../../../../../lib/db";
import {
  getMatchAccessCookieName, hasValidMatchAccess,
} from "../../../../../lib/match-access";
import { parseJsonRequest } from "../../../../../lib/request-security";
import { walkieRespondSchema } from "../../../../../lib/validators";
import { respondToPersistentWalkieRequest } from "../../../../../lib/walkie-store";
import Match from "../../../../../../models/Match";

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const parsedRequest = await parseJsonRequest(req, walkieRespondSchema, {
    maxBytes: 2048,
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

  const hasAccess = await hasMatchAccess(id, Number(match.adminAccessVersion || 1));
  if (!hasAccess) {
    return jsonError("Umpire access required.", 403);
  }

  if (!match.isOngoing || match.result) {
    return jsonError("Walkie-talkie is only available during a live match.", 409);
  }

  const result = await respondToPersistentWalkieRequest(id, parsedRequest.value);
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


