import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import { buildSessionMirrorUpdate } from "../../../../lib/match-engine";
import { isValidManagePin } from "../../../../lib/match-access";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import { serializePublicMatch } from "../../../../lib/public-data";
import { enforceSmartPinRateLimit } from "../../../../lib/pin-attempt-server";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { parseJsonRequest } from "../../../../lib/request-security";
import { invalidateSessionsDataCache } from "../../../../lib/server-data";
import { secretPinPayloadSchema } from "../../../../lib/validators";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

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
    const parsedRequest = await parseJsonRequest(req, secretPinPayloadSchema, {
      maxBytes: 2048,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

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

    const fallbackSession = match.sessionId
      ? await Session.findById(match.sessionId).select(
          "tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy updatedAt",
        )
      : null;

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

    await writeAuditLog({
      action: "match_live_stream_delete",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(serializePublicMatch(match, fallbackSession), {
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
