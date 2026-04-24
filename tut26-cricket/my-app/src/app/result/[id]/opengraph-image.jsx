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

export const runtime = "nodejs";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage({ params }) {
  const { id } = await params;
  const match = await loadPublicMatchData(id);

  if (!match) {
    return createLogoOnlySocialImage();
  }

  return createResultSocialImage(match);
}


