/**
 * File overview:
 * Purpose: Normalizes YouTube live stream links for match embeds and sharing.
 * Main exports: normalizeYouTubeLiveStream, normalizeStoredLiveStream, buildYouTubeEmbedUrl.
 * Major callers: Match patch routes, public serializers, and live stream UI.
 * Side effects: none.
 * Read next: ./public-data.js
 */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "gaming.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function safeParseUrl(input) {
  const value = String(input || "").trim();
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function sanitizeVideoId(value) {
  const videoId = String(value || "").trim();
  return VIDEO_ID_REGEX.test(videoId) ? videoId : "";
}

function extractVideoIdFromUrl(url) {
  if (!url || !YOUTUBE_HOSTS.has(url.hostname)) {
    return "";
  }

  if (url.hostname === "youtu.be" || url.hostname === "www.youtu.be") {
    const shareId = sanitizeVideoId(url.pathname.split("/").filter(Boolean)[0] || "");
    return shareId;
  }

  const watchId = sanitizeVideoId(url.searchParams.get("v"));
  if (watchId) {
    return watchId;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  if (!pathSegments.length) {
    return "";
  }

  const [firstSegment, secondSegment] = pathSegments;
  if (firstSegment === "embed" || firstSegment === "live" || firstSegment === "shorts") {
    return sanitizeVideoId(secondSegment);
  }

  return "";
}

export function buildYouTubeEmbedUrl(videoId) {
  const safeVideoId = sanitizeVideoId(videoId);
  if (!safeVideoId) {
    return "";
  }

  return `https://www.youtube-nocookie.com/embed/${safeVideoId}?rel=0&playsinline=1`;
}

export function normalizeYouTubeLiveStream(input) {
  const parsedUrl = safeParseUrl(input);
  if (!parsedUrl || !YOUTUBE_HOSTS.has(parsedUrl.hostname)) {
    return {
      ok: false,
      message: "Enter a valid YouTube link.",
    };
  }

  const videoId = extractVideoIdFromUrl(parsedUrl);
  if (!videoId) {
    return {
      ok: false,
      message: "Could not find a YouTube video in that link.",
    };
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedUrl = buildYouTubeEmbedUrl(videoId);

  return {
    ok: true,
    value: {
      provider: "youtube",
      inputUrl: String(input || "").trim(),
      watchUrl,
      embedUrl,
      videoId,
    },
  };
}

export function normalizeStoredLiveStream(stream) {
  if (!stream || typeof stream !== "object") {
    return null;
  }

  const provider = String(stream.provider || "").trim().toLowerCase();
  if (provider && provider !== "youtube") {
    return null;
  }

  const videoId = sanitizeVideoId(stream.videoId);
  const watchUrl = String(stream.watchUrl || "").trim();
  const embedUrl = String(stream.embedUrl || "").trim();
  const inputUrl = String(stream.inputUrl || watchUrl || "").trim();
  const normalizedVideoId =
    videoId ||
    extractVideoIdFromUrl(safeParseUrl(watchUrl)) ||
    extractVideoIdFromUrl(safeParseUrl(embedUrl)) ||
    extractVideoIdFromUrl(safeParseUrl(inputUrl));

  if (!normalizedVideoId) {
    return null;
  }

  return {
    provider: "youtube",
    inputUrl,
    watchUrl: watchUrl || `https://www.youtube.com/watch?v=${normalizedVideoId}`,
    embedUrl: embedUrl || buildYouTubeEmbedUrl(normalizedVideoId),
    videoId: normalizedVideoId,
    updatedAt: stream.updatedAt || null,
  };
}
