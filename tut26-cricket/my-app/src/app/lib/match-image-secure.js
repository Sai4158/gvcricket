/**
 * File overview:
 * Purpose: Provides shared Match Image Secure logic for routes, APIs, and feature code.
 * Main exports: hashMatchImageSourceUrl, buildSignedMatchImageUrl, hasValidSignedMatchImageUrl, encryptMatchImageSourceUrl, decryptMatchImageSourceUrl, resolveStoredMatchImageSource, getPublicMatchImagePath.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

import crypto from "node:crypto";
import {
  buildPublicMatchImageUrl,
  isSafeMatchImageUrl,
  isSafeRemoteMatchImageUrl,
} from "./match-image";

const MATCH_IMAGE_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

function getSignedImageExpiry() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(nowSeconds / MATCH_IMAGE_URL_TTL_SECONDS);
  return (currentWindow + 1) * MATCH_IMAGE_URL_TTL_SECONDS;
}

function hasSignedInternalMatchImageUrl(value) {
  if (!value || !isSafeMatchImageUrl(value) || isSafeRemoteMatchImageUrl(value)) {
    return false;
  }

  try {
    const url = new URL(String(value), "https://www.gvcricket.com");
    return Boolean(url.searchParams.get("sig") && url.searchParams.get("exp"));
  } catch {
    return false;
  }
}

function getImageSecret() {
  const secret =
    process.env.MATCH_IMAGE_SECRET || process.env.MATCH_ACCESS_SECRET || "";
  const allowFallbackSecret = process.env.NODE_ENV !== "production";

  if (!secret) {
    if (allowFallbackSecret) {
      return crypto
        .createHash("sha256")
        .update("gv-cricket-test-match-image-secret")
        .digest();
    }
    throw new Error("Match image secret is not configured.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function hashMatchImageSourceUrl(value) {
  return crypto
    .createHmac("sha256", getImageSecret())
    .update(String(value || ""))
    .digest("base64url");
}

function getImageUrlSignKey() {
  return crypto
    .createHmac("sha256", getImageSecret())
    .update("match-image-url-signature")
    .digest();
}

function signMatchImageUrlPayload(payload) {
  return crypto
    .createHmac("sha256", getImageUrlSignKey())
    .update(payload)
    .digest("base64url");
}

export function buildSignedMatchImageUrl(matchId, version = "", imageId = "") {
  const baseUrl = buildPublicMatchImageUrl(matchId, version, imageId);
  if (!baseUrl) {
    return "";
  }

  const safeMatchId = String(matchId || "").trim();
  const safeVersion = String(version || "").trim();
  const safeImageId = String(imageId || "").trim();
  const expiresAt = getSignedImageExpiry();
  const payload = [safeMatchId, safeImageId, safeVersion, expiresAt].join(":");
  const signature = signMatchImageUrlPayload(payload);
  const separator = baseUrl.includes("?") ? "&" : "?";

  return `${baseUrl}${separator}exp=${expiresAt}&sig=${signature}`;
}

export function hasValidSignedMatchImageUrl({
  matchId = "",
  imageId = "",
  version = "",
  expiresAt = "",
  signature = "",
}) {
  const safeSignature = String(signature || "").trim();
  const safeExpiresAt = Number(expiresAt);
  if (!safeSignature || !Number.isFinite(safeExpiresAt)) {
    return false;
  }

  if (safeExpiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const payload = [
    String(matchId || "").trim(),
    String(imageId || "").trim(),
    String(version || "").trim(),
    safeExpiresAt,
  ].join(":");
  const expected = signMatchImageUrlPayload(payload);
  const providedBuffer = Buffer.from(safeSignature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function encryptMatchImageSourceUrl(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getImageSecret(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value || ""), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptMatchImageSourceUrl(value) {
  const payload = Buffer.from(String(value || ""), "base64url");
  if (payload.length <= 28) {
    throw new Error("Encrypted image payload is invalid.");
  }

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getImageSecret(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function resolveStoredMatchImageSource(match, imageId = "") {
  const requestedImageId = String(imageId || "").trim();
  const normalizedImages = Array.isArray(match?.matchImages)
    ? match.matchImages
        .map((entry) => ({
          id: String(entry?.id || ""),
          url: String(entry?.url || ""),
          storageUrlEnc: String(entry?.storageUrlEnc || ""),
          storageUrlHash: String(entry?.storageUrlHash || ""),
        }))
        .filter((entry) => entry.id && (entry.storageUrlEnc || entry.url))
    : [];

  const selectedImage =
    (requestedImageId
      ? normalizedImages.find((entry) => entry.id === requestedImageId)
      : normalizedImages[0]) || null;

  if (selectedImage) {
    if (selectedImage.storageUrlEnc) {
      const sourceUrl = decryptMatchImageSourceUrl(selectedImage.storageUrlEnc);

      if (!isSafeRemoteMatchImageUrl(sourceUrl)) {
        throw new Error("Stored image source is invalid.");
      }

      if (
        selectedImage.storageUrlHash &&
        hashMatchImageSourceUrl(sourceUrl) !== selectedImage.storageUrlHash
      ) {
        throw new Error("Stored image source failed integrity verification.");
      }

      return sourceUrl;
    }

    if (isSafeRemoteMatchImageUrl(selectedImage.url)) {
      return selectedImage.url;
    }
  }

  const encryptedValue = String(match?.matchImageStorageUrlEnc || "");
  const storedHash = String(match?.matchImageStorageUrlHash || "");

  if (encryptedValue) {
    const sourceUrl = decryptMatchImageSourceUrl(encryptedValue);

    if (!isSafeRemoteMatchImageUrl(sourceUrl)) {
      throw new Error("Stored image source is invalid.");
    }

    if (storedHash && hashMatchImageSourceUrl(sourceUrl) !== storedHash) {
      throw new Error("Stored image source failed integrity verification.");
    }

    return sourceUrl;
  }

  const legacyUrl = String(match?.matchImageUrl || "");
  if (isSafeRemoteMatchImageUrl(legacyUrl)) {
    return legacyUrl;
  }

  return "";
}

export function getPublicMatchImagePath(match) {
  const currentUrl = String(match?.matchImageUrl || "");
  if (hasSignedInternalMatchImageUrl(currentUrl)) {
    return currentUrl;
  }

  const hasProtectedSource = Boolean(
    match?.matchImageStorageUrlEnc ||
      match?.matchImageStorageUrlHash ||
      isSafeRemoteMatchImageUrl(currentUrl)
  );

  if (!hasProtectedSource || !match?._id) {
    return "";
  }

  const version =
    match?.matchImagePublicId ||
    match?.matchImageUploadedAt ||
    match?.mediaUpdatedAt ||
    match?.matchImageStorageUrlHash ||
    "";

  return buildSignedMatchImageUrl(match._id, version);
}


