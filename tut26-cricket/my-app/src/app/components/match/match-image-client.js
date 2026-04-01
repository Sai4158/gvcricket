"use client";

const MAX_DIMENSION = 1280;
const TARGET_MAX_BYTES = 450 * 1024;
const FAST_PATH_MAX_BYTES = 450 * 1024;
const FAST_PATH_PNG_MAX_BYTES = 350 * 1024;

export function getAcceptedMatchImageTypes() {
  return "image/jpeg,image/png,image/webp";
}

async function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error("Could not compress the image."));
          return;
        }

        resolve(nextBlob);
      },
      "image/jpeg",
      quality
    );
  });
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
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not prepare image compression.");
  }

  let nextWidth = width;
  let nextHeight = height;
  let quality = 0.82;
  let bestBlob = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    ctx.clearRect(0, 0, nextWidth, nextHeight);
    ctx.drawImage(bitmap, 0, 0, nextWidth, nextHeight);

    const blob = await canvasToJpegBlob(canvas, quality);
    bestBlob = blob;

    if (blob.size <= TARGET_MAX_BYTES) {
      break;
    }

    quality = Math.max(0.58, quality - 0.1);
    nextWidth = Math.max(1, Math.round(nextWidth * 0.86));
    nextHeight = Math.max(1, Math.round(nextHeight * 0.86));
  }

  bitmap.close();

  if (!bestBlob) {
    throw new Error("Could not compress the image.");
  }

  return new File([bestBlob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
    type: "image/jpeg",
  });
}
