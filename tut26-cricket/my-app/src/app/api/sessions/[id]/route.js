import { cookies } from "next/headers";
import Session from "../../../../models/Session";
import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import { connectDB } from "../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
  isValidUmpirePin,
} from "../../../lib/match-access";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import {
  validatePinPayload,
  validateSessionPatchPayload,
} from "../../../lib/validators";

async function requireAdminAccess(request, sessionId) {
  const cookieStore = await cookies();
  const body = await request.json().catch(() => null);
  const cookieName = getMatchAccessCookieName(sessionId);
  const token = cookieStore.get(cookieName)?.value;

  if (hasValidMatchAccess(sessionId, token)) {
    return { allowed: true, body };
  }

  const validation = validatePinPayload(body);
  if (!validation.ok) {
    return { allowed: false, body, reason: validation.message, status: 400 };
  }

  if (!isValidUmpirePin(validation.value.pin)) {
    return { allowed: false, body, reason: "Incorrect PIN.", status: 401 };
  }

  return { allowed: true, body };
}

export async function GET(_req, { params }) {
  await connectDB();
  const doc = await Session.findById(params.id);
  if (!doc) return jsonError("Session not found", 404);
  return Response.json(doc);
}

export async function PATCH(req, { params }) {
  try {
    const meta = getRequestMeta(req);
    const patchLimit = enforceRateLimit({
      key: `session-patch:${params.id}:${meta.ip}`,
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

    const access = await requireAdminAccess(req, params.id);
    if (!access.allowed) {
      await writeAuditLog({
        action: "session_patch_denied",
        targetType: "session",
        targetId: params.id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError(access.reason || "Admin access required.", access.status || 403);
    }

    const validation = validateSessionPatchPayload(access.body);
    if (!validation.ok) {
      return jsonError(validation.message, 400);
    }

    const changedFields = Object.keys(validation.value);
    const isMediaUpdate = changedFields.some(
      (field) =>
        field.toLowerCase().includes("image") ||
        field.toLowerCase().includes("media")
    );

    if (isMediaUpdate) {
      const mediaLimit = enforceRateLimit({
        key: `session-media:${params.id}:${meta.ip}`,
        limit: 5,
        windowMs: 60 * 1000,
        blockMs: 60 * 1000,
      });

      if (!mediaLimit.allowed) {
        return jsonRateLimit(
          "Too many media update attempts. Try again shortly.",
          mediaLimit.retryAfterMs
        );
      }
    }

    await connectDB();
    const updated = await Session.findByIdAndUpdate(params.id, validation.value, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return jsonError("Session not found", 404);
    }

    const action = isMediaUpdate ? "session_media_edit" : "session_patch";

    await writeAuditLog({
      action,
      targetType: "session",
      targetId: params.id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { fields: changedFields },
    });

    return Response.json(updated);
  } catch (error) {
    return jsonError("Patch failed", 500, { error: error.message });
  }
}
