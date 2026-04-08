/**
 * File overview:
 * Purpose: Social image generator for Session.
 * Main exports: runtime, size, contentType.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: none.
 * Read next: ../../../../../docs/ONBOARDING.md
 */
import OpenGraphImage from "./opengraph-image";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default OpenGraphImage;
