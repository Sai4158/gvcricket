/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: ../../../../../docs/ONBOARDING.md
 */

import mongoose from "mongoose";
import { z } from "zod";
import Session from "../../../../models/Session";
import Match from "../../../../models/Match";
import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import { connectDB } from "../../../lib/db";
import { isValidManagePin } from "../../../lib/match-access";
import { enforceSmartPinRateLimit } from "../../../lib/pin-attempt-server";
import { getRequestMeta } from "../../../lib/request-meta";
import { parseJsonRequest } from "../../../lib/request-security";
import { secretPinSchema } from "../../../lib/validators";

const bulkDeleteSchema = z
  .object({
    sessionIds: z
      .array(z.string().regex(/^[a-f0-9]{24}$/i, "sessionIds is invalid."))
      .min(1)
      .max(15),
    pin: secretPinSchema,
  })
  .strict();

export async function POST(req) {
  const meta = getRequestMeta(req);
  const deleteLimit = enforceSmartPinRateLimit({
    key: `session-bulk-delete:${meta.ip}`,
    longLimit: 4,
    longWindowMs: 60 * 1000,
    longBlockMs: 60 * 1000,
  });

  if (!deleteLimit.allowed) {
    return jsonRateLimit(
      "Too many PIN attempts. Try again shortly.",
      deleteLimit.retryAfterMs,
    );
  }

  const parsedRequest = await parseJsonRequest(req, bulkDeleteSchema, {
    maxBytes: 8192,
  });
  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  if (!isValidManagePin(parsedRequest.value.pin)) {
    await writeAuditLog({
      action: "session_bulk_delete_denied",
      targetType: "session",
      targetId: "bulk",
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { requestedCount: parsedRequest.value.sessionIds.length },
    });

    return jsonError("Incorrect PIN.", 401);
  }

  try {
    await connectDB();
    const requestedSessionObjectIds = parsedRequest.value.sessionIds.map(
      (sessionId) => new mongoose.Types.ObjectId(sessionId),
    );

    const sessions = await Session.collection
      .find(
        {
          _id: { $in: requestedSessionObjectIds },
        },
        {
          projection: { _id: 1, match: 1 },
        },
      )
      .toArray();

    if (!sessions.length) {
      return Response.json(
        { ok: true, deletedSessionIds: [], deletedMatchIds: [] },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const deletedSessionIds = sessions.map((session) => String(session._id));
    const deletedMatchIds = sessions
      .map((session) => String(session.match || "").trim())
      .filter((matchId) => mongoose.Types.ObjectId.isValid(matchId));
    const deletedMatchObjectIds = deletedMatchIds.map(
      (matchId) => new mongoose.Types.ObjectId(matchId),
    );

    await Promise.all([
      deletedMatchObjectIds.length
        ? Match.collection.deleteMany({ _id: { $in: deletedMatchObjectIds } })
        : Promise.resolve(),
      Session.collection.deleteMany({ _id: { $in: requestedSessionObjectIds } }),
    ]);

    await writeAuditLog({
      action: "session_bulk_delete",
      targetType: "session",
      targetId: "bulk",
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        deletedSessionIds,
        deletedMatchIds,
      },
    });

    try {
      const { invalidateSessionsDataCache } = await import(
        "../../../lib/server-data"
      );
      invalidateSessionsDataCache();
    } catch (cacheError) {
      console.error("Bulk delete session cache invalidation failed:", cacheError);
    }

    try {
      const { publishMatchUpdate, publishSessionUpdate } = await import(
        "../../../lib/live-updates"
      );

      deletedMatchIds.forEach((matchId) => publishMatchUpdate(matchId));
      deletedSessionIds.forEach((sessionId) => publishSessionUpdate(sessionId));
    } catch (publishError) {
      console.error("Bulk delete live-update publish failed:", publishError);
    }

    return Response.json(
      {
        ok: true,
        deletedSessionIds,
        deletedMatchIds,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Session bulk delete failed:", error);
    await writeAuditLog({
      action: "session_bulk_delete",
      targetType: "session",
      targetId: "bulk",
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return jsonError("Could not delete the selected sessions.", 500);
  }
}


