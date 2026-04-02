"use client";

import SiteFooter from "../shared/SiteFooter";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaBroadcastTower, FaEllipsisV } from "react-icons/fa";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useAnnouncementSettings from "../live/useAnnouncementSettings";
import useLiveSoundEffectsPlayer from "../live/useLiveSoundEffectsPlayer";
import { WalkieNotice, WalkieRequestQueue } from "../live/WalkiePanel";
import useWalkieTalkie from "../live/useWalkieTalkie";
import MatchHeroBackdrop from "./MatchHeroBackdrop";
import { countLegalBalls } from "../../lib/match-scoring";
import {
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
  buildUmpireAnnouncement,
  buildSpectatorScoreAnnouncement,
  createScoreLiveEvent,
  createUndoLiveEvent,
} from "../../lib/live-announcements";
import {
  getScoreSoundEffectEventKey,
  getScoreSoundEffectPreviewInput,
  RANDOM_SCORE_EFFECT_ID,
  SCORE_SOUND_EFFECT_KEYS,
} from "../../lib/score-sound-effects";
import { getWalkieRemoteSpeakerState } from "../../lib/walkie-ui";
import { getTotalDismissalsAllowed } from "../../lib/team-utils";
import {
  MatchHeader,
  Scoreboard,
  Splash,
  AccessGate,
} from "./MatchStatusShell";
import { Controls } from "./MatchControls";
import { BallTracker } from "./MatchBallHistory";
import MatchActionGrid from "./MatchActionGrid";
import MatchModalLayer from "./MatchModalLayer";
import MatchSoundEffectsPanel from "./MatchSoundEffectsPanel";
import useLiveRelativeTime from "../live/useLiveRelativeTime";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import useMatch, { triggerMatchHapticFeedback } from "./useMatch";
import useMatchAccess from "./useMatchAccess";
import OptionalFeatureBoundary from "../shared/OptionalFeatureBoundary";
import { buildShareUrl } from "../../lib/site-metadata";
import {
  fetchCachedSoundEffectsLibrary,
  persistSoundEffectsOrder,
  readCachedSoundEffectsLibrary,
  readCachedSoundEffectsOrder,
  sortSoundEffectsByOrder,
  subscribeSoundEffectsLibrarySync,
  warmCachedSoundEffectAssets,
  writeCachedSoundEffectsLibrary,
  writeCachedSoundEffectsOrder,
} from "../../lib/sound-effects-client";
import { applyMatchAction } from "../../lib/match-engine";

function createSoundEffectRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `sound-effect:${crypto.randomUUID()}`;
  }

  return `sound-effect:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

const IPL_HORN_EFFECT = {
  id: "ipl_theme_song.mp3",
  fileName: "ipl_theme_song.mp3",
  label: "ipl theme song",
  src: "/audio/effects/ipl_theme_song.mp3",
};
const SCORE_PRE_EFFECT_RATE = 0.8;
const SCORE_PRE_EFFECT_GAP_MS = 1000;

function estimateSpeechLeadDelayMs(text, rate = 1) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const safeRate = Math.max(0.7, Number(rate) || 1);
  const estimatedMs = Math.round((Math.max(words, 1) / (180 * safeRate)) * 60000 + 250);
  return Math.max(1600, Math.min(2600, estimatedMs));
}

function estimateBoundaryLeadDelayMs(text, rate = 1) {
  return estimateSpeechLeadDelayMs(text, rate) + SCORE_PRE_EFFECT_GAP_MS;
}

const SOUND_EFFECT_DURATION_CACHE_KEY = "gv-sound-effect-durations-v1";

function readCachedSoundEffectDurations() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(SOUND_EFFECT_DURATION_CACHE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCachedSoundEffectDurations(nextDurations) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SOUND_EFFECT_DURATION_CACHE_KEY,
      JSON.stringify(nextDurations),
    );
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

export default function MatchPageClient({
  matchId,
  initialAuthStatus,
  initialMatch,
}) {
  const router = useRouter();
  const cachedInitialSoundEffectFiles = sortSoundEffectsByOrder(
    readCachedSoundEffectsLibrary(),
    readCachedSoundEffectsOrder(),
  );
  const cachedInitialSoundEffectDurations = readCachedSoundEffectDurations();
  const [modal, setModal] = useState({ type: null });
  const [infoText, setInfoText] = useState(null);
  const [soundEffectsOpen, setSoundEffectsOpen] = useState(false);
  const [soundEffectFiles, setSoundEffectFiles] = useState(
    cachedInitialSoundEffectFiles,
  );
  const [soundEffectLibraryStatus, setSoundEffectLibraryStatus] = useState(
    cachedInitialSoundEffectFiles.length ? "ready" : "idle",
  );
  const [soundEffectError, setSoundEffectError] = useState("");
  const [soundEffectDurations, setSoundEffectDurations] = useState(
    cachedInitialSoundEffectDurations,
  );
  const [activeCommentaryAction, setActiveCommentaryAction] = useState("");
  const [activeCommentaryPreviewId, setActiveCommentaryPreviewId] = useState("");
  const localAnnouncementIdRef = useRef(0);
  const lastWalkieRequestSignatureRef = useRef("");
  const umpireAnnouncementTimerRef = useRef(null);
  const pendingUmpireAnnouncementRef = useRef(null);
  const deferredUmpireAnnouncementRef = useRef(null);
  const interruptedUmpireAnnouncementQueueRef = useRef([]);
  const soundEffectPlayingRef = useRef(false);
  const shouldResumeAfterSoundEffectRef = useRef(false);
  const walkieAnnouncementPauseActiveRef = useRef(false);
  const pendingManualScoreAnnouncementRef = useRef(null);
  const previousSoundEffectMatchIdRef = useRef(initialMatch?._id || "");
  const lastSoundEffectTriggerRef = useRef({ effectId: "", at: 0 });
  const lastHandledSoundEffectEventRef = useRef(
    initialMatch?.lastLiveEvent?.type === "sound_effect"
      ? initialMatch.lastLiveEvent.id || ""
      : "",
  );
  const soundEffectPlaybackCutoffRef = useRef(0);
  const localSoundEffectRequestIdRef = useRef("");
  const skipNextBoundaryLeadRef = useRef(false);
  const activeBoundarySequenceRef = useRef(false);
  const boundarySequenceVersionRef = useRef(0);
  const boundarySequenceTimerRef = useRef(null);
  const lastPersistedAnnouncerSettingsRef = useRef("");
  const contentStartRef = useRef(null);
  const announcementDuckRef = useRef([]);
  const announcementRestoreTimerRef = useRef(null);
  const micMonitorDuckingRef = useRef(false);
  const speechPlaybackActiveRef = useRef(false);
  const soundEffectPlaybackActiveRef = useRef(false);
  const handleHeroMenuScroll = useCallback(() => {
    contentStartRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const { authStatus, authError, authSubmitting, submitPin } = useMatchAccess(
    matchId,
    initialAuthStatus
  );
  const { settings: umpireSettings, updateSetting: updateUmpireSetting } =
    useAnnouncementSettings("umpire", matchId);
  const micMonitor = useLocalMicMonitor();
  const {
    speak,
    speakSequence,
    prime,
    stop,
    status,
    voiceName,
    interruptAndCapture,
  } =
    useSpeechAnnouncer(umpireSettings);

  useEffect(() => {
    micMonitorDuckingRef.current = Boolean(
      micMonitor.isActive || micMonitor.isPaused || micMonitor.isStarting,
    );
  }, [micMonitor.isActive, micMonitor.isPaused, micMonitor.isStarting]);

  useEffect(() => {
    speechPlaybackActiveRef.current = status === "speaking";
  }, [status]);

  const clearAnnouncementDuck = useCallback(() => {
    if (announcementRestoreTimerRef.current) {
      window.clearTimeout(announcementRestoreTimerRef.current);
      announcementRestoreTimerRef.current = null;
    }

    if (!Array.isArray(announcementDuckRef.current) || !announcementDuckRef.current.length) {
      return;
    }

    for (const item of announcementDuckRef.current) {
      try {
        item.element.muted = item.muted;
        item.element.volume = item.volume;
      } catch {
        // Ignore stale media elements removed from the page.
      }
    }

    announcementDuckRef.current = [];
  }, []);

  const scheduleAnnouncementDuckRestore = useCallback(
    (delayMs = 220) => {
      if (announcementRestoreTimerRef.current) {
        window.clearTimeout(announcementRestoreTimerRef.current);
        announcementRestoreTimerRef.current = null;
      }

      announcementRestoreTimerRef.current = window.setTimeout(() => {
        announcementRestoreTimerRef.current = null;
        if (
          micMonitorDuckingRef.current ||
          speechPlaybackActiveRef.current ||
          soundEffectPlaybackActiveRef.current
        ) {
          return;
        }
        clearAnnouncementDuck();
      }, Math.max(0, delayMs));
    },
    [clearAnnouncementDuck],
  );

  const duckAnnouncementMedia = useCallback(() => {
    if (typeof document === "undefined" || micMonitorDuckingRef.current) {
      return false;
    }

    if (announcementRestoreTimerRef.current) {
      window.clearTimeout(announcementRestoreTimerRef.current);
      announcementRestoreTimerRef.current = null;
    }

    if (Array.isArray(announcementDuckRef.current) && announcementDuckRef.current.length) {
      return true;
    }

    const excludedElements = new Set(
      document.querySelectorAll('[data-gv-umpire-effects-player="true"]'),
    );
    const tracked = [];
    const mediaElements = document.querySelectorAll("audio, video");

    mediaElements.forEach((element) => {
      if (excludedElements.has(element)) {
        return;
      }

      try {
        tracked.push({
          element,
          volume: typeof element.volume === "number" ? element.volume : 1,
          muted: Boolean(element.muted),
        });

        if (!element.muted) {
          element.volume = Math.min(element.volume, 0.18);
        }
      } catch {
        // Ignore media elements the browser refuses to adjust.
      }
    });

    announcementDuckRef.current = tracked;
    return true;
  }, []);

  const speakWithAnnouncementDuck = useCallback(
    (text, options = {}) => {
      duckAnnouncementMedia();
      const spoke = speak(text, options);
      if (!spoke) {
        scheduleAnnouncementDuckRestore(120);
      }
      return spoke;
    },
    [duckAnnouncementMedia, scheduleAnnouncementDuckRestore, speak],
  );

  const speakSequenceWithAnnouncementDuck = useCallback(
    (items, options = {}) => {
      duckAnnouncementMedia();
      const spoke = speakSequence(items, options);
      if (!spoke) {
        scheduleAnnouncementDuckRestore(120);
      }
      return spoke;
    },
    [duckAnnouncementMedia, scheduleAnnouncementDuckRestore, speakSequence],
  );
  const queueDeferredUmpireAnnouncement = useCallback((entry) => {
    if (!entry?.items?.length) {
      return;
    }

    const nextItems = entry.items.map((item) => ({ ...item }));
    const nextOptions = {
      ...(entry.options || {}),
      priority: Number(entry.options?.priority || entry.priority || 2),
    };
    const existing = deferredUmpireAnnouncementRef.current;

    if (!existing?.items?.length) {
      deferredUmpireAnnouncementRef.current = {
        items: nextItems,
        options: nextOptions,
      };
      return;
    }

    deferredUmpireAnnouncementRef.current = {
      items: [...existing.items, ...nextItems],
      options: {
        ...(existing.options || {}),
        key:
          existing.options?.key ||
          nextOptions.key ||
          `umpire-deferred-${Date.now()}`,
        priority: Math.max(
          Number(existing.options?.priority || 1),
          Number(nextOptions.priority || 1),
        ),
        interrupt: true,
        minGapMs: 0,
      },
    };
  }, []);
  const resumeUmpireAnnouncementsAfterSoundEffect = useCallback(() => {
    soundEffectPlayingRef.current = false;
    activeBoundarySequenceRef.current = false;
    if (walkieAnnouncementPauseActiveRef.current) {
      return;
    }
    const pendingManualScore = pendingManualScoreAnnouncementRef.current;
    const deferredAnnouncement = deferredUmpireAnnouncementRef.current;
    pendingManualScoreAnnouncementRef.current = null;

    if (!shouldResumeAfterSoundEffectRef.current) {
      shouldResumeAfterSoundEffectRef.current = false;
      interruptedUmpireAnnouncementQueueRef.current = [];
      deferredUmpireAnnouncementRef.current = null;
      if (
        deferredAnnouncement?.items?.length &&
        umpireSettings.enabled &&
        umpireSettings.mode !== "silent"
      ) {
        localAnnouncementIdRef.current += 1;
        speakSequenceWithAnnouncementDuck(deferredAnnouncement.items, {
          key: `umpire-post-effect-${localAnnouncementIdRef.current}`,
          priority: Number(deferredAnnouncement.options?.priority || 2),
          interrupt: true,
          minGapMs: 0,
          userGesture: true,
        });
      }
      if (
        pendingManualScore &&
        umpireSettings.enabled &&
        umpireSettings.mode !== "silent"
      ) {
        localAnnouncementIdRef.current += 1;
        speakSequenceWithAnnouncementDuck(pendingManualScore.items, {
          key: `umpire-manual-score-${localAnnouncementIdRef.current}`,
          priority: 4,
          interrupt: true,
          minGapMs: 0,
          userGesture: true,
          ignoreEnabled: true,
        });
      }
      return;
    }
    shouldResumeAfterSoundEffectRef.current = false;

    if (!umpireSettings.enabled || umpireSettings.mode === "silent") {
      interruptedUmpireAnnouncementQueueRef.current = [];
      deferredUmpireAnnouncementRef.current = null;
      return;
    }

    const resumeQueue = [
      ...interruptedUmpireAnnouncementQueueRef.current,
      ...(deferredUmpireAnnouncementRef.current
        ? [deferredUmpireAnnouncementRef.current]
        : []),
    ];
    interruptedUmpireAnnouncementQueueRef.current = [];
    deferredUmpireAnnouncementRef.current = null;

    if (!resumeQueue.length) {
      if (pendingManualScore) {
        localAnnouncementIdRef.current += 1;
        speakSequenceWithAnnouncementDuck(pendingManualScore.items, {
          key: `umpire-manual-score-${localAnnouncementIdRef.current}`,
          priority: 4,
          interrupt: true,
          minGapMs: 0,
          userGesture: true,
          ignoreEnabled: true,
        });
      }
      return;
    }

    localAnnouncementIdRef.current += 1;
    speakSequenceWithAnnouncementDuck(
      [
        ...resumeQueue.flatMap((entry) => entry.items || []),
        ...(pendingManualScore?.items || []),
      ],
      {
        key: `umpire-resume-${localAnnouncementIdRef.current}`,
        priority: Math.max(
          ...resumeQueue.map((entry) => Number(entry.options?.priority || 1)),
          pendingManualScore ? 4 : 1,
        ),
        interrupt: true,
        minGapMs: 0,
        userGesture: true,
      }
    );
  }, [
    speakSequenceWithAnnouncementDuck,
    umpireSettings.enabled,
    umpireSettings.mode,
  ]);
  const {
    audioRef: soundEffectsAudioRef,
    activeEffectId: activeSoundEffectId,
    currentTime: activeSoundEffectCurrentTime,
    needsUnlock: soundEffectsNeedsUnlock,
    playEffect: playLocalSoundEffect,
    status: activeSoundEffectStatus,
    stop: stopActiveSoundEffect,
  } = useLiveSoundEffectsPlayer({
    volume: 1,
    onBeforePlay: () => {
      duckAnnouncementMedia();
      soundEffectPlayingRef.current = true;
      if (umpireAnnouncementTimerRef.current) {
        window.clearTimeout(umpireAnnouncementTimerRef.current);
        umpireAnnouncementTimerRef.current = null;
      }
      if (pendingUmpireAnnouncementRef.current) {
        queueDeferredUmpireAnnouncement(pendingUmpireAnnouncementRef.current);
        pendingUmpireAnnouncementRef.current = null;
      }
      const interruptedQueue = interruptAndCapture();
      if (interruptedQueue?.length) {
        interruptedUmpireAnnouncementQueueRef.current = interruptedQueue;
      }
      stop();
    },
    onAfterEnd: () => {
      scheduleAnnouncementDuckRestore(220);
      resumeUmpireAnnouncementsAfterSoundEffect();
    },
    onDuration: (effect, duration) => {
      if (!effect?.id || !Number.isFinite(duration) || duration <= 0) {
        return;
      }

      setSoundEffectDurations((current) => {
        if (Number.isFinite(current[effect.id])) {
          return current;
        }

        const next = {
          ...current,
          [effect.id]: duration,
        };
        writeCachedSoundEffectDurations(next);
        return next;
      });
    },
  });
  const isAnySoundEffectActive =
    activeSoundEffectStatus === "loading" || activeSoundEffectStatus === "playing";

  useEffect(() => {
    soundEffectPlaybackActiveRef.current = isAnySoundEffectActive;
  }, [isAnySoundEffectActive]);

  useEffect(() => {
    if (micMonitor.isActive || micMonitor.isPaused || micMonitor.isStarting) {
      if (announcementRestoreTimerRef.current) {
        window.clearTimeout(announcementRestoreTimerRef.current);
        announcementRestoreTimerRef.current = null;
      }
      return;
    }

    if (status === "speaking" || isAnySoundEffectActive) {
      duckAnnouncementMedia();
      return;
    }

    scheduleAnnouncementDuckRestore(220);
  }, [
    duckAnnouncementMedia,
    isAnySoundEffectActive,
    micMonitor.isActive,
    micMonitor.isPaused,
    micMonitor.isStarting,
    scheduleAnnouncementDuckRestore,
    status,
  ]);
  const {
    match,
    error,
    isLoading,
    isUpdating,
    lastUpdatedAt,
    historyStack,
    currentInningsHasHistory,
    replaceMatch,
    handleScoreEvent,
    handleUndo,
    handleNextInningsOrEnd,
    patchAndUpdate,
  } = useMatch(matchId, authStatus === "granted", initialMatch);
  const announcerSettingsSignature = useMemo(
    () =>
      [
        umpireSettings.enabled ? "1" : "0",
        umpireSettings.mode || "",
        umpireSettings.playScoreSoundEffects !== false ? "1" : "0",
        umpireSettings.broadcastScoreSoundEffects !== false ? "1" : "0",
      ].join(":"),
    [
      umpireSettings.broadcastScoreSoundEffects,
      umpireSettings.enabled,
      umpireSettings.mode,
      umpireSettings.playScoreSoundEffects,
    ]
  );
  const liveUpdatedLabel = useLiveRelativeTime(lastUpdatedAt);
  const isLiveMatch = Boolean(match?.isOngoing && !match?.result);
  const tossPending = Boolean(match && !match.tossReady);
  const walkie = useWalkieTalkie({
    matchId,
    enabled: Boolean(authStatus === "granted" && isLiveMatch),
    role: "umpire",
    hasUmpireAccess: authStatus === "granted",
    displayName: "Umpire",
    autoConnectAudio: Boolean(authStatus === "granted" && isLiveMatch),
    signalingActive: Boolean(authStatus === "granted" && isLiveMatch && match?.walkieTalkieEnabled),
  });
  const hasPendingWalkieRequests = Boolean(isLiveMatch && walkie.pendingRequests?.length);
  const umpireRemoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot: walkie.snapshot,
    participantId: walkie.participantId,
    isSelfTalking: walkie.isSelfTalking,
  });
  const isLocalWalkieInteractionActive = Boolean(
    walkie.claiming ||
      walkie.preparingToTalk ||
      walkie.updatingEnabled ||
      walkie.isSelfTalking ||
      walkie.isFinishing
  );
  const hasWalkieAudience = Boolean(
    Number(walkie.snapshot?.spectatorCount || 0) +
      Number(walkie.snapshot?.directorCount || 0) >
      0
  );
  const isWalkieConversationActive = Boolean(
    isLocalWalkieInteractionActive || umpireRemoteSpeakerState.isRemoteTalking
  );

  useEffect(() => {
    soundEffectPlaybackCutoffRef.current = Date.now();
  }, []);

  const warmKnownSoundEffects = useCallback(
    (files) => {
      const preferredIds = Object.values(
        umpireSettings.scoreSoundEffectMap || {},
      )
        .map((value) => String(value || "").trim())
        .filter((value) => value && value !== RANDOM_SCORE_EFFECT_ID);

      void warmCachedSoundEffectAssets(files, {
        preferredIds,
      }).catch(() => {});
    },
    [umpireSettings.scoreSoundEffectMap],
  );

  useEffect(() => {
    if (authStatus === "granted" && match && tossPending) {
      router.replace(`/toss/${matchId}`);
    }
  }, [authStatus, match, matchId, router, tossPending]);

  useEffect(() => {
    if (!isLiveMatch) {
      stop();
    }
  }, [isLiveMatch, stop]);

  useEffect(() => {
    const nextMatchId = match?._id || "";
    if (previousSoundEffectMatchIdRef.current === nextMatchId) {
      return;
    }

    previousSoundEffectMatchIdRef.current = nextMatchId;
    localSoundEffectRequestIdRef.current = "";
    lastHandledSoundEffectEventRef.current =
      match?.lastLiveEvent?.type === "sound_effect"
        ? match.lastLiveEvent.id || ""
        : "";
  }, [match?._id, match?.lastLiveEvent?.id, match?.lastLiveEvent?.type]);

  useEffect(() => {
    return () => {
      if (boundarySequenceTimerRef.current) {
        window.clearTimeout(boundarySequenceTimerRef.current);
        boundarySequenceTimerRef.current = null;
      }
      if (umpireAnnouncementTimerRef.current) {
        window.clearTimeout(umpireAnnouncementTimerRef.current);
        umpireAnnouncementTimerRef.current = null;
      }
      pendingUmpireAnnouncementRef.current = null;
      deferredUmpireAnnouncementRef.current = null;
      pendingManualScoreAnnouncementRef.current = null;
      interruptedUmpireAnnouncementQueueRef.current = [];
      activeBoundarySequenceRef.current = false;
      soundEffectPlayingRef.current = false;
      shouldResumeAfterSoundEffectRef.current = false;
      walkieAnnouncementPauseActiveRef.current = false;
      clearAnnouncementDuck();
    };
  }, [clearAnnouncementDuck]);

  const cancelBoundarySequence = useCallback(
    ({ stopEffect = false } = {}) => {
      boundarySequenceVersionRef.current += 1;
      activeBoundarySequenceRef.current = false;
      skipNextBoundaryLeadRef.current = false;
      shouldResumeAfterSoundEffectRef.current = false;
      soundEffectPlayingRef.current = false;

      if (boundarySequenceTimerRef.current) {
        window.clearTimeout(boundarySequenceTimerRef.current);
        boundarySequenceTimerRef.current = null;
      }
      if (umpireAnnouncementTimerRef.current) {
        window.clearTimeout(umpireAnnouncementTimerRef.current);
        umpireAnnouncementTimerRef.current = null;
      }

      pendingUmpireAnnouncementRef.current = null;
      deferredUmpireAnnouncementRef.current = null;
      pendingManualScoreAnnouncementRef.current = null;
      interruptedUmpireAnnouncementQueueRef.current = [];
      walkieAnnouncementPauseActiveRef.current = false;
      stop();

      if (stopEffect) {
        stopActiveSoundEffect();
      }
    },
    [stop, stopActiveSoundEffect]
  );

  useEffect(() => {
    if (!isLiveMatch || !walkie.pendingRequests?.length) {
      lastWalkieRequestSignatureRef.current = "";
      return;
    }

    const nextSignature = walkie.pendingRequests
      .map((request) => request.requestId)
      .join("|");
    if (nextSignature === lastWalkieRequestSignatureRef.current) {
      return;
    }

    lastWalkieRequestSignatureRef.current = nextSignature;
    const latestRequest = walkie.pendingRequests[0];
    const requestRole =
      latestRequest?.role === "director" ? "Director" : "Spectator";

    try {
      speakWithAnnouncementDuck(`${requestRole} requested walkie-talkie.`, {
        key: `umpire-walkie-request-${latestRequest?.requestId || nextSignature}`,
        rate: 0.9,
        interrupt: true,
        ignoreEnabled: true,
      });
    } catch (error) {
      console.error("Walkie request speech failed:", error);
    }
  }, [isLiveMatch, speakWithAnnouncementDuck, walkie.pendingRequests]);

  const flushPendingUmpireAnnouncement = () => {
    const next = pendingUmpireAnnouncementRef.current;
    if (!next) return;

    pendingUmpireAnnouncementRef.current = null;
    if (soundEffectPlayingRef.current || walkieAnnouncementPauseActiveRef.current) {
      queueDeferredUmpireAnnouncement(next);
      return;
    }
    if (!umpireSettings.enabled || umpireSettings.mode === "silent") {
      return;
    }
    localAnnouncementIdRef.current += 1;
    speakSequenceWithAnnouncementDuck(next.items, {
      key: `umpire-${localAnnouncementIdRef.current}`,
      priority: next.priority || 2,
      minGapMs: 0,
      userGesture: true,
      interrupt: true,
    });
  };

  const speakImmediateUmpireSequence = useCallback((sequence, keyPrefix) => {
    if (!sequence?.items?.length || !umpireSettings.enabled || umpireSettings.mode === "silent") {
      return;
    }

    if (soundEffectPlayingRef.current || walkieAnnouncementPauseActiveRef.current) {
      queueDeferredUmpireAnnouncement({
        items: sequence.items,
        options: {
          key: keyPrefix,
          priority: sequence.priority || 2,
        },
      });
      return;
    }

    localAnnouncementIdRef.current += 1;
    speakSequenceWithAnnouncementDuck(sequence.items, {
      key: `${keyPrefix}-${localAnnouncementIdRef.current}`,
      priority: sequence.priority || 2,
      minGapMs: 0,
      userGesture: true,
      interrupt: true,
    });
  }, [
    queueDeferredUmpireAnnouncement,
    speakSequenceWithAnnouncementDuck,
    umpireSettings.enabled,
    umpireSettings.mode,
  ]);

  const buildUmpireScorePreview = useCallback((runs, isOut = false, extraType = null) => {
    if (!match) {
      return {
        nextMatch: match,
        event: null,
        sequence: { items: [], priority: 2 },
        leadItem: null,
        followUpItems: [],
      };
    }
    let nextMatch = match;
    try {
      nextMatch = applyMatchAction(match, {
        actionId: `umpire-preview:${Date.now()}`,
        type: "score_ball",
        runs,
        isOut,
        extraType,
      });
    } catch {
      nextMatch = match;
    }

    const event = createScoreLiveEvent(match, nextMatch || match, {
      runs,
      isOut,
      extraType,
    });
    const baseSequence = buildLiveScoreAnnouncementSequence(
      event,
      nextMatch || match,
      umpireSettings.mode
    );
    const umpireLeadText =
      buildUmpireAnnouncement(event, umpireSettings.mode) ||
      baseSequence.items?.[0]?.text ||
      "";
    const sequence = {
      ...baseSequence,
      items: umpireLeadText
        ? [
            {
              ...(baseSequence.items?.[0] || {
                pauseAfterMs: 0,
                rate: 0.78,
              }),
              text: umpireLeadText,
            },
            ...(baseSequence.items?.slice(1) || []),
          ]
        : baseSequence.items || [],
    };
    const leadItem = sequence.items?.[0] || null;
    const followUpItems = sequence.items?.slice(1) || [];

    if (!followUpItems.length) {
      const followUpText =
        buildSpectatorScoreAnnouncement(event, nextMatch || match) ||
        buildCurrentScoreAnnouncement(nextMatch || match);
      if (followUpText) {
        followUpItems.push({
          text: followUpText,
          pauseAfterMs: 0,
          rate: 0.8,
        });
      }
    }

    return {
      nextMatch: nextMatch || match,
      event,
      sequence,
      leadItem,
      followUpItems,
    };
  }, [match, umpireSettings.mode]);

  const getAvailableScoreSoundEffectPool = useCallback(() => {
    const availableEffects = soundEffectFiles.length
      ? soundEffectFiles
      : readCachedSoundEffectsLibrary();

    return availableEffects.filter(
      (effect) => effect?.id && effect?.src && effect.id !== RANDOM_SCORE_EFFECT_ID,
    );
  }, [soundEffectFiles]);

  const pickRandomScoreSoundEffect = useCallback(() => {
    const randomPool = getAvailableScoreSoundEffectPool();
    if (!randomPool.length) {
      return null;
    }
    return randomPool[Math.floor(Math.random() * randomPool.length)] || null;
  }, [getAvailableScoreSoundEffectPool]);

  const findConfiguredScoreSoundEffect = useCallback((runs, isOut = false, extraType = null) => {
    const effectKey = getScoreSoundEffectEventKey(runs, isOut, extraType);
    if (!effectKey) {
      return null;
    }

    const configuredMap = umpireSettings.scoreSoundEffectMap || {};
    const configuredEffectId =
      typeof configuredMap?.[effectKey] === "string" ? configuredMap[effectKey] : "";
    const effectId = String(configuredEffectId || "").trim();
    if (!effectId) {
      return null;
    }

    if (effectId === RANDOM_SCORE_EFFECT_ID) {
      return pickRandomScoreSoundEffect();
    }

    const availableEffects = soundEffectFiles.length
      ? soundEffectFiles
      : readCachedSoundEffectsLibrary();
    return (
      availableEffects.find((effect) => effect?.id === effectId) ||
      (effectId === IPL_HORN_EFFECT.id ? IPL_HORN_EFFECT : null)
    );
  }, [pickRandomScoreSoundEffect, soundEffectFiles, umpireSettings.scoreSoundEffectMap]);

  const announceConfiguredScoreFollowUp = useCallback((followUpItems = []) => {
    if (!umpireSettings.enabled || umpireSettings.mode === "silent" || !followUpItems.length) {
      return;
    }

    speakImmediateUmpireSequence(
      {
        items: followUpItems,
        priority: 2,
      },
      "umpire-boundary-score"
    );
  }, [speakImmediateUmpireSequence, umpireSettings.enabled, umpireSettings.mode]);

  const queueConfiguredScoreFollowUp = useCallback((followUpItems = []) => {
    if (!umpireSettings.enabled || umpireSettings.mode === "silent" || !followUpItems.length) {
      deferredUmpireAnnouncementRef.current = null;
      return;
    }

    deferredUmpireAnnouncementRef.current = {
      items: followUpItems,
      options: {
        key: "umpire-boundary-score",
        priority: 2,
      },
    };
  }, [umpireSettings.enabled, umpireSettings.mode]);

  const announceUmpireAction = (runs, isOut = false, extraType = null) => {
    if (!umpireSettings.enabled || umpireSettings.mode === "silent" || !isLiveMatch) {
      return;
    }

    const { sequence } = buildUmpireScorePreview(runs, isOut, extraType);
    const shouldSkipBoundaryLead =
      skipNextBoundaryLeadRef.current &&
      !isOut &&
      !extraType &&
      Number(runs) === 6;
    if (shouldSkipBoundaryLead) {
      skipNextBoundaryLeadRef.current = false;
    }
    const sequenceItems = shouldSkipBoundaryLead
      ? sequence.items.slice(1)
      : sequence.items;

    if (!sequenceItems.length) return;

    pendingUmpireAnnouncementRef.current = {
      ...sequence,
      items: sequenceItems,
    };
    if (umpireAnnouncementTimerRef.current) {
      window.clearTimeout(umpireAnnouncementTimerRef.current);
    }
    umpireAnnouncementTimerRef.current = window.setTimeout(() => {
      umpireAnnouncementTimerRef.current = null;
      flushPendingUmpireAnnouncement();
    }, 140);
  };

  const handleAnnouncedScoreEvent = async (
    runs,
    isOut = false,
    extraType = null
  ) => {
    if (activeBoundarySequenceRef.current || soundEffectPlayingRef.current) {
      cancelBoundarySequence({ stopEffect: true });
    }

    const shouldPlayLocalScoreEffect =
      umpireSettings.playScoreSoundEffects !== false;
    const shouldBroadcastScoreEffect =
      umpireSettings.broadcastScoreSoundEffects !== false;
    const configuredScoreEffect =
      shouldPlayLocalScoreEffect || shouldBroadcastScoreEffect
        ? await resolveConfiguredScoreSoundEffect(runs, isOut, extraType)
        : null;
    const scorePreview = buildUmpireScorePreview(runs, isOut, extraType);

    if (configuredScoreEffect) {
      if (!shouldPlayLocalScoreEffect && shouldBroadcastScoreEffect) {
        try {
          await fetch(`/api/matches/${matchId}/sound-effects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              effectId: configuredScoreEffect.id,
              clientRequestId: createSoundEffectRequestId(),
              resumeAnnouncements: false,
              trigger: "score_boundary",
              preAnnouncementText: String(scorePreview.leadItem?.text || "").trim(),
              preAnnouncementDelayMs: String(scorePreview.leadItem?.text || "").trim()
                ? estimateBoundaryLeadDelayMs(
                    String(scorePreview.leadItem?.text || "").trim(),
                    Number(scorePreview.leadItem?.rate || SCORE_PRE_EFFECT_RATE),
                  )
                : 0,
            }),
          });
        } catch {
          // Spectator relay is best-effort and should not block scoring.
        }
        announceUmpireAction(runs, isOut, extraType);
        handleScoreEvent(runs, isOut, extraType);
        return;
      }

      const boundarySequenceVersion = boundarySequenceVersionRef.current + 1;
      const leadText = String(scorePreview.leadItem?.text || "").trim();
      const leadRate = Number(scorePreview.leadItem?.rate || SCORE_PRE_EFFECT_RATE);
      const leadDelayMs = leadText
        ? estimateBoundaryLeadDelayMs(leadText, leadRate)
        : 0;
      const clientRequestId = createSoundEffectRequestId();
      boundarySequenceVersionRef.current = boundarySequenceVersion;
      activeBoundarySequenceRef.current = true;

      if (shouldBroadcastScoreEffect) {
        localSoundEffectRequestIdRef.current = clientRequestId;
        try {
          await fetch(`/api/matches/${matchId}/sound-effects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              effectId: configuredScoreEffect.id,
              clientRequestId,
              resumeAnnouncements: false,
              trigger: "score_boundary",
              preAnnouncementText: leadText,
              preAnnouncementDelayMs: leadDelayMs,
            }),
          });
        } catch {
          // Spectator relay is best-effort and should not block scoring.
        }
      }

      handleScoreEvent(runs, isOut, extraType);

      if (leadText && umpireSettings.enabled && umpireSettings.mode !== "silent") {
        speakWithAnnouncementDuck(leadText, {
          key: `umpire-score-pre-${configuredScoreEffect.id}`,
          rate: leadRate,
          interrupt: true,
          minGapMs: 0,
          userGesture: true,
        });
        await new Promise((resolve) => {
          boundarySequenceTimerRef.current = window.setTimeout(() => {
            boundarySequenceTimerRef.current = null;
            resolve();
          }, leadDelayMs);
        });

        if (boundarySequenceVersion !== boundarySequenceVersionRef.current) {
          return;
        }
      }

      if (shouldPlayLocalScoreEffect) {
        setSoundEffectError("");
        shouldResumeAfterSoundEffectRef.current = false;
        queueConfiguredScoreFollowUp(scorePreview.followUpItems);
        const playedLocally = await playLocalSoundEffect(configuredScoreEffect, {
          userGesture: true,
        });
        if (!playedLocally) {
          resumeUmpireAnnouncementsAfterSoundEffect();
          return;
        }
      }

      if (boundarySequenceVersion !== boundarySequenceVersionRef.current) {
        return;
      }

      activeBoundarySequenceRef.current = false;
      if (!shouldPlayLocalScoreEffect) {
        announceConfiguredScoreFollowUp(scorePreview.followUpItems);
      }
      return;
    }

    announceUmpireAction(runs, isOut, extraType);
    handleScoreEvent(runs, isOut, extraType);
  };

  const handleManualScoreAnnouncement = useCallback(() => {
    if (!match) {
      return;
    }

    const text = buildCurrentScoreAnnouncement(match);
    if (!text) {
      return;
    }

    if (
      soundEffectPlayingRef.current ||
      walkieAnnouncementPauseActiveRef.current
    ) {
      pendingManualScoreAnnouncementRef.current = {
        items: [
          {
            text,
            pauseAfterMs: 0,
            rate: 0.9,
          },
        ],
        options: {
          key: `umpire-current-score-deferred-${Date.now()}`,
          priority: 3,
        },
      };
      return;
    }

    localAnnouncementIdRef.current += 1;
    speakWithAnnouncementDuck(text, {
      key: `umpire-current-score-${localAnnouncementIdRef.current}`,
      rate: 0.9,
      minGapMs: 0,
      userGesture: true,
      ignoreEnabled: true,
      interrupt: true,
    });
  }, [match, soundEffectPlayingRef, speakWithAnnouncementDuck]);
  const pauseUmpireAnnouncementsForWalkie = useCallback(() => {
    if (walkieAnnouncementPauseActiveRef.current) {
      return;
    }

    walkieAnnouncementPauseActiveRef.current = true;
    boundarySequenceVersionRef.current += 1;
    activeBoundarySequenceRef.current = false;
    shouldResumeAfterSoundEffectRef.current = false;

    if (boundarySequenceTimerRef.current) {
      window.clearTimeout(boundarySequenceTimerRef.current);
      boundarySequenceTimerRef.current = null;
    }

    if (umpireAnnouncementTimerRef.current) {
      window.clearTimeout(umpireAnnouncementTimerRef.current);
      umpireAnnouncementTimerRef.current = null;
    }

    if (pendingUmpireAnnouncementRef.current) {
      queueDeferredUmpireAnnouncement(pendingUmpireAnnouncementRef.current);
      pendingUmpireAnnouncementRef.current = null;
    }

    const interruptedQueue = interruptAndCapture();
    if (interruptedQueue?.length) {
      interruptedUmpireAnnouncementQueueRef.current = [
        ...interruptedUmpireAnnouncementQueueRef.current,
        ...interruptedQueue,
      ];
    }

    if (
      soundEffectPlayingRef.current ||
      activeSoundEffectStatus === "loading" ||
      activeSoundEffectStatus === "playing"
    ) {
      soundEffectPlayingRef.current = false;
      stopActiveSoundEffect();
    }
  }, [
    activeSoundEffectStatus,
    interruptAndCapture,
    queueDeferredUmpireAnnouncement,
    stopActiveSoundEffect,
  ]);
  const resumeUmpireAnnouncementsAfterWalkie = useCallback(() => {
    if (!walkieAnnouncementPauseActiveRef.current || soundEffectPlayingRef.current) {
      return;
    }

    walkieAnnouncementPauseActiveRef.current = false;
    const pendingManualScore = pendingManualScoreAnnouncementRef.current;
    pendingManualScoreAnnouncementRef.current = null;

    if (!umpireSettings.enabled || umpireSettings.mode === "silent") {
      interruptedUmpireAnnouncementQueueRef.current = [];
      deferredUmpireAnnouncementRef.current = null;
      return;
    }

    const resumeQueue = [
      ...interruptedUmpireAnnouncementQueueRef.current,
      ...(deferredUmpireAnnouncementRef.current
        ? [deferredUmpireAnnouncementRef.current]
        : []),
    ];
    interruptedUmpireAnnouncementQueueRef.current = [];
    deferredUmpireAnnouncementRef.current = null;

    if (!resumeQueue.length && !pendingManualScore?.items?.length) {
      return;
    }

    localAnnouncementIdRef.current += 1;
    speakSequenceWithAnnouncementDuck(
      [
        ...resumeQueue.flatMap((entry) => entry.items || []),
        ...(pendingManualScore?.items || []),
      ],
      {
        key: `umpire-walkie-resume-${localAnnouncementIdRef.current}`,
        priority: Math.max(
          ...resumeQueue.map((entry) => Number(entry.options?.priority || 1)),
          pendingManualScore ? 4 : 1,
        ),
        interrupt: true,
        minGapMs: 0,
        userGesture: true,
      }
    );
  }, [
    speakSequenceWithAnnouncementDuck,
    umpireSettings.enabled,
    umpireSettings.mode,
  ]);
  useEffect(() => {
    if (!isWalkieConversationActive) {
      resumeUmpireAnnouncementsAfterWalkie();
      return;
    }

    pauseUmpireAnnouncementsForWalkie();
  }, [
    isWalkieConversationActive,
    pauseUmpireAnnouncementsForWalkie,
    resumeUmpireAnnouncementsAfterWalkie,
  ]);

  const stopCommentaryPlayback = useCallback(() => {
    cancelBoundarySequence({ stopEffect: true });
    stop();
    scheduleAnnouncementDuckRestore(120);
    setActiveCommentaryPreviewId("");
    setActiveCommentaryAction("");
  }, [cancelBoundarySequence, scheduleAnnouncementDuckRestore, stop]);

  const ensureUmpireScoreFeedbackEnabled = useCallback(() => {
    if (!umpireSettings.enabled) {
      updateUmpireSetting("enabled", true);
    }

    if (umpireSettings.mode === "silent") {
      updateUmpireSetting("mode", "simple");
    }
  }, [
    umpireSettings.enabled,
    umpireSettings.mode,
    updateUmpireSetting,
  ]);

  const broadcastManualScoreAnnouncement = useCallback(async () => {
    if (!match?._id || !isLiveMatch) {
      return;
    }

    try {
      await fetch(`/api/matches/${matchId}/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({}),
      });
    } catch {
      // Local umpire announcement already played. Spectator sync is best-effort.
    }
  }, [isLiveMatch, match?._id, matchId]);

  const handleScoreFeedbackHoldStart = () => {
    if (!match) {
      return;
    }

    ensureUmpireScoreFeedbackEnabled();
    prime({ userGesture: true });
    handleManualScoreAnnouncement();
    void broadcastManualScoreAnnouncement();
  };

  const loadSoundEffectsLibrary = useCallback(async ({ force = false, silent = false } = {}) => {
    if (soundEffectLibraryStatus === "loading" && !force) {
      return;
    }

    if (!force && soundEffectFiles.length) {
      setSoundEffectLibraryStatus("ready");
      warmKnownSoundEffects(soundEffectFiles);
      return;
    }

    if (!silent || !soundEffectFiles.length) {
      setSoundEffectLibraryStatus("loading");
    }
    setSoundEffectError("");

    try {
      const nextFiles = await fetchCachedSoundEffectsLibrary({ force });
      setSoundEffectFiles(nextFiles);
      setSoundEffectLibraryStatus("ready");
      warmKnownSoundEffects(nextFiles);
    } catch (caughtError) {
      setSoundEffectLibraryStatus("idle");
      setSoundEffectError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load sound effects.",
      );
    }
  }, [
    soundEffectFiles,
    soundEffectLibraryStatus,
    warmKnownSoundEffects,
  ]);

  useEffect(() => {
    return subscribeSoundEffectsLibrarySync(() => {
      const nextFiles = sortSoundEffectsByOrder(
        readCachedSoundEffectsLibrary(),
        readCachedSoundEffectsOrder(),
      );

      setSoundEffectFiles(nextFiles);
      setSoundEffectLibraryStatus(nextFiles.length ? "ready" : "idle");
    });
  }, []);

  const resolveConfiguredScoreSoundEffect = useCallback(
    async (runs, isOut = false, extraType = null) => {
      let nextEffect = findConfiguredScoreSoundEffect(runs, isOut, extraType);
      if (nextEffect) {
        return nextEffect;
      }

      const effectKey = getScoreSoundEffectEventKey(runs, isOut, extraType);
      if (!effectKey) {
        return null;
      }

      const configuredEffectId = String(
        umpireSettings.scoreSoundEffectMap?.[effectKey] || "",
      ).trim();
      if (!configuredEffectId) {
        return null;
      }

      if (configuredEffectId === RANDOM_SCORE_EFFECT_ID) {
        return findConfiguredScoreSoundEffect(runs, isOut, extraType);
      }

      if (configuredEffectId === IPL_HORN_EFFECT.id) {
        return IPL_HORN_EFFECT;
      }

      return nextEffect;
    },
    [
      findConfiguredScoreSoundEffect,
      umpireSettings.scoreSoundEffectMap,
    ],
  );

  useEffect(() => {
    if (!soundEffectFiles.length) {
      return;
    }

    warmKnownSoundEffects(soundEffectFiles);
  }, [soundEffectFiles, warmKnownSoundEffects]);

  const toggleSoundEffectsPanel = useCallback(() => {
    setSoundEffectsOpen((current) => {
      const nextOpen = !current;
      if (nextOpen && !soundEffectFiles.length) {
        void loadSoundEffectsLibrary();
      }
      return nextOpen;
    });
  }, [loadSoundEffectsLibrary, soundEffectFiles.length]);

  const handlePlaySoundEffect = useCallback(
    async (file) => {
      if (!match?._id || !isLiveMatch || !file?.src) {
        return;
      }

      if (
        activeSoundEffectId === file.id &&
        (activeSoundEffectStatus === "loading" ||
          activeSoundEffectStatus === "playing")
      ) {
        const stopRequestId =
          localSoundEffectRequestIdRef.current || createSoundEffectRequestId();
        stopActiveSoundEffect();
        localSoundEffectRequestIdRef.current = "";
        try {
          await fetch(`/api/matches/${matchId}/sound-effects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              effectId: file.id,
              clientRequestId: stopRequestId,
              action: "stop",
            }),
          });
        } catch {
          // Local stop already succeeded. Relay sync is best-effort.
        }
        return;
      }

      const now = Date.now();
      if (
        lastSoundEffectTriggerRef.current.effectId === file.id &&
        now - lastSoundEffectTriggerRef.current.at < 220
      ) {
        return;
      }
      lastSoundEffectTriggerRef.current = {
        effectId: file.id,
        at: now,
      };

      triggerMatchHapticFeedback();
      setSoundEffectError("");
      shouldResumeAfterSoundEffectRef.current = false;

      const clientRequestId = createSoundEffectRequestId();
      const playedLocally = await playLocalSoundEffect(file, {
        userGesture: true,
      });
      if (!playedLocally) {
        resumeUmpireAnnouncementsAfterSoundEffect();
        return;
      }
      localSoundEffectRequestIdRef.current = clientRequestId;

      try {
        const response = await fetch(`/api/matches/${matchId}/sound-effects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            effectId: file.id,
            clientRequestId,
          }),
        });
        if (!response.ok) {
          return;
        }
      } catch {
        // Local playback already succeeded. Treat spectator/director sync as
        // best-effort so one failed relay does not surface as a hard app error.
      }
    },
    [
      activeSoundEffectId,
      activeSoundEffectStatus,
      isLiveMatch,
      match?._id,
      matchId,
      playLocalSoundEffect,
      resumeUmpireAnnouncementsAfterSoundEffect,
      stopActiveSoundEffect,
    ],
  );

  const handleStopLiveSoundEffect = useCallback(async () => {
    const effectId = String(activeSoundEffectId || "").trim();
    if (!effectId) {
      stopActiveSoundEffect();
      return;
    }

    const stopRequestId =
      localSoundEffectRequestIdRef.current || createSoundEffectRequestId();
    stopActiveSoundEffect();
    localSoundEffectRequestIdRef.current = "";

    try {
      await fetch(`/api/matches/${matchId}/sound-effects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          effectId,
          clientRequestId: stopRequestId,
          action: "stop",
        }),
      });
    } catch {
      // Local stop already succeeded. Relay sync is best-effort.
    }
  }, [activeSoundEffectId, matchId, stopActiveSoundEffect]);

  const triggerSharedSoundEffect = useCallback(
    async (
      file,
      {
        userGesture = true,
        resumeAnnouncements = false,
        trigger = "manual",
        preAnnouncementText = "",
        preAnnouncementDelayMs = 0,
        playLocally = true,
        broadcast = true,
      } = {}
    ) => {
      if (!match?._id || !isLiveMatch || !file?.id) {
        return false;
      }
      if (!playLocally && !broadcast) {
        return false;
      }

      setSoundEffectError("");
      const clientRequestId = createSoundEffectRequestId();
      let playedLocally = false;

      if (playLocally) {
        shouldResumeAfterSoundEffectRef.current = Boolean(resumeAnnouncements);
        playedLocally = await playLocalSoundEffect(file, { userGesture });
        if (!playedLocally) {
          resumeUmpireAnnouncementsAfterSoundEffect();
          return false;
        }

        localSoundEffectRequestIdRef.current = clientRequestId;
      } else {
        shouldResumeAfterSoundEffectRef.current = false;
      }

      if (broadcast) {
        try {
          await fetch(`/api/matches/${matchId}/sound-effects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              effectId: file.id,
              clientRequestId,
              resumeAnnouncements,
              trigger,
              preAnnouncementText,
              preAnnouncementDelayMs,
            }),
          });
        } catch {
          // Local playback already succeeded. Relay sync is best-effort.
        }
      }

      return playLocally ? playedLocally : true;
    },
    [
      isLiveMatch,
      match?._id,
      matchId,
      playLocalSoundEffect,
      resumeUmpireAnnouncementsAfterSoundEffect,
    ]
  );

  const handlePreviewCommentarySoundEffect = useCallback(
    async (file) => {
      if (!file?.src || !file?.id) {
        stopCommentaryPlayback();
        return false;
      }

      const isCurrentPreview =
        activeCommentaryAction === "event-preview" &&
        activeCommentaryPreviewId === file.id;

      if (isCurrentPreview || (activeSoundEffectId === file.id && isAnySoundEffectActive)) {
        stopCommentaryPlayback();
        return false;
      }

      cancelBoundarySequence({ stopEffect: true });
      setSoundEffectError("");
      shouldResumeAfterSoundEffectRef.current = false;
      setActiveCommentaryPreviewId(file.id);
      setActiveCommentaryAction("event-preview");
      const played = await playLocalSoundEffect(file, { userGesture: true });
      if (!played) {
        setActiveCommentaryPreviewId("");
        setActiveCommentaryAction((current) =>
          current === "event-preview" ? "" : current
        );
      }
      return played;
    },
    [
      activeCommentaryAction,
      activeCommentaryPreviewId,
      activeSoundEffectId,
      cancelBoundarySequence,
      isAnySoundEffectActive,
      playLocalSoundEffect,
      stopCommentaryPlayback,
    ]
  );

  const handleTestCommentarySequence = useCallback(
    async (eventKey = "out") => {
      const normalizedKey = SCORE_SOUND_EFFECT_KEYS.includes(eventKey)
        ? eventKey
        : "out";
      const previewInput =
        getScoreSoundEffectPreviewInput(normalizedKey) ||
        getScoreSoundEffectPreviewInput("out");
      const scorePreview = buildUmpireScorePreview(
        previewInput?.runs || 0,
        Boolean(previewInput?.isOut),
        previewInput?.extraType || null,
      );
      const leadText = String(scorePreview.leadItem?.text || "").trim();
      const previewEffect =
        umpireSettings.playScoreSoundEffects !== false
          ? await resolveConfiguredScoreSoundEffect(
              previewInput?.runs || 0,
              Boolean(previewInput?.isOut),
              previewInput?.extraType || null,
            )
          : null;

      cancelBoundarySequence({ stopEffect: true });
      setActiveCommentaryAction("test-sequence");

      if (umpireSettings.enabled && umpireSettings.mode !== "silent") {
        if (leadText) {
          speakWithAnnouncementDuck(leadText, {
            key: `umpire-sequence-test-${normalizedKey}`,
            rate: SCORE_PRE_EFFECT_RATE,
            interrupt: true,
            minGapMs: 0,
            userGesture: true,
            ignoreEnabled: true,
          });
          await new Promise((resolve) => {
            boundarySequenceTimerRef.current = window.setTimeout(() => {
              boundarySequenceTimerRef.current = null;
              resolve();
            }, estimateBoundaryLeadDelayMs(leadText, SCORE_PRE_EFFECT_RATE));
          });
        }
      }

      if (
        previewEffect &&
        umpireSettings.playScoreSoundEffects !== false
      ) {
        await handlePreviewCommentarySoundEffect(previewEffect);
        await new Promise((resolve) => {
          const durationSeconds = Number(soundEffectDurations?.[previewEffect.id] || 0);
          const waitMs = durationSeconds > 0 ? durationSeconds * 1000 + 180 : 1600;
          window.setTimeout(resolve, waitMs);
        });
      }

      if (umpireSettings.enabled && umpireSettings.mode !== "silent") {
        const followUpItems = scorePreview.followUpItems?.length
          ? scorePreview.followUpItems
          : [
              {
                text:
                  buildCurrentScoreAnnouncement(scorePreview.nextMatch) ||
                  "Score is 42 for 2.",
                pauseAfterMs: 0,
                rate: 0.8,
              },
            ];
        speakSequenceWithAnnouncementDuck(
          followUpItems,
          {
            key: `umpire-sequence-score-${normalizedKey}-${Date.now()}`,
            priority: 2,
            interrupt: true,
            minGapMs: 0,
            userGesture: true,
            ignoreEnabled: true,
          }
        );
      }
    },
    [
      buildUmpireScorePreview,
      cancelBoundarySequence,
      handlePreviewCommentarySoundEffect,
      resolveConfiguredScoreSoundEffect,
      soundEffectDurations,
      speakSequenceWithAnnouncementDuck,
      speakWithAnnouncementDuck,
      umpireSettings.enabled,
      umpireSettings.mode,
      umpireSettings.playScoreSoundEffects,
    ]
  );

  const handleCommentaryReadScoreAction = useCallback(() => {
    if (status === "speaking" || isAnySoundEffectActive) {
      stopCommentaryPlayback();
      return;
    }

    setActiveCommentaryAction("read-score");
    handleManualScoreAnnouncement();
  }, [
    handleManualScoreAnnouncement,
    isAnySoundEffectActive,
    status,
    stopCommentaryPlayback,
  ]);

  const handleCommentaryTestSequenceAction = useCallback((eventKey = "out") => {
    if (
      activeCommentaryAction === "test-sequence" &&
      (status === "speaking" || isAnySoundEffectActive)
    ) {
      stopCommentaryPlayback();
      return;
    }

    void handleTestCommentarySequence(eventKey);
  }, [
    activeCommentaryAction,
    handleTestCommentarySequence,
    isAnySoundEffectActive,
    status,
    stopCommentaryPlayback,
  ]);
  const handleHeroReadScoreAction = useCallback(() => {
    const isPlaybackActive = status === "speaking" || isAnySoundEffectActive;

    if (isPlaybackActive) {
      stopCommentaryPlayback();
      return;
    }

    ensureUmpireScoreFeedbackEnabled();
    void prime({ userGesture: true });
    handleCommentaryReadScoreAction();
    void broadcastManualScoreAnnouncement();
  }, [
    broadcastManualScoreAnnouncement,
    ensureUmpireScoreFeedbackEnabled,
    handleCommentaryReadScoreAction,
    isAnySoundEffectActive,
    prime,
    status,
    stopCommentaryPlayback,
  ]);
  const isReadScoreActionActive =
    status === "speaking" || isAnySoundEffectActive;
  const isTestSequenceActionActive =
    activeCommentaryAction === "test-sequence" &&
    (status === "speaking" || isAnySoundEffectActive);
  const previewingCommentarySoundEffectId =
    activeCommentaryAction === "event-preview" &&
    (activeSoundEffectStatus === "loading" ||
      activeSoundEffectStatus === "playing")
      ? activeCommentaryPreviewId
      : "";

  const commentarySoundEffectOptions = useMemo(() => {
    const availableEffects = soundEffectFiles.length
      ? soundEffectFiles
      : readCachedSoundEffectsLibrary();

    return availableEffects.map((effect) => ({
      ...effect,
      durationSeconds: Number(soundEffectDurations?.[effect.id] || 0),
    }));
  }, [soundEffectDurations, soundEffectFiles]);

  const handleReorderSoundEffects = useCallback((activeId, targetId) => {
    if (!activeId || !targetId || activeId === targetId) {
      return;
    }

    setSoundEffectFiles((currentFiles) => {
      const activeIndex = currentFiles.findIndex((file) => file.id === activeId);
      const targetIndex = currentFiles.findIndex((file) => file.id === targetId);

      if (activeIndex < 0 || targetIndex < 0) {
        return currentFiles;
      }

      const nextFiles = [...currentFiles];
      const [movedItem] = nextFiles.splice(activeIndex, 1);
      nextFiles.splice(targetIndex, 0, movedItem);

      writeCachedSoundEffectsLibrary(nextFiles);
      const nextOrder = nextFiles.map((file) => file.id);
      writeCachedSoundEffectsOrder(nextOrder);
      void persistSoundEffectsOrder(nextOrder);

      return nextFiles;
    });
  }, []);

  useEffect(() => {
    const liveEvent = match?.lastLiveEvent;
    if (!liveEvent?.id || liveEvent.type !== "sound_effect") {
      return;
    }

    if (lastHandledSoundEffectEventRef.current === liveEvent.id) {
      return;
    }

    lastHandledSoundEffectEventRef.current = liveEvent.id;
    const createdAtMs = Date.parse(String(liveEvent.createdAt || ""));
    if (
      Number.isFinite(createdAtMs) &&
      createdAtMs < soundEffectPlaybackCutoffRef.current
    ) {
      return;
    }
    if (
      liveEvent.clientRequestId &&
      liveEvent.clientRequestId === localSoundEffectRequestIdRef.current
    ) {
      if (liveEvent.action === "stop") {
        localSoundEffectRequestIdRef.current = "";
        return;
      }
      shouldResumeAfterSoundEffectRef.current = Boolean(
        liveEvent.resumeAnnouncements
      );
      localSoundEffectRequestIdRef.current = "";
      return;
    }

    if (liveEvent.action === "stop") {
      stopActiveSoundEffect();
      shouldResumeAfterSoundEffectRef.current = false;
      return;
    }

    shouldResumeAfterSoundEffectRef.current = Boolean(
      liveEvent.resumeAnnouncements
    );
    stop();
    void playLocalSoundEffect(
      {
        id: liveEvent.effectId || liveEvent.effectFileName || liveEvent.id,
        fileName: liveEvent.effectFileName || liveEvent.effectId || "",
        label: liveEvent.effectLabel || "Sound effect",
        src: liveEvent.effectSrc || "",
      },
      { userGesture: false },
    ).then((played) => {
      if (!played) {
        resumeUmpireAnnouncementsAfterSoundEffect();
      }
    });
  }, [
    match?.lastLiveEvent,
    playLocalSoundEffect,
    resumeUmpireAnnouncementsAfterSoundEffect,
    stopActiveSoundEffect,
    stop,
  ]);

  const handleAnnouncedUndo = async () => {
    if (!match?.undoCount || !currentInningsHasHistory) {
      return;
    }

    cancelBoundarySequence({ stopEffect: true });
    let previewMatch = match;
    try {
      previewMatch = applyMatchAction(match, {
        actionId: `umpire-preview:${Date.now()}`,
        type: "undo_last",
      });
    } catch {
      previewMatch = match;
    }

    const undoEvent = createUndoLiveEvent(previewMatch);
    const undoSequence = buildLiveScoreAnnouncementSequence(
      undoEvent,
      previewMatch,
      umpireSettings.mode
    );
    speakImmediateUmpireSequence(undoSequence, "umpire-undo");

    await handleUndo();
  };

  const handleAnnouncedPatchUpdate = async (payload) => {
    const nextMatch = await patchAndUpdate(payload);
    if (!nextMatch) {
      return null;
    }

    if (
      payload?.innings1Score === undefined &&
      payload?.overs === undefined
    ) {
      return nextMatch;
    }

    const correctionSequence = buildLiveScoreAnnouncementSequence(
      nextMatch.lastLiveEvent,
      nextMatch,
      umpireSettings.mode
    );
    speakImmediateUmpireSequence(correctionSequence, "umpire-correction");
    return nextMatch;
  };

  const handleUmpirePressFeedback = () => {
    triggerMatchHapticFeedback();
  };

  const openModalWithFeedback = (type) => {
    triggerMatchHapticFeedback();
    setModal({ type });
  };

  const handleCopyShareLink = async () => {
    if (!match) return;

    triggerMatchHapticFeedback();
    const link = buildShareUrl(
      `/session/${match.sessionId}/view`,
      window.location.origin
    );
    const shareTitle = `${match.innings1.team} vs ${match.innings2.team}`;
    const shareText = `Follow the live score for ${shareTitle}. Current score: ${match.score}/${match.outs}.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: link });
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(link);
        alert("Spectator link copied to clipboard.");
        return;
      } catch {
        // Fall through to the browser prompt if clipboard access is blocked.
      }
    }

    window.prompt("Copy spectator link", link);
  };

  const handleWalkieHoldStart = async () => {
    if (!isLiveMatch) {
      return;
    }

    if (!walkie.snapshot?.enabled) {
      return;
    }

    if (!hasWalkieAudience) {
      return;
    }

    if (walkie.canTalk) {
      await walkie.startTalking();
    }
  };

  const handleMicHoldStart = useCallback(async () => {
    if (!isLiveMatch) {
      return;
    }

    if (micMonitor.isPaused) {
      await micMonitor.resume({ pauseMedia: true });
    }
  }, [isLiveMatch, micMonitor]);

  const handleMicHoldEnd = useCallback(async () => {
    if (!micMonitor.isActive || micMonitor.isPaused) {
      return;
    }

    await micMonitor.pause({ resumeMedia: true });
  }, [micMonitor]);

  useEffect(() => {
    if (authStatus !== "granted" || !match?._id) {
      return;
    }

    const remoteSignature = [
      match.announcerEnabled ? "1" : "0",
      match.announcerMode || "",
      match.announcerScoreSoundEffectsEnabled !== false ? "1" : "0",
      match.announcerBroadcastScoreSoundEffectsEnabled !== false ? "1" : "0",
    ].join(":");

    if (remoteSignature === announcerSettingsSignature) {
      lastPersistedAnnouncerSettingsRef.current = announcerSettingsSignature;
      return;
    }

    if (lastPersistedAnnouncerSettingsRef.current === announcerSettingsSignature) {
      return;
    }

    let cancelled = false;
    lastPersistedAnnouncerSettingsRef.current = announcerSettingsSignature;

    void (async () => {
      const updatedMatch = await patchAndUpdate({
        announcerEnabled: umpireSettings.enabled,
        announcerMode:
          umpireSettings.enabled && umpireSettings.mode !== "silent"
            ? umpireSettings.mode || "simple"
            : "",
        announcerScoreSoundEffectsEnabled:
          umpireSettings.playScoreSoundEffects !== false,
        announcerBroadcastScoreSoundEffectsEnabled:
          umpireSettings.broadcastScoreSoundEffects !== false,
      });

      if (!updatedMatch && !cancelled) {
        lastPersistedAnnouncerSettingsRef.current = "";
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    announcerSettingsSignature,
    authStatus,
    match?._id,
    match?.announcerBroadcastScoreSoundEffectsEnabled,
    match?.announcerEnabled,
    match?.announcerMode,
    match?.announcerScoreSoundEffectsEnabled,
    patchAndUpdate,
    umpireSettings.broadcastScoreSoundEffects,
    umpireSettings.enabled,
    umpireSettings.mode,
    umpireSettings.playScoreSoundEffects,
  ]);

  if (authStatus !== "granted") {
    if (authStatus === "checking") return <Splash>Checking umpire access...</Splash>;
    return (
      <AccessGate
        onSubmit={submitPin}
        isSubmitting={authSubmitting}
        error={authError}
        rateLimitScope={matchId ? `match-auth:${matchId}` : "match-auth"}
      />
    );
  }

  if (isLoading) return <Splash>Loading match...</Splash>;
  if (error && !match) return <Splash>Error: Could not load the match data.</Splash>;
  if (!match) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
          <section className="w-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(8,8,12,0.98))] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
            <p className="text-2xl font-semibold tracking-tight text-white">
              Match not found
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              This match may have ended, moved, or never existed.
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => router.push("/session/new")}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Create New Session
              </button>
              <button
                type="button"
                onClick={() => router.push("/session")}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                All Sessions
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }
  if (tossPending) return <Splash>Opening toss...</Splash>;

  const activeInningsKey = match.innings === "first" ? "innings1" : "innings2";
  const oversHistory = match[activeInningsKey]?.history ?? [];
  const currentOverNumber = oversHistory.at(-1)?.overNumber ?? 1;
  const firstInningsOversPlayed = Math.max(
    1,
    Math.ceil(countLegalBalls(match.innings1.history) / 6)
  );
  const legalBalls = countLegalBalls(oversHistory);
  const oversDone = legalBalls >= match.overs * 6;
  const maxWickets = getTotalDismissalsAllowed(match);
  const isAllOut = maxWickets > 0 && match.outs >= maxWickets;
  const firstInningsComplete =
    match.innings === "first" && (oversDone || isAllOut);
  const matchFinished =
    Boolean(match.result) || (match.innings === "second" && !match.isOngoing);
  const showInningsEnd = firstInningsComplete || matchFinished;
  const controlsDisabled =
    isUpdating || showInningsEnd || Boolean(match.result) || tossPending;
  const showCompactUmpireWalkie = Boolean(
    !hasPendingWalkieRequests &&
      isLiveMatch &&
      (
        walkie.snapshot?.enabled ||
        isLocalWalkieInteractionActive ||
        umpireRemoteSpeakerState.isRemoteTalking ||
        walkie.recoveringAudio ||
        walkie.recoveringSignaling
      )
  );
  const canGridHoldWalkie = Boolean(
    isLiveMatch &&
      walkie.snapshot?.enabled &&
      hasWalkieAudience &&
      !umpireRemoteSpeakerState.isRemoteTalking
  );
  const canGridHoldMic = Boolean(
    isLiveMatch && (micMonitor.isActive || micMonitor.isPaused)
  );

  return (
    <>
      <main id="top" className="min-h-screen font-sans bg-zinc-950 text-white p-4">
        <div className="max-w-md mx-auto pt-8 pb-24">
          <MatchHeroBackdrop match={match} className="mb-5">
            <div className="relative px-5 pt-6 pb-5">
              <button
                type="button"
                onClick={handleHeroMenuScroll}
                aria-label="Scroll to match controls"
                className="absolute right-5 top-5 inline-flex h-12 w-12 items-center justify-center text-white transition hover:scale-105 hover:text-white/85"
              >
                <FaEllipsisV className="text-[1.45rem]" />
              </button>
              <div className="mb-3 flex items-center justify-center gap-3 text-[12px] font-semibold text-zinc-400">
                <span className="inline-flex items-center gap-2 uppercase tracking-[0.14em] text-zinc-300">
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-red-500/35 animate-ping"></span>
                    <span className="relative h-2.5 w-2.5 rounded-full bg-red-500"></span>
                  </span>
                  <span>Live</span>
                </span>
                <span className="h-3 w-px bg-white/12"></span>
                <span
                  suppressHydrationWarning
                  className="normal-case tracking-normal text-zinc-400"
                >
                  {liveUpdatedLabel}
                </span>
              </div>
              {match.result && (
                <div className="bg-green-900/50 text-green-300 p-4 rounded-xl text-center mb-4 ring-1 ring-green-500">
                  <h3 className="font-bold text-xl">Match Over</h3>
                  <p>{match.result}</p>
                </div>
              )}
              <MatchHeader
                match={match}
                onAnnounceScore={handleHeroReadScoreAction}
                announceIsActive={isReadScoreActionActive}
              />
              <Scoreboard match={match} history={oversHistory} />
            </div>
          </MatchHeroBackdrop>
          <div ref={contentStartRef} />
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {error.message || "Match update failed."}
            </div>
          ) : null}
          <OptionalFeatureBoundary label="Walkie unavailable right now.">
            {showCompactUmpireWalkie ? (
              <div className="mb-4">
                <WalkieNotice
                  notice={
                    umpireRemoteSpeakerState.isRemoteTalking
                      ? umpireRemoteSpeakerState.title
                      : walkie.notice
                  }
                  onDismiss={walkie.dismissNotice}
                  quickTalkEnabled={Boolean(
                    !umpireRemoteSpeakerState.isRemoteTalking &&
                      (
                        hasWalkieAudience ||
                        walkie.claiming ||
                        walkie.preparingToTalk ||
                        walkie.isSelfTalking ||
                        walkie.isFinishing
                      )
                  )}
                  quickTalkActive={walkie.isSelfTalking}
                  quickTalkPending={Boolean(
                    walkie.claiming ||
                      walkie.preparingToTalk ||
                      walkie.updatingEnabled ||
                      walkie.recoveringAudio ||
                      walkie.recoveringSignaling
                  )}
                  quickTalkFinishing={walkie.isFinishing}
                  quickTalkCountdown={walkie.countdown}
                  quickTalkFinishDelayLeft={walkie.finishDelayLeft}
                  onQuickTalkPrepare={walkie.prepareToTalk}
                  onQuickTalkStart={walkie.startTalking}
                  onQuickTalkStop={walkie.stopTalking}
                />
              </div>
            ) : !hasPendingWalkieRequests &&
              walkie.notice &&
              walkie.snapshot?.enabled ? (
              <section className="mb-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(10,10,14,0.98))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/14 text-emerald-300">
                      <FaBroadcastTower />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">Walkie-Talkie</h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        {walkie.isSelfTalking
                          ? "You are live"
                          : walkie.isFinishing
                          ? "Finishing"
                          : umpireRemoteSpeakerState.isRemoteTalking
                          ? umpireRemoteSpeakerState.shortStatus
                          : walkie.snapshot?.enabled
                          ? "Channel is live"
                          : "Channel update"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="min-h-[84px]">
                  <WalkieNotice
                    embedded
                    notice={
                      umpireRemoteSpeakerState.isRemoteTalking
                        ? umpireRemoteSpeakerState.title
                        : walkie.notice
                    }
                    onDismiss={walkie.dismissNotice}
                  />
                </div>
              </section>
            ) : null}
            {hasPendingWalkieRequests ? (
              <WalkieRequestQueue
                requests={walkie.pendingRequests}
                onAccept={walkie.acceptRequest}
                onDismiss={walkie.dismissRequest}
              />
            ) : null}
          </OptionalFeatureBoundary>
          <BallTracker history={oversHistory} />
          <Controls
            onScore={handleAnnouncedScoreEvent}
            onOut={() => openModalWithFeedback("out")}
            onNoBall={() => openModalWithFeedback("noball")}
            onWide={() => openModalWithFeedback("wide")}
            setInfoText={setInfoText}
            disabled={controlsDisabled}
          />
          {isLiveMatch ? (
            <MatchSoundEffectsPanel
              files={soundEffectFiles}
              isDisabled={controlsDisabled}
              isLoading={soundEffectLibraryStatus === "loading"}
              isOpen={soundEffectsOpen}
              error={soundEffectError}
              activeEffectId={activeSoundEffectId}
              activeEffectStatus={activeSoundEffectStatus}
              activeEffectCurrentTime={activeSoundEffectCurrentTime}
              effectDurations={soundEffectDurations}
              needsUnlock={soundEffectsNeedsUnlock}
              onToggle={toggleSoundEffectsPanel}
              onMinimize={() => setSoundEffectsOpen(false)}
              onPlayEffect={handlePlaySoundEffect}
              onStopEffect={handleStopLiveSoundEffect}
              onReorder={handleReorderSoundEffects}
              scoreSoundSettings={{
                settings: umpireSettings,
                updateSetting: updateUmpireSetting,
                showScoreSoundEffectsToggle: true,
                showSpectatorBroadcastToggle: true,
                showScoreEffectAssignments: true,
                soundEffectOptions: commentarySoundEffectOptions,
                previewingSoundEffectId: previewingCommentarySoundEffectId,
                previewingSoundEffectStatus: activeSoundEffectStatus,
                onPreviewSoundEffect: handlePreviewCommentarySoundEffect,
              }}
              onOpenScoreSoundSettings={() => {
                if (!soundEffectFiles.length) {
                  void loadSoundEffectsLibrary();
                }
              }}
            />
          ) : null}
          <MatchActionGrid
            isUpdating={isUpdating}
            historyStackLength={currentInningsHasHistory ? historyStack.length : 0}
            onEditTeams={() => setModal({ type: "editTeams" })}
            onEditOvers={() => setModal({ type: "editOvers" })}
            editOversLabel={
              match?.innings === "second" ? (
                <>
                  Edit overs
                  <br />
                  / innings
                </>
              ) : (
                "Edit overs"
              )
            }
            onUndo={handleAnnouncedUndo}
            onHistory={() => setModal({ type: "history" })}
            onImage={() => setModal({ type: "image" })}
            onCommentary={() => {
              void prime({ userGesture: true });
              void loadSoundEffectsLibrary();
              setModal({ type: "commentary" });
            }}
            onCommentaryHoldStart={handleScoreFeedbackHoldStart}
            onWalkie={() => setModal({ type: "walkie" })}
            onMic={() => setModal({ type: "mic" })}
            onShare={handleCopyShareLink}
            onWalkiePressStart={canGridHoldWalkie ? walkie.prepareToTalk : undefined}
            onWalkieHoldStart={canGridHoldWalkie ? handleWalkieHoldStart : undefined}
            onWalkieHoldEnd={canGridHoldWalkie ? () => walkie.stopTalking() : undefined}
            onMicHoldStart={canGridHoldMic ? handleMicHoldStart : undefined}
            onMicHoldEnd={canGridHoldMic ? handleMicHoldEnd : undefined}
            onPressFeedback={handleUmpirePressFeedback}
            showLiveControls={Boolean(isLiveMatch)}
            canHoldWalkie={canGridHoldWalkie}
            canHoldMic={canGridHoldMic}
            isWalkieActive={Boolean(walkie.snapshot?.enabled)}
            isWalkieTalking={Boolean(walkie.isSelfTalking)}
            isWalkieFinishing={Boolean(walkie.isFinishing)}
            isWalkieLoading={Boolean(
              walkie.claiming ||
                walkie.preparingToTalk ||
                walkie.recoveringAudio ||
                walkie.recoveringSignaling ||
                walkie.updatingEnabled
            )}
            isWalkieBusyByOther={Boolean(umpireRemoteSpeakerState.isRemoteTalking)}
            walkieBusyLabel={umpireRemoteSpeakerState.roleLabel}
            isCommentaryActive={micMonitor.isActive || micMonitor.isPaused}
            isCommentaryTalking={Boolean(micMonitor.isActive && !micMonitor.isPaused)}
            isAnnounceActive={Boolean(umpireSettings.enabled)}
          />
          <audio
            ref={soundEffectsAudioRef}
            hidden
            data-gv-umpire-effects-player="true"
          />
        </div>
        <SiteFooter />
      </main>
      <OptionalFeatureBoundary label="Optional match tools unavailable right now.">
        <MatchModalLayer
          showInningsEnd={showInningsEnd}
          match={match}
          modalType={modal.type}
          isUpdating={isUpdating}
          micMonitor={micMonitor}
          commentaryProps={
            isLiveMatch
              ? {
                  title: "Umpire Commentary",
                  variant: "modal",
                  simpleMode: true,
                  onClose: () => setModal({ type: null }),
                  settings: umpireSettings,
                  updateSetting: updateUmpireSetting,
                  onToggleEnabled: (nextEnabled) => {
                    if (!nextEnabled) {
                      if (umpireAnnouncementTimerRef.current) {
                        window.clearTimeout(umpireAnnouncementTimerRef.current);
                        umpireAnnouncementTimerRef.current = null;
                      }
                      pendingUmpireAnnouncementRef.current = null;
                    }

                    if (nextEnabled) {
                      if (umpireSettings.mode === "silent") {
                        updateUmpireSetting("mode", "simple");
                      }
                      try {
                        prime({ userGesture: true });
                        speakWithAnnouncementDuck("Umpire voice on.", {
                          key: "umpire-voice-enabled",
                          rate: 0.9,
                          interrupt: false,
                          userGesture: true,
                          ignoreEnabled: true,
                        });
                      } catch (error) {
                        console.error("Umpire announcer enable failed:", error);
                      }
                    } else {
                      stop();
                    }
                  },
                  statusText: umpireSettings.enabled
                    ? status === "waiting_for_gesture"
                      ? voiceName
                        ? voiceName
                        : "Tap Read Score once."
                      : voiceName
                      ? voiceName
                      : ""
                    : "",
                  onAnnounceNow: handleCommentaryReadScoreAction,
                  announceLabel: "Read Score",
                  announceDisabled: false,
                  showScoreSoundEffectsToggle: true,
                  showSpectatorBroadcastToggle: true,
                  showScoreEffectAssignments: true,
                  soundEffectOptions: commentarySoundEffectOptions,
                  previewingSoundEffectId: previewingCommentarySoundEffectId,
                  previewingSoundEffectStatus: activeSoundEffectStatus,
                  onPreviewSoundEffect: handlePreviewCommentarySoundEffect,
                  onTestSequence: handleCommentaryTestSequenceAction,
                  announceIsActive: isReadScoreActionActive,
                  testSequenceIsActive: isTestSequenceActionActive,
                }
              : null
          }
          walkieProps={
            isLiveMatch
              ? {
                  role: "umpire",
                  snapshot: walkie.snapshot,
                  notice: walkie.notice,
                  error: walkie.error,
                  canEnable: walkie.canEnable,
                  canRequestEnable: false,
                  canTalk: walkie.canTalk,
                  claiming: walkie.claiming,
                  preparingToTalk: walkie.preparingToTalk,
                  updatingEnabled: walkie.updatingEnabled,
                  recoveringAudio: walkie.recoveringAudio,
                  recoveringSignaling: walkie.recoveringSignaling,
                  isSelfTalking: walkie.isSelfTalking,
                  isFinishing: walkie.isFinishing,
                  countdown: walkie.countdown,
                  finishDelayLeft: walkie.finishDelayLeft,
                  needsAudioUnlock: walkie.needsAudioUnlock,
                  requestCooldownLeft: 0,
                  requestState: "idle",
                  pendingRequests: walkie.pendingRequests,
                  onRequestEnable: () => {},
                  onToggleEnabled: walkie.toggleEnabled,
                  onStartTalking: walkie.startTalking,
                  onStopTalking: walkie.stopTalking,
                  onUnlockAudio: walkie.unlockAudio,
                  onPrepareTalking: walkie.prepareToTalk,
                  onDismissNotice: walkie.dismissNotice,
                  onAcceptRequest: walkie.acceptRequest,
                  onDismissRequest: walkie.dismissRequest,
                }
              : null
          }
          currentOverNumber={currentOverNumber}
          firstInningsOversPlayed={firstInningsOversPlayed}
          infoText={infoText}
          onNext={handleNextInningsOrEnd}
          onUpdate={handleAnnouncedPatchUpdate}
          onImageUploaded={replaceMatch}
          onScoreEvent={handleAnnouncedScoreEvent}
          onClose={() => setModal({ type: null })}
          onInfoClose={() => setInfoText(null)}
        />
      </OptionalFeatureBoundary>
    </>
  );
}
