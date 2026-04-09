/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: runtime.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: none.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import crypto from "node:crypto";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import {
  buildInlineMatchImageDataUrl,
  validateMatchImageBuffer,
} from "../../../../lib/match-image";
import {
  applyStoredMatchImages,
  createStoredMatchImageEntry,
} from "../../../../lib/match-image-gallery";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { parseMultipartRequest } from "../../../../lib/request-security";
import { hasValidDraftToken } from "../../../../lib/session-draft";
import { invalidateSessionsDataCache } from "../../../../lib/server-data";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const uploadLimit = enforceRateLimit({
    key: `session-image:${id}:${meta.ip}`,
    limit: 4,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!uploadLimit.allowed) {
    await writeAuditLog({
      action: "session_media_rate_limited",
      targetType: "session",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { retryAfterMs: uploadLimit.retryAfterMs },
    });

    return jsonRateLimit(
      "Too many image uploads. Try again shortly.",
      uploadLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseMultipartRequest(req, {
      maxBytes: 6 * 1024 * 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();
    const session = await Session.findById(id);
    if (!session) {
      return jsonError("Session not found.", 404);
    }

    const draftToken = String(parsedRequest.value.get("draftToken") || "").trim();
    if (!session.isDraft || !hasValidDraftToken(session, draftToken)) {
      await writeAuditLog({
        action: "session_media_upload_denied",
        targetType: "session",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError("Draft access denied.", 403);
    }

    const file = parsedRequest.value.get("image");
    if (!(file instanceof File)) {
      return jsonError("An image file is required.", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validation = validateMatchImageBuffer(buffer, file.type);
    if (!validation.ok) {
      return jsonError(validation.message, 400);
    }

    const imageDataUrl = buildInlineMatchImageDataUrl(buffer, file.type);
    if (!imageDataUrl) {
      throw new Error("Could not prepare the uploaded image.");
    }

    const draftGalleryEntry = createStoredMatchImageEntry({
      matchId: session.match ? String(session.match) : "",
      sourceUrl: imageDataUrl,
      publicId: "",
      uploadedAt: new Date(),
      uploadedBy: "draft",
    });
    applyStoredMatchImages(session, [draftGalleryEntry], {
      matchId: session.match ? String(session.match) : "",
    });
    session.mediaUpdatedAt = new Date();
    await session.save({ timestamps: false });

    if (session.match) {
      const linkedMatch = await Match.findById(session.match);
      if (linkedMatch) {
        const matchGalleryEntry = createStoredMatchImageEntry({
          matchId: String(linkedMatch._id),
          sourceUrl: imageDataUrl,
          publicId: "",
          uploadedAt: draftGalleryEntry.uploadedAt,
          uploadedBy: "draft",
          id: draftGalleryEntry.id,
        });
        applyStoredMatchImages(linkedMatch, [matchGalleryEntry], {
          matchId: String(linkedMatch._id),
        });
        linkedMatch.mediaUpdatedAt = session.mediaUpdatedAt;
        linkedMatch.lastEventType = "image_update";
        linkedMatch.lastEventText = "Match image updated.";
        linkedMatch.lastLiveEvent = {
          id: `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          type: "image_update",
          summaryText: "Match image updated.",
          createdAt: new Date().toISOString(),
        };
        await linkedMatch.save();
        publishMatchUpdate(String(session.match));
      }
    }

    invalidateSessionsDataCache();
    publishSessionUpdate(session._id);

    await writeAuditLog({
      action: "session_media_upload",
      targetType: "session",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        size: buffer.length,
        mimeType: file.type,
        imagePublicId: session.matchImagePublicId,
      },
    });

    return Response.json(
      {
        ok: true,
        sessionId: String(session._id),
        matchId: session.match ? String(session.match) : null,
        hasImage: true,
        updatedAt: session.updatedAt || null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const status = error?.message === "Image moderation unavailable." ? 503 : 500;
    const failureMessage =
      status === 503
        ? "Image moderation is temporarily unavailable."
        : process.env.NODE_ENV === "production"
          ? "Failed to upload the session image."
          : error?.message || "Failed to upload the session image.";

    await writeAuditLog({
      action: "session_media_upload",
      targetType: "session",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { message: error?.message || "Failed to upload the session image." },
    });

    return jsonError(failureMessage, status);
  }
}


