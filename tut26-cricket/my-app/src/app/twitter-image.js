import {
  createLogoOnlySocialImage,
  SOCIAL_IMAGE_SIZE,
} from "./lib/social-image-card";

export const runtime = "nodejs";
export const alt = "GV Cricket logo social card";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default function TwitterImage() {
  return createLogoOnlySocialImage();
}
