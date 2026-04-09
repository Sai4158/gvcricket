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
  SOCIAL_IMAGE_SIZE,
} from "../../lib/social-image-card";

export const runtime = "nodejs";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage({ params }) {
  void params;
  return createLogoOnlySocialImage();
}


