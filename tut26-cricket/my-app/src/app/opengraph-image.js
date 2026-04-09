/**
 * File overview:
 * Purpose: Generates the default app-wide Open Graph social preview image.
 * Main exports: OpenGraphImage, runtime, alt, size, contentType.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: none.
 * Read next: ./README.md
 */

import {
  createLogoOnlySocialImage,
  SOCIAL_IMAGE_SIZE,
} from "./lib/social-image-card";

export const runtime = "nodejs";
export const alt = "GV Cricket logo social card";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createLogoOnlySocialImage();
}


