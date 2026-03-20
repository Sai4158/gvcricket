import crypto from "node:crypto";
import {
  buildPublicMatchImageUrl,
  isSafeMatchImageUrl,
  isSafeRemoteMatchImageUrl,
} from "./match-image";

function getImageSecret() {
  const secret =
    process.env.MATCH_IMAGE_SECRET || process.env.MATCH_ACCESS_SECRET || "";

  if (!secret) {
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

export function resolveStoredMatchImageSource(match) {
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
  if (currentUrl && isSafeMatchImageUrl(currentUrl) && !isSafeRemoteMatchImageUrl(currentUrl)) {
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
    match?.updatedAt ||
    "";

  return buildPublicMatchImageUrl(match._id, version);
}
