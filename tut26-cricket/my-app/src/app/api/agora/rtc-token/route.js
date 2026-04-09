/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { z } from "zod";
import { jsonError } from "../../../lib/api-response";
import { createAgoraRtcToken } from "../../../lib/agora";
import {
  getDirectorAccessCookieName,
  hasValidDirectorAccess,
} from "../../../lib/director-access";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../lib/match-access";
import { parseJsonRequest } from "../../../lib/request-security";
import { getCachedWalkieMatch } from "../../../lib/walkie-match-cache";

const schema = z
  .object({
    matchId: z.string().min(12).max(80),
    participantId: z
      .string()
      .min(8)
      .max(80)
      .regex(/^[a-zA-Z0-9._:-]+$/, "participantId is invalid."),
    rtcSessionId: z
      .string()
      .min(4)
      .max(32)
      .regex(/^[a-zA-Z0-9._:-]+$/, "rtcSessionId is invalid.")
      .optional(),
    role: z.enum(["umpire", "spectator", "director"]),
  })
  .strict();

async function hasUmpireAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

async function hasDirectorAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getDirectorAccessCookieName())?.value;
  return hasValidDirectorAccess(token);
}

export async function POST(req) {
  const parsedRequest = await parseJsonRequest(req, schema, {
    maxBytes: 4096,
  });

  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  const match = await getCachedWalkieMatch(parsedRequest.value.matchId);

  if (!match) {
    return jsonError("Match not found.", 404);
  }

  if (!match.isOngoing || match.result) {
    return jsonError("Walkie-talkie is only available during a live match.", 409);
  }

  if (parsedRequest.value.role === "umpire") {
    const authorized = await hasUmpireAccess(
      parsedRequest.value.matchId,
      Number(match.adminAccessVersion || 1)
    );
    if (!authorized) {
      return jsonError("Umpire access required.", 403);
    }
  }

  if (parsedRequest.value.role === "director") {
    const authorized = await hasDirectorAccess();
    if (!authorized) {
      return jsonError("Director access required.", 403);
    }
  }

  return Response.json(
    createAgoraRtcToken(parsedRequest.value),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}


