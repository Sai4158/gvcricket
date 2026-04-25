/**
 * File overview:
 * Purpose: Generates the social preview image for Result sharing routes.
 * Main exports: runtime, size, contentType.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: none.
 * Read next: ../../../../docs/ONBOARDING.md
 */

import {
  createLogoOnlySocialImage,
  createResultSocialImage,
  SOCIAL_IMAGE_SIZE,
} from "../../lib/social-image-card";
import { loadPublicMatchData } from "../../lib/server-data";
import { headers } from "next/headers";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

function getRequestOrigin(headersList) {
  const host =
    headersList.get("x-forwarded-host") ||
    headersList.get("host") ||
    "";
  if (!host) {
    return "";
  }

  const forwardedProto = headersList.get("x-forwarded-proto");
  const proto =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}

async function embedShareImages(match, baseUrl) {
  const images = Array.isArray(match?.matchImages)
    ? match.matchImages.filter((image) => image?.url).slice(0, 4)
    : [];

  if (images.length < 2 || !baseUrl) {
    return match;
  }

  const embeddedImages = (
    await Promise.all(
      images.map(async (image) => {
        try {
          const imageUrl = new URL(image.url, baseUrl).toString();
          const response = await fetch(imageUrl, { cache: "no-store" });
          if (!response.ok) {
            return null;
          }

          const contentType =
            response.headers.get("content-type") || "image/jpeg";
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          return {
            ...image,
            url: `data:${contentType};base64,${imageBuffer.toString("base64")}`,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);

  if (embeddedImages.length < 2) {
    return match;
  }

  return {
    ...match,
    matchImages: embeddedImages,
  };
}

export default async function OpenGraphImage({ params }) {
  const { id } = await params;
  const requestHeaders = await headers();
  const requestOrigin = getRequestOrigin(requestHeaders);
  const match = await loadPublicMatchData(id);

  if (!match) {
    return createLogoOnlySocialImage();
  }

  return createResultSocialImage(await embedShareImages(match, requestOrigin), {
    baseUrl: requestOrigin,
  });
}


