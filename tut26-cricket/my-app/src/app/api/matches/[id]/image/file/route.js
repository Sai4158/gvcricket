import { connectDB } from "../../../../../lib/db";
import { jsonError } from "../../../../../lib/api-response";
import {
  isAllowedMatchImageMime,
  validateMatchImageBuffer,
} from "../../../../../lib/match-image";
import { resolveStoredMatchImageSource } from "../../../../../lib/match-image-secure";
import Match from "../../../../../../models/Match";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { id } = await params;

  try {
    await connectDB();
    const match = await Match.findById(id)
      .select(
        "_id matchImageUrl matchImageStorageUrlEnc matchImageStorageUrlHash matchImagePublicId matchImageUploadedAt updatedAt"
      )
      .lean();

    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const sourceUrl = resolveStoredMatchImageSource(match);
    if (!sourceUrl) {
      return jsonError("Match image not found.", 404);
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

    const hasVersionParam = req.nextUrl.searchParams.has("v");

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": hasVersionParam
          ? "public, max-age=31536000, immutable"
          : "public, max-age=600, stale-while-revalidate=86400",
        "Content-Length": String(buffer.length),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError("Could not load the match image.", 500);
  }
}
