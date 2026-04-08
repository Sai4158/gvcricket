/**
 * File overview:
 * Purpose: API route handler for Api requests.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../../../docs/ONBOARDING.md
 */
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
import { hasValidWalkieParticipantToken } from "../../../../../lib/walkie-auth";
import Match from "../../../../../../models/Match";

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getIceServers() {
  const stunUrls = splitCsv(process.env.WALKIE_STUN_URLS).length
    ? splitCsv(process.env.WALKIE_STUN_URLS)
    : ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"];
  const turnUrls = splitCsv(process.env.WALKIE_TURN_URLS);
  const username = String(process.env.WALKIE_TURN_USERNAME || "").trim();
  const credential = String(process.env.WALKIE_TURN_CREDENTIAL || "").trim();

  const iceServers = [{ urls: stunUrls }];
  if (turnUrls.length && username && credential) {
    iceServers.push({
      urls: turnUrls,
      username,
      credential,
    });
  }

  return iceServers;
}

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

export async function GET(request, { params }) {
  const { id } = await params;
  const role = request.nextUrl.searchParams.get("role") || "";
  const participantId = request.nextUrl.searchParams.get("participantId") || "";
  const token = request.nextUrl.searchParams.get("token") || "";

  if (!["umpire", "spectator", "director"].includes(role) || !participantId) {
    return jsonError("Invalid walkie participant.", 400);
  }

  await connectDB();
  const match = await Match.findById(id).select("_id adminAccessVersion");
  if (!match) {
    return jsonError("Match not found.", 404);
  }

  const hasValidToken = hasValidWalkieParticipantToken(token, id, participantId, role);
  if (!hasValidToken) {
    return jsonError("Walkie participant token is invalid.", 403);
  }

  if (role === "umpire") {
    const hasAccess = await hasMatchAccess(id, Number(match.adminAccessVersion || 1));
    if (!hasAccess) {
      return jsonError("Umpire access required.", 403);
    }
  }

  if (role === "director") {
    const hasAccess = await hasDirectorAccess();
    if (!hasAccess) {
      return jsonError("Director access required.", 403);
    }
  }

  return Response.json(
    { iceServers: getIceServers() },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
