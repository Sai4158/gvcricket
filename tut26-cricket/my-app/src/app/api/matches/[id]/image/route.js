import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import {
  isSafeMatchImageUrl,
  normalizeMatchImageMetadata,
  validateMatchImageBuffer,
} from "../../../../lib/match-image";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

export const runtime = "nodejs";

async function requireMatchAccess(matchId) {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(getMatchAccessCookieName(matchId));
  return hasValidMatchAccess(matchId, accessCookie?.value);
}

export async function POST(req, { params }) {
  const meta = getRequestMeta(req);

  try {
    const hasAccess = await requireMatchAccess(params.id);
    if (!hasAccess) {
      return jsonError("Umpire access required", 403);
    }

    const uploadLimit = enforceRateLimit({
      key: `match-image:${params.id}:${meta.ip}`,
      limit: 4,
      windowMs: 60 * 1000,
      blockMs: 60 * 1000,
    });

    if (!uploadLimit.allowed) {
      return jsonRateLimit(
        "Too many image uploads. Try again shortly.",
        uploadLimit.retryAfterMs
      );
    }

    const formData = await req.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return jsonError("An image file is required.", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validation = validateMatchImageBuffer(buffer, file.type);

    if (!validation.ok) {
      return jsonError(validation.message, 400);
    }

    const imgbbKey = process.env.IMGBB_API_KEY;
    if (!imgbbKey) {
      return jsonError("Image storage is not configured.", 500);
    }

    const uploadForm = new FormData();
    uploadForm.append("image", new Blob([buffer], { type: file.type }), file.name);
    uploadForm.append("name", file.name.replace(/\.[^.]+$/, ""));

    const uploadResponse = await fetch(
      `https://api.imgbb.com/1/upload?key=${imgbbKey}`,
      {
        method: "POST",
        body: uploadForm,
      }
    );

    const uploadJson = await uploadResponse.json();
    if (!uploadResponse.ok || !uploadJson?.success) {
      throw new Error(uploadJson?.error?.message || "Image upload failed.");
    }

    const imageMetadata = normalizeMatchImageMetadata(uploadJson.data);
    if (!isSafeMatchImageUrl(imageMetadata.matchImageUrl)) {
      throw new Error("Upload provider returned an unsafe image URL.");
    }

    await connectDB();
    const updatedMatch = await Match.findByIdAndUpdate(
      params.id,
      {
        $set: {
          ...imageMetadata,
          matchImageUploadedBy: "admin",
          mediaUpdatedAt: new Date(),
          lastEventType: "image_update",
          lastEventText: "Match image updated.",
          lastLiveEvent: {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "image_update",
            summaryText: "Match image updated.",
            createdAt: new Date().toISOString(),
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedMatch) {
      return jsonError("Match not found", 404);
    }

    await Session.findByIdAndUpdate(updatedMatch.sessionId, {
      $set: {
        matchImageUrl: updatedMatch.matchImageUrl,
        matchImagePublicId: updatedMatch.matchImagePublicId,
        matchImageUploadedAt: updatedMatch.matchImageUploadedAt,
        matchImageUploadedBy: updatedMatch.matchImageUploadedBy,
        mediaUpdatedAt: updatedMatch.mediaUpdatedAt,
        lastEventType: "image_update",
        lastEventText: "Match image updated.",
      },
    });

    await writeAuditLog({
      action: "match_media_upload",
      targetType: "match",
      targetId: params.id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        size: buffer.length,
        mimeType: file.type,
        imagePublicId: updatedMatch.matchImagePublicId,
      },
    });

    return NextResponse.json(updatedMatch, { status: 200 });
  } catch (error) {
    await writeAuditLog({
      action: "match_media_upload",
      targetType: "match",
      targetId: params.id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { error: error.message },
    });

    return jsonError("Failed to upload match image", 500, {
      error: error.message,
    });
  }
}
