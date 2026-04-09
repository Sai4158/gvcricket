/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: runtime.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: performs network requests.
 * Read next: ../../../../../../../docs/ONBOARDING.md
 */

import { connectDB } from "../../../../../lib/db";
import { jsonError } from "../../../../../lib/api-response";
import {
  isSafeRemoteMatchImageUrl,
  isAllowedMatchImageMime,
  validateMatchImageBuffer,
} from "../../../../../lib/match-image";
import {
  hasValidSignedMatchImageUrl,
  resolveStoredMatchImageSource,
} from "../../../../../lib/match-image-secure";
import Match from "../../../../../../models/Match";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { id } = await params;
  const imageId = String(req.nextUrl.searchParams.get("imageId") || "").trim();
  const version = String(req.nextUrl.searchParams.get("v") || "").trim();
  const expiresAt = String(req.nextUrl.searchParams.get("exp") || "").trim();
  const signature = String(req.nextUrl.searchParams.get("sig") || "").trim();

  try {
    const cacheControl = version
      ? "public, max-age=31536000, immutable"
      : "public, max-age=600, stale-while-revalidate=86400";
    const hasValidSignature = hasValidSignedMatchImageUrl({
      matchId: id,
      imageId,
      version,
      expiresAt,
      signature,
    });

    if (!hasValidSignature) {
      return jsonError("Match image link is invalid or expired.", 403);
    }

    await connectDB();
    const match = await Match.findById(id)
      .select(
        "_id matchImages matchImageUrl matchImageStorageUrlEnc matchImageStorageUrlHash matchImagePublicId matchImageUploadedAt updatedAt"
      )
      .lean();

    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const sourceUrl = resolveStoredMatchImageSource(match, imageId);
    if (!sourceUrl) {
      return jsonError("Match image not found.", 404);
    }

    if (isSafeRemoteMatchImageUrl(sourceUrl)) {
      return new Response(null, {
        status: 307,
        headers: {
          Location: sourceUrl,
          "Cache-Control": cacheControl,
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const upstream = await fetch(sourceUrl, {
      cache: "force-cache",
      headers: {
        Accept: "image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
      },
    });

    if (!upstream.ok) {
      return jsonError("Match image unavailable.", 502);
    }

    const mimeType = String(upstream.headers.get("content-type") || "").split(";")[0];
    if (!isAllowedMatchImageMime(mimeType)) {
      return jsonError("Match image type is invalid.", 415);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const validation = validateMatchImageBuffer(buffer, mimeType);
    if (!validation.ok) {
      return jsonError("Match image is invalid.", 415);
    }

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": cacheControl,
        "Content-Length": String(buffer.length),
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return jsonError("Could not load the match image.", 500);
  }
}


