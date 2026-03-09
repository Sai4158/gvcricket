import { cookies } from "next/headers";
import { z } from "zod";
import Session from "../../../../models/Session";
import Match from "../../../../models/Match";
import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import { connectDB } from "../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
  isValidUmpirePin,
} from "../../../lib/match-access";
import { serializePublicSession } from "../../../lib/public-data";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { parseJsonRequest } from "../../../lib/request-security";
import { pinSchema, sessionPatchObjectSchema } from "../../../lib/validators";

const sessionAdminPatchSchema = z
  .object({
    pin: pinSchema.optional(),
  })
  .extend(sessionPatchObjectSchema.shape)
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "pin"), {
    message: "No valid session fields provided.",
  });

async function hasSessionAdminAccess(session) {
  const matchId = session?.match ? String(session.match) : "";
  if (!matchId) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;

  return hasValidMatchAccess(
    matchId,
    token,
    Number(session.adminAccessVersion || 1)
  );
}

export async function GET(_req, { params }) {
  const { id } = await params;
  await connectDB();
  const session = await Session.findById(id);
  if (!session) {
    return jsonError("Session not found.", 404);
  }

  return Response.json(serializePublicSession(session), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const patchLimit = enforceRateLimit({
    key: `session-patch:${id}:${meta.ip}`,
    limit: 6,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!patchLimit.allowed) {
    return jsonRateLimit(
      "Too many admin update attempts. Try again shortly.",
      patchLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, sessionAdminPatchSchema, {
      maxBytes: 16 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();
    const session = await Session.findById(id);
    if (!session) {
      return jsonError("Session not found.", 404);
    }

    const hasCookieAccess = await hasSessionAdminAccess(session);
    const hasPinAccess = parsedRequest.value.pin
      ? isValidUmpirePin(parsedRequest.value.pin)
      : false;

    if (!hasCookieAccess && !hasPinAccess) {
      await writeAuditLog({
        action: "session_patch_denied",
        targetType: "session",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError("Admin access required.", 403);
    }

    const {
      pin: _pin,
      ...safePatch
    } = parsedRequest.value;

    Object.assign(session, safePatch);
    await session.save();

    if (session.match) {
      await Match.findByIdAndUpdate(session.match, {
        $set: {
          teamA: session.teamA,
          teamB: session.teamB,
          teamAName: session.teamAName,
          teamBName: session.teamBName,
          overs: session.overs,
          tossWinner: session.tossWinner,
          matchImageUrl: session.matchImageUrl,
          matchImagePublicId: session.matchImagePublicId,
          matchImageUploadedAt: session.matchImageUploadedAt,
          matchImageUploadedBy: session.matchImageUploadedBy,
          announcerEnabled: session.announcerEnabled,
          announcerMode: session.announcerMode,
          lastEventType: session.lastEventType,
          lastEventText: session.lastEventText,
          adminAccessVersion: session.adminAccessVersion,
        },
      });
    }

    await writeAuditLog({
      action: "session_patch",
      targetType: "session",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { fields: Object.keys(safePatch) },
    });

    return Response.json(serializePublicSession(session), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Could not update the session.", 500);
  }
}
