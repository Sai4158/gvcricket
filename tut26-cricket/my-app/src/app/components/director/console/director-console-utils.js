/**
 * File overview:
 * Purpose: Renders Director UI for the app's screens and flows.
 * Main exports: buildYouTubeWatchUrl, buildYouTubeThumbnailUrl, extractYouTubePlaylistId, extractYouTubeVideoId, normalizeDirectorYouTubeTrack, readCachedDirectorYouTubeTracks, readStoredDirectorPreferredSessionId, writeStoredDirectorPreferredSessionId, writeCachedDirectorYouTubeTracks, loadDirectorYouTubeIframeApi, serializeOrder, readCachedDirectorSessions, writeCachedDirectorSessions, readCachedDirectorAudioLibrary, writeCachedDirectorAudioLibrary, createSpeechSettings, buildDirectorScoreLine, mergeDirectorMatchIntoSessions, getDirectorActiveHistory, getDirectorOversDisplay, getDirectorChaseSummary, getDirectorPreferredMatch, getPreferredLiveSessionId, resolveDirectorAutoManageSessionId, formatAudioTime, findLibraryCardIdFromPoint, DIRECTOR_AUDIO_METADATA_CACHE_KEY, DIRECTOR_SESSIONS_CACHE_KEY, DIRECTOR_AUDIO_ORDER_SAVE_DELAY_MS, DIRECTOR_SESSIONS_REFRESH_MIN_GAP_MS, DIRECTOR_YOUTUBE_TRACKS_CACHE_KEY, DIRECTOR_PREFERRED_SESSION_STORAGE_KEY, DIRECTOR_YOUTUBE_PLAYLIST_IMPORT_LIMIT, DIRECTOR_AUTO_ANNOUNCE_EVENT_TYPES.
 * Major callers: Feature routes and sibling components.
 * Side effects: reads or writes browser storage.
 * Read next: ./README.md
 */

import { countLegalBalls } from "../../../lib/match-scoring";
import { getBattingTeamBundle } from "../../../lib/team-utils";
import {
  readCachedSoundEffectsLibrary as readSharedSoundEffectsLibrary,
  writeCachedSoundEffectsLibrary as writeSharedSoundEffectsLibrary,
} from "../../../lib/sound-effects-client";

export const DIRECTOR_AUDIO_METADATA_CACHE_KEY = "gv-director-audio-metadata-v1";
export const DIRECTOR_SESSIONS_CACHE_KEY = "gv-director-sessions-v1";
export const DIRECTOR_AUDIO_ORDER_SAVE_DELAY_MS = 20_000;
export const DIRECTOR_SESSIONS_REFRESH_MIN_GAP_MS = 1500;
export const DIRECTOR_YOUTUBE_TRACKS_CACHE_KEY = "gv-director-youtube-tracks-v1";
export const DIRECTOR_PREFERRED_SESSION_STORAGE_KEY = "gv-director-preferred-session-v1";
export const DIRECTOR_YOUTUBE_PLAYLIST_IMPORT_LIMIT = 40;

let directorAudioLibraryMemoryCache = null;
let directorSessionsMemoryCache = null;
let directorYouTubeApiPromise = null;

export function buildYouTubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function buildYouTubeThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function extractYouTubePlaylistId(input) {
  const rawValue = String(input || "").trim();
  if (!rawValue) {
    return "";
  }

  try {
    const parsed = new URL(rawValue);
    const host = parsed.hostname.replace(/^www\./, "");

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be"
    ) {
      const playlistId = String(parsed.searchParams.get("list") || "").trim();
      if (/^[a-zA-Z0-9_-]{10,}$/.test(playlistId)) {
        return playlistId;
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function extractYouTubeVideoId(input) {
  const rawValue = String(input || "").trim();
  if (!rawValue) {
    return "";
  }

  const directIdMatch = rawValue.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directIdMatch) {
    return directIdMatch[0];
  }

  try {
    const parsed = new URL(rawValue);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.replace(/\//g, "").slice(0, 11);
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return String(parsed.searchParams.get("v") || "").slice(0, 11);
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2]?.slice(0, 11) || "";
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2]?.slice(0, 11) || "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function normalizeDirectorYouTubeTrack(track, index = 0) {
  const videoId = extractYouTubeVideoId(track?.videoId || track?.url || "");
  if (!videoId) {
    return null;
  }

  const safeName = String(track?.name || "").trim() || `Video ${index + 1}`;

  return {
    id: String(track?.id || `yt-${videoId}`),
    name: safeName,
    videoId,
    url: buildYouTubeWatchUrl(videoId),
    playlistId: String(track?.playlistId || "").trim(),
    playlistPosition: Number.isFinite(track?.playlistPosition)
      ? Number(track.playlistPosition)
      : index,
    thumbnailUrl:
      String(track?.thumbnailUrl || "").trim() || buildYouTubeThumbnailUrl(videoId),
  };
}

export function readCachedDirectorYouTubeTracks() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const cachedValue = window.localStorage.getItem(
      DIRECTOR_YOUTUBE_TRACKS_CACHE_KEY,
    );
    if (!cachedValue) {
      return [];
    }

    const parsed = JSON.parse(cachedValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((track, index) => normalizeDirectorYouTubeTrack(track, index))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function readStoredDirectorPreferredSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return String(
      window.localStorage.getItem(DIRECTOR_PREFERRED_SESSION_STORAGE_KEY) || "",
    ).trim();
  } catch {
    return "";
  }
}

export function writeStoredDirectorPreferredSessionId(sessionId) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSessionId = String(sessionId || "").trim();

  try {
    if (!normalizedSessionId) {
      window.localStorage.removeItem(DIRECTOR_PREFERRED_SESSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      DIRECTOR_PREFERRED_SESSION_STORAGE_KEY,
      normalizedSessionId,
    );
  } catch {
    // Ignore storage failures.
  }
}

export function writeCachedDirectorYouTubeTracks(tracks) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DIRECTOR_YOUTUBE_TRACKS_CACHE_KEY,
      JSON.stringify(Array.isArray(tracks) ? tracks : []),
    );
  } catch {
    // Ignore storage failures.
  }
}

export async function resolveDirectorYouTubeTrack(input) {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) {
    throw new Error("Paste a valid YouTube link.");
  }

  const track = {
    id: `yt-${videoId}`,
    name: `YouTube ${videoId}`,
    videoId,
    url: buildYouTubeWatchUrl(videoId),
    thumbnailUrl: buildYouTubeThumbnailUrl(videoId),
    playlistId: "",
    playlistPosition: 0,
  };

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        track.url,
      )}&format=json`,
      {
        cache: "no-store",
      },
    );

    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      const resolvedName = String(payload?.title || "").trim();
      const resolvedThumbnail = String(payload?.thumbnail_url || "").trim();
      if (resolvedName) {
        track.name = resolvedName;
      }
      if (resolvedThumbnail) {
        track.thumbnailUrl = resolvedThumbnail;
      }
    }
  } catch {
    // Keep the fallback title and thumbnail.
  }

  return track;
}

export async function resolveDirectorYouTubePlaylist(input) {
  const playlistId = extractYouTubePlaylistId(input);
  if (!playlistId) {
    throw new Error("Paste a valid YouTube playlist link.");
  }

  const YT = await loadDirectorYouTubeIframeApi();
  if (typeof document === "undefined") {
    throw new Error("This browser cannot load playlists right now.");
  }

  const mountNode = document.createElement("div");
  mountNode.style.position = "fixed";
  mountNode.style.left = "-9999px";
  mountNode.style.top = "0";
  mountNode.style.width = "1px";
  mountNode.style.height = "1px";
  mountNode.style.opacity = "0";
  document.body.appendChild(mountNode);

  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer = 0;
    let timeoutTimer = 0;
    let player = null;

    const cleanup = () => {
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      if (timeoutTimer) {
        window.clearTimeout(timeoutTimer);
      }
      try {
        player?.destroy();
      } catch {
        // Ignore cleanup failures.
      }
      mountNode.remove();
    };

    const finish = (videoIds) => {
      if (settled) {
        return;
      }
      settled = true;
      const uniqueIds = Array.from(
        new Set(
          (Array.isArray(videoIds) ? videoIds : []).filter((videoId) =>
            /^[a-zA-Z0-9_-]{11}$/.test(String(videoId || "")),
          ),
        ),
      );
      const limitedIds = uniqueIds.slice(0, DIRECTOR_YOUTUBE_PLAYLIST_IMPORT_LIMIT);
      cleanup();

      if (!limitedIds.length) {
        reject(new Error("No playable videos were found in that playlist."));
        return;
      }

      resolve({
        playlistId,
        importedCount: limitedIds.length,
        totalCount: uniqueIds.length,
        tracks: limitedIds.map((videoId, index) => ({
          id: `yt-${playlistId}-${videoId}`,
          name: `Playlist track ${index + 1}`,
          videoId,
          url: buildYouTubeWatchUrl(videoId),
          thumbnailUrl: buildYouTubeThumbnailUrl(videoId),
          playlistId,
          playlistPosition: index,
        })),
      });
    };

    const maybeResolvePlaylist = () => {
      try {
        const videoIds = player?.getPlaylist?.();
        if (Array.isArray(videoIds) && videoIds.length) {
          finish(videoIds);
        }
      } catch {
        // Wait for the next tick while the player warms up.
      }
    };

    timeoutTimer = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("This YouTube playlist took too long to load."));
    }, 12000);

    player = new YT.Player(mountNode, {
      height: "1",
      width: "1",
      host: "https://www.youtube-nocookie.com",
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        playsinline: 1,
        listType: "playlist",
        list: playlistId,
      },
      events: {
        onReady: (event) => {
          try {
            event.target.cuePlaylist({
              listType: "playlist",
              list: playlistId,
              index: 0,
            });
          } catch {
            try {
              event.target.cuePlaylist(playlistId, 0, 0);
            } catch {
              // Fall through to polling.
            }
          }
          maybeResolvePlaylist();
          pollTimer = window.setInterval(maybeResolvePlaylist, 140);
        },
        onStateChange: maybeResolvePlaylist,
        onError: () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(new Error("This YouTube playlist could not be loaded."));
        },
      },
    });
  });
}

export function loadDirectorYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window unavailable."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (directorYouTubeApiPromise) {
    return directorYouTubeApiPromise;
  }

  directorYouTubeApiPromise = new Promise((resolve, reject) => {
    let pollTimer = 0;
    let timeoutTimer = 0;

    const cleanup = () => {
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      if (timeoutTimer) {
        window.clearTimeout(timeoutTimer);
      }
    };

    const resolveIfReady = () => {
      if (window.YT?.Player) {
        cleanup();
        resolve(window.YT);
        return true;
      }
      return false;
    };

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolveIfReady();
    };

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    pollTimer = window.setInterval(() => {
      void resolveIfReady();
    }, 120);
    timeoutTimer = window.setTimeout(() => {
      cleanup();
      directorYouTubeApiPromise = null;
      reject(new Error("YouTube player timed out while loading."));
    }, 12_000);

    if (existingScript) {
      void resolveIfReady();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      cleanup();
      directorYouTubeApiPromise = null;
      reject(new Error("YouTube player script could not load."));
    };
    document.head.appendChild(script);
  });

  return directorYouTubeApiPromise;
}

export function serializeOrder(order) {
  return JSON.stringify(Array.isArray(order) ? order : []);
}

export function readCachedDirectorSessions() {
  if (directorSessionsMemoryCache?.length) {
    return directorSessionsMemoryCache;
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const cachedValue = window.sessionStorage.getItem(
      DIRECTOR_SESSIONS_CACHE_KEY,
    );
    if (!cachedValue) {
      return [];
    }
    const parsed = JSON.parse(cachedValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    directorSessionsMemoryCache = parsed;
    return parsed;
  } catch {
    return [];
  }
}

export function writeCachedDirectorSessions(sessions) {
  if (!Array.isArray(sessions)) {
    return;
  }

  directorSessionsMemoryCache = sessions;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      DIRECTOR_SESSIONS_CACHE_KEY,
      JSON.stringify(sessions),
    );
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

export function readCachedDirectorAudioLibrary() {
  const files = readSharedSoundEffectsLibrary();
  directorAudioLibraryMemoryCache = files;
  return files;
}

export function writeCachedDirectorAudioLibrary(files) {
  if (!Array.isArray(files)) {
    return;
  }

  directorAudioLibraryMemoryCache = files;
  writeSharedSoundEffectsLibrary(files);
}

export function createSpeechSettings() {
  return {
    enabled: true,
    muted: false,
    mode: "full",
    volume: 1,
  };
}

export const DIRECTOR_AUTO_ANNOUNCE_EVENT_TYPES = new Set([
  "score_update",
  "undo",
  "innings_change",
  "target_chased",
  "match_end",
]);

export function buildDirectorScoreLine(match) {
  if (!match) return "";
  const battingTeam = getBattingTeamBundle(match);
  return `${battingTeam.name} ${match.score || 0}/${match.outs || 0}`;
}

export function mergeDirectorMatchIntoSessions(currentSessions, nextMatch) {
  if (!Array.isArray(currentSessions) || !nextMatch?._id) {
    return currentSessions;
  }

  let didChange = false;

  const nextSessions = currentSessions.map((item) => {
    const itemMatchId = item?.match?._id || "";
    const itemSessionId = item?.session?._id || "";
    const nextMatchId = String(nextMatch._id || "");
    const nextSessionId = String(nextMatch.sessionId || "");

    if (itemMatchId !== nextMatchId && itemSessionId !== nextSessionId) {
      return item;
    }

    didChange = true;
    const nextIsLive = Boolean(nextMatch.isOngoing && !nextMatch.result);

    return {
      ...item,
      session: {
        ...item.session,
        match: nextMatchId,
        matchImageUrl:
          nextMatch.matchImageUrl || item.session?.matchImageUrl || "",
        teamAName: nextMatch.teamAName || item.session?.teamAName || "",
        teamBName: nextMatch.teamBName || item.session?.teamBName || "",
        isLive: nextIsLive,
      },
      match: {
        ...item.match,
        ...nextMatch,
      },
      updatedAt: new Date(
        nextMatch.updatedAt || item.updatedAt || Date.now(),
      ).toISOString(),
      isLive: nextIsLive,
    };
  });

  return didChange ? nextSessions : currentSessions;
}

export function getDirectorActiveHistory(match) {
  if (!match) {
    return [];
  }

  return match[match.innings === "second" ? "innings2" : "innings1"]?.history || [];
}

export function getDirectorOversDisplay(match) {
  const legalBalls = countLegalBalls(getDirectorActiveHistory(match));
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

export function getDirectorChaseSummary(match) {
  if (!match || match.innings !== "second") {
    return "";
  }

  const target = Number(match?.innings1?.score || 0) + 1;
  const runsNeeded = Math.max(0, target - Number(match?.score || 0));
  if (runsNeeded <= 0) {
    return `Target ${target} reached`;
  }

  const totalBalls = Math.max(Number(match?.overs || 0), 0) * 6;
  const legalBalls = countLegalBalls(getDirectorActiveHistory(match));
  const ballsLeft = Math.max(totalBalls - legalBalls, 0);
  const oversLeft = `${Math.floor(ballsLeft / 6)}.${ballsLeft % 6}`;
  return `Need ${runsNeeded} from ${oversLeft}`;
}

export function getDirectorPreferredMatch(liveMatch, sessionMatch = null) {
  if (liveMatch?._id) {
    return liveMatch;
  }

  return sessionMatch || null;
}

export function getPreferredLiveSessionId(sessions, preferredSessionId = "") {
  const nextSessions = Array.isArray(sessions) ? sessions : [];
  const preferredLive = preferredSessionId
    ? nextSessions.find(
        (item) => item.session?._id === preferredSessionId && item.isLive,
      )
    : null;
  const firstLive = nextSessions.find((item) => item.isLive);
  return preferredLive?.session?._id || firstLive?.session?._id || "";
}

export function resolveDirectorAutoManageSessionId(
  sessions,
  {
    preferredSessionId = "",
    selectedSessionId = "",
    autoManageRequested = false,
  } = {},
) {
  const liveSessions = (Array.isArray(sessions) ? sessions : []).filter(
    (item) => item?.isLive && item?.session?._id,
  );

  if (!liveSessions.length) {
    return "";
  }

  const preferredLive = preferredSessionId
    ? liveSessions.find((item) => item.session?._id === preferredSessionId)
    : null;
  if (preferredLive?.session?._id) {
    return preferredLive.session._id;
  }

  if (autoManageRequested && selectedSessionId) {
    const selectedLive = liveSessions.find(
      (item) => item.session?._id === selectedSessionId,
    );
    if (selectedLive?.session?._id) {
      return selectedLive.session._id;
    }
  }

  if (liveSessions.length === 1) {
    return liveSessions[0].session._id;
  }

  return "";
}

export function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function findLibraryCardIdFromPoint(clientX, clientY) {
  if (typeof document === "undefined") {
    return "";
  }

  const hoveredElement = document.elementFromPoint(clientX, clientY);
  if (!(hoveredElement instanceof HTMLElement)) {
    return "";
  }

  const card = hoveredElement.closest("[data-library-effect-id]");
  if (!(card instanceof HTMLElement)) {
    return "";
  }

  return card.dataset.libraryEffectId || "";
}


