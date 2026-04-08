/**
 * File overview:
 * Purpose: Social image generator for Session.
 * Main exports: runtime, alt, size, contentType.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: none.
 * Read next: ../../../../../docs/ONBOARDING.md
 */
import {
  createLogoOnlySocialImage,
  SOCIAL_IMAGE_SIZE,
} from "../../../lib/social-image-card";

export const runtime = "nodejs";
export const alt = "GV Cricket logo social card";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage({ params }) {
  void params;
  return createLogoOnlySocialImage();
}
