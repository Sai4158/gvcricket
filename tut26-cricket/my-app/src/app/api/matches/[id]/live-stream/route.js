import { cookies } from "next/headers";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import {
  getDirectorAccessCookieName,
  hasValidDirectorAccess,
} from "../../../../lib/director-access";
import { buildSessionMirrorUpdate } from "../../../../lib/match-engine";
import { isValidManagePin } from "../../../../lib/match-access";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import { serializePublicMatch } from "../../../../lib/public-data";
import { enforceSmartPinRateLimit } from "../../../../lib/pin-attempt-server";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { parseJsonRequest } from "../../../../lib/request-security";
import { invalidateSessionsDataCache } from "../../../../lib/server-data";
import { normalizeYouTubeLiveStream } from "../../../../lib/youtube-live-stream";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";
import { z } from "zod";

const liveStreamUpsertSchema = z.object({
  pin: z.string().trim().optional(),
  liveStreamUrl: z.string().trim().min(1, "Enter a YouTube link."),
});

const optionalPinSchema = z.object({
  pin: z.string().trim().optional(),
});

async function hasDirectorRouteAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getDirectorAccessCookieName())?.value;
  return hasValidDirectorAccess(token);
}

async function getFallbackSession(sessionId) {
  return sessionId
    ? Session.findById(sessionId).select(
        "tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy updatedAt",
      )
    : null;
}

async function saveAndPublish(match, fallbackSessionPromise) {
  const fallbackSession = await fallbackSessionPromise;

  await Promise.all([
    match.save(),
    Session.findByIdAndUpdate(
      match.sessionId,
      {
        $set: buildSessionMirrorUpdate(match),
      },
      {
        timestamps: false,
      },
    ),
  ]);

  invalidateSessionsDataCache();
  publishMatchUpdate(match._id);
  publishSessionUpdate(match.sessionId);

  return serializePublicMatch(match, fallbackSession);
}

export async function PUT(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const updateLimit = enforceRateLimit({
    key: `match-live-stream-put:${id}:${meta.ip}`,
    limit: 8,
    windowMs: 5 * 60 * 1000,
    blockMs: 2 * 60 * 1000,
  });

  if (!updateLimit.allowed) {
    return jsonRateLimit(
      "Too many live stream update attempts. Try again shortly.",
      updateLimit.retryAfterMs,
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, liveStreamUpsertSchema, {
      maxBytes: 8 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    const directorAccessGranted = await hasDirectorRouteAccess();

    if (!directorAccessGranted) {
      const pinAttemptLimit = enforceSmartPinRateLimit({
        key: `match-live-stream-put-pin:${id}:${meta.ip}`,
        longLimit: 5,
        longWindowMs: 5 * 60 * 1000,
        longBlockMs: 2 * 60 * 1000,
      });

      if (!pinAttemptLimit.allowed) {
        return jsonRateLimit(
          "Too many PIN attempts. Try again shortly.",
          pinAttemptLimit.retryAfterMs,
        );
      }

      if (!/^\d{6}$/.test(String(parsedRequest.value.pin || ""))) {
        return jsonError("Enter the 6-digit manage PIN.", 400);
      }

      if (!isValidManagePin(parsedRequest.value.pin)) {
        await writeAuditLog({
          action: "match_live_stream_put_denied",
          targetType: "match",
          targetId: id,
          status: "failure",
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        return jsonError("Incorrect PIN.", 401);
      }
    }

    const normalizedStream = normalizeYouTubeLiveStream(
      parsedRequest.value.liveStreamUrl,
    );
    if (!normalizedStream.ok) {
      return jsonError(normalizedStream.message, 400);
    }

    await connectDB();
    const match = await Match.findById(id);
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    match.liveStream = {
      ...normalizedStream.value,
      updatedAt: new Date().toISOString(),
    };
    match.lastEventType = "live_stream_update";
    match.lastEventText = "Live stream updated.";
    match.lastLiveEvent = {
      id: `live-stream-update-${Date.now()}`,
      type: "live_stream_update",
      summaryText: "Live stream updated.",
      createdAt: new Date().toISOString(),
    };

    const responseBody = await saveAndPublish(
      match,
      getFallbackSession(match.sessionId),
    );

    await writeAuditLog({
      action: "match_live_stream_put",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(responseBody, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await writeAuditLog({
      action: "match_live_stream_put",
      targetType: "match",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { message: error?.message || "Unknown error" },
    });

    return jsonError("Failed to update the live stream.", 500);
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const deleteLimit = enforceRateLimit({
    key: `match-live-stream-delete:${id}:${meta.ip}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
    blockMs: 2 * 60 * 1000,
  });

  if (!deleteLimit.allowed) {
    return jsonRateLimit(
      "Too many live stream removal attempts. Try again shortly.",
      deleteLimit.retryAfterMs,
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, optionalPinSchema, {
      maxBytes: 2048,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    const directorAccessGranted = await hasDirectorRouteAccess();

    if (!directorAccessGranted) {
      const pinAttemptLimit = enforceSmartPinRateLimit({
        key: `match-live-stream-delete-pin:${id}:${meta.ip}`,
        longLimit: 5,
        longWindowMs: 5 * 60 * 1000,
        longBlockMs: 2 * 60 * 1000,
      });

      if (!pinAttemptLimit.allowed) {
        return jsonRateLimit(
          "Too many PIN attempts. Try again shortly.",
          pinAttemptLimit.retryAfterMs,
        );
      }

      if (!/^\d{6}$/.test(String(parsedRequest.value.pin || ""))) {
        return jsonError("Enter the 6-digit manage PIN.", 400);
      }

      if (!isValidManagePin(parsedRequest.value.pin)) {
        await writeAuditLog({
          action: "match_live_stream_delete_denied",
          targetType: "match",
          targetId: id,
          status: "failure",
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        return jsonError("Incorrect PIN.", 401);
      }
    }

    await connectDB();
    const match = await Match.findById(id);
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    match.liveStream = null;
    match.lastEventType = "live_stream_update";
    match.lastEventText = "Live stream removed.";
    match.lastLiveEvent = {
      id: `live-stream-remove-${Date.now()}`,
      type: "live_stream_update",
      summaryText: "Live stream removed.",
      createdAt: new Date().toISOString(),
    };

    const responseBody = await saveAndPublish(
      match,
      getFallbackSession(match.sessionId),
    );

    await writeAuditLog({
      action: "match_live_stream_delete",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(responseBody, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await writeAuditLog({
      action: "match_live_stream_delete",
      targetType: "match",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { message: error?.message || "Unknown error" },
    });

    return jsonError("Failed to remove the live stream.", 500);
  }
}
