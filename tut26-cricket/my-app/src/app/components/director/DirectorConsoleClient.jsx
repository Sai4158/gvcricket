"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaBroadcastTower,
  FaBullhorn,
  FaChevronDown,
  FaCompactDisc,
  FaExternalLinkAlt,
  FaForward,
  FaGripVertical,
  FaHeadphones,
  FaInfoCircle,
  FaMicrophone,
  FaMusic,
  FaPause,
  FaPlay,
  FaPowerOff,
  FaStop,
  FaTrash,
  FaVolumeUp,
  FaWifi,
  FaYoutube,
} from "react-icons/fa";
import LiquidSportText from "../home/LiquidSportText";
import SessionCoverHero from "../shared/SessionCoverHero";
import LoadingButton from "../shared/LoadingButton";
import DirectorSessionPicker from "./DirectorSessionPicker";
import useEventSource from "../live/useEventSource";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import useWalkieTalkie from "../live/useWalkieTalkie";
import { WalkieNotice, WalkieTalkButton } from "../live/WalkiePanel";
import { buildCurrentScoreAnnouncement } from "../../lib/live-announcements";
import { getBattingTeamBundle } from "../../lib/team-utils";
import {
  didSharedWalkieDisable,
  didSharedWalkieEnable,
  getNonUmpireWalkieUiState,
  getNonUmpireWalkieToggleAction,
  NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
} from "../../lib/walkie-device-state";
import { getWalkieRemoteSpeakerState } from "../../lib/walkie-ui";
import {
  getCachedAudioAssetUrl,
  isIOSSafari,
  isUiAudioUnlocked,
  playBufferedUiAudio,
  playUiTone,
  primeUiAudio,
  restorePreferredAudioSessionType,
  setPreferredAudioSessionType,
  subscribeUiAudioUnlock,
} from "../../lib/page-audio";
import { countLegalBalls } from "../../lib/match-scoring";

const DIRECTOR_AUDIO_LIBRARY_CACHE_KEY = "gv-director-audio-library-v1";
const DIRECTOR_AUDIO_METADATA_CACHE_KEY = "gv-director-audio-metadata-v1";
const DIRECTOR_SESSIONS_CACHE_KEY = "gv-director-sessions-v1";
const DIRECTOR_AUDIO_LIBRARY_CACHE_TTL_MS = 10 * 60 * 1000;
const DIRECTOR_AUDIO_ORDER_SAVE_DELAY_MS = 20_000;
const DIRECTOR_SESSIONS_REFRESH_MIN_GAP_MS = 1500;
const DIRECTOR_YOUTUBE_TRACKS_CACHE_KEY = "gv-director-youtube-tracks-v1";
const DIRECTOR_YOUTUBE_PLAYLIST_IMPORT_LIMIT = 40;
let directorAudioLibraryMemoryCache = null;
let directorAudioLibraryPromise = null;
let directorSessionsMemoryCache = null;
let directorAudioMetadataMemoryCache = {};
let directorYouTubeApiPromise = null;

function buildYouTubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function buildYouTubeThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function extractYouTubePlaylistId(input) {
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

function extractYouTubeVideoId(input) {
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

function normalizeDirectorYouTubeTrack(track, index = 0) {
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

function readCachedDirectorYouTubeTracks() {
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

function writeCachedDirectorYouTubeTracks(tracks) {
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

async function resolveDirectorYouTubeTrack(input) {
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

async function resolveDirectorYouTubePlaylist(input) {
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

function loadDirectorYouTubeIframeApi() {
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

function serializeOrder(order) {
  return JSON.stringify(Array.isArray(order) ? order : []);
}

function getDirectorAudioOrderStorageKey(sessionId) {
  return "gv-director-audio-order:global";
}

function readCachedDirectorSessions() {
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

function writeCachedDirectorSessions(sessions) {
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

function readCachedDirectorAudioLibrary() {
  if (directorAudioLibraryMemoryCache?.length) {
    return directorAudioLibraryMemoryCache;
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const cachedValue = window.localStorage.getItem(
      DIRECTOR_AUDIO_LIBRARY_CACHE_KEY,
    );
    if (!cachedValue) {
      return [];
    }

    const parsed = JSON.parse(cachedValue);
    const savedAt = Number(parsed?.savedAt || 0);
    const files = Array.isArray(parsed?.files) ? parsed.files : [];
    if (!files.length) {
      return [];
    }

    if (savedAt && Date.now() - savedAt > DIRECTOR_AUDIO_LIBRARY_CACHE_TTL_MS) {
      return [];
    }

    directorAudioLibraryMemoryCache = files;
    return files;
  } catch {
    return [];
  }
}

function writeCachedDirectorAudioLibrary(files) {
  if (!Array.isArray(files)) {
    return;
  }

  directorAudioLibraryMemoryCache = files;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DIRECTOR_AUDIO_LIBRARY_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        files,
      }),
    );
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

function createSpeechSettings() {
  return {
    enabled: true,
    muted: false,
    mode: "full",
    volume: 1,
  };
}

const DIRECTOR_AUTO_ANNOUNCE_EVENT_TYPES = new Set([
  "score_update",
  "undo",
  "innings_change",
  "target_chased",
  "match_end",
]);

function buildDirectorScoreLine(match) {
  if (!match) return "";
  const battingTeam = getBattingTeamBundle(match);
  return `${battingTeam.name} ${match.score || 0}/${match.outs || 0}`;
}

function mergeDirectorMatchIntoSessions(currentSessions, nextMatch) {
  if (!Array.isArray(currentSessions) || !nextMatch?._id) {
    return currentSessions;
  }

  let didChange = false;

  const nextSessions = currentSessions.map((item) => {
    const itemMatchId = item?.match?._id || "";
    const itemSessionId = item?.session?._id || "";
    const nextMatchId = String(nextMatch._id || "");
    const nextSessionId = String(nextMatch.sessionId || "");

    if (
      itemMatchId !== nextMatchId &&
      itemSessionId !== nextSessionId
    ) {
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

function getDirectorActiveHistory(match) {
  if (!match) {
    return [];
  }

  return match[match.innings === "second" ? "innings2" : "innings1"]?.history || [];
}

function getDirectorOversDisplay(match) {
  const legalBalls = countLegalBalls(getDirectorActiveHistory(match));
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function getDirectorChaseSummary(match) {
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

function getDirectorPreferredMatch(liveMatch, sessionMatch = null) {
  if (liveMatch?._id) {
    return liveMatch;
  }

  return sessionMatch || null;
}

function getPreferredLiveSessionId(sessions, preferredSessionId = "") {
  const nextSessions = Array.isArray(sessions) ? sessions : [];
  const preferredLive = preferredSessionId
    ? nextSessions.find(
        (item) => item.session?._id === preferredSessionId && item.isLive,
      )
    : null;
  const firstLive = nextSessions.find((item) => item.isLive);
  return preferredLive?.session?._id || firstLive?.session?._id || "";
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function findLibraryCardIdFromPoint(clientX, clientY) {
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

function IosSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-8 w-13.5 items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/35 ${
        checked
          ? "border-emerald-300/35 bg-emerald-500 shadow-[0_10px_24px_rgba(16,185,129,0.22)]"
          : "border-white/10 bg-white/8"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-6.5" : "translate-x-0.75"
        }`}
      />
    </button>
  );
}

function HelpButton({ title, body }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const [panelStyle, setPanelStyle] = useState(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const updatePanelPosition = () => {
      const buttonRect = buttonRef.current?.getBoundingClientRect();
      if (!buttonRect || typeof window === "undefined") {
        return;
      }

      const panelWidth = Math.min(288, Math.max(220, window.innerWidth - 24));
      const top = Math.min(buttonRect.bottom + 10, window.innerHeight - 24);
      const left = Math.min(
        Math.max(12, buttonRect.right - panelWidth),
        Math.max(12, window.innerWidth - panelWidth - 12),
      );

      setPanelStyle({
        top: `${top}px`,
        left: `${left}px`,
        width: `${panelWidth}px`,
      });
    };

    const handlePointerDown = (event) => {
      if (
        !containerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    updatePanelPosition();
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
        aria-label={`How ${title} works`}
      >
        <FaInfoCircle />
      </button>
      {open && panelStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="fixed z-140 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,32,0.98),rgba(11,11,16,0.98))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            >
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{body}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const DIRECTOR_CARD_THEMES = {
  slate: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(148,163,184,0.16),transparent_42%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(244,244,245,0),rgba(226,232,240,0.72)_22%,rgba(125,211,252,0.72)_62%,rgba(244,244,245,0))]",
    icon: "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.04))] text-white shadow-[0_10px_26px_rgba(15,23,42,0.22)]",
  },
  emerald: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(16,185,129,0.2),transparent_42%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(52,211,153,0.86)_18%,rgba(34,211,238,0.82)_58%,rgba(0,0,0,0))]",
    icon: "border-emerald-300/14 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(6,95,70,0.08))] text-emerald-100 shadow-[0_10px_26px_rgba(16,185,129,0.18)]",
  },
  amber: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(245,158,11,0.2),transparent_42%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(251,191,36,0.85)_18%,rgba(245,158,11,0.82)_54%,rgba(34,211,238,0.54)_82%,rgba(0,0,0,0))]",
    icon: "border-amber-300/14 bg-[linear-gradient(180deg,rgba(245,158,11,0.18),rgba(120,53,15,0.08))] text-amber-100 shadow-[0_10px_26px_rgba(245,158,11,0.18)]",
  },
  violet: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.2),transparent_42%),radial-gradient(circle_at_88%_100%,rgba(59,130,246,0.12),transparent_34%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(192,132,252,0.84)_18%,rgba(99,102,241,0.74)_54%,rgba(34,211,238,0.6)_82%,rgba(0,0,0,0))]",
    icon: "border-violet-300/14 bg-[linear-gradient(180deg,rgba(139,92,246,0.18),rgba(76,29,149,0.08))] text-violet-100 shadow-[0_10px_26px_rgba(139,92,246,0.18)]",
  },
  cyan: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.2),transparent_42%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(34,211,238,0.86)_18%,rgba(59,130,246,0.74)_54%,rgba(250,204,21,0.52)_82%,rgba(0,0,0,0))]",
    icon: "border-cyan-300/14 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(8,47,73,0.08))] text-cyan-100 shadow-[0_10px_26px_rgba(34,211,238,0.18)]",
  },
};

function Card({
  title,
  subtitle = "",
  icon,
  children,
  action = null,
  help = null,
  accent = "slate",
}) {
  const theme = DIRECTOR_CARD_THEMES[accent] || DIRECTOR_CARD_THEMES.slate;
  return (
    <section
      className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(10,10,14,0.98))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] before:pointer-events-none before:absolute before:inset-0 before:opacity-100 after:pointer-events-none after:absolute after:inset-x-5 after:top-0 after:h-px after:rounded-full ${theme.shellGlow}`}
    >
      <div
        className={`absolute inset-x-5 top-0 h-0.5 rounded-full ${theme.strip}`}
      />
      <div className="relative mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${theme.icon}`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
          {help ? <HelpButton title={help.title} body={help.body} /> : null}
          {action}
        </div>
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

const HOLD_BUTTON_INTERACTION_PROPS = {
  draggable: false,
  onContextMenu: (event) => {
    event.preventDefault();
  },
  onMouseDown: (event) => {
    event.preventDefault();
  },
  onDragStart: (event) => {
    event.preventDefault();
  },
  style: {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    touchAction: "none",
    WebkitTapHighlightColor: "transparent",
  },
};

function SessionHeader({
  selectedSession,
  liveMatch,
  onChangeSession,
  readCurrentScore,
}) {
  const session = selectedSession?.session;
  const match = getDirectorPreferredMatch(liveMatch, selectedSession?.match);
  const isLive = Boolean(match?.isOngoing && !match?.result) || Boolean(selectedSession?.isLive);
  const imageUrl = match?.matchImageUrl || session?.matchImageUrl || "";
  const teams =
    match?.teamAName && match?.teamBName
      ? `${match.teamAName} vs ${match.teamBName}`
      : session?.teamAName && session?.teamBName
        ? `${session.teamAName} vs ${session.teamBName}`
        : "Teams pending";
  const score = Number(match?.score || 0);
  const outs = Number(match?.outs || 0);
  const oversDisplay = getDirectorOversDisplay(match);
  const chaseSummary = getDirectorChaseSummary(match);

  return (
    <SessionCoverHero
      imageUrl={imageUrl}
      alt={`${session?.name || "Session"} cover`}
      className="mb-5"
      priority
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
              {isLive ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-white">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Live
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
              {session?.name || "Director Console"}
            </h1>
            <p className="mt-1 text-sm text-zinc-200/90">{teams}</p>
          </div>

          <div className="flex items-center justify-center gap-2 sm:justify-end">
            <HelpButton
              title="Director console"
              body="Use this screen to manage the live session, PA mic, music, effects, and walkie."
            />
            <button
              type="button"
              onClick={readCurrentScore}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100 transition hover:bg-white/10"
              aria-label="Read current score"
            >
              <FaVolumeUp />
            </button>
            <button
              type="button"
              onClick={onChangeSession}
              className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 max-sm:text-xs"
            >
              Change
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                Live score
              </p>
              <p className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                {buildDirectorScoreLine(match)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Overs
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{oversDisplay}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-200">
              Wickets {outs}
            </span>
            {chaseSummary ? (
              <span className="inline-flex items-center rounded-full border border-amber-300/16 bg-amber-500/10 px-3 py-1.5 text-amber-100">
                {chaseSummary}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full border border-emerald-300/16 bg-emerald-500/10 px-3 py-1.5 text-emerald-100">
              {match?.result
                ? "Match finished"
                : isLive
                  ? "Managing live"
                  : "Waiting for live updates"}
            </span>
          </div>
        </div>
      </div>
    </SessionCoverHero>
  );
}

export default function DirectorConsoleClient({
  initialAuthorized = false,
  initialSessions = [],
  initialPreferredSessionId = "",
  initialAutoManage = false,
}) {
  const router = useRouter();
  const initialTargetSessionId = getPreferredLiveSessionId(
    initialSessions,
    initialPreferredSessionId,
  );
  const [authorized, setAuthorized] = useState(Boolean(initialAuthorized));
  const [sessions, setSessions] = useState(initialSessions || []);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [showDirectorPinStep, setShowDirectorPinStep] = useState(
    Boolean(initialAutoManage && initialTargetSessionId && !initialAuthorized),
  );
  const [selectedSessionId, setSelectedSessionId] = useState(
    initialTargetSessionId,
  );
  const [managedSessionId, setManagedSessionId] = useState(() =>
    initialAuthorized && initialAutoManage && initialTargetSessionId
      ? initialTargetSessionId
      : "",
  );
  const [showPicker, setShowPicker] = useState(false);
  const [musicTracks, setMusicTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [musicState, setMusicState] = useState("idle");
  const [directorAudioMode, setDirectorAudioMode] = useState("cut");
  const [musicVolume, setMusicVolume] = useState(0.8);
  const [musicInput, setMusicInput] = useState("");
  const [isAddingMusicTrack, setIsAddingMusicTrack] = useState(false);
  const [hasLoadedMusicTracks, setHasLoadedMusicTracks] = useState(false);
  const [musicPlayerReady, setMusicPlayerReady] = useState(false);
  const [musicPlayerError, setMusicPlayerError] = useState("");
  const [musicPlayerBootNonce, setMusicPlayerBootNonce] = useState(0);
  const [masterVolume, setMasterVolume] = useState(1);
  const [speakerDeviceId, setSpeakerDeviceId] = useState("default");
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [speakerMessage, setSpeakerMessage] = useState("");
  const [consoleError, setConsoleError] = useState("");
  const [musicMessage, setMusicMessage] = useState("");
  const [directorHoldLive, setDirectorHoldLive] = useState(false);
  const [directorSpeakerOn, setDirectorSpeakerOn] = useState(false);
  const [directorWalkieOn, setDirectorWalkieOn] = useState(false);
  const [directorWalkieNotice, setDirectorWalkieNotice] = useState("");
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryOrder, setLibraryOrder] = useState([]);
  const [libraryDurations, setLibraryDurations] = useState({});
  const [libraryCurrentTime, setLibraryCurrentTime] = useState(0);
  const [libraryLiveId, setLibraryLiveId] = useState("");
  const [libraryState, setLibraryState] = useState("idle");
  const [libraryPanelOpen, setLibraryPanelOpen] = useState(true);
  const [effectsNeedsUnlock, setEffectsNeedsUnlock] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(() => isUiAudioUnlocked());
  const [draggingLibraryId, setDraggingLibraryId] = useState("");
  const [libraryDropTargetId, setLibraryDropTargetId] = useState("");
  const preferredSessionIdRef = useRef(initialPreferredSessionId || "");
  const pendingInitialManageRef = useRef(Boolean(initialAutoManage));
  const pendingLibraryOrderRef = useRef(null);
  const libraryOrderSaveTimerRef = useRef(null);
  const lastPersistedLibraryOrderRef = useRef(serializeOrder([]));
  const musicTrackRowRefs = useRef(new Map());
  const audioRef = useRef(null);
  const youtubePlayerHostRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const effectsAudioRef = useRef(null);
  const bufferedEffectPlaybackRef = useRef(null);
  const bufferedEffectTimerRef = useRef(null);
  const directorMicPointerIdRef = useRef(null);
  const directorMicHoldingRef = useRef(false);
  const previousDirectorWalkieEnabledRef = useRef(false);
  const previousDirectorWalkieRequestStateRef = useRef("idle");
  const previousManagedMatchIdRef = useRef("");
  const directorWalkieNoticeTimerRef = useRef(null);
  const effectPlayRequestRef = useRef(0);
  const effectPrimeRequestRef = useRef(null);
  const playEffectRef = useRef(null);
  const musicResumeTimerRef = useRef(null);
  const musicUrlsRef = useRef([]);
  const musicTracksRef = useRef([]);
  const currentTrackIndexRef = useRef(0);
  const loadedMusicVideoIdRef = useRef("");
  const pendingMusicAutoplayRef = useRef(false);
  const cachedEffectUrlRef = useRef(new Map());
  const musicEffectDuckFactorRef = useRef(1);
  const musicDuckAnimationFrameRef = useRef(0);
  const sharedBoundaryDuckTimerRef = useRef(null);
  const sharedBoundaryEffectActiveRef = useRef(false);
  const ambientAudioSessionTypeRef = useRef("");
  const lastDirectorAnnouncedLiveEventRef = useRef("");
  const lastHandledSharedSoundEffectEventRef = useRef("");
  const lastHandledBoundarySoundEffectEventRef = useRef("");
  const soundEffectPlaybackCutoffRef = useRef(0);
  const directorSessionsRefreshPromiseRef = useRef(null);
  const lastDirectorSessionsRefreshAtRef = useRef(0);
  const pendingDirectorAnnouncementRef = useRef(null);
  const libraryPointerDragRef = useRef({
    pointerId: null,
    activeId: "",
    targetId: "",
  });
  const libraryLoadTimeoutRef = useRef(null);
  const [speechSettings, setSpeechSettings] = useState(createSpeechSettings);
  const speech = useSpeechAnnouncer(speechSettings);
  const stopDirectorSpeech = speech.stop;
  const micMonitor = useLocalMicMonitor();
  const iOSSafari = useMemo(() => isIOSSafari(), []);
  const usePointerLibraryReorder = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(
      window.matchMedia?.("(pointer: coarse)")?.matches ||
        window.navigator?.maxTouchPoints > 0,
    );
  }, []);
  const currentTrack = musicTracks[currentTrackIndex];
  const isPlaylistInput = useMemo(
    () => Boolean(extractYouTubePlaylistId(musicInput)),
    [musicInput],
  );

  const getDirectorBoundaryDuckWindowMs = useCallback(
    (liveEvent) => {
      const preDelayMs = Math.max(
        0,
        Number(liveEvent?.preAnnouncementDelayMs || 0),
      );
      const durationKey = String(
        liveEvent?.effectId || liveEvent?.effectFileName || "",
      ).trim();
      const knownDurationMs = durationKey
        ? Math.round(Number(libraryDurations[durationKey] || 0) * 1000)
        : 0;
      const fallbackEffectMs = 2400;

      return Math.max(
        1200,
        preDelayMs + (knownDurationMs > 0 ? knownDurationMs : fallbackEffectMs) + 180,
      );
    },
    [libraryDurations],
  );

  const hydrateImportedMusicTracks = useCallback((tracksToHydrate) => {
    if (!Array.isArray(tracksToHydrate) || !tracksToHydrate.length) {
      return;
    }

    void Promise.allSettled(
      tracksToHydrate.map(async (track) => {
        const resolved = await resolveDirectorYouTubeTrack(track.url);
        return {
          id: track.id,
          name: resolved.name,
          thumbnailUrl: resolved.thumbnailUrl,
        };
      }),
    ).then((results) => {
      const nextMetadataById = new Map();
      results.forEach((result) => {
        if (result.status !== "fulfilled" || !result.value?.id) {
          return;
        }
        nextMetadataById.set(result.value.id, result.value);
      });

      if (!nextMetadataById.size) {
        return;
      }

      setMusicTracks((current) =>
        current.map((track) => {
          const metadata = nextMetadataById.get(track.id);
          return metadata
            ? {
                ...track,
                name: metadata.name || track.name,
                thumbnailUrl: metadata.thumbnailUrl || track.thumbnailUrl,
              }
            : track;
        }),
      );
    });
  }, []);

  useEffect(() => {
    setMusicTracks(readCachedDirectorYouTubeTracks());
    setHasLoadedMusicTracks(true);
  }, []);

  useEffect(() => {
    musicTracksRef.current = musicTracks;
    if (hasLoadedMusicTracks) {
      writeCachedDirectorYouTubeTracks(musicTracks);
    }
  }, [hasLoadedMusicTracks, musicTracks]);

  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  const handlePasteMusicLink = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      setMusicMessage("Clipboard paste is not supported here.");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!String(clipboardText || "").trim()) {
        setMusicMessage("Clipboard is empty.");
        return;
      }
      setMusicInput(String(clipboardText || "").trim());
      setMusicMessage("Link pasted.");
    } catch {
      setMusicMessage("Could not paste from clipboard.");
    }
  }, []);

  const cancelMusicDuckAnimation = useCallback(() => {
    if (musicDuckAnimationFrameRef.current) {
      window.cancelAnimationFrame(musicDuckAnimationFrameRef.current);
      musicDuckAnimationFrameRef.current = 0;
    }
  }, []);

  const getBaseMusicVolume = useCallback(() => {
    const micDuckFactor = micMonitor.isActive ? 0.24 : 1;
    return Math.max(0, Math.min(1, musicVolume * masterVolume * micDuckFactor));
  }, [masterVolume, micMonitor.isActive, musicVolume]);

  const getMusicTargetVolume = useCallback(
    (duckFactor = musicEffectDuckFactorRef.current) =>
      Math.max(0, Math.min(1, getBaseMusicVolume() * duckFactor)),
    [getBaseMusicVolume],
  );

  const setMusicOutputVolume = useCallback((nextVolume) => {
    const safeVolume = Math.max(0, Math.min(1, Number(nextVolume) || 0));
    const audio = audioRef.current;
    if (audio) {
      audio.volume = safeVolume;
    }

    const player = youtubePlayerRef.current;
    if (player && typeof player.setVolume === "function") {
      try {
        player.setVolume(Math.round(safeVolume * 100));
      } catch {
        // Ignore YouTube player volume failures.
      }
    }
  }, []);

  const getCurrentMusicOutputVolume = useCallback(() => {
    const player = youtubePlayerRef.current;
    if (player && typeof player.getVolume === "function") {
      try {
        const playerVolume = Number(player.getVolume());
        if (Number.isFinite(playerVolume)) {
          return Math.max(0, Math.min(1, playerVolume / 100));
        }
      } catch {
        // Ignore player volume reads and fall back below.
      }
    }

    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.volume)) {
      return Math.max(0, Math.min(1, audio.volume));
    }

    return getMusicTargetVolume();
  }, [getMusicTargetVolume]);

  const applyMusicDuck = useCallback(
    (duckFactor, { durationMs = 220 } = {}) => {
      musicEffectDuckFactorRef.current = duckFactor;
      const audio = audioRef.current;
      const player = youtubePlayerRef.current;
      if (!audio && !player) {
        return;
      }

      cancelMusicDuckAnimation();

      const targetVolume = getMusicTargetVolume(duckFactor);
      const startVolume = getCurrentMusicOutputVolume();

      if (durationMs <= 0 || Math.abs(startVolume - targetVolume) < 0.01) {
        setMusicOutputVolume(targetVolume);
        return;
      }

      const startTime = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - startTime) / durationMs);
        const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
        setMusicOutputVolume(
          startVolume + (targetVolume - startVolume) * eased,
        );

        if (progress < 1) {
          musicDuckAnimationFrameRef.current =
            window.requestAnimationFrame(step);
        } else {
          musicDuckAnimationFrameRef.current = 0;
        }
      };

      musicDuckAnimationFrameRef.current = window.requestAnimationFrame(step);
    },
    [
      cancelMusicDuckAnimation,
      getCurrentMusicOutputVolume,
      getMusicTargetVolume,
      setMusicOutputVolume,
    ],
  );

  useEffect(() => {
    if (!musicTracks.length) {
      setCurrentTrackIndex(0);
      loadedMusicVideoIdRef.current = "";
      setMusicState("idle");
      return;
    }

    if (currentTrackIndex >= musicTracks.length) {
      setCurrentTrackIndex(musicTracks.length - 1);
    }
  }, [currentTrackIndex, musicTracks.length]);

  const prepareMusicForDirectorAnnouncement = useCallback(() => {
    const player = youtubePlayerRef.current;
    if (!player || !currentTrack) {
      return;
    }

    if (directorAudioMode === "duck") {
      applyMusicDuck(0.14, { durationMs: 180 });
      return;
    }

    if (musicState !== "playing") {
      pendingMusicAutoplayRef.current = false;
      return;
    }

    pendingMusicAutoplayRef.current = true;
    if (musicResumeTimerRef.current) {
      window.clearTimeout(musicResumeTimerRef.current);
      musicResumeTimerRef.current = null;
    }
    try {
      player.pauseVideo();
      setMusicState("paused");
      setMusicMessage("Paused for score announcement.");
    } catch {
      pendingMusicAutoplayRef.current = false;
    }
  }, [
    applyMusicDuck,
    currentTrack,
    directorAudioMode,
    musicState,
  ]);

  const speakDirectorScoreAnnouncement = useCallback(
    (targetMatch, eventId, options = {}) => {
      const announcement = buildCurrentScoreAnnouncement(targetMatch);
      if (!targetMatch?._id || !announcement) {
        return false;
      }

      prepareMusicForDirectorAnnouncement();
      return speech.speak(announcement, {
        key: `director-auto-score-${eventId || targetMatch._id}`,
        ignoreEnabled: false,
        interrupt: options.interrupt ?? true,
        priority: options.priority ?? 4,
        rate: 0.9,
        userGesture: Boolean(options.userGesture),
      });
    },
    [prepareMusicForDirectorAnnouncement, speech],
  );

  const flushPendingDirectorAnnouncement = useCallback(() => {
    const pendingAnnouncement = pendingDirectorAnnouncementRef.current;
    if (
      !pendingAnnouncement ||
      !speechSettings.enabled ||
      speechSettings.muted ||
      speechSettings.mode === "silent"
    ) {
      return;
    }

    const spoke = speakDirectorScoreAnnouncement(
      pendingAnnouncement.match,
      pendingAnnouncement.eventId,
      {
        interrupt: true,
      },
    );
    if (spoke || speech.needsGesture || speech.status === "waiting_for_gesture") {
      lastDirectorAnnouncedLiveEventRef.current = pendingAnnouncement.eventId;
      pendingDirectorAnnouncementRef.current = null;
    }
  }, [
    speakDirectorScoreAnnouncement,
    speech.needsGesture,
    speech.status,
    speechSettings.enabled,
    speechSettings.mode,
    speechSettings.muted,
  ]);

  const clearSharedBoundaryDuckWindow = useCallback(() => {
    sharedBoundaryEffectActiveRef.current = false;
    if (sharedBoundaryDuckTimerRef.current) {
      window.clearTimeout(sharedBoundaryDuckTimerRef.current);
      sharedBoundaryDuckTimerRef.current = null;
    }
  }, []);

  const showTemporaryDirectorWalkieNotice = useCallback(
    (message, duration = 2600) => {
      setDirectorWalkieNotice(message);
      if (directorWalkieNoticeTimerRef.current) {
        window.clearTimeout(directorWalkieNoticeTimerRef.current);
      }
      directorWalkieNoticeTimerRef.current = window.setTimeout(() => {
        setDirectorWalkieNotice("");
        directorWalkieNoticeTimerRef.current = null;
      }, duration);
    },
    [],
  );

  useEffect(() => subscribeUiAudioUnlock(setAudioUnlocked), []);

  useEffect(() => {
    soundEffectPlaybackCutoffRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (audioUnlocked) {
      setEffectsNeedsUnlock(false);
      setConsoleError((current) =>
        current ===
        "Safari blocked this audio. Tap Enable Audio once, then play the sound again."
          ? ""
          : current,
      );
    }
  }, [audioUnlocked]);

  useEffect(() => {
    return () => {
      if (directorWalkieNoticeTimerRef.current) {
        window.clearTimeout(directorWalkieNoticeTimerRef.current);
        directorWalkieNoticeTimerRef.current = null;
      }
      clearSharedBoundaryDuckWindow();
    };
  }, [clearSharedBoundaryDuckWindow]);

  useEffect(() => {
    if (initialSessions?.length) {
      writeCachedDirectorSessions(initialSessions);
      lastDirectorSessionsRefreshAtRef.current = Date.now();
    }
  }, [initialSessions]);

  const selectedSession = useMemo(() => {
    return (
      sessions.find((item) => item.session?._id === selectedSessionId) ||
      sessions.find((item) => item.isLive) ||
      sessions[0] ||
      null
    );
  }, [selectedSessionId, sessions]);

  const managedSession = useMemo(() => {
    if (!managedSessionId) {
      return null;
    }
    return (
      sessions.find((item) => item.session?._id === managedSessionId) || null
    );
  }, [managedSessionId, sessions]);

  const audioOrderStorageKey = useMemo(
    () => getDirectorAudioOrderStorageKey(),
    [],
  );

  const [liveMatch, setLiveMatch] = useState(managedSession?.match || null);
  useEffect(() => {
    const nextManagedMatch = managedSession?.match || null;
    const nextManagedMatchId = nextManagedMatch?._id || "";

    if (previousManagedMatchIdRef.current === nextManagedMatchId) {
      return;
    }

    previousManagedMatchIdRef.current = nextManagedMatchId;

    pendingDirectorAnnouncementRef.current = null;
    lastDirectorAnnouncedLiveEventRef.current =
      nextManagedMatch?.lastLiveEvent?.id || "";
    lastHandledSharedSoundEffectEventRef.current =
      nextManagedMatch?.lastLiveEvent?.type === "sound_effect"
        ? nextManagedMatch.lastLiveEvent.id || ""
        : "";
    lastHandledBoundarySoundEffectEventRef.current =
      nextManagedMatch?.lastLiveEvent?.type === "sound_effect" &&
      nextManagedMatch?.lastLiveEvent?.trigger === "score_boundary"
        ? nextManagedMatch.lastLiveEvent.id || ""
        : "";
    clearSharedBoundaryDuckWindow();

    if (!nextManagedMatch?._id) {
      setLiveMatch(null);
      return;
    }

    setLiveMatch((current) =>
      current?._id === nextManagedMatch._id && current ? current : nextManagedMatch,
    );
  }, [clearSharedBoundaryDuckWindow, managedSession?.match]);

  useEffect(() => {
    const firstLive = sessions.find((item) => item.isLive);
    if (!selectedSessionId && firstLive) {
      setSelectedSessionId(firstLive.session._id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    const preferredSessionId = preferredSessionIdRef.current;
    if (!preferredSessionId) {
      return;
    }

    const preferredLive = sessions.find(
      (item) => item.session?._id === preferredSessionId && item.isLive,
    );
    if (!preferredLive) {
      return;
    }

    if (selectedSessionId !== preferredSessionId) {
      setSelectedSessionId(preferredSessionId);
    }

    if (authorized && pendingInitialManageRef.current) {
      setManagedSessionId(preferredSessionId);
      setShowPicker(false);
      setAuthError("");
      pendingInitialManageRef.current = false;
    }
  }, [authorized, selectedSessionId, sessions]);

  useEffect(() => {
    if (!iOSSafari) {
      return undefined;
    }

    ambientAudioSessionTypeRef.current =
      setPreferredAudioSessionType("ambient") || "";

    return () => {
      if (ambientAudioSessionTypeRef.current) {
        restorePreferredAudioSessionType(ambientAudioSessionTypeRef.current);
        ambientAudioSessionTypeRef.current = "";
      }
    };
  }, [iOSSafari]);

  useEffect(() => {
    if (
      managedSessionId &&
      !sessions.some((item) => item.session?._id === managedSessionId)
    ) {
      setManagedSessionId("");
    }
  }, [managedSessionId, sessions]);

  const refreshDirectorSessions = useCallback(async () => {
    if (!authorized) {
      return [];
    }
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return sessions;
    }
    if (directorSessionsRefreshPromiseRef.current) {
      return directorSessionsRefreshPromiseRef.current;
    }
    if (Date.now() - lastDirectorSessionsRefreshAtRef.current < DIRECTOR_SESSIONS_REFRESH_MIN_GAP_MS) {
      return sessions;
    }
    directorSessionsRefreshPromiseRef.current = (async () => {
      try {
        const response = await fetch("/api/director/sessions", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({ sessions: [] }));
        if (!response.ok) {
          return [];
        }
        const nextSessions = Array.isArray(payload.sessions)
          ? payload.sessions
          : [];
        const hasLiveSessions = nextSessions.some((item) => item.isLive);
        const currentManagedStillLive = Boolean(
          managedSessionId &&
            nextSessions.some(
              (item) => item.session?._id === managedSessionId && item.isLive,
            ),
        );
        writeCachedDirectorSessions(nextSessions);
        setSessions(nextSessions);

        const nextLiveSessionId = getPreferredLiveSessionId(
          nextSessions,
          preferredSessionIdRef.current,
        );

        if (nextLiveSessionId) {
          setSelectedSessionId((current) => {
            if (
              current &&
              nextSessions.some(
                (item) => item.session?._id === current && item.isLive,
              )
            ) {
              return current;
            }
            return nextLiveSessionId;
          });
        } else {
          setSelectedSessionId("");
        }

        setManagedSessionId((current) => {
          if (
            current &&
            nextSessions.some(
              (item) => item.session?._id === current && item.isLive,
            )
          ) {
            return current;
          }
          return "";
        });

        if (!hasLiveSessions || (managedSessionId && !currentManagedStillLive)) {
          setShowPicker(true);
        }

        lastDirectorSessionsRefreshAtRef.current = Date.now();
        return nextSessions;
      } catch {
        return [];
      } finally {
        directorSessionsRefreshPromiseRef.current = null;
      }
    })();

    return directorSessionsRefreshPromiseRef.current;
  }, [authorized, managedSessionId, sessions]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    const cachedSessions = readCachedDirectorSessions();
    if (cachedSessions.length) {
      setSessions((current) => (current.length ? current : cachedSessions));
      const cachedLiveSessionId = getPreferredLiveSessionId(
        cachedSessions,
        preferredSessionIdRef.current,
      );
      if (cachedLiveSessionId) {
        setSelectedSessionId((current) => current || cachedLiveSessionId);
      }
    }

    let cancelled = false;
    const refreshIfActive = async () => {
      if (cancelled) {
        return;
      }
      await refreshDirectorSessions();
    };

    void refreshIfActive();

    const handleFocus = () => {
      void refreshIfActive();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshIfActive();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [authorized, managedSessionId, refreshDirectorSessions, showPicker]);

  const handleChangeSession = useCallback(() => {
    setManagedSessionId("");
    setShowPicker(true);
    void refreshDirectorSessions();
  }, [refreshDirectorSessions]);

  const fetchAudioLibrary = useCallback(async () => {
    if (directorAudioLibraryPromise) {
      const nextFiles = await directorAudioLibraryPromise;
      setLibraryFiles(nextFiles);
      return nextFiles;
    }

    directorAudioLibraryPromise = (async () => {
      const response = await fetch("/api/director/audio-library", {
        cache: "default",
      });
      const payload = await response
        .json()
        .catch(() => ({ files: [], order: [] }));

      if (!response.ok) {
        return [];
      }

      const nextFiles = Array.isArray(payload.files) ? payload.files : [];
      const nextOrder = Array.isArray(payload.order) ? payload.order : [];
      setLibraryOrder(nextOrder);
      lastPersistedLibraryOrderRef.current = serializeOrder(nextOrder);
      if (
        pendingLibraryOrderRef.current &&
        serializeOrder(pendingLibraryOrderRef.current) ===
          lastPersistedLibraryOrderRef.current
      ) {
        pendingLibraryOrderRef.current = null;
      }
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            audioOrderStorageKey,
            JSON.stringify(nextOrder),
          );
        } catch {
          // Ignore storage failures and keep the in-memory order.
        }
      }
      writeCachedDirectorAudioLibrary(nextFiles);
      return nextFiles;
    })();

    try {
      const nextFiles = await directorAudioLibraryPromise;
      setLibraryFiles(nextFiles);
      return nextFiles;
    } finally {
      directorAudioLibraryPromise = null;
    }
  }, [audioOrderStorageKey]);

  useEffect(() => {
    const cachedFiles = readCachedDirectorAudioLibrary();
    if (cachedFiles.length) {
      setLibraryFiles(cachedFiles);
      return;
    }

    let cancelled = false;

    const loadLibraryOnce = async () => {
      try {
        const nextFiles = await fetchAudioLibrary();
        if (!cancelled) {
          setLibraryFiles(nextFiles);
        }
      } catch {
        if (!cancelled) {
          setLibraryFiles((current) => current);
        }
      }
    };

    void loadLibraryOnce();

    return () => {
      cancelled = true;
    };
  }, [fetchAudioLibrary]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const cachedValue = window.sessionStorage.getItem(
        DIRECTOR_AUDIO_METADATA_CACHE_KEY,
      );
      if (!cachedValue) {
        return;
      }
      const parsed = JSON.parse(cachedValue);
      if (parsed && typeof parsed === "object") {
        directorAudioMetadataMemoryCache = parsed;
        setLibraryDurations(parsed);
      }
    } catch {
      // Ignore broken cache.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(audioOrderStorageKey);
      if (!rawValue) {
        setLibraryOrder([]);
        return;
      }

      const parsed = JSON.parse(rawValue);
      setLibraryOrder(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLibraryOrder([]);
    }
  }, [audioOrderStorageKey]);

  const orderedLibraryFiles = useMemo(() => {
    if (!libraryFiles.length) {
      return [];
    }

    if (!libraryOrder.length) {
      return libraryFiles;
    }

    const orderMap = new Map(libraryOrder.map((id, index) => [id, index]));
    return [...libraryFiles].sort((left, right) => {
      const leftIndex = orderMap.has(left.id)
        ? orderMap.get(left.id)
        : Number.MAX_SAFE_INTEGER;
      const rightIndex = orderMap.has(right.id)
        ? orderMap.get(right.id)
        : Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      const leftDuration = libraryDurations[left.id] || 0;
      const rightDuration = libraryDurations[right.id] || 0;
      if (leftDuration !== rightDuration) {
        return rightDuration - leftDuration;
      }
      return left.label.localeCompare(right.label);
    });
  }, [libraryDurations, libraryFiles, libraryOrder]);

  const clearLibraryOrderSaveTimer = useCallback(() => {
    if (libraryOrderSaveTimerRef.current) {
      window.clearTimeout(libraryOrderSaveTimerRef.current);
      libraryOrderSaveTimerRef.current = null;
    }
  }, []);

  const persistLibraryOrder = useCallback(
    async (nextOrder, { keepalive = false } = {}) => {
      try {
        const response = await fetch("/api/director/audio-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive,
          body: JSON.stringify({ order: nextOrder }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const flushPendingLibraryOrder = useCallback(
    async ({ useBeacon = false } = {}) => {
      const nextOrder = pendingLibraryOrderRef.current;
      if (!nextOrder?.length) {
        return false;
      }

      const serializedOrder = serializeOrder(nextOrder);
      if (serializedOrder === lastPersistedLibraryOrderRef.current) {
        pendingLibraryOrderRef.current = null;
        return true;
      }

      if (
        useBeacon &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        try {
          const payload = new Blob([JSON.stringify({ order: nextOrder })], {
            type: "application/json",
          });
          const queued = navigator.sendBeacon(
            "/api/director/audio-library",
            payload,
          );
          if (queued) {
            lastPersistedLibraryOrderRef.current = serializedOrder;
            pendingLibraryOrderRef.current = null;
            return true;
          }
        } catch {
          // Fall through to fetch keepalive.
        }
      }

      const persisted = await persistLibraryOrder(nextOrder, {
        keepalive: useBeacon,
      });
      if (persisted) {
        lastPersistedLibraryOrderRef.current = serializedOrder;
        pendingLibraryOrderRef.current = null;
      }
      return persisted;
    },
    [persistLibraryOrder],
  );

  const scheduleLibraryOrderPersist = useCallback(
    (nextOrder) => {
      const serializedOrder = serializeOrder(nextOrder);
      pendingLibraryOrderRef.current = nextOrder;

      clearLibraryOrderSaveTimer();

      if (serializedOrder === lastPersistedLibraryOrderRef.current) {
        pendingLibraryOrderRef.current = null;
        return;
      }

      libraryOrderSaveTimerRef.current = window.setTimeout(() => {
        libraryOrderSaveTimerRef.current = null;
        void flushPendingLibraryOrder();
      }, DIRECTOR_AUDIO_ORDER_SAVE_DELAY_MS);
    },
    [clearLibraryOrderSaveTimer, flushPendingLibraryOrder],
  );

  const handleLibraryReorder = useCallback(
    (nextFiles) => {
      setLibraryFiles(nextFiles);
      const nextOrder = nextFiles.map((file) => file.id);
      setLibraryOrder(nextOrder);

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            audioOrderStorageKey,
            JSON.stringify(nextOrder),
          );
        } catch {
          // Ignore storage failures and keep the in-memory order.
        }
      }
      scheduleLibraryOrderPersist(nextOrder);
    },
    [audioOrderStorageKey, scheduleLibraryOrderPersist],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const flushQueuedOrder = () => {
      clearLibraryOrderSaveTimer();
      void flushPendingLibraryOrder({ useBeacon: true });
    };

    window.addEventListener("pagehide", flushQueuedOrder);
    window.addEventListener("beforeunload", flushQueuedOrder);

    return () => {
      window.removeEventListener("pagehide", flushQueuedOrder);
      window.removeEventListener("beforeunload", flushQueuedOrder);
    };
  }, [clearLibraryOrderSaveTimer, flushPendingLibraryOrder]);

  useEffect(() => {
    const effectsAudio = effectsAudioRef.current;
    const musicUrls = musicUrlsRef.current;

    return () => {
      clearLibraryOrderSaveTimer();
      void flushPendingLibraryOrder({ useBeacon: true });
      cancelMusicDuckAnimation();
      musicUrls.forEach((url) => URL.revokeObjectURL(url));
      if (effectsAudio) {
        effectsAudio.pause();
        effectsAudio.src = "";
      }
    };
  }, [
    cancelMusicDuckAnimation,
    clearLibraryOrderSaveTimer,
    flushPendingLibraryOrder,
  ]);

  const moveLibraryItem = useCallback(
    (activeId, targetId) => {
      if (!activeId || !targetId || activeId === targetId) {
        return;
      }

      const activeIndex = orderedLibraryFiles.findIndex(
        (file) => file.id === activeId,
      );
      const targetIndex = orderedLibraryFiles.findIndex(
        (file) => file.id === targetId,
      );

      if (activeIndex < 0 || targetIndex < 0) {
        return;
      }

      const nextFiles = [...orderedLibraryFiles];
      const [movedItem] = nextFiles.splice(activeIndex, 1);
      nextFiles.splice(targetIndex, 0, movedItem);
      handleLibraryReorder(nextFiles);
    },
    [handleLibraryReorder, orderedLibraryFiles],
  );

  const setLibrarySelectionLock = useCallback((locked) => {
    if (typeof document === "undefined") {
      return;
    }

    [document.body, document.documentElement].forEach((node) => {
      if (!node) {
        return;
      }

      if (locked) {
        node.style.setProperty("user-select", "none");
        node.style.setProperty("-webkit-user-select", "none");
        node.style.setProperty("-webkit-touch-callout", "none");
      } else {
        node.style.removeProperty("user-select");
        node.style.removeProperty("-webkit-user-select");
        node.style.removeProperty("-webkit-touch-callout");
      }
    });
  }, []);

  useEffect(
    () => () => {
      setLibrarySelectionLock(false);
    },
    [setLibrarySelectionLock],
  );

  const updatePointerLibraryDropTarget = useCallback((clientX, clientY) => {
    const activeId = libraryPointerDragRef.current.activeId;
    if (!activeId) {
      return;
    }

    const hoveredId = findLibraryCardIdFromPoint(clientX, clientY);
    const nextTargetId =
      hoveredId && hoveredId !== activeId ? hoveredId : "";

    if (libraryPointerDragRef.current.targetId === nextTargetId) {
      return;
    }

    libraryPointerDragRef.current.targetId = nextTargetId;
    setLibraryDropTargetId(nextTargetId);
  }, []);

  const clearLibraryDragState = useCallback(() => {
    libraryPointerDragRef.current = {
      pointerId: null,
      activeId: "",
      targetId: "",
    };
    setLibrarySelectionLock(false);
    setDraggingLibraryId("");
    setLibraryDropTargetId("");
  }, [setLibrarySelectionLock]);

  const finishPointerLibraryDrag = useCallback(
    (pointerId = null, options = {}) => {
      const { commit = true, clientX = null, clientY = null } = options;
      const activeDrag = libraryPointerDragRef.current;

      if (!activeDrag.activeId) {
        return;
      }

      if (
        pointerId !== null &&
        activeDrag.pointerId !== null &&
        pointerId !== activeDrag.pointerId
      ) {
        return;
      }

      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        updatePointerLibraryDropTarget(clientX, clientY);
      }

      const activeId = libraryPointerDragRef.current.activeId;
      const targetId = libraryPointerDragRef.current.targetId;
      clearLibraryDragState();

      if (commit && activeId && targetId && activeId !== targetId) {
        moveLibraryItem(activeId, targetId);
      }
    },
    [clearLibraryDragState, moveLibraryItem, updatePointerLibraryDropTarget],
  );

  const handleLibraryGripPointerDown = useCallback(
    (event, fileId) => {
      if (!usePointerLibraryReorder) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setLibrarySelectionLock(true);
      libraryPointerDragRef.current = {
        pointerId: event.pointerId ?? null,
        activeId: fileId,
        targetId: "",
      };
      setDraggingLibraryId(fileId);
      setLibraryDropTargetId("");
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [setLibrarySelectionLock, usePointerLibraryReorder],
  );

  const handleLibraryDragStart = (event, fileId) => {
    if (event.target instanceof HTMLElement && event.target.closest("button")) {
      event.preventDefault();
      return;
    }
    setDraggingLibraryId(fileId);
    setLibraryDropTargetId("");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fileId);
  };

  const handleLibraryDragEnter = (fileId) => {
    if (draggingLibraryId && draggingLibraryId !== fileId) {
      setLibraryDropTargetId(fileId);
    }
  };

  const handleLibraryDragOver = (event, fileId) => {
    event.preventDefault();
    if (draggingLibraryId && draggingLibraryId !== fileId) {
      event.dataTransfer.dropEffect = "move";
      setLibraryDropTargetId(fileId);
    }
  };

  const handleLibraryDrop = (event, fileId) => {
    event.preventDefault();
    const activeId =
      event.dataTransfer.getData("text/plain") || draggingLibraryId;
    moveLibraryItem(activeId, fileId);
    clearLibraryDragState();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const activeDrag = libraryPointerDragRef.current;
      if (!activeDrag.activeId) {
        return;
      }

      if (
        activeDrag.pointerId !== null &&
        event.pointerId !== undefined &&
        event.pointerId !== activeDrag.pointerId
      ) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      updatePointerLibraryDropTarget(event.clientX, event.clientY);
    };

    const handlePointerRelease = (event) => {
      finishPointerLibraryDrag(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    const handlePointerCancel = (event) => {
      finishPointerLibraryDrag(event.pointerId, { commit: false });
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [finishPointerLibraryDrag, updatePointerLibraryDropTarget]);

  useEventSource({
    url:
      authorized && managedSession?.match?._id
        ? `/api/live/matches/${managedSession.match._id}?history=0`
        : null,
    event: "match",
    enabled: Boolean(authorized && managedSession?.match?._id),
    onMessage: (payload) => {
      const nextLiveMatch = payload?.match || payload;
      if (!nextLiveMatch?._id) {
        return;
      }

      startTransition(() => {
        setLiveMatch(nextLiveMatch);
        setSessions((current) => {
          const nextSessions = mergeDirectorMatchIntoSessions(
            current,
            nextLiveMatch,
          );
          if (nextSessions !== current) {
            writeCachedDirectorSessions(nextSessions);
          }
          return nextSessions;
        });
        setConsoleError("");
      });
    },
    onError: () => {
      if (!liveMatch) {
        setConsoleError("Could not load live match state.");
      }
    },
  });

  const directorWalkieMatch = getDirectorPreferredMatch(
    liveMatch,
    managedSession?.match,
  );
  const directorWalkieAvailable = Boolean(
    authorized &&
    managedSession?.match?._id &&
    (directorWalkieMatch?.isOngoing ?? managedSession?.isLive),
  );

  const walkie = useWalkieTalkie({
    matchId: managedSession?.match?._id || "",
    enabled: directorWalkieAvailable,
    role: "director",
    displayName: managedSession?.session?.name
      ? `${managedSession.session.name} Director`
      : "Director",
    autoConnectAudio: directorWalkieAvailable && directorWalkieOn,
    signalingActive: directorWalkieAvailable && directorWalkieOn,
  });
  const directorWalkieSharedEnabled = Boolean(walkie.snapshot?.enabled);
  const directorWalkieRequestState = walkie.requestState || "idle";
  const deactivateDirectorWalkieAudio = walkie.deactivateAudio;

  const handleDirectorWalkieSwitchChange = useCallback(
    async (nextChecked) => {
      const action = getNonUmpireWalkieToggleAction({
        nextChecked,
        sharedEnabled: directorWalkieSharedEnabled,
        requestState: directorWalkieRequestState,
        hasOwnPendingRequest: walkie.hasOwnPendingRequest,
      });

      if (action === "disable") {
        setDirectorWalkieOn(false);
        await walkie.deactivateAudio();
        return;
      }

      setDirectorWalkieOn(true);

      if (action === "enable") {
        showTemporaryDirectorWalkieNotice("Refreshing walkie signal...", 3200);
        await walkie.refreshSignal?.({ propagate: false });
        return;
      }

      if (action === "pending") {
        showTemporaryDirectorWalkieNotice(
          "Requested umpire access. Waiting for approval.",
          3200,
        );
        return;
      }

      if (!authorized || !managedSession?.match?._id) {
        setDirectorWalkieOn(false);
        return;
      }

      showTemporaryDirectorWalkieNotice("Requesting umpire access...", 3200);
      const requested = await walkie.requestEnable();
      if (!requested) {
        setDirectorWalkieOn(false);
        setDirectorWalkieNotice("");
        return;
      }

      showTemporaryDirectorWalkieNotice(
        "Requested umpire access. Waiting for approval.",
        3200,
      );
    },
    [
      authorized,
      directorWalkieRequestState,
      directorWalkieSharedEnabled,
      managedSession?.match?._id,
      showTemporaryDirectorWalkieNotice,
      walkie,
    ],
  );

  useEffect(() => {
    if (
      didSharedWalkieEnable({
        previousSharedEnabled: previousDirectorWalkieEnabledRef.current,
        sharedEnabled: directorWalkieSharedEnabled,
      })
    ) {
      const sharedEnableMessage =
        walkie.nonUmpireUi?.sharedEnableNotice ||
        NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT;
      showTemporaryDirectorWalkieNotice(sharedEnableMessage, 3600);
      speech.speak(
        walkie.nonUmpireUi?.sharedEnableAnnouncement ||
          NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
        {
          key: `director-walkie-live-${
            managedSession?.match?._id ||
            managedSession?.session?._id ||
            "session"
          }`,
          priority: 4,
          interrupt: true,
          ignoreEnabled: true,
        },
      );
    }

    if (
      didSharedWalkieDisable({
        previousSharedEnabled: previousDirectorWalkieEnabledRef.current,
        sharedEnabled: directorWalkieSharedEnabled,
      })
    ) {
      setDirectorWalkieOn(false);
      void deactivateDirectorWalkieAudio();
    }

    previousDirectorWalkieEnabledRef.current = directorWalkieSharedEnabled;
  }, [
    deactivateDirectorWalkieAudio,
    directorWalkieSharedEnabled,
    managedSession?.match?._id,
    managedSession?.session?._id,
    speech,
    showTemporaryDirectorWalkieNotice,
    walkie.nonUmpireUi?.sharedEnableAnnouncement,
    walkie.nonUmpireUi?.sharedEnableNotice,
  ]);

  useEffect(() => {
    if (
      directorWalkieRequestState ===
      previousDirectorWalkieRequestStateRef.current
    ) {
      return;
    }

    previousDirectorWalkieRequestStateRef.current = directorWalkieRequestState;

    if (directorWalkieRequestState === "accepted") {
      setDirectorWalkieOn(true);
      return;
    }

    if (directorWalkieRequestState === "dismissed") {
      setDirectorWalkieOn(false);
    }
  }, [directorWalkieRequestState]);

  useEffect(() => {
    if (!speechSettings.enabled || speechSettings.muted || speechSettings.mode === "silent") {
      pendingDirectorAnnouncementRef.current = null;
      return;
    }

    const targetMatch = getDirectorPreferredMatch(
      liveMatch,
      managedSession?.match,
    );
    const liveEvent = targetMatch?.lastLiveEvent || null;

    if (
      !authorized ||
      !targetMatch?._id ||
      !liveEvent?.id ||
      lastDirectorAnnouncedLiveEventRef.current === liveEvent.id
    ) {
      return;
    }

    if (!DIRECTOR_AUTO_ANNOUNCE_EVENT_TYPES.has(liveEvent.type)) {
      lastDirectorAnnouncedLiveEventRef.current = liveEvent.id;
      pendingDirectorAnnouncementRef.current = null;
      return;
    }

    const effectIsActive =
      Boolean(libraryLiveId) ||
      libraryState === "loading" ||
      libraryState === "playing" ||
      sharedBoundaryEffectActiveRef.current ||
      Boolean(bufferedEffectPlaybackRef.current);

    if (effectIsActive) {
      pendingDirectorAnnouncementRef.current = {
        match: targetMatch,
        eventId: liveEvent.id,
      };
      lastDirectorAnnouncedLiveEventRef.current = liveEvent.id;
      return;
    }

    const spoke = speakDirectorScoreAnnouncement(targetMatch, liveEvent.id, {
      interrupt: true,
    });

    if (spoke || speech.needsGesture || speech.status === "waiting_for_gesture") {
      lastDirectorAnnouncedLiveEventRef.current = liveEvent.id;
      pendingDirectorAnnouncementRef.current = null;
    }
  }, [
    authorized,
    bufferedEffectPlaybackRef,
    libraryLiveId,
    libraryState,
    liveMatch,
    managedSession?.match,
    speakDirectorScoreAnnouncement,
    speech.needsGesture,
    speech.status,
    speechSettings.enabled,
    speechSettings.mode,
    speechSettings.muted,
  ]);

  useEffect(() => {
    const targetMatch = getDirectorPreferredMatch(
      liveMatch,
      managedSession?.match,
    );
    const liveEvent = targetMatch?.lastLiveEvent || null;

    if (
      !authorized ||
      !liveEvent?.id ||
      liveEvent.type !== "sound_effect" ||
      liveEvent.trigger === "score_boundary"
    ) {
      return;
    }

    if (lastHandledSharedSoundEffectEventRef.current === liveEvent.id) {
      return;
    }

    lastHandledSharedSoundEffectEventRef.current = liveEvent.id;
    const createdAtMs = Date.parse(String(liveEvent.createdAt || ""));
    if (
      Number.isFinite(createdAtMs) &&
      createdAtMs < soundEffectPlaybackCutoffRef.current
    ) {
      return;
    }
    void playEffectRef.current?.(
      {
        id: liveEvent.effectId || liveEvent.effectFileName || liveEvent.id,
        fileName: liveEvent.effectFileName || liveEvent.effectId || "",
        label: liveEvent.effectLabel || "Sound effect",
        src: liveEvent.effectSrc || "",
      },
      { toggleIfActive: false },
    );
  }, [authorized, liveMatch, managedSession?.match]);

  const readCurrentScore = () => {
    const targetMatch = getDirectorPreferredMatch(
      liveMatch,
      managedSession?.match,
    );
    const announcement = buildCurrentScoreAnnouncement(targetMatch);
    if (!targetMatch || !announcement) {
      return;
    }

    void primeUiAudio();
    speech.stop();
    speech.prime({ userGesture: true });
    prepareMusicForDirectorAnnouncement();
    speech.speak(announcement, {
      key: `director-score-${targetMatch._id}`,
      userGesture: true,
      ignoreEnabled: true,
      interrupt: true,
      priority: 5,
      rate: 0.9,
    });
  };

  useEffect(() => {
    if (directorAudioMode === "duck") {
      if (speech.status === "speaking") {
        applyMusicDuck(0.14, { durationMs: 180 });
      } else if (
        !libraryLiveId &&
        libraryState !== "loading" &&
        !sharedBoundaryEffectActiveRef.current
      ) {
        applyMusicDuck(1, { durationMs: 220 });
      }
      pendingMusicAutoplayRef.current = false;
      return undefined;
    }

    if (speech.status === "speaking" || !pendingMusicAutoplayRef.current) {
      return undefined;
    }

    pendingMusicAutoplayRef.current = false;
    if (!currentTrack || !youtubePlayerRef.current) {
      return undefined;
    }

    musicResumeTimerRef.current = window.setTimeout(() => {
      musicResumeTimerRef.current = null;
      try {
        youtubePlayerRef.current?.playVideo();
        setMusicState("playing");
        setMusicMessage(`Back on: ${currentTrack.name}.`);
      } catch {
        setMusicMessage("Tap video to resume music.");
      }
    }, 180);

    return () => {
      if (musicResumeTimerRef.current) {
        window.clearTimeout(musicResumeTimerRef.current);
        musicResumeTimerRef.current = null;
      }
    };
  }, [
    applyMusicDuck,
    currentTrack,
    directorAudioMode,
    libraryLiveId,
    libraryState,
    speech.status,
  ]);

  const restoreMusicAfterEffects = useCallback(
    ({ durationMs = 220, flushDelayMs = 24 } = {}) => {
      const shouldKeepDuck =
        directorAudioMode === "duck" &&
        (speech.status === "speaking" ||
          sharedBoundaryEffectActiveRef.current ||
          Boolean(pendingDirectorAnnouncementRef.current));

      applyMusicDuck(shouldKeepDuck ? 0.14 : 1, { durationMs });
      window.setTimeout(flushPendingDirectorAnnouncement, flushDelayMs);
    },
    [applyMusicDuck, directorAudioMode, flushPendingDirectorAnnouncement, speech.status],
  );

  useEffect(() => {
    const targetMatch = getDirectorPreferredMatch(
      liveMatch,
      managedSession?.match,
    );
    const liveEvent = targetMatch?.lastLiveEvent || null;

    if (
      !authorized ||
      !liveEvent?.id ||
      liveEvent.type !== "sound_effect" ||
      liveEvent.trigger !== "score_boundary"
    ) {
      return;
    }

    if (lastHandledBoundarySoundEffectEventRef.current === liveEvent.id) {
      return;
    }

    lastHandledBoundarySoundEffectEventRef.current = liveEvent.id;
    sharedBoundaryEffectActiveRef.current = true;

    if (sharedBoundaryDuckTimerRef.current) {
      window.clearTimeout(sharedBoundaryDuckTimerRef.current);
      sharedBoundaryDuckTimerRef.current = null;
    }

    applyMusicDuck(0.14, { durationMs: 150 });

    sharedBoundaryDuckTimerRef.current = window.setTimeout(() => {
      sharedBoundaryDuckTimerRef.current = null;
      sharedBoundaryEffectActiveRef.current = false;
      restoreMusicAfterEffects({ durationMs: 220, flushDelayMs: 12 });
    }, getDirectorBoundaryDuckWindowMs(liveEvent));
  }, [
    authorized,
    applyMusicDuck,
    getDirectorBoundaryDuckWindowMs,
    liveMatch,
    managedSession?.match,
    restoreMusicAfterEffects,
  ]);

  const submitDirectorPin = async () => {
    setIsSubmittingPin(true);
    setAuthError("");

    try {
      const response = await fetch("/api/director/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const payload = await response
        .json()
        .catch(() => ({ message: "Could not verify PIN." }));

      if (!response.ok) {
        setAuthError(payload.message || "Could not verify PIN.");
        return;
      }

      setConsoleError("");
      setAuthorized(true);
      setPin("");
      const nextSessions = sessions.length
        ? sessions
        : readCachedDirectorSessions();
      if (nextSessions.length) {
        writeCachedDirectorSessions(nextSessions);
        setSessions(nextSessions);
        const preferredLive = preferredSessionIdRef.current
          ? nextSessions.find(
              (item) =>
                item.session?._id === preferredSessionIdRef.current &&
                item.isLive,
            )
          : null;
        const nextLive = nextSessions.find((item) => item.isLive);
        setSelectedSessionId(
          preferredLive?.session?._id ||
            nextLive?.session?._id ||
            nextSessions?.[0]?.session?._id ||
            "",
        );
        if (pendingInitialManageRef.current && preferredLive?.session?._id) {
          setManagedSessionId(preferredLive.session._id);
          pendingInitialManageRef.current = false;
        } else {
          setManagedSessionId("");
          setShowPicker(true);
        }
      }
      setShowDirectorPinStep(false);
    } catch {
      setAuthError("Could not verify PIN.");
    } finally {
      setIsSubmittingPin(false);
    }
  };

  useEffect(() => {
    if (authorized) {
      setConsoleError("");
    }
  }, [authorized]);

  const logout = async () => {
    await fetch("/api/director/auth", {
      method: "DELETE",
    }).catch(() => {});
    setAuthorized(false);
    setManagedSessionId("");
    setShowPicker(false);
    setShowDirectorPinStep(false);
    setPin("");
    setAuthError("");
  };

  const leaveDirectorMode = async () => {
    await logout();
    router.push("/");
  };

  const syncSinkId = async (deviceId) => {
    const audio = audioRef.current;
    if (!audio || typeof audio.setSinkId !== "function") {
      return false;
    }

    try {
      await audio.setSinkId(deviceId || "default");
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    applyMusicDuck(musicEffectDuckFactorRef.current, { durationMs: 140 });
  }, [applyMusicDuck]);

  useEffect(() => {
    const nextVolume = Math.max(
      0,
      Math.min(1, (micMonitor.isActive ? 0.24 : 1) * masterVolume),
    );
    if (effectsAudioRef.current) {
      effectsAudioRef.current.volume = nextVolume;
    }
  }, [masterVolume, micMonitor.isActive]);

  useEffect(() => {
    const audio = effectsAudioRef.current;
    if (!audio) {
      return undefined;
    }

    const persistLibraryDuration = () => {
      const fileId = audio.dataset.effectId || "";
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (!fileId || !Number.isFinite(duration) || duration <= 0) {
        return;
      }

      setLibraryDurations((current) => {
        if (Number.isFinite(current[fileId])) {
          return current;
        }
        const next = { ...current, [fileId]: duration };
        directorAudioMetadataMemoryCache = next;
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(
              DIRECTOR_AUDIO_METADATA_CACHE_KEY,
              JSON.stringify(next),
            );
          } catch {
            // Ignore storage failures.
          }
        }
        return next;
      });
    };

    const handleEnded = () => {
      setLibraryLiveId("");
      setLibraryState("idle");
      setLibraryCurrentTime(0);
      restoreMusicAfterEffects({ durationMs: 220, flushDelayMs: 12 });
    };
    const handlePause = () => {
      setLibraryState((current) =>
        current === "loading" ? current : "paused",
      );
      if (!audio.ended) {
        setLibraryCurrentTime(audio.currentTime || 0);
      }
    };
    const handlePlay = () => {
      setConsoleError("");
      setLibraryState("playing");
    };
    const handleWaiting = () => {
      setLibraryState("loading");
    };
    const handleCanPlay = () => {
      setConsoleError("");
      setLibraryState((current) =>
        current === "loading" ? "paused" : current,
      );
      persistLibraryDuration();
    };
    const handleError = () => {
      if (!audio.src) {
        return;
      }
      setConsoleError("This audio file could not be played in this browser.");
      setLibraryLiveId("");
      setLibraryState("idle");
      setLibraryCurrentTime(0);
      restoreMusicAfterEffects({ durationMs: 180, flushDelayMs: 12 });
    };
    const handleTimeUpdate = () => {
      setLibraryCurrentTime(audio.currentTime || 0);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("canplaythrough", handleCanPlay);
    audio.addEventListener("loadedmetadata", persistLibraryDuration);
    audio.addEventListener("error", handleError);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("canplaythrough", handleCanPlay);
      audio.removeEventListener("loadedmetadata", persistLibraryDuration);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [restoreMusicAfterEffects]);

  useEffect(() => {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      setSpeakerMessage("Uses your phone or browser output.");
      return;
    }

    let cancelled = false;
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        const outputs = devices.filter(
          (device) => device.kind === "audiooutput",
        );
        setSpeakerDevices(outputs);
        if (outputs.length) {
          setSpeakerMessage(
            typeof HTMLMediaElement !== "undefined" &&
              "setSinkId" in HTMLMediaElement.prototype
              ? "Speaker selection is supported in this browser."
              : "Using your phone or Bluetooth output.",
          );
        } else {
          setSpeakerMessage("Using your phone or Bluetooth output.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpeakerMessage("Using your phone or Bluetooth output.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stopMusicDeck = useCallback(({ resetTime = true } = {}) => {
    pendingMusicAutoplayRef.current = false;
    if (musicResumeTimerRef.current) {
      window.clearTimeout(musicResumeTimerRef.current);
      musicResumeTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      if (resetTime) {
        audioRef.current.currentTime = 0;
      }
    }
    try {
      youtubePlayerRef.current?.stopVideo();
    } catch {
      // Ignore stop failures.
    }
    setMusicState("stopped");
  }, []);

  const stopAllEffects = useCallback((options = {}) => {
    const {
      clearSource = true,
      preserveRequest = false,
      restoreMusic = !preserveRequest,
    } = options;
    const audio = effectsAudioRef.current;
    if (!audio && !bufferedEffectPlaybackRef.current) {
      return;
    }

    if (!preserveRequest) {
      effectPlayRequestRef.current += 1;
    }

    setConsoleError("");
    setEffectsNeedsUnlock(false);
    if (libraryLoadTimeoutRef.current) {
      window.clearTimeout(libraryLoadTimeoutRef.current);
      libraryLoadTimeoutRef.current = null;
    }
    if (bufferedEffectTimerRef.current) {
      window.clearInterval(bufferedEffectTimerRef.current);
      bufferedEffectTimerRef.current = null;
    }
    if (bufferedEffectPlaybackRef.current) {
      bufferedEffectPlaybackRef.current.stop();
      bufferedEffectPlaybackRef.current = null;
    }
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore stubborn Safari currentTime resets while the element is settling.
      }
      if (clearSource) {
        audio.src = "";
        audio.removeAttribute("src");
        delete audio.dataset.effectSrc;
        delete audio.dataset.effectId;
        audio.load();
      }
    }
    setLibraryLiveId("");
    setLibraryState("idle");
    setLibraryCurrentTime(0);
    if (restoreMusic) {
      restoreMusicAfterEffects({ durationMs: 200, flushDelayMs: 12 });
    }
  }, [restoreMusicAfterEffects]);

  useEffect(() => {
    if (libraryLoadTimeoutRef.current) {
      window.clearTimeout(libraryLoadTimeoutRef.current);
      libraryLoadTimeoutRef.current = null;
    }

    if (libraryState !== "loading" || !libraryLiveId) {
      return undefined;
    }

    libraryLoadTimeoutRef.current = window.setTimeout(() => {
      const audio = effectsAudioRef.current;
      if (
        !audio ||
        libraryState !== "loading" ||
        !libraryLiveId ||
        !audio.src
      ) {
        return;
      }

      setConsoleError("This sound got stuck loading. Tap it again.");
      setLibraryState("idle");
      setLibraryLiveId("");
      setLibraryCurrentTime(0);
      applyMusicDuck(1, { durationMs: 180 });
    }, 4500);

    return () => {
      if (libraryLoadTimeoutRef.current) {
        window.clearTimeout(libraryLoadTimeoutRef.current);
        libraryLoadTimeoutRef.current = null;
      }
    };
  }, [applyMusicDuck, libraryLiveId, libraryState]);

  const primeEffectsAudio = useCallback(async () => {
    if (effectPrimeRequestRef.current) {
      return effectPrimeRequestRef.current;
    }

    const audio = effectsAudioRef.current;
    const request = (async () => {
      const unlocked = isUiAudioUnlocked()
        ? true
        : await primeUiAudio({
            mediaElements: audio ? [audio] : [],
          });

      if (!audio) {
        return unlocked;
      }

      audio.muted = false;
      audio.playsInline = true;
      audio.setAttribute("playsinline", "");
      audio.setAttribute("webkit-playsinline", "");
      audio.volume = Math.max(0, Math.min(1, masterVolume));
      setEffectsNeedsUnlock(!unlocked && iOSSafari);
      return unlocked;
    })().finally(() => {
      effectPrimeRequestRef.current = null;
    });

    effectPrimeRequestRef.current = request;
    return request;
  }, [iOSSafari, masterVolume]);

  const playEffect = useCallback(async (file, options = {}) => {
    const audio = effectsAudioRef.current;
    if (!file?.src) {
      return;
    }

    if (options.toggleIfActive !== false && libraryLiveId === file.id) {
      stopAllEffects();
      return;
    }

    const requestId = effectPlayRequestRef.current + 1;
    effectPlayRequestRef.current = requestId;

    stopDirectorSpeech();
    stopAllEffects({ clearSource: false, preserveRequest: true });
    setConsoleError("");
    setEffectsNeedsUnlock(false);
    setLibraryLiveId(file.id);
    setLibraryState("loading");
    setLibraryCurrentTime(0);
    const unlocked = await primeEffectsAudio();
    if (requestId !== effectPlayRequestRef.current) {
      return;
    }
    if (iOSSafari && !unlocked) {
      setConsoleError("Tap Enable Audio once, then play the sound again.");
      setLibraryState("idle");
      setLibraryLiveId("");
      return;
    }

    audio.preload = "auto";
    let effectSrc = cachedEffectUrlRef.current.get(file.id) || "";
    if (!effectSrc && !iOSSafari) {
      try {
        effectSrc = await getCachedAudioAssetUrl(file.src);
        if (effectSrc) {
          cachedEffectUrlRef.current.set(file.id, effectSrc);
        }
      } catch {
        effectSrc = file.src;
      }
    }
    if (!effectSrc) {
      effectSrc = file.src;
    }

    if (requestId !== effectPlayRequestRef.current) {
      return;
    }

    applyMusicDuck(0.16, { durationMs: 220 });

    if (iOSSafari) {
      try {
        const playback = await playBufferedUiAudio(file.src, {
          volume: Math.max(
            0,
            Math.min(1, (micMonitor.isActive ? 0.24 : 1) * masterVolume),
          ),
          onEnded: () => {
            bufferedEffectPlaybackRef.current = null;
            if (bufferedEffectTimerRef.current) {
              window.clearInterval(bufferedEffectTimerRef.current);
              bufferedEffectTimerRef.current = null;
            }
            setLibraryLiveId("");
            setLibraryState("idle");
            setLibraryCurrentTime(0);
            restoreMusicAfterEffects({ durationMs: 220, flushDelayMs: 12 });
          },
        });

        if (!playback) {
          throw new Error("Buffered audio playback is unavailable.");
        }

        bufferedEffectPlaybackRef.current = playback;
        setLibraryState("playing");
        setLibraryCurrentTime(0);
        setLibraryDurations((current) => {
          if (Number.isFinite(current[file.id])) {
            return current;
          }
          const next = { ...current, [file.id]: playback.duration || 0 };
          directorAudioMetadataMemoryCache = next;
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(
                DIRECTOR_AUDIO_METADATA_CACHE_KEY,
                JSON.stringify(next),
              );
            } catch {
              // Ignore storage failures.
            }
          }
          return next;
        });

        if (bufferedEffectTimerRef.current) {
          window.clearInterval(bufferedEffectTimerRef.current);
        }
        bufferedEffectTimerRef.current = window.setInterval(() => {
          const currentPlayback = bufferedEffectPlaybackRef.current;
          if (!currentPlayback) {
            return;
          }
          setLibraryCurrentTime(currentPlayback.getCurrentTime());
        }, 90);
        return;
      } catch {
        if (requestId !== effectPlayRequestRef.current) {
          return;
        }
        setConsoleError(
          "This sound could not be played right now. Try Enable Audio and tap again.",
        );
        setEffectsNeedsUnlock(true);
        setLibraryState("idle");
        setLibraryLiveId("");
        restoreMusicAfterEffects({ durationMs: 160, flushDelayMs: 12 });
        return;
      }
    }

    if (!audio) {
      setConsoleError("This audio file could not be played in this browser.");
      setLibraryState("idle");
      setLibraryLiveId("");
      restoreMusicAfterEffects({ durationMs: 160, flushDelayMs: 12 });
      return;
    }

    const nextSrc = effectSrc || file.src;
    const sourceChanged = audio.dataset.effectSrc !== nextSrc;
    audio.dataset.effectSrc = nextSrc;
    audio.dataset.effectId = file.id;
    audio.volume = Math.max(
      0,
      Math.min(1, (micMonitor.isActive ? 0.24 : 1) * masterVolume),
    );
    if (sourceChanged) {
      audio.src = nextSrc;
      audio.load();
    } else {
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore reset failures and still attempt playback.
      }
    }

    try {
      await audio.play();
      if (iOSSafari && !cachedEffectUrlRef.current.has(file.id)) {
        void getCachedAudioAssetUrl(file.src)
          .then((cachedUrl) => {
            if (cachedUrl) {
              cachedEffectUrlRef.current.set(file.id, cachedUrl);
            }
          })
          .catch(() => {});
      }
    } catch (error) {
      if (requestId !== effectPlayRequestRef.current) {
        return;
      }
      if (
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "NotAllowedError")
      ) {
        setConsoleError(
          "Safari blocked this audio. Tap Enable Audio once, then play the sound again.",
        );
        setEffectsNeedsUnlock(true);
        setLibraryState("idle");
        setLibraryLiveId("");
        restoreMusicAfterEffects({ durationMs: 160, flushDelayMs: 12 });
        return;
      }
      setConsoleError("This audio file could not be played in this browser.");
      setLibraryState("idle");
      setLibraryLiveId("");
      restoreMusicAfterEffects({ durationMs: 160, flushDelayMs: 12 });
    }
  }, [
    applyMusicDuck,
    iOSSafari,
    libraryLiveId,
    masterVolume,
    micMonitor.isActive,
    primeEffectsAudio,
    restoreMusicAfterEffects,
    stopDirectorSpeech,
    stopAllEffects,
  ]);

  useEffect(() => {
    playEffectRef.current = playEffect;
  }, [playEffect]);

  const stopAllAudio = async () => {
    stopMusicDeck();
    await micMonitor.stop({ resumeMedia: true });
    await walkie.stopTalking();
    stopAllEffects();
  };

  useEffect(() => {
    setConsoleError("");
    setMusicMessage("");
    setAuthError("");
    setDirectorWalkieNotice("");
    setDirectorHoldLive(false);
    setDirectorSpeakerOn(false);
    setDirectorWalkieOn(false);
    clearSharedBoundaryDuckWindow();
    setLibraryCurrentTime(0);
    setLibraryLiveId("");
    setLibraryState("idle");
    clearLibraryDragState();
    previousDirectorWalkieEnabledRef.current = false;
    previousDirectorWalkieRequestStateRef.current = "idle";
    if (directorWalkieNoticeTimerRef.current) {
      window.clearTimeout(directorWalkieNoticeTimerRef.current);
      directorWalkieNoticeTimerRef.current = null;
    }

    if (effectsAudioRef.current) {
      effectsAudioRef.current.pause();
      effectsAudioRef.current.currentTime = 0;
      effectsAudioRef.current.src = "";
      delete effectsAudioRef.current.dataset.effectSrc;
      delete effectsAudioRef.current.dataset.effectId;
      effectsAudioRef.current.load();
    }
    if (bufferedEffectTimerRef.current) {
      window.clearInterval(bufferedEffectTimerRef.current);
      bufferedEffectTimerRef.current = null;
    }
    if (bufferedEffectPlaybackRef.current) {
      bufferedEffectPlaybackRef.current.stop();
      bufferedEffectPlaybackRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    stopMusicDeck();
    setMusicState("idle");
  }, [clearLibraryDragState, clearSharedBoundaryDuckWindow, managedSessionId, stopMusicDeck]);

  const syncMusicTrackToPlayer = useCallback(
    (track, { autoplay = false, restart = false } = {}) => {
      const player = youtubePlayerRef.current;
      if (!player || !track?.videoId) {
        return false;
      }

      setMusicPlayerError("");
      setMusicOutputVolume(getMusicTargetVolume());

      try {
        const currentVideoId = String(player.getVideoData?.().video_id || "");
        const sameVideo =
          currentVideoId === track.videoId ||
          loadedMusicVideoIdRef.current === track.videoId;

        loadedMusicVideoIdRef.current = track.videoId;

        if (autoplay) {
          if (sameVideo && !restart) {
            player.playVideo();
          } else {
            player.loadVideoById(track.videoId);
          }
          return true;
        }

        if (!sameVideo || restart) {
          player.cueVideoById(track.videoId);
        }
        return true;
      } catch {
        setMusicPlayerError("Player is still loading.");
        return false;
      }
    },
    [getMusicTargetVolume, setMusicOutputVolume],
  );

  useEffect(() => {
    let cancelled = false;
    const mountNode = youtubePlayerHostRef.current;
    setMusicPlayerReady(false);
    setMusicPlayerError("");

    void loadDirectorYouTubeIframeApi()
      .then(() => {
        if (
          cancelled ||
          !mountNode ||
          youtubePlayerRef.current
        ) {
          return;
        }

        mountNode.innerHTML = "";
        const playerHost = document.createElement("div");
        playerHost.className = "h-full w-full";
        mountNode.appendChild(playerHost);

        const player = new window.YT.Player(playerHost, {
          height: "100%",
          width: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            fs: 0,
            disablekb: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event) => {
              if (cancelled) {
                return;
              }

              youtubePlayerRef.current = event.target;
              setMusicPlayerReady(true);
              setMusicPlayerError("");
              setMusicOutputVolume(getMusicTargetVolume());

              const initialTrack =
                musicTracksRef.current[currentTrackIndexRef.current];
              if (initialTrack?.videoId) {
                loadedMusicVideoIdRef.current = initialTrack.videoId;
                try {
                  event.target.cueVideoById(initialTrack.videoId);
                } catch {
                  // Ignore cue failures until the user interacts.
                }
              }
            },
            onStateChange: (event) => {
              if (cancelled) {
                return;
              }

              if (event.data === window.YT.PlayerState.PLAYING) {
                const activeTrack =
                  musicTracksRef.current[currentTrackIndexRef.current];
                setMusicPlayerReady(true);
                setMusicPlayerError("");
                setMusicState("playing");
                setMusicMessage(
                  activeTrack ? `Playing ${activeTrack.name}.` : "Playing video.",
                );
                return;
              }

              if (event.data === window.YT.PlayerState.PAUSED) {
                setMusicPlayerReady(true);
                setMusicState("paused");
                return;
              }

              if (event.data === window.YT.PlayerState.BUFFERING) {
                setMusicPlayerReady(true);
                setMusicMessage("Loading video...");
                return;
              }

              if (event.data === window.YT.PlayerState.CUED) {
                setMusicPlayerReady(true);
                setMusicState((current) =>
                  current === "playing" ? current : "paused",
                );
                return;
              }

              if (event.data === window.YT.PlayerState.ENDED) {
                if (musicTracksRef.current.length > 1) {
                  const nextIndex =
                    (currentTrackIndexRef.current + 1) %
                    musicTracksRef.current.length;
                  const nextTrack = musicTracksRef.current[nextIndex];
                  currentTrackIndexRef.current = nextIndex;
                  setCurrentTrackIndex(nextIndex);
                  if (nextTrack?.videoId) {
                    loadedMusicVideoIdRef.current = nextTrack.videoId;
                    try {
                      event.target.loadVideoById(nextTrack.videoId);
                    } catch {
                      setMusicState("stopped");
                    }
                  }
                } else {
                  setMusicState("stopped");
                  setMusicMessage("Playback finished.");
                }
              }
            },
          },
        });

        youtubePlayerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) {
          setMusicPlayerReady(false);
          setMusicPlayerError("YouTube player could not load.");
          setMusicMessage("YouTube player could not load.");
        }
      });

    return () => {
      cancelled = true;
      try {
        youtubePlayerRef.current?.destroy();
      } catch {
        // Ignore destroy failures.
      }
      youtubePlayerRef.current = null;
      loadedMusicVideoIdRef.current = "";
      mountNode?.replaceChildren();
      setMusicPlayerReady(false);
    };
  }, [getMusicTargetVolume, musicPlayerBootNonce, setMusicOutputVolume]);

  useEffect(() => {
    const currentTrack = musicTracks[currentTrackIndex];
    if (!currentTrack?.videoId || !youtubePlayerRef.current) {
      return;
    }

    if (loadedMusicVideoIdRef.current === currentTrack.videoId) {
      return;
    }

    const synced = syncMusicTrackToPlayer(currentTrack, { autoplay: false });
    if (synced) {
      setMusicMessage(`Ready: ${currentTrack.name}.`);
      setMusicState("paused");
    }
  }, [currentTrackIndex, musicPlayerError, musicTracks, syncMusicTrackToPlayer]);

  useEffect(() => {
    if (!currentTrack?.id) {
      return;
    }

    const row = musicTrackRowRefs.current.get(currentTrack.id);
    row?.scrollIntoView?.({
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentTrack?.id]);

  const handleAddMusicTrack = useCallback(async () => {
    const nextValue = String(musicInput || "").trim();
    if (!nextValue || isAddingMusicTrack) {
      return;
    }

    setIsAddingMusicTrack(true);
    setMusicMessage("");

    try {
      const playlistId = extractYouTubePlaylistId(nextValue);
      if (playlistId) {
        const resolvedPlaylist = await resolveDirectorYouTubePlaylist(nextValue);
        const existingVideoIds = new Set(
          musicTracks.map((track) => track.videoId),
        );
        const nextTracksToAdd = resolvedPlaylist.tracks.filter(
          (track) => !existingVideoIds.has(track.videoId),
        );

        if (!nextTracksToAdd.length) {
          setMusicInput("");
          setMusicMessage("This playlist is already in the deck.");
          return;
        }

        const firstAddedTrack = nextTracksToAdd[0];
        const nextTrackIndex = musicTracks.length;
        setMusicTracks((current) => [...current, ...nextTracksToAdd]);
        setCurrentTrackIndex(nextTrackIndex);
        setMusicInput("");
        loadedMusicVideoIdRef.current = "";
        window.setTimeout(() => {
          syncMusicTrackToPlayer(firstAddedTrack, {
            autoplay: false,
            restart: true,
          });
        }, 0);
        void hydrateImportedMusicTracks(nextTracksToAdd);
        setMusicMessage(
          resolvedPlaylist.totalCount > resolvedPlaylist.importedCount
            ? `Playlist added. ${nextTracksToAdd.length} tracks loaded now.`
            : `Playlist added. ${nextTracksToAdd.length} tracks ready.`,
        );
        return;
      }

      const nextTrack = await resolveDirectorYouTubeTrack(nextValue);
      const existingIndex = musicTracks.findIndex(
        (track) => track.videoId === nextTrack.videoId,
      );

      if (existingIndex >= 0) {
        setCurrentTrackIndex(existingIndex);
        setMusicInput("");
        setMusicMessage("This video is already in the deck.");
        loadedMusicVideoIdRef.current = "";
        syncMusicTrackToPlayer(musicTracks[existingIndex], {
          autoplay: false,
          restart: true,
        });
        return;
      }

      setMusicTracks((current) => [...current, nextTrack]);
      setCurrentTrackIndex(musicTracks.length);
      setMusicInput("");
      loadedMusicVideoIdRef.current = "";
      window.setTimeout(() => {
        syncMusicTrackToPlayer(nextTrack, {
          autoplay: false,
          restart: true,
        });
      }, 0);
      setMusicMessage("Video added. Tap play.");
    } catch (caughtError) {
      setMusicMessage(caughtError.message || "Could not add this YouTube link.");
    } finally {
      setIsAddingMusicTrack(false);
    }
  }, [
    hydrateImportedMusicTracks,
    isAddingMusicTrack,
    musicInput,
    musicTracks,
    syncMusicTrackToPlayer,
  ]);

  const handlePlayMusic = useCallback(async () => {
    const track = musicTracks[currentTrackIndex];
    if (!track) {
      return;
    }

    if (musicPlayerError) {
      setMusicPlayerError("");
      setMusicPlayerReady(false);
      setMusicMessage("Reloading YouTube player...");
      setMusicPlayerBootNonce((current) => current + 1);
      return;
    }

    if (!youtubePlayerRef.current) {
      setMusicPlayerReady(false);
      setMusicMessage("Loading YouTube player...");
      setMusicPlayerBootNonce((current) => current + 1);
      return;
    }

    const synced = syncMusicTrackToPlayer(track, {
      autoplay: true,
    });

    if (!synced) {
      setMusicMessage("YouTube player is loading...");
    }
  }, [currentTrackIndex, musicPlayerError, musicTracks, syncMusicTrackToPlayer]);

  const handlePauseMusic = useCallback(() => {
    const player = youtubePlayerRef.current;
    if (!player) {
      return;
    }

    try {
      player.pauseVideo();
      setMusicState("paused");
    } catch {
      setMusicMessage("Could not pause this video.");
    }
  }, []);

  const handleStopMusic = useCallback(() => {
    stopMusicDeck();
    setMusicMessage("Music stopped.");
  }, [stopMusicDeck]);

  const handleNextMusic = useCallback(async () => {
    if (!musicTracks.length) {
      return;
    }

    const nextIndex = (currentTrackIndex + 1) % musicTracks.length;
    const nextTrack = musicTracks[nextIndex];
    setCurrentTrackIndex(nextIndex);

    if (!nextTrack) {
      return;
    }

    const synced = syncMusicTrackToPlayer(nextTrack, {
      autoplay: true,
      restart: true,
    });

    if (!synced) {
      setMusicMessage("YouTube player is loading...");
    }
  }, [currentTrackIndex, musicTracks, syncMusicTrackToPlayer]);

  const handleToggleMusicPlayback = useCallback(() => {
    if (!musicTracks[currentTrackIndex]) {
      return;
    }

    if (musicState === "playing") {
      handlePauseMusic();
      return;
    }

    void handlePlayMusic();
  }, [currentTrackIndex, handlePauseMusic, handlePlayMusic, musicState, musicTracks]);

  const handleRemoveMusicTrack = useCallback(
    (trackId) => {
      const removeIndex = musicTracks.findIndex((track) => track.id === trackId);
      if (removeIndex < 0) {
        return;
      }

      const nextTracks = musicTracks.filter((track) => track.id !== trackId);
      setMusicTracks(nextTracks);

      if (!nextTracks.length) {
        loadedMusicVideoIdRef.current = "";
        stopMusicDeck();
        setCurrentTrackIndex(0);
        setMusicState("idle");
        setMusicMessage("Deck cleared.");
        return;
      }

      const nextIndex =
        currentTrackIndex > removeIndex
          ? currentTrackIndex - 1
          : Math.min(currentTrackIndex, nextTracks.length - 1);
      const nextTrack = nextTracks[nextIndex];
      setCurrentTrackIndex(nextIndex);
      loadedMusicVideoIdRef.current = "";
      if (nextTrack) {
        const autoplay = musicState === "playing";
        window.setTimeout(() => {
          syncMusicTrackToPlayer(nextTrack, { autoplay });
        }, 0);
      }
      setMusicMessage("Video removed.");
    },
    [currentTrackIndex, musicState, musicTracks, stopMusicDeck, syncMusicTrackToPlayer],
  );

  const handleSelectMusicTrack = useCallback(
    (index) => {
      const nextTrack = musicTracks[index];
      if (!nextTrack) {
        return;
      }

      setCurrentTrackIndex(index);
      loadedMusicVideoIdRef.current = "";
      syncMusicTrackToPlayer(nextTrack, {
        autoplay: musicState === "playing",
      });
    },
    [musicState, musicTracks, syncMusicTrackToPlayer],
  );

  const handleDirectorMicStart = useCallback(async () => {
    if (!directorSpeakerOn || directorMicHoldingRef.current) {
      return;
    }

    directorMicHoldingRef.current = true;
    setDirectorHoldLive(true);
    playUiTone({ frequency: 900, durationMs: 100, type: "sine", volume: 0.04 });
    const started = await micMonitor.start({ pauseMedia: true });
    if (!started) {
      directorMicHoldingRef.current = false;
      setDirectorHoldLive(false);
    }
  }, [directorSpeakerOn, micMonitor]);

  const handleDirectorMicStop = useCallback(async () => {
    directorMicHoldingRef.current = false;
    setDirectorHoldLive(false);
    await micMonitor.stop({ resumeMedia: true });
  }, [micMonitor]);

  const handleDirectorSpeakerSwitchChange = useCallback(
    async (nextChecked) => {
      setDirectorSpeakerOn(nextChecked);

      if (nextChecked) {
        return;
      }

      directorMicPointerIdRef.current = null;
      directorMicHoldingRef.current = false;
      setDirectorHoldLive(false);
      await micMonitor.stop({ resumeMedia: true });
    },
    [micMonitor],
  );

  useEffect(() => {
    const handlePointerRelease = (event) => {
      if (
        directorMicPointerIdRef.current !== null &&
        event.pointerId !== undefined &&
        event.pointerId !== directorMicPointerIdRef.current
      ) {
        return;
      }

      directorMicPointerIdRef.current = null;
      void handleDirectorMicStop();
    };

    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);

    return () => {
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, [handleDirectorMicStop]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const resetHeldAudio = () => {
      directorMicPointerIdRef.current = null;
      void handleDirectorMicStop();
      void walkie.stopTalking("backgrounded");
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        resetHeldAudio();
      }
    };

    window.addEventListener("pagehide", resetHeldAudio);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pagehide", resetHeldAudio);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [handleDirectorMicStop, walkie]);

  const handleSpeakerOutputChange = async (deviceId) => {
    setSpeakerDeviceId(deviceId);
    const applied = await syncSinkId(deviceId);
    setSpeakerMessage(
      applied
        ? "Music routed to selected output."
        : "Using your phone or Bluetooth output.",
    );
  };

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      typeof MediaMetadata === "undefined" ||
      !("mediaSession" in navigator)
    ) {
      return;
    }

    if (iOSSafari || !currentTrack || musicState !== "playing") {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("stop", null);
      } catch {
        // Ignore unsupported action cleanup.
      }
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: "YouTube deck",
      album: "GV Cricket Music Deck",
    });
    navigator.mediaSession.playbackState =
      musicState === "playing" ? "playing" : "paused";

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        void handlePlayMusic();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        handlePauseMusic();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (musicTracks.length > 1) {
          void handleNextMusic();
        }
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        handleStopMusic();
      });
    } catch {
      // Some browsers only support a subset of media session actions.
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("stop", null);
      } catch {
        // Ignore unsupported action cleanup.
      }
    };
  }, [
    currentTrack,
    handleNextMusic,
    handlePauseMusic,
    handlePlayMusic,
    handleStopMusic,
    iOSSafari,
    musicState,
    musicTracks.length,
  ]);

  const directorWalkieChannelEnabled = directorWalkieSharedEnabled;
  const directorWalkieUi =
    walkie.nonUmpireUi ||
    getNonUmpireWalkieUiState({
      sharedEnabled: directorWalkieChannelEnabled,
      localEnabled: directorWalkieOn,
      isTalking: walkie.isSelfTalking,
      isFinishing: walkie.isFinishing,
      requestState: walkie.requestState,
      hasOwnPendingRequest: walkie.hasOwnPendingRequest,
    });
  const directorWalkiePending = Boolean(directorWalkieUi.pendingRequest);
  const directorWalkieNeedsLocalEnableNotice = Boolean(
    directorWalkieUi.needsLocalEnableNotice,
  );
  const directorWalkieLoading = Boolean(
    walkie.claiming ||
    walkie.preparingToTalk ||
    walkie.recoveringAudio ||
    walkie.recoveringSignaling ||
    walkie.updatingEnabled,
  );
  const directorRemoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot: walkie.snapshot,
    participantId: walkie.participantId,
    isSelfTalking: walkie.isSelfTalking,
  });
  const walkieStatus = directorWalkieLoading
    ? walkie.recoveringAudio || walkie.recoveringSignaling
      ? "Reconnecting"
      : "Connecting"
    : directorRemoteSpeakerState.isRemoteTalking
      ? directorRemoteSpeakerState.shortStatus
      : directorWalkiePending
        ? "Requested"
        : !directorWalkieChannelEnabled
          ? "Off"
          : !directorWalkieOn
            ? "Off"
            : walkie.isFinishing
              ? "Finishing"
              : walkie.isSelfTalking
                ? "Director Live"
                : "Ready";
  const surfacedDirectorWalkieNotice = directorWalkieNeedsLocalEnableNotice
    ? directorWalkieUi.notice
    : directorWalkieChannelEnabled ||
        directorWalkieOn ||
        directorWalkieRequestState === "dismissed"
      ? directorWalkieNotice || walkie.notice
      : "";
  const showDirectorWalkieNotice = Boolean(
    surfacedDirectorWalkieNotice || directorWalkieNeedsLocalEnableNotice,
  );
  const canManageSession = Boolean(authorized && managedSession?.match?._id);

  return (
    <div className="mx-auto w-full max-w-full overflow-x-clip px-4 py-6 lg:max-w-375 lg:px-6 2xl:max-w-440">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            void leaveDirectorMode();
          }}
          className="press-feedback inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
        >
          <FaArrowLeft />
          Home
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {authorized ? (
            <button
              type="button"
              onClick={logout}
              className="press-feedback inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-[linear-gradient(135deg,rgba(69,10,10,0.96),rgba(127,29,29,0.92))] px-4 py-2 text-sm font-extrabold uppercase tracking-[0.18em] text-rose-100 shadow-[0_14px_34px_rgba(127,29,29,0.28)]"
            >
              <FaPowerOff />
              Exit
            </button>
          ) : null}
        </div>
      </div>

      {managedSession ? (
        <SessionHeader
          selectedSession={managedSession}
          liveMatch={liveMatch}
          onChangeSession={handleChangeSession}
          readCurrentScore={authorized ? readCurrentScore : () => {}}
        />
      ) : (
        <SessionCoverHero
          imageUrl={
            selectedSession?.match?.matchImageUrl ||
            selectedSession?.session?.matchImageUrl ||
            ""
          }
          alt="Director console cover"
          className="mb-5"
          priority
          showImage={false}
        >
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {!authorized ? (
              <>
                <div className="space-y-2 text-center sm:text-left">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/12 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                    <FaBroadcastTower className="text-xl" />
                  </div>
                  <LiquidSportText
                    as="h1"
                    text="DIRECTOR CONSOLE"
                    variant="hero-bright"
                    simplifyMotion
                    className="text-2xl font-semibold tracking-[-0.03em] sm:text-[2rem]"
                  />
                </div>
                {authError ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {authError}
                  </div>
                ) : null}
                {!showDirectorPinStep ? (
                  <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,8,11,0.68),rgba(8,8,11,0.4))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <LoadingButton
                      type="button"
                      onClick={() => {
                        setAuthError("");
                        setShowDirectorPinStep(true);
                      }}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#22c55e_58%,#34d399_100%)] px-5 py-3.5 font-bold text-black shadow-[0_16px_36px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5 hover:brightness-105"
                    >
                      Get Started
                    </LoadingButton>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-black/30 px-4 py-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                          Step 1
                        </p>
                        <p className="mt-2 text-sm text-zinc-300">
                          Enter the 4-digit director PIN to join the shared live
                          director console.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDirectorPinStep(false);
                          setPin("");
                          setAuthError("");
                        }}
                        className="press-feedback inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300"
                      >
                        Back
                      </button>
                    </div>
                    <label
                      htmlFor="director-inline-pin"
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                    >
                      Director PIN
                    </label>
                    <input
                      id="director-inline-pin"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={4}
                      value={pin}
                      onChange={(event) =>
                        setPin(
                          event.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void submitDirectorPin();
                        }
                      }}
                      placeholder="0000"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-emerald-400/30 focus:bg-white/6 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.08)]"
                    />
                    <LoadingButton
                      type="button"
                      onClick={() => void submitDirectorPin()}
                      disabled={pin.length !== 4}
                      loading={isSubmittingPin}
                      pendingLabel="Checking..."
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#22c55e_58%,#34d399_100%)] px-5 py-3.5 font-bold text-black shadow-[0_16px_36px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue to Match Picker
                    </LoadingButton>
                    {!isSubmittingPin && pin.length !== 4 ? (
                      <p className="mt-3 text-center text-xs text-zinc-500">
                        Enter all 4 digits to continue.
                      </p>
                    ) : null}
                  </div>
                )}
              </>
            ) : showPicker || !managedSession ? (
              <div className="space-y-4">
                <div className="text-center sm:text-left">
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
                    Choose a live session
                  </h1>
                  <p className="mt-1 text-sm text-zinc-300">
                    Pick a live match to join. Multiple directors can open the
                    same match at the same time.
                  </p>
                </div>
                <DirectorSessionPicker
                  sessions={sessions}
                  onSelect={(item) => {
                    setSelectedSessionId(item.session._id);
                    setManagedSessionId(item.session._id);
                    setShowPicker(false);
                    setAuthError("");
                  }}
                  onQuickStart={(item) => {
                    setSelectedSessionId(item.session._id);
                    setManagedSessionId(item.session._id);
                    setShowPicker(false);
                    setAuthError("");
                  }}
                />
              </div>
            ) : null}
          </div>
        </SessionCoverHero>
      )}

      {authorized && consoleError ? (
        <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {consoleError}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.78fr)] 2xl:grid-cols-[minmax(0,1.48fr)_minmax(380px,0.72fr)]">
        <div className="min-w-0 flex flex-col gap-5">
          <div className="order-4 xl:order-4">
            <Card
              title="Loudspeaker"
              subtitle={
                directorHoldLive || micMonitor.isActive
                  ? "Live on speaker"
                  : micMonitor.isStarting
                    ? "Starting loudspeaker"
                    : directorSpeakerOn
                      ? "Hold to talk over loudspeaker"
                      : "Turn on mic to use hold to talk"
              }
              icon={<FaMicrophone />}
              accent="amber"
              help={{
                title: "Loudspeaker",
                body: "Press and hold to speak over the phone speaker or connected Bluetooth speaker. Music and effects duck automatically while you talk.",
              }}
              action={
                <IosSwitch
                  checked={directorSpeakerOn}
                  label="Loudspeaker mic"
                  onChange={(nextChecked) => {
                    void handleDirectorSpeakerSwitchChange(nextChecked);
                  }}
                />
              }
            >
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.24),rgba(10,10,14,0.46))] px-4 py-5">
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(251,191,36,0.84)_20%,rgba(34,211,238,0.42)_75%,rgba(0,0,0,0))]" />
                <div
                  className="flex flex-col items-center gap-4 text-center"
                  style={{
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                  }}
                >
                  {!directorSpeakerOn ? (
                    <div className="w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm text-zinc-300">
                      Turn on the loudspeaker mic to use hold to talk.
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={!directorSpeakerOn}
                    {...HOLD_BUTTON_INTERACTION_PROPS}
                    onPointerDown={(event) => {
                      if (!event.isPrimary) return;
                      if (event.pointerType === "mouse" && event.button !== 0)
                        return;
                      event.preventDefault();
                      directorMicPointerIdRef.current = event.pointerId;
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                      void handleDirectorMicStart();
                    }}
                    onPointerUp={(event) => {
                      event.currentTarget.releasePointerCapture?.(
                        event.pointerId,
                      );
                    }}
                    onPointerCancel={(event) => {
                      event.preventDefault();
                      event.currentTarget.releasePointerCapture?.(
                        event.pointerId,
                      );
                      directorMicPointerIdRef.current = null;
                      void handleDirectorMicStop();
                    }}
                    className={`relative inline-flex h-28 w-28 items-center justify-center rounded-full border text-3xl transition focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${
                      !directorSpeakerOn
                        ? "cursor-not-allowed border-white/8 bg-white/3 text-zinc-500"
                        : directorHoldLive || micMonitor.isActive
                          ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_40px_rgba(16,185,129,0.34)]"
                          : "border-white/10 bg-white/5 text-white"
                    }`}
                    aria-label="Hold to talk on loudspeaker"
                  >
                    <span
                      className={`absolute -inset-2 rounded-full border ${
                        directorSpeakerOn &&
                        (directorHoldLive || micMonitor.isActive)
                          ? "animate-pulse border-emerald-300/35"
                          : "border-transparent"
                      }`}
                    />
                    <FaMicrophone />
                  </button>
                  <div
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      WebkitTouchCallout: "none",
                    }}
                  >
                    <p className="text-lg font-semibold text-white">
                      {!directorSpeakerOn
                        ? "Turn on to talk"
                        : micMonitor.isStarting
                          ? "Starting..."
                          : directorHoldLive || micMonitor.isActive
                            ? "Release to stop"
                            : "Hold to talk"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {directorSpeakerOn
                        ? "Music and effects duck while you speak."
                        : "Mic stays off until you enable it on this device."}
                    </p>
                  </div>
                  {micMonitor.error ? (
                    <p className="text-sm text-rose-300">{micMonitor.error}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>

          <div className="order-1 xl:order-2">
            <Card
              title="Walkie with umpire"
              subtitle="Shared live channel"
              icon={<FaBroadcastTower />}
              accent="emerald"
              help={{
                title: "Walkie with umpire",
                body: "Request walkie when it is off. Once it is on, you can talk with the umpire or spectators. Only one person can hold the channel at a time.",
              }}
              action={
                <div className="flex items-center gap-2">
                  {walkieStatus !== "Off" ? (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        walkieStatus.includes("Live")
                          ? "bg-emerald-500/14 text-emerald-200"
                          : "bg-white/6 text-zinc-300"
                      }`}
                    >
                      {walkieStatus}
                    </span>
                  ) : null}
                  <IosSwitch
                    checked={directorWalkieOn}
                    label="Walkie state"
                    onChange={(nextChecked) => {
                      void handleDirectorWalkieSwitchChange(nextChecked);
                    }}
                    disabled={
                      !canManageSession ||
                      walkie.requestState === "pending" ||
                      walkie.updatingEnabled
                    }
                  />
                </div>
              }
            >
              <div className="space-y-4">
                <div className="min-h-18">
                  {showDirectorWalkieNotice ? (
                    <WalkieNotice
                      embedded
                      notice={surfacedDirectorWalkieNotice}
                      attention={directorWalkieUi.attentionMode}
                      onDismiss={() => {
                        setDirectorWalkieNotice("");
                        walkie.dismissNotice();
                      }}
                    />
                  ) : null}
                </div>
                <div
                  className={
                    directorWalkieChannelEnabled && directorWalkieOn
                      ? "grid gap-4 md:grid-cols-[1fr_auto] md:items-center"
                      : "space-y-3"
                  }
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-500/8 px-3 py-1 text-sm text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <FaBroadcastTower className="text-sky-300" />
                        {walkie.snapshot?.umpireCount || 0} umpire
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/8 px-3 py-1 text-sm text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <FaHeadphones className="text-emerald-300" />
                        {walkie.snapshot?.directorCount || 0} director
                      </span>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(4,20,18,0.68),rgba(10,10,14,0.5))] px-4 py-3 text-center text-sm text-zinc-300">
                      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(52,211,153,0.8)_22%,rgba(34,211,238,0.46)_72%,rgba(0,0,0,0))]" />
                      {!canManageSession
                        ? "Enter director mode and choose a live session to use walkie."
                        : directorWalkieLoading
                          ? walkie.recoveringAudio || walkie.recoveringSignaling
                            ? "Reconnecting walkie..."
                            : "Connecting walkie..."
                          : directorRemoteSpeakerState.isRemoteTalking
                            ? directorRemoteSpeakerState.detail
                            : walkie.snapshot?.enabled && !directorWalkieOn
                              ? "Turn on walkie to listen and respond."
                              : walkie.snapshot?.enabled
                                ? "Hold to talk with the live channel."
                                : directorWalkiePending
                                  ? "Requested umpire access. Waiting for approval."
                                  : directorWalkieOn
                                    ? "Walkie is on. Requesting umpire access."
                                    : walkie.requestState === "dismissed"
                                      ? "Umpire dismissed the request."
                                      : "Turn on this device to request access."}
                    </div>
                    {walkie.error ? (
                      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {walkie.error}
                      </div>
                    ) : null}
                    {walkie.needsAudioUnlock ? (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        <p>
                          Safari needs one tap to enable walkie audio on this
                          device.
                        </p>
                        <button
                          type="button"
                          onClick={() => void walkie.unlockAudio()}
                          className="mt-3 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-300"
                        >
                          Enable Audio
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {directorWalkieChannelEnabled && directorWalkieOn ? (
                    <div className="flex flex-col items-center gap-4">
                      {directorRemoteSpeakerState.isRemoteTalking ? (
                        <div className="w-full max-w-[320px] rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,18,26,0.92),rgba(8,10,16,0.98))] px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                          <div className="mb-2 inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                            {directorRemoteSpeakerState.capsuleLabel}
                          </div>
                          <p className="text-sm font-medium text-white">
                            {directorRemoteSpeakerState.title}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-zinc-400">
                            {directorRemoteSpeakerState.detail}
                          </p>
                        </div>
                      ) : (
                        <WalkieTalkButton
                          active={walkie.isSelfTalking}
                          finishing={walkie.isFinishing}
                          pending={directorWalkieLoading}
                          disabled={
                            !walkie.canTalk ||
                            walkie.recoveringAudio ||
                            walkie.recoveringSignaling
                          }
                          countdown={walkie.countdown}
                          finishDelayLeft={walkie.finishDelayLeft}
                          onPrepare={walkie.prepareToTalk}
                          onStart={walkie.startTalking}
                          onStop={walkie.stopTalking}
                          label="Hold to talk to umpire"
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>

          <div className="order-2 xl:order-3">
            <Card
              title="Sound Effects"
              subtitle={libraryPanelOpen ? "Tap to play audio" : "Ready to fire"}
              icon={<FaBullhorn />}
              accent="violet"
              help={{
                title: "Sound Effects",
                body: "Drop audio files into public/audio/effects and they will show here automatically. Files only load when you tap them.",
              }}
              action={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLibraryPanelOpen((current) => !current)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10"
                    aria-expanded={libraryPanelOpen}
                    aria-label={libraryPanelOpen ? "Collapse sound effects" : "Expand sound effects"}
                  >
                    <FaChevronDown
                      className={`text-sm transition ${libraryPanelOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={stopAllEffects}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200"
                  >
                    Stop audio
                  </button>
                </div>
              }
            >
              <audio
                ref={effectsAudioRef}
                hidden
                preload="metadata"
                playsInline
              />
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,16,30,0.36),rgba(10,10,14,0.32))] p-2">
                <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(192,132,252,0.84)_18%,rgba(59,130,246,0.42)_76%,rgba(0,0,0,0))]" />
                <div className="mb-3 flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-zinc-300">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {orderedLibraryFiles.length} effects ready
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {libraryLiveId
                        ? "Tap the active pad again or use Stop audio."
                        : "Open the deck when you need quick pads."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLibraryPanelOpen((current) => !current)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-white/10"
                  >
                    {libraryPanelOpen ? "Hide" : "Open"}
                    <FaChevronDown
                      className={`text-[10px] transition ${libraryPanelOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
                {effectsNeedsUnlock ? (
                  <div className="mb-3 rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <p>
                      Safari needs one quick tap to enable audio playback on
                      this device.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void primeEffectsAudio().then(() => {
                          setEffectsNeedsUnlock(false);
                          setConsoleError("");
                        });
                      }}
                      className="mt-3 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-300"
                    >
                      Enable Audio
                    </button>
                  </div>
                ) : null}
                {!effectsNeedsUnlock && iOSSafari && !audioUnlocked ? (
                  <div className="mb-3 rounded-[22px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-zinc-300">
                    Tap any sound once to enable audio on this iPhone or iPad.
                  </div>
                ) : null}
                <div className="mb-3 rounded-[22px] border border-white/10 bg-white/3 px-4 py-3 text-sm text-zinc-300">
                  Turn off silent mode to hear sound effects
                </div>
                {libraryPanelOpen && orderedLibraryFiles.length ? (
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                    {orderedLibraryFiles.map((file) => (
                      <div
                        key={file.id}
                        data-library-effect-id={file.id}
                        draggable={!usePointerLibraryReorder}
                        onDragStart={(event) =>
                          handleLibraryDragStart(event, file.id)
                        }
                        onDragEnter={() => handleLibraryDragEnter(file.id)}
                        onDragOver={(event) =>
                          handleLibraryDragOver(event, file.id)
                        }
                        onDrop={(event) => handleLibraryDrop(event, file.id)}
                        onDragEnd={clearLibraryDragState}
                        onClick={() => void playEffect(file)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void playEffect(file);
                          }
                        }}
                        className={`group relative min-h-47 overflow-hidden rounded-3xl border px-4 py-4 pb-5 text-left transition select-none ${
                          libraryLiveId === file.id
                            ? "border-emerald-300/30 bg-[linear-gradient(180deg,rgba(18,40,34,0.9),rgba(10,16,18,0.94))] shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                            : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        } ${
                          draggingLibraryId === file.id
                            ? "scale-[0.985] opacity-72 shadow-[0_20px_50px_rgba(0,0,0,0.34)]"
                            : ""
                        } ${
                          libraryDropTargetId === file.id
                            ? "border-emerald-300/40 ring-2 ring-emerald-400/20"
                            : ""
                        }`}
                      >
                        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-white/18 to-transparent" />
                        <div className="flex h-full flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/90">
                                <FaMusic className="text-sm" />
                              </div>
                              <span
                                role="button"
                                tabIndex={-1}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400"
                                title={
                                  usePointerLibraryReorder
                                    ? "Drag this handle to reorder"
                                    : "Drag to reorder"
                                }
                                onPointerDown={(event) =>
                                  handleLibraryGripPointerDown(event, file.id)
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onDragStart={(event) => {
                                  if (usePointerLibraryReorder) {
                                    event.preventDefault();
                                  }
                                }}
                                style={{
                                  userSelect: "none",
                                  WebkitUserSelect: "none",
                                  WebkitTouchCallout: "none",
                                  touchAction: usePointerLibraryReorder
                                    ? "none"
                                    : "auto",
                                }}
                              >
                                <FaGripVertical className="text-sm" />
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                                {file.label}
                              </div>
                              <div className="truncate text-xs text-zinc-400">
                                {file.fileName}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-2">
                            <div className="space-y-1 pb-1 text-xs text-zinc-400">
                              {libraryLiveId === file.id
                                ? libraryState === "loading"
                                  ? "Loading..."
                                  : "Playing"
                                : "Tap to play"}
                              <div className="text-[11px] text-zinc-500">
                                {libraryLiveId === file.id
                                  ? `${formatAudioTime(libraryCurrentTime)} / ${formatAudioTime(
                                      libraryDurations[file.id] || 0,
                                    )}`
                                  : formatAudioTime(
                                      libraryDurations[file.id] || 0,
                                    )}
                              </div>
                            </div>
                            {libraryLiveId === file.id ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  stopAllEffects();
                                }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                                aria-label={`Stop ${file.label}`}
                              >
                                {libraryState === "loading" ? (
                                  <FaMusic className="text-xs" />
                                ) : (
                                  <FaPause className="text-xs" />
                                )}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : libraryPanelOpen ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-5 text-left text-sm text-zinc-400"
                  >
                    Drop audio files into{" "}
                    <span className="font-semibold text-zinc-200">
                      public/audio/effects
                    </span>{" "}
                    and they will appear here.
                  </button>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="order-3 xl:order-3">
            <Card
              title="YouTube Deck"
              subtitle="Videos and playlists"
              icon={<FaYoutube />}
              accent="cyan"
              help={{
                title: "YouTube Deck",
                body: "Paste a YouTube video or playlist, then play it right here.",
              }}
              action={
                <span className="inline-flex items-center gap-2 rounded-full border border-red-300/16 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 shadow-[0_10px_30px_rgba(239,68,68,0.14)]">
                  <FaYoutube className="text-base text-red-300" />
                  YouTube
                </span>
              }
            >
              <audio ref={audioRef} hidden />
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,25,34,0.34),rgba(10,10,14,0.52))] p-3">
                  <label
                    htmlFor="director-youtube-input"
                    className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                  >
                    Paste video or playlist
                  </label>
                  <p className="mt-2 text-sm text-zinc-400">
                    Open YouTube, copy the link, then paste it here.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href="https://www.youtube.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-red-300/16 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/16"
                    >
                      <FaYoutube className="text-sm text-red-300" />
                      Open YouTube
                    </a>
                    <button
                      type="button"
                      onClick={() => void handlePasteMusicLink()}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/16"
                    >
                      Paste link
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="director-youtube-input"
                      type="url"
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={musicInput}
                      onChange={(event) => setMusicInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleAddMusicTrack();
                        }
                      }}
                      placeholder={
                        isPlaylistInput
                          ? "https://youtube.com/playlist?list=..."
                          : "https://youtube.com/watch?v=..."
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-[16px] text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/26 focus:bg-white/[0.07]"
                    />
                    <LoadingButton
                      type="button"
                      onClick={() => void handleAddMusicTrack()}
                      loading={isAddingMusicTrack}
                      pendingLabel={isPlaylistInput ? "Importing..." : "Adding..."}
                      disabled={!String(musicInput || "").trim()}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#22d3ee_0%,#3b82f6_100%)] px-4 py-3 text-sm font-semibold text-black shadow-[0_14px_34px_rgba(34,211,238,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPlaylistInput ? <FaYoutube /> : <FaCompactDisc />}
                      {isPlaylistInput ? "Import playlist" : "Add video"}
                    </LoadingButton>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-1.5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDirectorAudioMode("cut")}
                      aria-pressed={directorAudioMode === "cut"}
                      className={`rounded-[20px] px-4 py-3 text-left transition ${
                        directorAudioMode === "cut"
                          ? "bg-[linear-gradient(135deg,rgba(127,29,29,0.9),rgba(239,68,68,0.18))] text-white shadow-[0_14px_28px_rgba(127,29,29,0.18)]"
                          : "bg-transparent text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <p className="text-sm font-semibold">Cut music</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Pause YouTube for score calls, then resume.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectorAudioMode("duck")}
                      aria-pressed={directorAudioMode === "duck"}
                      className={`rounded-[20px] px-4 py-3 text-left transition ${
                        directorAudioMode === "duck"
                          ? "bg-[linear-gradient(135deg,rgba(8,47,73,0.92),rgba(34,211,238,0.16))] text-white shadow-[0_14px_28px_rgba(8,145,178,0.18)]"
                          : "bg-transparent text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <p className="text-sm font-semibold">Duck music</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Keep YouTube on and lower it under score calls.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,25,34,0.38),rgba(10,10,14,0.52))]">
                  <div className="relative aspect-video bg-black">
                    {currentTrack ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            currentTrack.thumbnailUrl ||
                            buildYouTubeThumbnailUrl(currentTrack.videoId)
                          }
                          alt={currentTrack.name}
                          className={`absolute inset-0 h-full w-full object-cover transition duration-300 ${
                            musicState === "playing" && musicPlayerReady
                              ? "opacity-0"
                              : "opacity-100"
                          }`}
                        />
                        <div
                          className={`absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.62))] transition ${
                            musicState === "playing" && musicPlayerReady
                              ? "opacity-0"
                              : "opacity-100"
                          }`}
                        />
                      </>
                    ) : null}
                    <div
                      ref={youtubePlayerHostRef}
                      className={`h-full w-full transition ${
                        currentTrack ? "opacity-100" : "pointer-events-none opacity-0"
                      }`}
                      style={{ pointerEvents: "none" }}
                    />
                    {!currentTrack ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.06] text-zinc-300">
                          <FaMusic className="text-lg" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-white">
                            No video loaded
                          </p>
                          <p className="mt-1 text-sm text-zinc-400">
                            Paste a YouTube link to start.
                          </p>
                        </div>
                      </div>
                    ) : currentTrack && (!musicPlayerReady || musicPlayerError) ? (
                      <div className="absolute inset-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            currentTrack.thumbnailUrl ||
                            buildYouTubeThumbnailUrl(currentTrack.videoId)
                          }
                          alt={currentTrack.name}
                          className="h-full w-full object-cover opacity-72"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28),rgba(0,0,0,0.78))]" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center">
                          <p className="text-lg font-semibold text-white">
                            {musicPlayerError || "Loading player..."}
                          </p>
                          <p className="max-w-xs text-sm text-zinc-300">
                            If it takes too long, open the video in YouTube and paste
                            another link.
                          </p>
                          <a
                            href={currentTrack.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
                          >
                            <FaExternalLinkAlt className="text-xs" />
                            Open on YouTube
                          </a>
                        </div>
                      </div>
                    ) : null}
                    {currentTrack ? (
                      <button
                        type="button"
                        onClick={handleToggleMusicPlayback}
                        className="absolute inset-0 z-10 flex items-center justify-center"
                        aria-label={
                          musicState === "playing"
                            ? "Pause video"
                            : "Play video"
                        }
                      >
                        <div
                          className={`inline-flex h-18 w-18 items-center justify-center rounded-full border border-white/18 shadow-[0_16px_36px_rgba(0,0,0,0.32)] transition ${
                            musicState === "playing" && musicPlayerReady
                              ? "bg-black/28 text-white/92 opacity-0 hover:opacity-100"
                              : "bg-white/16 text-white opacity-100 backdrop-blur-sm"
                          }`}
                        >
                          {musicState === "playing" && musicPlayerReady ? (
                            <FaPause className="text-xl" />
                          ) : (
                            <FaPlay className="ml-1 text-xl" />
                          )}
                        </div>
                      </button>
                    ) : null}
                    {currentTrack ? (
                      <div className="pointer-events-none absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-white/14 bg-black/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/88 backdrop-blur-sm">
                        <FaYoutube className="text-red-300" />
                        {musicState === "playing" && musicPlayerReady
                          ? "Tap video to pause"
                          : "Tap video to play"}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,25,34,0.38),rgba(10,10,14,0.52))] px-4 py-4">
                  <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(34,211,238,0.82)_18%,rgba(59,130,246,0.76)_56%,rgba(250,204,21,0.34)_82%,rgba(0,0,0,0))]" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                        Now playing
                      </p>
                      <p className="mt-2 line-clamp-2 text-lg font-semibold text-white">
                        {currentTrack ? currentTrack.name : "No video loaded"}
                      </p>
                    </div>
                    {currentTrack ? (
                      <a
                        href={currentTrack.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 transition hover:bg-white/[0.1]"
                        aria-label="Open on YouTube"
                      >
                        <FaExternalLinkAlt className="text-xs" />
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    {musicMessage ||
                      (musicState === "playing"
                        ? "Playing"
                        : musicState === "paused"
                          ? "Paused"
                          : "Ready")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleNextMusic}
                    disabled={!currentTrack || musicTracks.length < 2}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white disabled:cursor-not-allowed disabled:text-zinc-500"
                    aria-label="Next track"
                  >
                    <FaForward />
                  </button>
                  <button
                    type="button"
                    onClick={handleStopMusic}
                    disabled={!currentTrack}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white disabled:cursor-not-allowed disabled:text-zinc-500"
                    aria-label="Stop music"
                  >
                    <FaStop />
                  </button>
                </div>

                <label className="space-y-2 pb-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Music volume
                  </span>
                  <div className="director-gradient-slider">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#22d3ee_0%,#38bdf8_26%,#3b82f6_52%,#facc15_78%,#f59e0b_100%)]"
                      style={{ width: `${Math.round(musicVolume * 100)}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={musicVolume}
                      onChange={(event) =>
                        setMusicVolume(Number(event.target.value))
                      }
                      className="director-gradient-slider__input"
                    />
                  </div>
                </label>

                {musicTracks.length ? (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3 px-1">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          Playlist
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {musicTracks.length} {musicTracks.length === 1 ? "track" : "tracks"}
                        </p>
                      </div>
                      {currentTrack ? (
                        <div className="rounded-full border border-emerald-300/16 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                          {currentTrackIndex + 1} / {musicTracks.length}
                        </div>
                      ) : null}
                    </div>
                    <div className="max-h-[23rem] space-y-2 overflow-y-auto pr-1">
                      {musicTracks.map((track, index) => (
                        <div
                          key={track.id}
                          ref={(node) => {
                            if (node) {
                              musicTrackRowRefs.current.set(track.id, node);
                            } else {
                              musicTrackRowRefs.current.delete(track.id);
                            }
                          }}
                          className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
                            index === currentTrackIndex
                              ? "border-emerald-300/18 bg-emerald-500/10"
                              : "border-white/8 bg-white/[0.03]"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={track.thumbnailUrl || buildYouTubeThumbnailUrl(track.videoId)}
                            alt={track.name}
                            className="h-12 w-20 shrink-0 rounded-xl object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleSelectMusicTrack(index)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="truncate text-sm font-semibold text-white">
                              {track.name}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                                #{index + 1}
                              </span>
                              {index === currentTrackIndex
                                ? musicState === "playing"
                                  ? "Live"
                                  : "Ready"
                                : "Tap to load"}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMusicTrack(track.id)}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:bg-rose-500/18 hover:text-rose-100"
                            aria-label={`Remove ${track.name}`}
                          >
                            <FaTrash className="text-sm" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-center text-sm text-zinc-400">
                    Paste a YouTube video or playlist above to build the deck.
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="order-5 xl:order-5 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <FaHeadphones className="text-zinc-200" />
              {speakerMessage || "Using phone speaker output."}
            </span>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <Card
            title="Score announcer"
            subtitle="Live score readout"
            icon={<FaVolumeUp />}
            accent="violet"
            help={{
              title: "Score announcer",
              body: "Keep score announcements on for the managed session. Use read current score any time for a quick update.",
            }}
            action={
              <IosSwitch
                checked={speechSettings.enabled}
                label="Score announcer"
                onChange={(nextChecked) =>
                  setSpeechSettings((current) => ({
                    ...current,
                    enabled: nextChecked,
                  }))
                }
              />
            }
          >
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(28,16,46,0.38),rgba(10,10,14,0.52))] px-4 py-4">
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(192,132,252,0.82)_18%,rgba(34,211,238,0.42)_76%,rgba(0,0,0,0))]" />
                <p className="text-sm text-zinc-300">
                  {speechSettings.enabled
                    ? "Score announcer is on."
                    : "Score announcer is off."}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  Tap Read current score any time for a manual update.
                </p>
                {speech.needsGesture && !speech.audioUnlocked ? (
                  <p className="mt-2 text-sm text-amber-200">
                    Tap Read current score once to enable iPhone audio.
                  </p>
                ) : null}
                {speech.status === "blocked" ? (
                  <p className="mt-2 text-sm text-rose-200">
                    Audio is blocked in this browser right now.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={readCurrentScore}
                disabled={!canManageSession}
                className="w-full rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-left text-sm font-semibold text-amber-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/4 disabled:text-zinc-500 disabled:hover:translate-y-0"
              >
                {canManageSession
                  ? "Read current score"
                  : "Choose session first"}
              </button>
            </div>
          </Card>

          <Card
            title="Audio output"
            subtitle="Current playback route"
            icon={<FaHeadphones />}
            accent="amber"
            help={{
              title: "Audio output",
              body: "This shows where your audio is playing. Connect the phone to a Bluetooth speaker first for louder PA playback.",
            }}
          >
            <div className="space-y-4">
              <div className="rounded-3xl border border-rose-300/16 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.16),transparent_36%),linear-gradient(180deg,rgba(52,18,24,0.34),rgba(18,6,10,0.22))] px-4 py-4">
                <p className="text-sm font-semibold text-white">
                  How to use it
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                  <li>1. Connect your phone to a Bluetooth speaker.</li>
                  <li>2. Keep the speaker volume up.</li>
                  <li>
                    3. Use PA mic, music, or sound effects from this page.
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
