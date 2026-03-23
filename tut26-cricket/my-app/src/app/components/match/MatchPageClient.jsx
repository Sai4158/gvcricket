"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaBroadcastTower } from "react-icons/fa";
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
  createScoreLiveEvent,
  createUndoLiveEvent,
} from "../../lib/live-announcements";
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
const SIX_PRE_EFFECT_TEXT = "Umpire has given 6 runs.";
const SIX_PRE_EFFECT_DELAY_MS = 1000;

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
  const [modal, setModal] = useState({ type: null });
  const [infoText, setInfoText] = useState(null);
  const [soundEffectsOpen, setSoundEffectsOpen] = useState(false);
  const [soundEffectFiles, setSoundEffectFiles] = useState([]);
  const [soundEffectLibraryStatus, setSoundEffectLibraryStatus] = useState("idle");
  const [soundEffectError, setSoundEffectError] = useState("");
  const [soundEffectDurations, setSoundEffectDurations] = useState({});
  const localAnnouncementIdRef = useRef(0);
  const lastWalkieRequestSignatureRef = useRef("");
  const umpireAnnouncementTimerRef = useRef(null);
  const pendingUmpireAnnouncementRef = useRef(null);
  const deferredUmpireAnnouncementRef = useRef(null);
  const interruptedUmpireAnnouncementQueueRef = useRef([]);
  const soundEffectPlayingRef = useRef(false);
  const shouldResumeAfterSoundEffectRef = useRef(false);
  const pendingManualScoreAnnouncementRef = useRef(null);
  const previousSoundEffectMatchIdRef = useRef(initialMatch?._id || "");
  const lastSoundEffectTriggerRef = useRef({ effectId: "", at: 0 });
  const lastHandledSoundEffectEventRef = useRef(
    initialMatch?.lastLiveEvent?.type === "sound_effect"
      ? initialMatch.lastLiveEvent.id || ""
      : "",
  );
  const localSoundEffectRequestIdRef = useRef("");
  const skipNextBoundaryLeadRef = useRef(false);
  const activeBoundarySequenceRef = useRef(false);
  const boundarySequenceVersionRef = useRef(0);
  const boundarySequenceTimerRef = useRef(null);
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
  const resumeUmpireAnnouncementsAfterSoundEffect = useCallback(() => {
    soundEffectPlayingRef.current = false;
    activeBoundarySequenceRef.current = false;
    const pendingManualScore = pendingManualScoreAnnouncementRef.current;
    pendingManualScoreAnnouncementRef.current = null;

    if (!shouldResumeAfterSoundEffectRef.current) {
      shouldResumeAfterSoundEffectRef.current = false;
      interruptedUmpireAnnouncementQueueRef.current = [];
      deferredUmpireAnnouncementRef.current = null;
      if (
        pendingManualScore &&
        umpireSettings.enabled &&
        umpireSettings.mode !== "silent"
      ) {
        localAnnouncementIdRef.current += 1;
        speakSequence(pendingManualScore.items, {
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
        speakSequence(pendingManualScore.items, {
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
    speakSequence(
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
  }, [speakSequence, umpireSettings.enabled, umpireSettings.mode]);
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
      soundEffectPlayingRef.current = true;
      if (umpireAnnouncementTimerRef.current) {
        window.clearTimeout(umpireAnnouncementTimerRef.current);
        umpireAnnouncementTimerRef.current = null;
      }
      if (pendingUmpireAnnouncementRef.current) {
        deferredUmpireAnnouncementRef.current = pendingUmpireAnnouncementRef.current;
        pendingUmpireAnnouncementRef.current = null;
      }
      const interruptedQueue = interruptAndCapture();
      if (interruptedQueue?.length) {
        interruptedUmpireAnnouncementQueueRef.current = interruptedQueue;
      }
      stop();
    },
    onAfterEnd: resumeUmpireAnnouncementsAfterSoundEffect,
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
  });
  const hasPendingWalkieRequests = Boolean(isLiveMatch && walkie.pendingRequests?.length);
  const umpireRemoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot: walkie.snapshot,
    participantId: walkie.participantId,
    isSelfTalking: walkie.isSelfTalking,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cachedFiles = readCachedSoundEffectsLibrary();
      if (cachedFiles.length) {
        setSoundEffectFiles(
          sortSoundEffectsByOrder(cachedFiles, readCachedSoundEffectsOrder())
        );
        setSoundEffectLibraryStatus("ready");
      }

      setSoundEffectDurations(readCachedSoundEffectDurations());
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

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
    };
  }, []);

  const cancelBoundarySequence = useCallback(
    ({ stopEffect = false } = {}) => {
      boundarySequenceVersionRef.current += 1;
      activeBoundarySequenceRef.current = false;
      skipNextBoundaryLeadRef.current = false;
      shouldResumeAfterSoundEffectRef.current = false;

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
      interruptedUmpireAnnouncementQueueRef.current = [];
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
      speak(`${requestRole} requested walkie-talkie.`, {
        key: `umpire-walkie-request-${latestRequest?.requestId || nextSignature}`,
        rate: 0.9,
        interrupt: true,
        ignoreEnabled: true,
      });
    } catch (error) {
      console.error("Walkie request speech failed:", error);
    }
  }, [isLiveMatch, speak, walkie.pendingRequests]);

  const flushPendingUmpireAnnouncement = () => {
    const next = pendingUmpireAnnouncementRef.current;
    if (!next) return;

    pendingUmpireAnnouncementRef.current = null;
    if (soundEffectPlayingRef.current) {
      deferredUmpireAnnouncementRef.current = next;
      return;
    }
    if (!umpireSettings.enabled || umpireSettings.mode === "silent") {
      return;
    }
    localAnnouncementIdRef.current += 1;
    speakSequence(next.items, {
      key: `umpire-${localAnnouncementIdRef.current}`,
      priority: next.priority || 2,
      minGapMs: 0,
      userGesture: true,
      interrupt: true,
    });
  };

  const speakImmediateUmpireSequence = (sequence, keyPrefix) => {
    if (!sequence?.items?.length || !umpireSettings.enabled || umpireSettings.mode === "silent") {
      return;
    }

    if (soundEffectPlayingRef.current) {
      deferredUmpireAnnouncementRef.current = {
        items: sequence.items,
        options: {
          key: keyPrefix,
          priority: sequence.priority || 2,
        },
      };
      return;
    }

    localAnnouncementIdRef.current += 1;
    speakSequence(sequence.items, {
      key: `${keyPrefix}-${localAnnouncementIdRef.current}`,
      priority: sequence.priority || 2,
      minGapMs: 0,
      userGesture: true,
      interrupt: true,
    });
  };

  const announceUmpireAction = (runs, isOut = false, extraType = null) => {
    if (!umpireSettings.enabled || umpireSettings.mode === "silent" || !isLiveMatch) {
      return;
    }

    let nextMatch = match;
    if (match) {
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
    }
    const event = createScoreLiveEvent(match, nextMatch || match, {
      runs,
      isOut,
      extraType,
    });
    const sequence = buildLiveScoreAnnouncementSequence(
      event,
      nextMatch || match,
      umpireSettings.mode
    );
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

    const shouldPlayBoundaryHorn =
      !isOut && !extraType && Number(runs) === 6;

    if (shouldPlayBoundaryHorn && umpireSettings.playScoreSoundEffects !== false) {
      const boundarySequenceVersion = boundarySequenceVersionRef.current + 1;
      boundarySequenceVersionRef.current = boundarySequenceVersion;
      activeBoundarySequenceRef.current = true;
      handleScoreEvent(runs, isOut, extraType);

      if (umpireSettings.enabled && umpireSettings.mode !== "silent") {
        speak(SIX_PRE_EFFECT_TEXT, {
          key: "umpire-six-pre",
          rate: 0.8,
          interrupt: true,
          minGapMs: 0,
          userGesture: true,
        });
        await new Promise((resolve) => {
          boundarySequenceTimerRef.current = window.setTimeout(() => {
            boundarySequenceTimerRef.current = null;
            resolve();
          }, SIX_PRE_EFFECT_DELAY_MS);
        });

        if (boundarySequenceVersion !== boundarySequenceVersionRef.current) {
          return;
        }
      }

      skipNextBoundaryLeadRef.current = true;
      await triggerSharedSoundEffect(IPL_HORN_EFFECT, {
        userGesture: true,
        resumeAnnouncements: true,
        trigger: "score_boundary",
        preAnnouncementText: SIX_PRE_EFFECT_TEXT,
        preAnnouncementDelayMs: SIX_PRE_EFFECT_DELAY_MS,
      });

      if (boundarySequenceVersion !== boundarySequenceVersionRef.current) {
        return;
      }

      activeBoundarySequenceRef.current = false;
      announceUmpireAction(runs, isOut, extraType);
      return;
    }

    announceUmpireAction(runs, isOut, extraType);
    handleScoreEvent(runs, isOut, extraType);
  };

  const handleManualScoreAnnouncement = () => {
    if (!match) {
      return;
    }

    const text = buildCurrentScoreAnnouncement(match);
    if (!text) {
      return;
    }

    if (soundEffectPlayingRef.current) {
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
    speak(text, {
      key: `umpire-current-score-${localAnnouncementIdRef.current}`,
      rate: 0.9,
      minGapMs: 0,
      userGesture: true,
      ignoreEnabled: true,
      interrupt: true,
    });
  };

  const ensureUmpireScoreFeedbackEnabled = () => {
    if (!umpireSettings.enabled) {
      updateUmpireSetting("enabled", true);
    }

    if (umpireSettings.mode === "silent") {
      updateUmpireSetting("mode", "simple");
    }
  };

  const handleScoreFeedbackHoldStart = () => {
    if (!match) {
      return;
    }

    ensureUmpireScoreFeedbackEnabled();
    prime({ userGesture: true });
    handleManualScoreAnnouncement();
  };

  const loadSoundEffectsLibrary = useCallback(async () => {
    if (soundEffectLibraryStatus === "loading") {
      return;
    }

    if (soundEffectFiles.length) {
      setSoundEffectLibraryStatus("ready");
      return;
    }

    setSoundEffectLibraryStatus("loading");
    setSoundEffectError("");

    try {
      const nextFiles = await fetchCachedSoundEffectsLibrary();
      setSoundEffectFiles(nextFiles);
      setSoundEffectLibraryStatus("ready");
    } catch (caughtError) {
      setSoundEffectLibraryStatus("idle");
      setSoundEffectError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load sound effects.",
      );
    }
  }, [soundEffectFiles.length, soundEffectLibraryStatus]);

  const toggleSoundEffectsPanel = useCallback(() => {
    setSoundEffectsOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        void loadSoundEffectsLibrary();
      }
      return nextOpen;
    });
  }, [loadSoundEffectsLibrary]);

  const handlePlaySoundEffect = useCallback(
    async (file) => {
      if (!match?._id || !isLiveMatch || !file?.src) {
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
      isLiveMatch,
      match?._id,
      matchId,
      playLocalSoundEffect,
      resumeUmpireAnnouncementsAfterSoundEffect,
    ],
  );

  const triggerSharedSoundEffect = useCallback(
    async (
      file,
      {
        userGesture = true,
        resumeAnnouncements = false,
        trigger = "manual",
        preAnnouncementText = "",
        preAnnouncementDelayMs = 0,
      } = {}
    ) => {
      if (!match?._id || !isLiveMatch || !file?.src || !file?.id) {
        return false;
      }

      setSoundEffectError("");
      shouldResumeAfterSoundEffectRef.current = Boolean(resumeAnnouncements);
      const clientRequestId = createSoundEffectRequestId();
      const playedLocally = await playLocalSoundEffect(file, { userGesture });
      if (!playedLocally) {
        resumeUmpireAnnouncementsAfterSoundEffect();
        return false;
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
            resumeAnnouncements,
            trigger,
            preAnnouncementText,
            preAnnouncementDelayMs,
          }),
        });
        if (!response.ok) {
          return true;
        }
      } catch {
        // Local playback already succeeded. Relay sync is best-effort.
      }

      return true;
    },
    [
      isLiveMatch,
      match?._id,
      matchId,
      playLocalSoundEffect,
      resumeUmpireAnnouncementsAfterSoundEffect,
    ]
  );

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
    if (
      liveEvent.clientRequestId &&
      liveEvent.clientRequestId === localSoundEffectRequestIdRef.current
    ) {
      shouldResumeAfterSoundEffectRef.current = Boolean(
        liveEvent.resumeAnnouncements
      );
      localSoundEffectRequestIdRef.current = "";
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
    stop,
  ]);

  const handleAnnouncedUndo = async () => {
    cancelBoundarySequence({ stopEffect: true });
    const undoEvent = createUndoLiveEvent(match);
    const undoSequence = buildLiveScoreAnnouncementSequence(
      undoEvent,
      match,
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
      if (!walkie.canEnable) {
        return;
      }

      await walkie.toggleEnabled(true);
    }

    if (walkie.canTalk || walkie.snapshot?.enabled) {
      const prepared = await walkie.prepareToTalk?.();
      if (prepared === false) {
        return;
      }
      await walkie.startTalking();
    }
  };

  if (authStatus !== "granted") {
    if (authStatus === "checking") return <Splash>Checking umpire access...</Splash>;
    return (
      <AccessGate
        onSubmit={submitPin}
        isSubmitting={authSubmitting}
        error={authError}
      />
    );
  }

  if (isLoading) return <Splash>Loading match...</Splash>;
  if (error && !match) return <Splash>Error: Could not load the match data.</Splash>;
  if (!match) return <Splash>Match not found.</Splash>;
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
    !hasPendingWalkieRequests && isLiveMatch && walkie.snapshot?.enabled
  );

  return (
    <>
      <main className="min-h-screen font-sans bg-zinc-950 text-white p-4">
        <div className="max-w-md mx-auto pt-8 pb-24">
          <MatchHeroBackdrop match={match} className="mb-5">
            <div className="px-5 pt-6 pb-5">
              <div className="flex items-center justify-center gap-3 mb-4 text-sm text-zinc-200">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  Live
                </span>
                <span suppressHydrationWarning>{liveUpdatedLabel}</span>
              </div>
              {match.result && (
                <div className="bg-green-900/50 text-green-300 p-4 rounded-xl text-center mb-4 ring-1 ring-green-500">
                  <h3 className="font-bold text-xl">Match Over</h3>
                  <p>{match.result}</p>
                </div>
              )}
              <MatchHeader match={match} />
              <Scoreboard match={match} history={oversHistory} />
            </div>
          </MatchHeroBackdrop>
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
                  quickTalkEnabled={!umpireRemoteSpeakerState.isRemoteTalking}
                  quickTalkActive={walkie.isSelfTalking}
                  quickTalkPending={Boolean(
                    walkie.claiming ||
                      walkie.preparingToTalk ||
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
            ) : !hasPendingWalkieRequests && walkie.notice && walkie.snapshot?.enabled ? (
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
              onStopEffect={() => stopActiveSoundEffect()}
              onReorder={handleReorderSoundEffects}
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
            onCommentary={() => setModal({ type: "commentary" })}
            onCommentaryHoldStart={handleScoreFeedbackHoldStart}
            onWalkie={() => setModal({ type: "walkie" })}
            onMic={() => setModal({ type: "mic" })}
            onShare={handleCopyShareLink}
            onWalkiePressStart={
              umpireRemoteSpeakerState.isRemoteTalking ? undefined : walkie.prepareToTalk
            }
            onWalkieHoldStart={
              umpireRemoteSpeakerState.isRemoteTalking ? undefined : handleWalkieHoldStart
            }
            onWalkieHoldEnd={() => walkie.stopTalking()}
            onMicHoldStart={
              isLiveMatch ? () => micMonitor.start({ pauseMedia: true }) : undefined
            }
            onMicHoldEnd={() => micMonitor.stop({ resumeMedia: true })}
            onPressFeedback={handleUmpirePressFeedback}
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
            isCommentaryTalking={Boolean(micMonitor.isActive)}
            isAnnounceActive={Boolean(umpireSettings.enabled)}
          />
          <audio ref={soundEffectsAudioRef} hidden />
        </div>
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
                        speak("Umpire voice on.", {
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
                  onAnnounceNow: handleManualScoreAnnouncement,
                  announceLabel: "Read Score",
                  announceDisabled: false,
                  showScoreSoundEffectsToggle: true,
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
