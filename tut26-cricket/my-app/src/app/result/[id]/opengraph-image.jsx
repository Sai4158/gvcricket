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

export default async function OpenGraphImage({ params }) {
  const { id } = await params;
  const requestHeaders = await headers();
  const requestOrigin = getRequestOrigin(requestHeaders);
  const match = await loadPublicMatchData(id);

  if (!match) {
    return createLogoOnlySocialImage();
  }

  return createResultSocialImage(match, {
    baseUrl: requestOrigin,
  });
}


