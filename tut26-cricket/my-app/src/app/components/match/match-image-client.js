"use client";

const MAX_DIMENSION = 1600;
const FAST_PATH_MAX_BYTES = 2 * 1024 * 1024;
const FAST_PATH_PNG_MAX_BYTES = 900 * 1024;

export function getAcceptedMatchImageTypes() {
  return "image/jpeg,image/png,image/webp";
}

export async function compressMatchImage(file) {
  const bitmap = await createImageBitmap(file);
  const fitsMaxDimension =
    bitmap.width <= MAX_DIMENSION && bitmap.height <= MAX_DIMENSION;
  const canUseOriginalFile =
    (fitsMaxDimension &&
      (("image/jpeg" === file.type || "image/webp" === file.type) &&
        file.size <= FAST_PATH_MAX_BYTES)) ||
    (fitsMaxDimension &&
      file.type === "image/png" &&
      file.size <= FAST_PATH_PNG_MAX_BYTES);

  if (canUseOriginalFile) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not prepare image compression.");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error("Could not compress the image."));
          return;
        }

        resolve(nextBlob);
      },
      "image/jpeg",
      0.82
    );
  });

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
    type: "image/jpeg",
  });
}
