import crypto from "node:crypto";
import { createRequire } from "node:module";
import { isSafeRemoteMatchImageUrl } from "./match-image";
import {
  buildSignedMatchImageUrl,
  encryptMatchImageSourceUrl,
  getPublicMatchImagePath,
  hashMatchImageSourceUrl,
} from "./match-image-secure";

const require = createRequire(import.meta.url);

const shouldEnforceServerOnly =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.NEXT_RUNTIME);

if (shouldEnforceServerOnly) {
  require("server-only");
}

function toIsoDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function getImageVersion(entry) {
  return (
    entry?.publicId ||
    entry?.uploadedAt?.getTime?.() ||
    entry?.uploadedAt ||
    Date.now()
  );
}

function buildImageUrl(matchId, entry) {
  if (!matchId) {
    return isSafeRemoteMatchImageUrl(entry?.url) ? String(entry.url) : "";
  }

  return buildSignedMatchImageUrl(matchId, getImageVersion(entry), entry?.id || "");
}

function normalizeStoredImageEntry(entry, { matchId = "" } = {}) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const id = String(entry.id || "").trim();
  const storageUrlEnc = String(entry.storageUrlEnc || "").trim();
  const storageUrlHash = String(entry.storageUrlHash || "").trim();
  const remoteUrl = String(entry.url || "").trim();
  const uploadedAt = toIsoDate(entry.uploadedAt);

  if (!id || (!storageUrlEnc && !isSafeRemoteMatchImageUrl(remoteUrl))) {
    return null;
  }

  const normalized = {
    id,
    url: buildImageUrl(matchId, {
      ...entry,
      id,
      url: remoteUrl,
      uploadedAt,
    }),
    publicId: String(entry.publicId || "").trim(),
    storageUrlEnc,
    storageUrlHash,
    uploadedAt,
    uploadedBy: String(entry.uploadedBy || "").trim(),
  };

  return normalized;
}

function buildLegacyCoverEntry(record, { matchId = "" } = {}) {
  const currentUrl = String(record?.matchImageUrl || "").trim();
  const storageUrlEnc = String(record?.matchImageStorageUrlEnc || "").trim();
  const storageUrlHash = String(record?.matchImageStorageUrlHash || "").trim();
  const remoteUrl = isSafeRemoteMatchImageUrl(currentUrl) ? currentUrl : "";
  if (!storageUrlEnc && !remoteUrl && !getPublicMatchImagePath(record)) {
    return null;
  }

  return normalizeStoredImageEntry(
    {
      id: "cover",
      url:
        remoteUrl ||
        getPublicMatchImagePath({
          ...record,
          _id: matchId || record?._id || "",
        }) ||
        "",
      publicId: record?.matchImagePublicId || "",
      storageUrlEnc,
      storageUrlHash,
      uploadedAt: record?.matchImageUploadedAt || null,
      uploadedBy: record?.matchImageUploadedBy || "",
    },
    { matchId }
  );
}

export function createStoredMatchImageEntry({
  matchId = "",
  sourceUrl = "",
  publicId = "",
  uploadedAt = new Date(),
  uploadedBy = "admin",
  id = "",
}) {
  const safeSourceUrl = String(sourceUrl || "").trim();
  if (!isSafeRemoteMatchImageUrl(safeSourceUrl)) {
    throw new Error("Remote image URL was rejected.");
  }

  const nextUploadedAt = toIsoDate(uploadedAt) || new Date();
  const nextEntry = {
    id: String(id || crypto.randomBytes(8).toString("hex")).trim(),
    url: safeSourceUrl,
    publicId: String(publicId || "").trim(),
    storageUrlEnc: encryptMatchImageSourceUrl(safeSourceUrl),
    storageUrlHash: hashMatchImageSourceUrl(safeSourceUrl),
    uploadedAt: nextUploadedAt,
    uploadedBy: String(uploadedBy || "").trim(),
  };

  return normalizeStoredImageEntry(nextEntry, { matchId });
}

export function getStoredMatchImages(record, { matchId = "" } = {}) {
  const normalized = Array.isArray(record?.matchImages)
    ? record.matchImages
        .map((entry) => normalizeStoredImageEntry(entry, { matchId }))
        .filter(Boolean)
    : [];

  if (normalized.length) {
    return normalized;
  }

  const legacyEntry = buildLegacyCoverEntry(record, { matchId });
  return legacyEntry ? [legacyEntry] : [];
}

export function applyStoredMatchImages(record, images, { matchId = "" } = {}) {
  const normalized = Array.isArray(images)
    ? images
        .map((entry) => normalizeStoredImageEntry(entry, { matchId }))
        .filter(Boolean)
    : [];

  record.matchImages = normalized;

  const cover = normalized[0] || null;
  if (!cover) {
    record.matchImageUrl = "";
    record.matchImagePublicId = "";
    record.matchImageStorageUrlEnc = "";
    record.matchImageStorageUrlHash = "";
    record.matchImageUploadedAt = null;
    record.matchImageUploadedBy = "";
    return normalized;
  }

  record.matchImageUrl = cover.url || "";
  record.matchImagePublicId = cover.publicId || "";
  record.matchImageStorageUrlEnc = cover.storageUrlEnc || "";
  record.matchImageStorageUrlHash = cover.storageUrlHash || "";
  record.matchImageUploadedAt = cover.uploadedAt || null;
  record.matchImageUploadedBy = cover.uploadedBy || "";
  return normalized;
}

export function rebaseStoredMatchImagesForMatch(matchId, images) {
  return Array.isArray(images)
    ? images
        .map((entry) => normalizeStoredImageEntry(entry, { matchId }))
        .filter(Boolean)
    : [];
}

export function getPublicMatchImages(record, { matchId = "" } = {}) {
  return getStoredMatchImages(record, { matchId }).map((entry) => ({
    id: entry.id,
    url: entry.url,
    uploadedAt: entry.uploadedAt || null,
    uploadedBy: entry.uploadedBy || "",
  }));
}
