"use client";

/**
 * File overview:
 * Purpose: Normalizes result-page match state and media-only updates.
 * Main exports: normalizeResultMatch, mergeResultMatchUpdate.
 * Major callers: Result page client state updates.
 * Side effects: none.
 * Read next: ./ResultPageClient.jsx
 */

function normalizeInnings(innings) {
  return {
    team: String(innings?.team || ""),
    score: Number(innings?.score || 0),
    history: Array.isArray(innings?.history) ? innings.history : [],
  };
}

function normalizeLiveStream(liveStream) {
  if (!liveStream || typeof liveStream !== "object") {
    return null;
  }

  const provider = String(liveStream.provider || "").trim();
  const watchUrl = String(liveStream.watchUrl || "").trim();
  const embedUrl = String(liveStream.embedUrl || "").trim();
  const videoId = String(liveStream.videoId || "").trim();

  if (!watchUrl || !embedUrl || !videoId) {
    return null;
  }

  return {
    provider: provider || "youtube",
    inputUrl: String(liveStream.inputUrl || watchUrl).trim(),
    watchUrl,
    embedUrl,
    videoId,
    updatedAt: liveStream.updatedAt || null,
  };
}

export function normalizeResultMatch(match) {
  if (!match || typeof match !== "object") {
    return null;
  }

  return {
    ...match,
    innings1: normalizeInnings(match?.innings1),
    innings2: normalizeInnings(match?.innings2),
    matchImages: Array.isArray(match?.matchImages) ? match.matchImages : [],
    liveStream: normalizeLiveStream(match?.liveStream),
  };
}

export function mergeResultMatchUpdate(currentMatch, incomingUpdate) {
  if (!incomingUpdate || typeof incomingUpdate !== "object") {
    return normalizeResultMatch(currentMatch);
  }

  if (!currentMatch || typeof currentMatch !== "object") {
    return normalizeResultMatch(incomingUpdate);
  }

  return normalizeResultMatch({
    ...currentMatch,
    ...incomingUpdate,
    innings1:
      incomingUpdate?.innings1 && typeof incomingUpdate.innings1 === "object"
        ? {
            ...(currentMatch?.innings1 || {}),
            ...incomingUpdate.innings1,
          }
        : currentMatch?.innings1,
    innings2:
      incomingUpdate?.innings2 && typeof incomingUpdate.innings2 === "object"
        ? {
            ...(currentMatch?.innings2 || {}),
            ...incomingUpdate.innings2,
          }
        : currentMatch?.innings2,
  });
}
