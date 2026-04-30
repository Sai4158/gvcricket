/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { jsonError } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { getRequestMeta } from "../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../lib/request-security";
import { walkieToggleSchema } from "../../../../lib/validators";
import {
  getPersistentWalkieSnapshot,
  setPersistentWalkieEnabled,
} from "../../../../lib/walkie-store";
import Match from "../../../../../models/Match";

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);

  try {
    const parsedRequest = await parseJsonRequest(req, walkieToggleSchema);
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();
    const match = await Match.findById(id);
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

    const { enabled } = parsedRequest.value;
    const snapshot = await setPersistentWalkieEnabled(id, enabled);

    await writeAuditLog({
      action: enabled ? "walkie_enabled" : "walkie_disabled",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(
      {
        walkie: snapshot,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Walkie toggle failed:", error);
    return jsonError("Could not update walkie-talkie.", 500);
  }
}

export async function GET(_req, { params }) {
  const { id } = await params;
  await connectDB();
  const match = await Match.findById(id).select("_id");
  if (!match) {
    return jsonError("Match not found.", 404);
  }

  const { snapshot } = await getPersistentWalkieSnapshot(id);
  return Response.json(
    {
      walkie: snapshot,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}


