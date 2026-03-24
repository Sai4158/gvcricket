import crypto from "node:crypto";
import { cookies } from "next/headers";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import { buildSessionMirrorUpdate } from "../../../../lib/match-engine";
import { publishMatchUpdate, publishSessionUpdate } from "../../../../lib/live-updates";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
  isValidUmpirePin,
} from "../../../../lib/match-access";
import {
  isSafeRemoteMatchImageUrl,
  normalizeMatchImageMetadata,
  validateMatchImageBuffer,
} from "../../../../lib/match-image";
import {
  applyStoredMatchImages,
  createStoredMatchImageEntry,
  getStoredMatchImages,
} from "../../../../lib/match-image-gallery";
import { moderateMatchImageBuffer } from "../../../../lib/match-image-moderation";
import { serializePublicMatch } from "../../../../lib/public-data";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import {
  parseJsonRequest,
  parseMultipartRequest,
} from "../../../../lib/request-security";
import { pinPayloadSchema } from "../../../../lib/validators";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";
import { z } from "zod";

export const runtime = "nodejs";

const deleteImagePayloadSchema = pinPayloadSchema.extend({
  imageId: z.string().trim().max(80).optional().default(""),
});

function getMatchImageModerationMode() {
  return String(process.env.MATCH_IMAGE_MODERATION_MODE || "best-effort").trim().toLowerCase();
}

function getSafeUploadName(file) {
  const extension = String(file?.name || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
    ? extension
    : "jpg";

  return `match-${crypto.randomBytes(8).toString("hex")}.${safeExtension}`;
}

function getProjectedGalleryCount({
  currentCount = 0,
  targetImageId = "",
  shouldAppend = false,
  plannedTotalCount = 0,
}) {
  const existingCount = Math.max(0, Number(currentCount || 0));
  const declaredTotal = Math.max(0, Number(plannedTotalCount || 0));

  let projectedCount = existingCount;
  if (shouldAppend) {
    projectedCount = existingCount + 1;
  } else if (targetImageId) {
    projectedCount = Math.max(existingCount, 1);
  } else if (existingCount > 0) {
    projectedCount = existingCount;
  } else {
    projectedCount = 1;
  }

  return Math.max(projectedCount, declaredTotal);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const uploadLimit = enforceRateLimit({
    key: `match-image:${id}:${meta.ip}`,
    limit: 12,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!uploadLimit.allowed) {
    await writeAuditLog({
      action: "match_media_rate_limited",
      targetType: "match",
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
    const match = await Match.findById(id);
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const targetImageId = String(parsedRequest.value.get("imageId") || "").trim();
    const shouldAppend =
      String(parsedRequest.value.get("append") || "")
        .trim()
        .toLowerCase() === "1";
    const plannedTotalCount = Number(
      String(parsedRequest.value.get("plannedTotalCount") || "").trim() || 0
    );
    const existingImages = getStoredMatchImages(match, { matchId: id });
    const projectedGalleryCount = getProjectedGalleryCount({
      currentCount: existingImages.length,
      targetImageId,
      shouldAppend,
      plannedTotalCount,
    });

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(getMatchAccessCookieName(id))?.value;
    const hasCookieAccess = hasValidMatchAccess(
      id,
      accessToken,
      Number(match.adminAccessVersion || 1)
    );
    const pinValue = String(parsedRequest.value.get("pin") || "").trim();
    const hasPinAccess = Boolean(pinValue) && isValidUmpirePin(pinValue);
    const requiresPinForUpload = projectedGalleryCount > 1;

    if ((!hasCookieAccess && !hasPinAccess) || (requiresPinForUpload && !hasPinAccess)) {
      await writeAuditLog({
        action: "match_media_upload_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return jsonError(
        requiresPinForUpload
          ? "Umpire PIN required when uploading more than one match image."
          : "Umpire PIN required for image upload.",
        401
      );
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
        action: "match_media_moderation_bypassed",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: error?.message || "Image moderation unavailable." },
      });
    }

    if (!moderation.ok) {
      await writeAuditLog({
        action: "match_media_upload_blocked",
        targetType: "match",
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

    const imageMetadata = normalizeMatchImageMetadata(uploadJson.data);
    if (!isSafeRemoteMatchImageUrl(imageMetadata.matchImageUrl)) {
      throw new Error("Remote image URL was rejected.");
    }

    const nextEntry = createStoredMatchImageEntry({
      matchId: id,
      sourceUrl: imageMetadata.matchImageUrl,
      publicId: imageMetadata.matchImagePublicId,
      uploadedAt: imageMetadata.matchImageUploadedAt,
      uploadedBy: "admin",
      id: targetImageId || "",
    });
    let nextImages = existingImages;
    if (targetImageId) {
      const hasExistingTarget = nextImages.some((entry) => entry.id === targetImageId);
      nextImages = hasExistingTarget
        ? nextImages.map((entry) =>
            entry.id === targetImageId ? { ...nextEntry, id: targetImageId } : entry
          )
        : [...nextImages, { ...nextEntry, id: targetImageId }];
    } else if (shouldAppend) {
      nextImages = [...nextImages, nextEntry];
    } else if (nextImages.length > 0) {
      nextImages = [{ ...nextEntry, id: nextImages[0].id }, ...nextImages.slice(1)];
    } else {
      nextImages = [nextEntry];
    }

    applyStoredMatchImages(match, nextImages, { matchId: id });
    match.mediaUpdatedAt = new Date();
    match.lastEventType = "image_update";
    match.lastEventText = "Match image updated.";
    match.lastLiveEvent = {
      id: `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      type: "image_update",
      summaryText: "Match image updated.",
      createdAt: new Date().toISOString(),
    };
    await match.save();

    await Session.findByIdAndUpdate(match.sessionId, {
      $set: buildSessionMirrorUpdate(match),
    });
    publishMatchUpdate(match._id);
    publishSessionUpdate(match.sessionId);

    await writeAuditLog({
      action: "match_media_upload",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        size: buffer.length,
        mimeType: file.type,
        imagePublicId: match.matchImagePublicId,
      },
    });

    return Response.json(serializePublicMatch(match), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error?.message === "Image moderation unavailable." ? 503 : 500;

    await writeAuditLog({
      action: "match_media_upload",
      targetType: "match",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { message: error.message },
    });

    return jsonError(
      status === 503 ? "Image moderation is temporarily unavailable." : "Failed to upload the match image.",
      status
    );
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const deleteLimit = enforceRateLimit({
    key: `match-image-delete:${id}:${meta.ip}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
    blockMs: 2 * 60 * 1000,
  });

  if (!deleteLimit.allowed) {
    await writeAuditLog({
      action: "match_media_delete_rate_limited",
      targetType: "match",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { retryAfterMs: deleteLimit.retryAfterMs },
    });

    return jsonRateLimit(
      "Too many image removal attempts. Try again shortly.",
      deleteLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, deleteImagePayloadSchema, {
      maxBytes: 2048,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    if (!isValidUmpirePin(parsedRequest.value.pin)) {
      await writeAuditLog({
        action: "match_media_delete_denied",
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

    const targetImageId = String(parsedRequest.value.imageId || "").trim();
    const currentImages = getStoredMatchImages(match, { matchId: id });
    const nextImages = targetImageId
      ? currentImages.filter((entry) => entry.id !== targetImageId)
      : currentImages.slice(1);

    applyStoredMatchImages(match, nextImages, { matchId: id });
    match.mediaUpdatedAt = new Date();
    match.lastEventType = "image_update";
    match.lastEventText = "Match image removed.";
    match.lastLiveEvent = {
      id: `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      type: "image_update",
      summaryText: "Match image removed.",
      createdAt: new Date().toISOString(),
    };
    await match.save();

    await Session.findByIdAndUpdate(match.sessionId, {
      $set: buildSessionMirrorUpdate(match),
    });
    publishMatchUpdate(match._id);
    publishSessionUpdate(match.sessionId);

    await writeAuditLog({
      action: "match_media_delete",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(serializePublicMatch(match), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await writeAuditLog({
      action: "match_media_delete",
      targetType: "match",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { message: error.message },
    });

    return jsonError("Failed to remove the match image.", 500);
  }
}
