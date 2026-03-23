import crypto from "node:crypto";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import {
  isSafeRemoteMatchImageUrl,
  normalizeMatchImageMetadata,
  validateMatchImageBuffer,
} from "../../../../lib/match-image";
import {
  applyStoredMatchImages,
  createStoredMatchImageEntry,
} from "../../../../lib/match-image-gallery";
import { moderateMatchImageBuffer } from "../../../../lib/match-image-moderation";
import { serializePublicSession } from "../../../../lib/public-data";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { parseMultipartRequest } from "../../../../lib/request-security";
import { hasValidDraftToken } from "../../../../lib/session-draft";

export const runtime = "nodejs";

function getMatchImageModerationMode() {
  return String(process.env.MATCH_IMAGE_MODERATION_MODE || "best-effort")
    .trim()
    .toLowerCase();
}

function getSafeUploadName(file) {
  const extension = String(file?.name || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
    ? extension
    : "jpg";

  return `session-${crypto.randomBytes(8).toString("hex")}.${safeExtension}`;
}

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

    let moderation = {
      ok: true,
      blockedLabels: [],
      predictions: [],
      message: "",
    };

    try {
      moderation = await moderateMatchImageBuffer(buffer);
    } catch (error) {
      if (getMatchImageModerationMode() === "strict") {
        throw error;
      }

      await writeAuditLog({
        action: "session_media_moderation_bypassed",
        targetType: "session",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: error?.message || "Image moderation unavailable." },
      });
    }

    if (!moderation.ok) {
      await writeAuditLog({
        action: "session_media_upload_blocked",
        targetType: "session",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: {
          blockedLabels: moderation.blockedLabels,
          predictions: moderation.predictions.map((prediction) => ({
            className: prediction.className,
            probability: Number(prediction.probability.toFixed(4)),
          })),
        },
      });

      return jsonError(moderation.message, 422);
    }

    const imgbbKey = process.env.IMGBB_API_KEY;
    if (!imgbbKey) {
      return jsonError("Image uploads are not configured.", 500);
    }

    const safeName = getSafeUploadName(file);
    const uploadForm = new FormData();
    uploadForm.append("image", new Blob([buffer], { type: file.type }), safeName);
    uploadForm.append("name", safeName.replace(/\.[^.]+$/, ""));

    const uploadResponse = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey)}`,
      {
        method: "POST",
        body: uploadForm,
      }
    );
    const uploadJson = await uploadResponse.json().catch(() => null);

    if (!uploadResponse.ok || !uploadJson?.success) {
      throw new Error("Remote image upload failed.");
    }

    const imageMetadata = normalizeMatchImageMetadata(uploadJson.data, "draft");
    if (!isSafeRemoteMatchImageUrl(imageMetadata.matchImageUrl)) {
      throw new Error("Remote image URL was rejected.");
    }

    const draftGalleryEntry = createStoredMatchImageEntry({
      matchId: session.match ? String(session.match) : "",
      sourceUrl: imageMetadata.matchImageUrl,
      publicId: imageMetadata.matchImagePublicId,
      uploadedAt: imageMetadata.matchImageUploadedAt,
      uploadedBy: "draft",
    });
    applyStoredMatchImages(session, [draftGalleryEntry], {
      matchId: session.match ? String(session.match) : "",
    });
    session.mediaUpdatedAt = new Date();
    await session.save();

    if (session.match) {
      const linkedMatch = await Match.findById(session.match);
      if (linkedMatch) {
        const matchGalleryEntry = createStoredMatchImageEntry({
          matchId: String(linkedMatch._id),
          sourceUrl: imageMetadata.matchImageUrl,
          publicId: imageMetadata.matchImagePublicId,
          uploadedAt: imageMetadata.matchImageUploadedAt,
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
        publishMatchUpdate(session.match);
      }
    }

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

    return Response.json(serializePublicSession(session), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error?.message === "Image moderation unavailable." ? 503 : 500;

    await writeAuditLog({
      action: "session_media_upload",
      targetType: "session",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { message: error?.message || "Failed to upload the session image." },
    });

    return jsonError(
      status === 503
        ? "Image moderation is temporarily unavailable."
        : "Failed to upload the session image.",
      status
    );
  }
}
