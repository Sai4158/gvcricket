"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: getAcceptedMatchImageTypes.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

const MAX_DIMENSION = 1024;
const TARGET_MAX_BYTES = 280 * 1024;
const FAST_PATH_MAX_BYTES = 220 * 1024;
const FAST_PATH_PNG_MAX_BYTES = 180 * 1024;
const MIN_QUALITY = 0.46;
const QUALITY_STEP = 0.08;
const RESIZE_STEP = 0.82;
const MAX_ATTEMPTS = 6;

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
  let quality = 0.76;
  let bestBlob = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    ctx.clearRect(0, 0, nextWidth, nextHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, nextWidth, nextHeight);

    const blob = await canvasToJpegBlob(canvas, quality);
    bestBlob = blob;

    if (blob.size <= TARGET_MAX_BYTES) {
      break;
    }

    quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    nextWidth = Math.max(1, Math.round(nextWidth * RESIZE_STEP));
    nextHeight = Math.max(1, Math.round(nextHeight * RESIZE_STEP));
  }

  bitmap.close();

  if (!bestBlob) {
    throw new Error("Could not compress the image.");
  }

  return new File([bestBlob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
    type: "image/jpeg",
  });
}


