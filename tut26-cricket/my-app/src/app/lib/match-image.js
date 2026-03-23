const SAFE_IMAGE_HOSTS = new Set(["i.ibb.co", "ibb.co"]);
const MAX_MATCH_IMAGE_BYTES = 5 * 1024 * 1024;
const INTERNAL_MATCH_IMAGE_PATH =
  /^\/api\/matches\/[a-f0-9]{24}\/image\/file(?:\?[^#]*)?$/i;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isJpeg(buffer) {
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer) {
  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function isWebp(buffer) {
  return (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  );
}

export function getMatchImageLimits() {
  return {
    maxBytes: MAX_MATCH_IMAGE_BYTES,
    allowedMimeTypes: [...ALLOWED_IMAGE_MIME_TYPES],
  };
}

export function isAllowedMatchImageMime(mimeType) {
  return ALLOWED_IMAGE_MIME_TYPES.has(String(mimeType || "").toLowerCase());
}

export function validateMatchImageBuffer(buffer, mimeType) {
  if (!buffer || buffer.length === 0) {
    return { ok: false, message: "Image file is empty." };
  }

  if (buffer.length > MAX_MATCH_IMAGE_BYTES) {
    return { ok: false, message: "Image exceeds the 5 MB upload limit." };
  }

  if (!isAllowedMatchImageMime(mimeType)) {
    return {
      ok: false,
      message: "Only JPG, PNG, and WEBP images are allowed.",
    };
  }

  const header = buffer.subarray(0, 16);
  const validSignature =
    isJpeg(header) || isPng(header) || isWebp(header);

  if (!validSignature) {
    return { ok: false, message: "Image content did not match an allowed format." };
  }

  return { ok: true };
}

export function buildPublicMatchImageUrl(matchId, version = "", imageId = "") {
  const safeId = String(matchId || "").trim();
  if (!/^[a-f0-9]{24}$/i.test(safeId)) {
    return "";
  }

  const searchParams = new URLSearchParams();
  if (imageId) {
    searchParams.set("imageId", String(imageId));
  }
  if (version) {
    searchParams.set("v", String(version));
  }

  const query = searchParams.toString();
  return `/api/matches/${safeId}/image/file${query ? `?${query}` : ""}`;
}

export function isSafeRemoteMatchImageUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && SAFE_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isSafeMatchImageUrl(value) {
  if (!value) return false;

  if (typeof value === "string" && INTERNAL_MATCH_IMAGE_PATH.test(value.trim())) {
    return true;
  }

  return isSafeRemoteMatchImageUrl(value);
}

export function normalizeMatchImageMetadata(uploadData, uploadedBy = "admin") {
  return {
    matchImageUrl: uploadData?.display_url || uploadData?.url || "",
    matchImagePublicId: uploadData?.id || "",
    matchImageUploadedAt: new Date(),
    matchImageUploadedBy: uploadedBy,
  };
}
