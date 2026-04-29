"use client";

/**
 * File overview:
 * Purpose: Renders Director UI for the app's screens and flows.
 * Main exports: DirectorConsoleScreen.
 * Major callers: Feature routes and sibling components.
 * Side effects: reads or writes browser storage.
 * Read next: ./README.md
 */


import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaPowerOff } from "react-icons/fa";
import {
  SessionHeader,
} from "./DirectorConsoleChrome";
import {
  createSpeechSettings,
  DIRECTOR_AUTO_ANNOUNCE_EVENT_TYPES,
  getDirectorPreferredMatch,
  mergeDirectorMatchIntoSessions,
  readCachedDirectorSessions,
  resolveDirectorAutoManageSessionId,
  resolveDirectorYouTubeTrack,
  writeCachedDirectorSessions,
} from "./director-console-utils";
import useEventSource from "../../live/useEventSource";
import useLocalMicMonitor from "../../live/useLocalMicMonitor";
import useSpeechAnnouncer from "../../live/useSpeechAnnouncer";
import useDirectorAudioLibrary from "./hooks/useDirectorAudioLibrary";
import useDirectorAuth from "./hooks/useDirectorAuth";
import useDirectorMusicDeck from "./hooks/useDirectorMusicDeck";
import useDirectorSessionSelection from "./hooks/useDirectorSessionSelection";
import useDirectorWalkieControls from "./hooks/useDirectorWalkieControls";
import LoadingButton from "../../shared/LoadingButton";
import DirectorAudioOutputPanel from "./panels/DirectorAudioOutputPanel";
import DirectorConsoleEntrySection from "./panels/DirectorConsoleEntrySection";
import DirectorLiveStreamPanel from "./panels/DirectorLiveStreamPanel";
import DirectorLoudspeakerPanel from "./panels/DirectorLoudspeakerPanel";
import DirectorScoreAnnouncerPanel from "./panels/DirectorScoreAnnouncerPanel";
import DirectorSoundEffectsPanel from "./panels/DirectorSoundEffectsPanel";
import DirectorWalkiePanel from "./panels/DirectorWalkiePanel";
import DirectorYouTubeDeckPanel from "./panels/DirectorYouTubeDeckPanel";
import { buildCurrentScoreAnnouncement } from "../../../lib/live-announcements";
import {
  getCachedAudioAssetUrl,
  isIOSSafari,
  isUiAudioUnlocked,
  playBufferedUiAudio,
  primeUiAudio,
  restorePreferredAudioSessionType,
  setPreferredAudioSessionType,
  subscribeUiAudioUnlock,
} from "../../../lib/page-audio";

export { resolveDirectorAutoManageSessionId } from "./director-console-utils";

let directorAudioLibraryPromise = null;
let directorAudioMetadataMemoryCache = {};

export default function DirectorConsoleScreen({
  initialAuthorized = false,
  initialSessions = [],
  initialPreferredSessionId = "",
  initialAutoManage = false,
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(Boolean(initialAuthorized));
  const [isLeavingDirectorMode, setIsLeavingDirectorMode] = useState(false);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [consoleError, setConsoleError] = useState("");
  const sessionSelection = useDirectorSessionSelection({
    initialAuthorized,
    initialAutoManage,
    initialPreferredSessionId,
    initialSessions,
    authorized,
    setAuthError,
  });
  const {
    handleChangeSession,
    initialDirectorWalkiePreferenceScope,
    initialTargetSessionId,
    loadAuthorizedDirectorSessions,
    managedSession,
    managedSessionId,
    openDirectorSession,
    pendingInitialManageRef,
    preferredSessionIdRef,
    previousManagedMatchIdRef,
    refreshDirectorSessions,
    selectedSession,
    selectedSessionId,
    sessions,
    setManagedSessionId,
    setSelectedSessionId,
    setSessions,
    setShowPicker,
    showPicker,
  } = sessionSelection;
  const [showDirectorPinStep, setShowDirectorPinStep] = useState(
    Boolean(initialAutoManage && initialTargetSessionId && !initialAuthorized),
  );
  const [musicTracks, setMusicTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [musicState, setMusicState] = useState("idle");
  const [directorAudioMode, setDirectorAudioMode] = useState("duck");
  const [musicVolume, setMusicVolume] = useState(0.8);
  const [musicInput, setMusicInput] = useState("");
  const [isAddingMusicTrack, setIsAddingMusicTrack] = useState(false);
  const [hasLoadedMusicTracks, setHasLoadedMusicTracks] = useState(false);
  const [musicPlayerReady, setMusicPlayerReady] = useState(false);
  const [musicPlayerError, setMusicPlayerError] = useState("");
  const [musicPlayerBootNonce, setMusicPlayerBootNonce] = useState(0);
  const [masterVolume, setMasterVolume] = useState(1);
  const [speakerMessage, setSpeakerMessage] = useState("");
  const [musicMessage, setMusicMessage] = useState("");
  const [directorHoldLive, setDirectorHoldLive] = useState(false);
  const [directorSpeakerOn, setDirectorSpeakerOn] = useState(false);
  const musicTrackRowRefs = useRef(new Map());
  const audioRef = useRef(null);
  const youtubePlayerHostRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const directorMicPointerIdRef = useRef(null);
  const directorMicHoldingRef = useRef(false);
  const playEffectRef = useRef(null);
  const musicResumeTimerRef = useRef(null);
  const musicUrlsRef = useRef([]);
  const musicTracksRef = useRef([]);
  const currentTrackIndexRef = useRef(0);
  const loadedMusicVideoIdRef = useRef("");
  const pendingMusicAutoplayRef = useRef(false);
  const musicEffectDuckFactorRef = useRef(1);
  const musicDuckAnimationFrameRef = useRef(0);
  const sharedBoundaryDuckTimerRef = useRef(null);
  const sharedBoundaryEffectActiveRef = useRef(false);
  const ambientAudioSessionTypeRef = useRef("");
  const lastDirectorAnnouncedLiveEventRef = useRef("");
  const lastHandledSharedSoundEffectEventRef = useRef("");
  const lastHandledBoundarySoundEffectEventRef = useRef("");
  const soundEffectPlaybackCutoffRef = useRef(0);
  const pendingDirectorAnnouncementRef = useRef(null);
  const [speechSettings, setSpeechSettings] = useState(createSpeechSettings);
  const speech = useSpeechAnnouncer(speechSettings);
  const stopDirectorSpeech = speech.stop;
  const micMonitor = useLocalMicMonitor();
  const auth = useDirectorAuth({
    authorized,
    authError,
    isSubmittingPin,
    pin,
    router,
    sessionSelection,
    setAuthError,
    setAuthorized,
    setConsoleError,
    setIsSubmittingPin,
    setPin,
    setShowDirectorPinStep,
  });
  const {
    directorPinError,
    directorPinRateLimit,
    leaveDirectorMode,
    logout,
    submitDirectorPin,
  } = auth;
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
  const audioLibraryRuntime = useDirectorAudioLibrary({
    usePointerLibraryReorder,
  });
  const {
    audioUnlocked,
    bufferedEffectPlaybackRef,
    bufferedEffectTimerRef,
    cachedEffectUrlRef,
    clearLibraryDragState,
    clearLibraryOrderSaveTimer,
    draggingLibraryId,
    effectPlayRequestRef,
    effectPrimeRequestRef,
    effectsAudioRef,
    effectsNeedsUnlock,
    fetchAudioLibrary,
    filteredLibraryFiles,
    flushPendingLibraryOrder,
    handleLibraryDragEnter,
    handleLibraryDragOver,
    handleLibraryDragStart,
    handleLibraryDrop,
    handleLibraryGripPointerDown,
    libraryCurrentTime,
    libraryDropTargetId,
    libraryDurations,
    libraryFiles,
    libraryLiveId,
    libraryLoadTimeoutRef,
    libraryPanelOpen,
    librarySearchQuery,
    libraryState,
    orderedLibraryFiles,
    setAudioUnlocked,
    setEffectsNeedsUnlock,
    setLibraryCurrentTime,
    setLibraryDurations,
    setLibraryLiveId,
    setLibraryPanelOpen,
    setLibrarySearchQuery,
    setLibraryState,
  } = audioLibraryRuntime;

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

  const cancelMusicDuckAnimation = useCallback(() => {
    if (musicDuckAnimationFrameRef.current) {
      window.cancelAnimationFrame(musicDuckAnimationFrameRef.current);
      musicDuckAnimationFrameRef.current = 0;
    }
  }, []);

  const directorMicLive = Boolean(
    directorHoldLive || (micMonitor.isActive && !micMonitor.isPaused),
  );

  const getBaseMusicVolume = useCallback(() => {
    const micDuckFactor = directorMicLive ? 0.24 : 1;
    return Math.max(0, Math.min(1, musicVolume * masterVolume * micDuckFactor));
  }, [directorMicLive, masterVolume, musicVolume]);

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
      clearSharedBoundaryDuckWindow();
    };
  }, [clearSharedBoundaryDuckWindow]);

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
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    if (authorized && managedSessionId) {
      nextUrl.pathname = "/director";
      nextUrl.searchParams.set("session", managedSessionId);
      nextUrl.searchParams.set("manage", "1");
    } else {
      nextUrl.searchParams.delete("session");
      nextUrl.searchParams.delete("manage");
    }

    const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextHref !== currentHref) {
      window.history.replaceState({}, "", nextHref);
    }
  }, [authorized, managedSessionId]);

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

  const handleDirectorMatchUpdated = useCallback(
    (nextMatch) => {
      if (!nextMatch?._id) {
        return;
      }

      setLiveMatch(nextMatch);
      setSessions((current) => {
        const nextSessions = mergeDirectorMatchIntoSessions(current, nextMatch);
        if (nextSessions !== current) {
          writeCachedDirectorSessions(nextSessions);
        }
        return nextSessions;
      });
      setConsoleError("");
    },
    [setSessions],
  );

  const walkieControls = useDirectorWalkieControls({
    authorized,
    initialDirectorWalkiePreferenceScope,
    liveMatch,
    managedSession,
    managedSessionId,
    setDirectorHoldLive,
    speech,
  });
  const {
    directorWalkieOn,
    handleDirectorWalkieSwitchChange,
    setDirectorWalkieNotice,
    setDirectorWalkieOn,
    walkie,
  } = walkieControls;

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
      Math.min(1, (directorMicLive ? 0.24 : 1) * masterVolume),
    );
    if (effectsAudioRef.current) {
      effectsAudioRef.current.volume = nextVolume;
    }
  }, [directorMicLive, masterVolume]);

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
            Math.min(1, (directorMicLive ? 0.24 : 1) * masterVolume),
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
      Math.min(1, (directorMicLive ? 0.24 : 1) * masterVolume),
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
    directorMicLive,
    iOSSafari,
    libraryLiveId,
    masterVolume,
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
  const audioLibrary = audioLibraryRuntime;
  const musicDeck = useDirectorMusicDeck({
    audioRef,
    currentTrack,
    currentTrackIndex,
    currentTrackIndexRef,
    directorAudioMode,
    directorHoldLive,
    directorMicHoldingRef,
    directorMicPointerIdRef,
    directorSpeakerOn,
    getMusicTargetVolume,
    hasLoadedMusicTracks,
    hydrateImportedMusicTracks,
    iOSSafari,
    isAddingMusicTrack,
    loadedMusicVideoIdRef,
    micMonitor,
    musicInput,
    musicMessage,
    musicPlayerBootNonce,
    musicPlayerError,
    musicPlayerReady,
    musicState,
    musicTrackRowRefs,
    musicTracks,
    musicTracksRef,
    musicVolume,
    setCurrentTrackIndex,
    setDirectorAudioMode,
    setDirectorHoldLive,
    setDirectorSpeakerOn,
    setHasLoadedMusicTracks,
    setMusicInput,
    setMusicMessage,
    setMusicPlayerBootNonce,
    setMusicPlayerError,
    setMusicPlayerReady,
    setMusicState,
    setMusicTracks,
    setMusicVolume,
    setMusicOutputVolume,
    setSpeakerMessage,
    stopMusicDeck,
    walkie,
    youtubePlayerHostRef,
    youtubePlayerRef,
  });
  const canManageSession = Boolean(authorized && managedSession?.match?._id);
  const handleLeaveDirectorMode = useCallback(async () => {
    if (isLeavingDirectorMode) {
      return;
    }

    setIsLeavingDirectorMode(true);
    try {
      await leaveDirectorMode();
      if (typeof window !== "undefined") {
        if (window.history.length > 1) {
          router.back();
          window.setTimeout(() => {
            if (
              window.location.pathname === "/director" ||
              window.location.pathname.startsWith("/director?")
            ) {
              router.replace("/");
            }
          }, 180);
          return;
        }
      }
      router.replace("/");
    } finally {
      window.setTimeout(() => {
        setIsLeavingDirectorMode(false);
      }, 220);
    }
  }, [isLeavingDirectorMode, leaveDirectorMode, router]);

  return (
    <div className="mx-auto w-full max-w-full overflow-x-clip px-4 py-6 lg:max-w-375 lg:px-6 2xl:max-w-440">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <LoadingButton
          type="button"
          onClick={() => {
            void handleLeaveDirectorMode();
          }}
          loading={isLeavingDirectorMode}
          pendingLabel="Leaving..."
          leadingIcon={<FaArrowLeft />}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
        >
          <span>Home</span>
        </LoadingButton>
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
        <DirectorConsoleEntrySection
          auth={{
            authorized,
            directorPinError,
            directorPinRateLimit,
            isSubmittingPin,
            pin,
            setAuthError,
            setPin,
            setShowDirectorPinStep,
            showDirectorPinStep,
            submitDirectorPin,
          }}
          sessionSelection={sessionSelection}
        />
      )}

      {authorized && consoleError ? (
        <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {consoleError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] 2xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <div className="min-w-0 flex flex-col gap-4">
          <div className="order-4 md:hidden">
            <DirectorLoudspeakerPanel
              loudspeaker={musicDeck}
              micMonitor={micMonitor}
            />
          </div>

          <div className="order-1 xl:order-2">
            <DirectorWalkiePanel
              canManageSession={canManageSession}
              walkieControls={walkieControls}
            />
          </div>

          <div className="order-2 xl:order-3">
            <DirectorSoundEffectsPanel
              audioLibrary={audioLibrary}
              onStopAllEffects={stopAllEffects}
              onPlayEffect={playEffect}
            />
          </div>

          <div className="order-3">
            <DirectorYouTubeDeckPanel
              musicDeck={musicDeck}
              speakerMessage={speakerMessage}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <DirectorScoreAnnouncerPanel
            canManageSession={canManageSession}
            readCurrentScore={readCurrentScore}
            setSpeechSettings={setSpeechSettings}
            speech={speech}
            speechSettings={speechSettings}
          />

          <DirectorLiveStreamPanel
            canManageSession={canManageSession}
            liveMatch={liveMatch}
            managedSession={managedSession}
            onMatchUpdated={handleDirectorMatchUpdated}
          />

          <div className="hidden md:block">
            <DirectorLoudspeakerPanel
              loudspeaker={musicDeck}
              micMonitor={micMonitor}
            />
          </div>

          <DirectorAudioOutputPanel />
        </div>
      </div>
    </div>
  );
}


