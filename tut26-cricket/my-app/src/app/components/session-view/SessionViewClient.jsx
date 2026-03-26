"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaBluetoothB,
  FaBullhorn,
  FaCheck,
  FaMicrophoneAlt,
  FaMicrophone,
  FaMicrophoneSlash,
  FaShareAlt,
  FaVolumeUp,
} from "react-icons/fa";
import AnnouncementControls from "../live/AnnouncementControls";
import LiveMicModal from "../live/LiveMicModal";
import WalkiePanel, { WalkieNotice } from "../live/WalkiePanel";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useAnnouncementSettings from "../live/useAnnouncementSettings";
import useWalkieTalkie from "../live/useWalkieTalkie";
import MatchHeroBackdrop from "../match/MatchHeroBackdrop";
import { BallTracker } from "../match/MatchBallHistory";
import useEventSource from "../live/useEventSource";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import useLiveSoundEffectsPlayer from "../live/useLiveSoundEffectsPlayer";
import LiveScoreCard from "./LiveScoreCard";
import SplashMsg from "./SplashMsg";
import TeamInningsDetail from "./TeamInningsDetail";
import LiquidSportText from "../home/LiquidSportText";
import {
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
} from "../../lib/live-announcements";
import { addBallToHistory } from "../../lib/match-scoring";
import {
  didSharedWalkieDisable,
  didSharedWalkieEnable,
  getNonUmpireWalkieUiState,
  getNonUmpireWalkieToggleAction,
  NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT,
  NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
} from "../../lib/walkie-device-state";
import { getWalkieRemoteSpeakerState } from "../../lib/walkie-ui";
import { getTeamBundle } from "../../lib/team-utils";
import { duckPageMedia, restorePageMedia } from "../../lib/page-audio";
import { buildShareUrl } from "../../lib/site-metadata";
import { ModalBase } from "../match/MatchBaseModals";
import LoadingButton from "../shared/LoadingButton";
import OptionalFeatureBoundary from "../shared/OptionalFeatureBoundary";
import { useRouteFeedback } from "../shared/RouteFeedbackProvider";

function DualWalkieIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.5h4a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7V5.75L9 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="14" r="0.9" fill="currentColor" />
      <path
        d="M14.5 9h4a1 1 0 0 1 1 1v5.5a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V10a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 8.5V7.25L18 6.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="14" r="0.9" fill="currentColor" />
    </svg>
  );
}

function LoudspeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M4.5 14H7l4.75 3.5V6.5L7 10H4.5A1.5 1.5 0 0 0 3 11.5v1A1.5 1.5 0 0 0 4.5 14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 9.5a4 4 0 0 1 0 5m2.5-7.5a7 7 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PaMicSpeakerIcon() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center text-[1.05rem]"
      aria-hidden="true"
    >
      <FaBullhorn />
    </span>
  );
}

function IosGlassSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-8 w-14.5 items-center rounded-full border p-1 transition ${
        disabled
          ? "cursor-not-allowed border-white/8 bg-white/4 opacity-55"
          : checked
            ? "border-emerald-300/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.92),rgba(6,95,70,0.92))] shadow-[0_12px_28px_rgba(16,185,129,0.24)]"
            : "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
      }`}
    >
      <span
        className={`absolute inset-px rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] ${
          checked ? "opacity-30" : "opacity-100"
        }`}
        aria-hidden="true"
      />
      <span
        className={`relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(229,231,235,0.92))] shadow-[0_6px_16px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-6.5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function countLegalBallsLocal(history = []) {
  return (history || []).reduce((total, over) => {
    const balls = Array.isArray(over?.balls) ? over.balls : [];
    return (
      total +
      balls.filter(
        (ball) => ball?.extraType !== "wide" && ball?.extraType !== "noball",
      ).length
    );
  }, 0);
}

function formatOversLeftLocal(match) {
  const totalBalls = Math.max(Number(match?.overs || 0), 0) * 6;
  const legalBalls = countLegalBallsLocal(match?.innings2?.history || []);
  const ballsLeft = Math.max(totalBalls - legalBalls, 0);
  const overs = Math.floor(ballsLeft / 6);
  const balls = ballsLeft % 6;
  return balls > 0 ? `${overs}.${balls} overs` : `${overs} overs`;
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

const ANNOUNCER_AUTO_RESET_DELAY_MS = 1500;
const ANNOUNCER_GESTURE_READ_DELAY_MS = 2000;
const SIX_PRE_EFFECT_DELAY_MS = 1000;

function isSixBoundaryScoreEvent(event) {
  return Boolean(
    event?.type === "score_update" &&
    !event?.ball?.isOut &&
    !event?.ball?.extraType &&
    Number(event?.ball?.runs) === 6,
  );
}

export default function SessionViewClient({ sessionId, initialData }) {
  const [copied, setCopied] = useState(false);
  const [isLeavingToSessions, setIsLeavingToSessions] = useState(false);
  const [data, setData] = useState(initialData || null);
  const [activePanel, setActivePanel] = useState(null);
  const [localWalkieNotice, setLocalWalkieNotice] = useState("");
  const [streamError, setStreamError] = useState("");
  const [spectatorWalkieEnabled, setSpectatorWalkieEnabled] = useState(false);
  const [quickWalkieTalking, setQuickWalkieTalking] = useState(false);
  const [quickSpeakerTalking, setQuickSpeakerTalking] = useState(false);
  const lastAnnouncedEventRef = useRef("");
  const announcementDuckRef = useRef([]);
  const announcementRestoreTimerRef = useRef(null);
  const announcerResetTimerRef = useRef(null);
  const walkieNoticeTimerRef = useRef(null);
  const walkieHoldTimerRef = useRef(null);
  const walkieHeldRef = useRef(false);
  const announcerHoldTimerRef = useRef(null);
  const announcerHoldStartedRef = useRef(false);
  const suppressAnnouncerCardClickRef = useRef(false);
  const speakerHoldTimerRef = useRef(null);
  const speakerHeldRef = useRef(false);
  const previousEnabledRef = useRef(false);
  const previousWalkieEnabledRef = useRef(false);
  const previousWalkieRequestStateRef = useRef("idle");
  const initialWalkieStateResolvedRef = useRef(false);
  const micPrepareRequestedRef = useRef(false);
  const lastStreamUpdateRef = useRef(initialData?.updatedAt || "");
  const announcerAutoEnabledMatchRef = useRef("");
  const announcerInitialSummaryRef = useRef("");
  const announcerGestureReplayRef = useRef("");
  const announcerAutoReadTimerRef = useRef(null);
  const interruptedAnnouncementQueueRef = useRef([]);
  const deferredAnnouncementRef = useRef(null);
  const soundEffectPlayingRef = useRef(false);
  const shouldResumeAfterSoundEffectRef = useRef(false);
  const skipNextBoundaryLeadRef = useRef(false);
  const pendingSoundEffectTimerRef = useRef(null);
  const pendingManualScoreAnnouncementRef = useRef(null);
  const activeBoundarySoundEffectRef = useRef(false);
  const previousSoundEffectMatchIdRef = useRef(initialData?.match?._id || "");
  const lastHandledSoundEffectEventRef = useRef(
    initialData?.match?.lastLiveEvent?.type === "sound_effect"
      ? initialData.match.lastLiveEvent.id || ""
      : "",
  );
  const soundEffectPlaybackCutoffRef = useRef(0);
  const router = useRouter();
  const { startNavigation } = useRouteFeedback();
  const sessionData = data?.session;
  const match = data?.match;
  const { settings, updateSetting } = useAnnouncementSettings(
    "spectator",
    match?._id || sessionId || "",
  );
  const micMonitor = useLocalMicMonitor();
  const {
    speakSequence,
    prime,
    stop,
    interruptAndCapture,
    isSupported,
    needsGesture,
    audioUnlocked,
    status: announcerStatus,
  } = useSpeechAnnouncer(settings);

  const handleBackToSessions = useCallback(() => {
    setIsLeavingToSessions(true);
    startNavigation("Opening sessions...");
    router.push("/session");
  }, [router, startNavigation]);

  useEventSource({
    url: sessionId ? `/api/live/sessions/${sessionId}` : null,
    event: "session",
    enabled: Boolean(sessionId),
    disconnectWhenHidden: false,
    onMessage: (payload) => {
      if (
        payload.updatedAt &&
        payload.updatedAt === lastStreamUpdateRef.current
      ) {
        return;
      }

      lastStreamUpdateRef.current = payload.updatedAt || "";
      const liveEventType = String(payload?.match?.lastLiveEvent?.type || "");

      startTransition(() => {
        setData(payload);
        setStreamError("");
        if (liveEventType === "walkie_disabled") {
          setSpectatorWalkieEnabled(false);
        }
      });
    },
    onError: () => {
      if (!data) {
        setStreamError("Could not load the session data.");
      }
    },
  });

  const currentLiveEventId = match?.lastLiveEvent?.id || "";
  const currentAnnouncementEventId =
    match?.lastLiveEvent?.type === "sound_effect" ? "" : currentLiveEventId;
  const isLiveMatch = Boolean(match?.isOngoing && !match?.result);
  const spectatorWalkieSignalActive = Boolean(
    isLiveMatch && (spectatorWalkieEnabled || quickWalkieTalking),
  );
  const walkie = useWalkieTalkie({
    matchId: match?._id || "",
    enabled: Boolean(match?._id && isLiveMatch),
    role: "spectator",
    displayName: sessionData?.name
      ? `${sessionData.name} Spectator`
      : "Spectator",
    autoConnectAudio: spectatorWalkieEnabled,
    signalingActive: spectatorWalkieSignalActive,
  });

  useEffect(() => {
    soundEffectPlaybackCutoffRef.current = Date.now();
  }, []);

  const speakSequenceWithDuck = useCallback(
    (items, options = {}, restoreAfterMs = 2600) => {
      const spoke = speakSequence(items, options);
      if (!spoke) {
        return false;
      }

      duckPageMedia(announcementDuckRef, 0.18);
      if (announcementRestoreTimerRef.current) {
        window.clearTimeout(announcementRestoreTimerRef.current);
      }
      announcementRestoreTimerRef.current = window.setTimeout(() => {
        restorePageMedia(announcementDuckRef);
        announcementRestoreTimerRef.current = null;
      }, restoreAfterMs);

      return true;
    },
    [speakSequence],
  );

  const announceCurrentScore = useCallback(
    (options = {}) => {
      if (!match?._id) {
        return false;
      }

      const text = buildCurrentScoreAnnouncement(match);
      if (!text) {
        return false;
      }

      if (soundEffectPlayingRef.current) {
        pendingManualScoreAnnouncementRef.current = {
          items: [
            {
              text,
              pauseAfterMs: 0,
              rate: 0.8,
            },
          ],
          options: {
            key: `spectator-current-score-deferred-${match._id}`,
            priority: 4,
            interrupt: true,
            minGapMs: 0,
            ignoreEnabled: true,
            userGesture: Boolean(options.userGesture),
          },
          restoreAfterMs: 2400,
        };
        return true;
      }

      return speakSequenceWithDuck(
        [
          {
            text,
            pauseAfterMs: 0,
            rate: 0.8,
          },
        ],
        {
          key: `spectator-current-score-${match._id}-${currentAnnouncementEventId || "snapshot"}`,
          priority: 3,
          interrupt: Boolean(options.interrupt),
          minGapMs: 0,
          ignoreEnabled: true,
          userGesture: Boolean(options.userGesture),
        },
        2400,
      );
    },
    [currentAnnouncementEventId, match, speakSequenceWithDuck],
  );

  const clearAnnouncementTimers = useCallback(() => {
    if (announcementRestoreTimerRef.current) {
      window.clearTimeout(announcementRestoreTimerRef.current);
      announcementRestoreTimerRef.current = null;
    }
    restorePageMedia(announcementDuckRef);
  }, []);

  const resumeSpectatorAnnouncementsAfterSoundEffect = useCallback(() => {
    soundEffectPlayingRef.current = false;
    activeBoundarySoundEffectRef.current = false;
    const pendingManualScore = pendingManualScoreAnnouncementRef.current;
    const deferredAnnouncement = deferredAnnouncementRef.current;
    pendingManualScoreAnnouncementRef.current = null;
    if (!shouldResumeAfterSoundEffectRef.current) {
      shouldResumeAfterSoundEffectRef.current = false;
      interruptedAnnouncementQueueRef.current = [];
      deferredAnnouncementRef.current = null;
      if (
        deferredAnnouncement?.items?.length &&
        settings.enabled &&
        settings.mode !== "silent"
      ) {
        speakSequenceWithDuck(
          deferredAnnouncement.items,
          {
            key: `spectator-post-effect-${Date.now()}`,
            priority: Number(deferredAnnouncement.options?.priority || 2),
            interrupt: true,
            minGapMs: 0,
          },
          Math.max(2400, Number(deferredAnnouncement.restoreAfterMs || 0)),
        );
      }
      if (
        pendingManualScore &&
        settings.enabled &&
        settings.mode !== "silent"
      ) {
        speakSequenceWithDuck(
          pendingManualScore.items,
          pendingManualScore.options,
          pendingManualScore.restoreAfterMs,
        );
      }
      return;
    }
    shouldResumeAfterSoundEffectRef.current = false;

    if (!settings.enabled || settings.mode === "silent") {
      interruptedAnnouncementQueueRef.current = [];
      deferredAnnouncementRef.current = null;
      return;
    }

    const resumeQueue = [
      ...interruptedAnnouncementQueueRef.current,
      ...(deferredAnnouncementRef.current
        ? [deferredAnnouncementRef.current]
        : []),
    ];
    interruptedAnnouncementQueueRef.current = [];
    deferredAnnouncementRef.current = null;

    if (!resumeQueue.length) {
      if (pendingManualScore) {
        speakSequenceWithDuck(
          pendingManualScore.items,
          pendingManualScore.options,
          pendingManualScore.restoreAfterMs,
        );
      }
      return;
    }

    const resumeItems = resumeQueue.flatMap((entry) => entry.items || []);
    const resumePriority = Math.max(
      ...resumeQueue.map((entry) => Number(entry.options?.priority || 1)),
    );
    const resumeRestoreAfterMs = Math.max(
      2400,
      ...resumeQueue.map((entry) => Number(entry.restoreAfterMs || 0)),
      Number(pendingManualScore?.restoreAfterMs || 0),
    );

    speakSequenceWithDuck(
      [...resumeItems, ...(pendingManualScore?.items || [])],
      {
        key: `spectator-resume-${Date.now()}`,
        priority: Math.max(resumePriority, pendingManualScore ? 4 : 1),
        interrupt: true,
        minGapMs: 0,
      },
      resumeRestoreAfterMs,
    );
  }, [settings.enabled, settings.mode, speakSequenceWithDuck]);

  const {
    audioRef: soundEffectsAudioRef,
    prime: primeSoundEffects,
    playEffect: playLiveSoundEffect,
    stop: stopLiveSoundEffect,
  } = useLiveSoundEffectsPlayer({
    volume: 0.95,
    onBeforePlay: () => {
      soundEffectPlayingRef.current = true;
      clearAnnouncementTimers();
      const interruptedQueue = interruptAndCapture();
      if (interruptedQueue?.length) {
        interruptedAnnouncementQueueRef.current = interruptedQueue;
      }
    },
    onAfterEnd: resumeSpectatorAnnouncementsAfterSoundEffect,
  });

  useEffect(() => {
    if (!match?._id || !isLiveMatch || settings.playScoreSoundEffects === false) {
      return undefined;
    }

    const unlockSoundEffects = () => {
      void primeSoundEffects({ userGesture: true });
    };

    window.addEventListener("click", unlockSoundEffects, { once: true });
    window.addEventListener("touchend", unlockSoundEffects, { once: true });
    window.addEventListener("keydown", unlockSoundEffects, { once: true });

    return () => {
      window.removeEventListener("click", unlockSoundEffects);
      window.removeEventListener("touchend", unlockSoundEffects);
      window.removeEventListener("keydown", unlockSoundEffects);
    };
  }, [
    isLiveMatch,
    match?._id,
    primeSoundEffects,
    settings.playScoreSoundEffects,
  ]);

  const cancelBoundarySoundEffectSequence = useCallback(() => {
    activeBoundarySoundEffectRef.current = false;
    shouldResumeAfterSoundEffectRef.current = false;
    skipNextBoundaryLeadRef.current = false;
    if (pendingSoundEffectTimerRef.current) {
      window.clearTimeout(pendingSoundEffectTimerRef.current);
      pendingSoundEffectTimerRef.current = null;
    }
    stop();
    stopLiveSoundEffect();
  }, [stop, stopLiveSoundEffect]);

  const showTemporaryWalkieNotice = useCallback((message, duration = 2600) => {
    setLocalWalkieNotice(message);
    if (walkieNoticeTimerRef.current) {
      window.clearTimeout(walkieNoticeTimerRef.current);
    }
    walkieNoticeTimerRef.current = window.setTimeout(() => {
      setLocalWalkieNotice("");
      walkieNoticeTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    if (announcerAutoReadTimerRef.current) {
      window.clearTimeout(announcerAutoReadTimerRef.current);
      announcerAutoReadTimerRef.current = null;
    }
    if (announcerResetTimerRef.current) {
      window.clearTimeout(announcerResetTimerRef.current);
      announcerResetTimerRef.current = null;
    }
    if (pendingSoundEffectTimerRef.current) {
      window.clearTimeout(pendingSoundEffectTimerRef.current);
      pendingSoundEffectTimerRef.current = null;
    }
    activeBoundarySoundEffectRef.current = false;
    pendingManualScoreAnnouncementRef.current = null;
    lastAnnouncedEventRef.current = "";
    previousEnabledRef.current = false;
    previousWalkieEnabledRef.current = false;
    previousWalkieRequestStateRef.current = "idle";
    initialWalkieStateResolvedRef.current = false;
    announcerAutoEnabledMatchRef.current = "";
    announcerInitialSummaryRef.current = "";
    announcerGestureReplayRef.current = "";
    queueMicrotask(() => {
      setSpectatorWalkieEnabled(false);
      setLocalWalkieNotice("");
      setQuickWalkieTalking(false);
    });
    clearAnnouncementTimers();
    stop();
    stopLiveSoundEffect();
  }, [clearAnnouncementTimers, match?._id, stop, stopLiveSoundEffect]);

  useEffect(() => {
    const nextMatchId = match?._id || "";
    if (previousSoundEffectMatchIdRef.current === nextMatchId) {
      return;
    }

    previousSoundEffectMatchIdRef.current = nextMatchId;
    lastHandledSoundEffectEventRef.current =
      match?.lastLiveEvent?.type === "sound_effect"
        ? match.lastLiveEvent.id || ""
        : "";
  }, [match?._id, match?.lastLiveEvent?.id, match?.lastLiveEvent?.type]);

  useEffect(() => {
    if (!match?._id || !isLiveMatch) {
      initialWalkieStateResolvedRef.current = false;
      queueMicrotask(() => {
        setSpectatorWalkieEnabled(false);
      });
      return;
    }

    const hasResolvedSnapshot =
      Number(walkie.snapshot?.version || 0) > 0 ||
      Boolean(walkie.snapshot?.updatedAt);

    if (!hasResolvedSnapshot || initialWalkieStateResolvedRef.current) {
      return;
    }

    initialWalkieStateResolvedRef.current = true;
    previousWalkieEnabledRef.current = Boolean(walkie.snapshot?.enabled);
  }, [
    isLiveMatch,
    match?._id,
    walkie.snapshot?.enabled,
    walkie.snapshot?.updatedAt,
    walkie.snapshot?.version,
  ]);

  useEffect(() => {
    if (!match?._id || !isLiveMatch) {
      return;
    }

    if (announcerAutoEnabledMatchRef.current === match._id) {
      return;
    }

    announcerAutoEnabledMatchRef.current = match._id;
    lastAnnouncedEventRef.current = "";
    announcerInitialSummaryRef.current = "";
    previousEnabledRef.current = false;
    clearAnnouncementTimers();
    stop();
    if (announcerResetTimerRef.current) {
      window.clearTimeout(announcerResetTimerRef.current);
      announcerResetTimerRef.current = null;
    }
    if (settings.enabled) {
      updateSetting("enabled", false);
      announcerResetTimerRef.current = window.setTimeout(() => {
        announcerResetTimerRef.current = null;
        updateSetting("enabled", true);
      }, ANNOUNCER_AUTO_RESET_DELAY_MS);
      return;
    }

    if (!settings.enabled) {
      updateSetting("enabled", true);
    }
  }, [
    clearAnnouncementTimers,
    isLiveMatch,
    match?._id,
    settings.enabled,
    stop,
    updateSetting,
  ]);

  useEffect(() => {
    const announcerEnabled = Boolean(
      match && isLiveMatch && settings.enabled && settings.mode !== "silent",
    );

    if (!announcerEnabled) {
      if (previousEnabledRef.current) {
        clearAnnouncementTimers();
        stop();
      }
      announcerInitialSummaryRef.current = "";
      previousEnabledRef.current = false;
      return;
    }

    if (!previousEnabledRef.current) {
      lastAnnouncedEventRef.current = "";
      announcerInitialSummaryRef.current = "";
      clearAnnouncementTimers();
      stop();
      prime();
    }

    previousEnabledRef.current = true;
  }, [
    clearAnnouncementTimers,
    isLiveMatch,
    match,
    prime,
    settings.enabled,
    settings.mode,
    stop,
  ]);

  useEffect(() => {
    const announcerEnabled = Boolean(
      match && isLiveMatch && settings.enabled && settings.mode !== "silent",
    );
    if (!announcerEnabled || !match?._id) {
      return;
    }

    const initialSummaryKey = `${match._id}:${currentAnnouncementEventId || "snapshot"}`;
    if (announcerInitialSummaryRef.current === initialSummaryKey) {
      return;
    }

    const queuedWhileWaitingForGesture =
      announcerStatus === "waiting_for_gesture";
    const spoke = announceCurrentScore();
    if (!spoke && !queuedWhileWaitingForGesture) {
      return;
    }

    announcerInitialSummaryRef.current = initialSummaryKey;
  }, [
    announceCurrentScore,
    currentAnnouncementEventId,
    isLiveMatch,
    match,
    announcerStatus,
    audioUnlocked,
    settings.enabled,
    settings.mode,
  ]);

  useEffect(() => {
    const announcerEnabled = Boolean(
      match && isLiveMatch && settings.enabled && settings.mode !== "silent",
    );
    const initialSummaryKey = match?._id
      ? `${match._id}:${currentAnnouncementEventId || "snapshot"}`
      : "";

    if (
      !announcerEnabled ||
      !initialSummaryKey ||
      announcerInitialSummaryRef.current === initialSummaryKey
    ) {
      return undefined;
    }

    if (announcerAutoReadTimerRef.current) {
      window.clearTimeout(announcerAutoReadTimerRef.current);
      announcerAutoReadTimerRef.current = null;
    }

    announcerAutoReadTimerRef.current = window.setTimeout(() => {
      announcerAutoReadTimerRef.current = null;
      if (announcerInitialSummaryRef.current === initialSummaryKey) {
        return;
      }
      const spoke = announceCurrentScore({ interrupt: true });
      if (spoke) {
        announcerInitialSummaryRef.current = initialSummaryKey;
      }
    }, ANNOUNCER_GESTURE_READ_DELAY_MS);

    return () => {
      if (announcerAutoReadTimerRef.current) {
        window.clearTimeout(announcerAutoReadTimerRef.current);
        announcerAutoReadTimerRef.current = null;
      }
    };
  }, [
    announceCurrentScore,
    currentAnnouncementEventId,
    isLiveMatch,
    match,
    settings.enabled,
    settings.mode,
  ]);

  useEffect(() => {
    const announcerEnabled = Boolean(
      match && isLiveMatch && settings.enabled && settings.mode !== "silent",
    );
    const initialSummaryKey = match?._id
      ? `${match._id}:${currentAnnouncementEventId || "snapshot"}`
      : "";

    if (
      !announcerEnabled ||
      !initialSummaryKey ||
      announcerInitialSummaryRef.current === initialSummaryKey ||
      announcerGestureReplayRef.current === initialSummaryKey
    ) {
      return undefined;
    }

    const replayOnGesture = () => {
      if (announcerGestureReplayRef.current === initialSummaryKey) {
        return;
      }
      announcerGestureReplayRef.current = initialSummaryKey;
      if (announcerAutoReadTimerRef.current) {
        window.clearTimeout(announcerAutoReadTimerRef.current);
        announcerAutoReadTimerRef.current = null;
      }
      prime({ userGesture: true });
      const spoke = announceCurrentScore({
        userGesture: true,
        interrupt: true,
      });
      if (spoke) {
        announcerInitialSummaryRef.current = initialSummaryKey;
      }
    };

    window.addEventListener("click", replayOnGesture, { once: true });
    window.addEventListener("touchend", replayOnGesture, { once: true });
    window.addEventListener("keydown", replayOnGesture, { once: true });

    return () => {
      window.removeEventListener("click", replayOnGesture);
      window.removeEventListener("touchend", replayOnGesture);
      window.removeEventListener("keydown", replayOnGesture);
    };
  }, [
    announceCurrentScore,
    currentAnnouncementEventId,
    isLiveMatch,
    match,
    prime,
    settings.enabled,
    settings.mode,
  ]);

  useEffect(() => {
    const event = match?.lastLiveEvent;
    const isTerminalEvent =
      event?.type === "match_end" || event?.type === "target_chased";

    if (
      !event ||
      (!isLiveMatch && !isTerminalEvent) ||
      !settings.enabled ||
      settings.mode === "silent"
    ) {
      return;
    }
    if (lastAnnouncedEventRef.current === event.id) return;

    const { items, priority, restoreAfterMs } =
      buildLiveScoreAnnouncementSequence(event, match, settings.mode);
    const shouldSkipBoundaryLead =
      skipNextBoundaryLeadRef.current && isSixBoundaryScoreEvent(event);
    if (shouldSkipBoundaryLead) {
      skipNextBoundaryLeadRef.current = false;
    }
    const nextItems = shouldSkipBoundaryLead ? items.slice(1) : items;
    if (!nextItems.length) return;
    if (soundEffectPlayingRef.current) {
      deferredAnnouncementRef.current = {
        items: nextItems,
        options: {
          key: event.id,
          priority,
          interrupt: false,
          minGapMs: 0,
        },
        restoreAfterMs,
      };
      lastAnnouncedEventRef.current = event.id;
      return;
    }
    const spoke = speakSequenceWithDuck(
      nextItems,
      {
        key: event.id,
        priority,
        interrupt: true,
        minGapMs: 0,
      },
      restoreAfterMs,
    );
    if (!spoke && announcerStatus === "waiting_for_gesture") {
      lastAnnouncedEventRef.current = event.id;
      return;
    }
    if (!spoke) {
      return;
    }
    lastAnnouncedEventRef.current = event.id;
  }, [
    announcerStatus,
    audioUnlocked,
    isLiveMatch,
    match,
    settings.enabled,
    settings.mode,
    speakSequenceWithDuck,
  ]);

  useEffect(() => {
    const terminalEvent =
      match?.lastLiveEvent?.type === "match_end" ||
      match?.lastLiveEvent?.type === "target_chased";

    if (!isLiveMatch && !terminalEvent) {
      stop();
    }
  }, [isLiveMatch, match?.lastLiveEvent?.type, stop]);

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
      liveEvent.trigger === "score_boundary" &&
      settings.playScoreSoundEffects === false
    ) {
      return;
    }

    if (liveEvent.action === "stop") {
      stopLiveSoundEffect();
      shouldResumeAfterSoundEffectRef.current = false;
      activeBoundarySoundEffectRef.current = false;
      return;
    }

    shouldResumeAfterSoundEffectRef.current = Boolean(
      liveEvent.resumeAnnouncements,
    );
    const effectToPlay = {
      id: liveEvent.effectId || liveEvent.effectFileName || liveEvent.id,
      fileName: liveEvent.effectFileName || liveEvent.effectId || "",
      label: liveEvent.effectLabel || "Sound effect",
      src: liveEvent.effectSrc || "",
    };
    const playIncomingSoundEffect = () => {
      void playLiveSoundEffect(effectToPlay, { userGesture: false }).then(
        (played) => {
          if (!played) {
            resumeSpectatorAnnouncementsAfterSoundEffect();
          }
        },
      );
    };
    const preAnnouncementText = String(
      liveEvent.preAnnouncementText || "",
    ).trim();

    if (
      liveEvent.trigger === "score_boundary" &&
      preAnnouncementText &&
      settings.enabled &&
      settings.mode !== "silent"
    ) {
      activeBoundarySoundEffectRef.current = true;
      soundEffectPlayingRef.current = true;
      skipNextBoundaryLeadRef.current = true;
      clearAnnouncementTimers();
      const interruptedQueue = interruptAndCapture();
      if (interruptedQueue?.length) {
        interruptedAnnouncementQueueRef.current = interruptedQueue;
      }
      stop();
      speakSequenceWithDuck(
        [
          {
            text: preAnnouncementText,
            pauseAfterMs: 0,
            rate: 0.8,
          },
        ],
        {
          key: `${liveEvent.id}:pre`,
          priority: 4,
          interrupt: true,
          minGapMs: 0,
          ignoreEnabled: true,
        },
        Math.max(
          2200,
          Number(liveEvent.preAnnouncementDelayMs || SIX_PRE_EFFECT_DELAY_MS) +
            900,
        ),
      );
      if (pendingSoundEffectTimerRef.current) {
        window.clearTimeout(pendingSoundEffectTimerRef.current);
      }
      pendingSoundEffectTimerRef.current = window.setTimeout(
        () => {
          pendingSoundEffectTimerRef.current = null;
          playIncomingSoundEffect();
        },
        Number(liveEvent.preAnnouncementDelayMs || SIX_PRE_EFFECT_DELAY_MS),
      );
      return;
    }

    playIncomingSoundEffect();
  }, [
    cancelBoundarySoundEffectSequence,
    clearAnnouncementTimers,
    interruptAndCapture,
    match?.lastLiveEvent,
    playLiveSoundEffect,
    resumeSpectatorAnnouncementsAfterSoundEffect,
    settings.enabled,
    settings.mode,
    settings.playScoreSoundEffects,
    speakSequenceWithDuck,
    stop,
    stopLiveSoundEffect,
  ]);

  useEffect(() => {
    const liveEvent = match?.lastLiveEvent;
    if (!liveEvent || !activeBoundarySoundEffectRef.current) {
      return;
    }

    if (liveEvent.type === "undo") {
      cancelBoundarySoundEffectSequence();
    }
  }, [cancelBoundarySoundEffectSequence, match?.lastLiveEvent]);

  useEffect(() => {
    return () => {
      if (announcerAutoReadTimerRef.current) {
        window.clearTimeout(announcerAutoReadTimerRef.current);
        announcerAutoReadTimerRef.current = null;
      }
      if (announcerResetTimerRef.current) {
        window.clearTimeout(announcerResetTimerRef.current);
        announcerResetTimerRef.current = null;
      }
      if (pendingSoundEffectTimerRef.current) {
        window.clearTimeout(pendingSoundEffectTimerRef.current);
        pendingSoundEffectTimerRef.current = null;
      }
      clearAnnouncementTimers();
      if (walkieNoticeTimerRef.current) {
        window.clearTimeout(walkieNoticeTimerRef.current);
        walkieNoticeTimerRef.current = null;
      }
    };
  }, [clearAnnouncementTimers]);

  useEffect(() => {
    const walkieEnabled = Boolean(walkie.snapshot?.enabled);

    if (
      isLiveMatch &&
      didSharedWalkieEnable({
        previousSharedEnabled: previousWalkieEnabledRef.current,
        sharedEnabled: walkieEnabled,
      })
    ) {
      queueMicrotask(() => {
        setLocalWalkieNotice("");
      });
      speakSequenceWithDuck(
        [
          {
            text:
              walkie.nonUmpireUi?.sharedEnableAnnouncement ||
              NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
            pauseAfterMs: 0,
            rate: 0.84,
          },
        ],
        {
          key: `spectator-walkie-live-${match?._id || sessionId || "session"}`,
          priority: 4,
          interrupt: true,
          ignoreEnabled: true,
        },
        1800,
      );
      previousWalkieEnabledRef.current = walkieEnabled;
      return undefined;
    }

    if (
      didSharedWalkieDisable({
        previousSharedEnabled: previousWalkieEnabledRef.current,
        sharedEnabled: walkieEnabled,
      })
    ) {
      queueMicrotask(() => {
        setQuickWalkieTalking(false);
        setActivePanel((current) => (current === "walkie" ? null : current));
        setSpectatorWalkieEnabled(false);
      });
      walkieHeldRef.current = false;
    }

    previousWalkieEnabledRef.current = walkieEnabled;
  }, [
    isLiveMatch,
    match?._id,
    sessionId,
    speakSequenceWithDuck,
    walkie.nonUmpireUi?.sharedEnableAnnouncement,
    walkie.snapshot?.enabled,
  ]);

  useEffect(() => {
    const requestState = walkie.requestState || "idle";

    if (requestState === previousWalkieRequestStateRef.current) {
      return;
    }

    previousWalkieRequestStateRef.current = requestState;

    if (requestState === "accepted") {
      queueMicrotask(() => {
        setSpectatorWalkieEnabled(true);
        setLocalWalkieNotice("");
      });
      speakSequenceWithDuck(
        [
          {
            text: NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT,
            pauseAfterMs: 0,
            rate: 0.84,
          },
        ],
        {
          key: `spectator-walkie-accepted-${match?._id || sessionId || "session"}`,
          priority: 4,
          interrupt: true,
          ignoreEnabled: true,
        },
        1800,
      );
      return;
    }

    if (requestState === "dismissed") {
      queueMicrotask(() => {
        setSpectatorWalkieEnabled(false);
        setQuickWalkieTalking(false);
        showTemporaryWalkieNotice("Walkie request dismissed.");
      });
    }
  }, [
    match?._id,
    sessionId,
    showTemporaryWalkieNotice,
    speakSequenceWithDuck,
    walkie.requestState,
  ]);

  useEffect(() => {
    if (match?.result) {
      router.push(`/result/${match._id}`);
    }
  }, [match, router]);

  useEffect(() => {
    if (activePanel !== "mic") {
      micPrepareRequestedRef.current = false;
      return;
    }

    if (micPrepareRequestedRef.current) {
      return;
    }

    micPrepareRequestedRef.current = true;
    void micMonitor.prepare({ requestPermission: true });
  }, [activePanel, micMonitor]);

  const handleShare = async () => {
    const shareUrl = buildShareUrl(
      `/session/${sessionId}/view`,
      window.location.origin,
    );

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: sessionData?.name || "GV Cricket live score",
            text: "View the live cricket score.",
            url: shareUrl,
          });
          return;
        } catch {
          // Fall back to copy below if native share is dismissed or unavailable.
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      window.prompt("Copy spectator link", shareUrl);
    } catch (error) {
      console.error("Spectator share failed:", error);
    }
  };

  const ensureSpectatorAnnouncerReady = useCallback(
    ({ userGesture = false, openPanel = false } = {}) => {
      if (!settings.enabled) {
        updateSetting("enabled", true);
      }

      if (settings.mode === "silent") {
        updateSetting("mode", "full");
      }

      if (openPanel) {
        setActivePanel("announce");
      }

      prime({ userGesture });
    },
    [prime, settings.enabled, settings.mode, updateSetting],
  );

  const handleOpenAnnouncePanel = useCallback(() => {
    ensureSpectatorAnnouncerReady({ userGesture: true, openPanel: true });
  }, [ensureSpectatorAnnouncerReady]);

  const clearWalkieHoldTimer = () => {
    if (walkieHoldTimerRef.current) {
      window.clearTimeout(walkieHoldTimerRef.current);
      walkieHoldTimerRef.current = null;
    }
  };

  const clearAnnouncerHoldTimer = () => {
    if (announcerHoldTimerRef.current) {
      window.clearTimeout(announcerHoldTimerRef.current);
      announcerHoldTimerRef.current = null;
    }
  };

  const handleQuickAnnounce = useCallback(() => {
    if (!match) {
      return;
    }

    ensureSpectatorAnnouncerReady({ userGesture: true });
    announceCurrentScore({ userGesture: true, interrupt: true });
  }, [announceCurrentScore, ensureSpectatorAnnouncerReady, match]);

  const handleAnnouncerCardPressStart = useCallback(
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(
          "button, input, select, textarea, a, [role='switch']",
        )
      ) {
        return;
      }

      clearAnnouncerHoldTimer();
      announcerHoldStartedRef.current = false;
      announcerHoldTimerRef.current = window.setTimeout(() => {
        announcerHoldTimerRef.current = null;
        announcerHoldStartedRef.current = true;
        suppressAnnouncerCardClickRef.current = true;
        handleQuickAnnounce();
        window.setTimeout(() => {
          suppressAnnouncerCardClickRef.current = false;
        }, 220);
      }, 180);
    },
    [handleQuickAnnounce],
  );

  const handleAnnouncerCardPressEnd = useCallback(() => {
    clearAnnouncerHoldTimer();
  }, []);

  const clearSpeakerHoldTimer = () => {
    if (speakerHoldTimerRef.current) {
      window.clearTimeout(speakerHoldTimerRef.current);
      speakerHoldTimerRef.current = null;
    }
  };

  const handleWalkieLauncherPressStart = () => {
    if (
      !walkie.snapshot?.enabled ||
      !spectatorWalkieEnabled ||
      !walkie.canTalk
    ) {
      return;
    }

    clearWalkieHoldTimer();
    walkieHeldRef.current = true;
    void (async () => {
      const prepared = await walkie.prepareToTalk?.();
      if (!walkieHeldRef.current || prepared === false) {
        walkieHeldRef.current = false;
        setQuickWalkieTalking(false);
        return;
      }

      const started = await walkie.startTalking();
      if (!walkieHeldRef.current && started) {
        await walkie.stopTalking();
      }
      if (!walkieHeldRef.current || !started) {
        walkieHeldRef.current = false;
        setQuickWalkieTalking(false);
        return;
      }
      setQuickWalkieTalking(true);
    })();
  };

  const handleWalkieLauncherPressEnd = async () => {
    clearWalkieHoldTimer();
    if (!walkieHeldRef.current) {
      return;
    }

    walkieHeldRef.current = false;
    setQuickWalkieTalking(false);
    await walkie.stopTalking();
  };

  const handleSpeakerLauncherPressStart = () => {
    if (!speakerMicOn) {
      return;
    }

    clearSpeakerHoldTimer();
    speakerHeldRef.current = true;
    setQuickSpeakerTalking(true);
    void (async () => {
      const started = micMonitor.isPaused
        ? await micMonitor.resume({ pauseMedia: true })
        : await micMonitor.start({ pauseMedia: true });
      if (!started) {
        speakerHeldRef.current = false;
        setQuickSpeakerTalking(false);
      }
    })();
  };

  const handleSpeakerLauncherPressEnd = async () => {
    clearSpeakerHoldTimer();
    if (!speakerHeldRef.current) {
      return;
    }

    speakerHeldRef.current = false;
    setQuickSpeakerTalking(false);
    await micMonitor.stop({ resumeMedia: true });
  };

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const resetHeldAudio = () => {
      clearWalkieHoldTimer();
      clearAnnouncerHoldTimer();
      clearSpeakerHoldTimer();
      walkieHeldRef.current = false;
      announcerHoldStartedRef.current = false;
      suppressAnnouncerCardClickRef.current = false;
      speakerHeldRef.current = false;
      setQuickWalkieTalking(false);
      setQuickSpeakerTalking(false);
      void walkie.stopTalking("backgrounded");
      void micMonitor.stop({ resumeMedia: true });
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
  }, [micMonitor, walkie]);

  const handleWalkieSwitchChange = useCallback(
    async (nextChecked) => {
      const action = getNonUmpireWalkieToggleAction({
        nextChecked,
        sharedEnabled: Boolean(walkie.snapshot?.enabled),
        requestState: walkie.requestState,
        hasOwnPendingRequest: walkie.hasOwnPendingRequest,
      });

      if (action === "disable") {
        clearWalkieHoldTimer();
        walkieHeldRef.current = false;
        setQuickWalkieTalking(false);
        setSpectatorWalkieEnabled(false);
        setLocalWalkieNotice("");
        setActivePanel((current) => (current === "walkie" ? null : current));
        walkie.dismissNotice();
        await walkie.deactivateAudio();
        return;
      }

      setSpectatorWalkieEnabled(true);
      if (action === "enable") {
        showTemporaryWalkieNotice("Refreshing walkie signal...", 3400);
        await walkie.refreshSignal?.({ propagate: false });
        return;
      }

      if (action === "pending") {
        showTemporaryWalkieNotice("Waiting for umpire approval.");
        return;
      }

      if (action === "request") {
        setSpectatorWalkieEnabled(true);
        prime({ userGesture: true });
        showTemporaryWalkieNotice("Requesting walkie-talkie...");
        speakSequenceWithDuck(
          [
            {
              text: "Requesting walkie-talkie.",
              pauseAfterMs: 0,
              rate: 0.84,
            },
          ],
          {
            key: `spectator-walkie-request-${match?._id || sessionId || "session"}`,
            priority: 4,
            interrupt: true,
            userGesture: true,
            ignoreEnabled: true,
          },
          1200,
        );
        const requested = await walkie.requestEnable();
        if (!requested) {
          setSpectatorWalkieEnabled(false);
        }
      }
    },
    [
      match?._id,
      prime,
      sessionId,
      showTemporaryWalkieNotice,
      speakSequenceWithDuck,
      walkie,
    ],
  );

  const handleWalkieSignalRefresh = useCallback(async () => {
    clearWalkieHoldTimer();
    walkieHeldRef.current = false;
    setQuickWalkieTalking(false);
    setSpectatorWalkieEnabled(true);
    setLocalWalkieNotice("");
    walkie.dismissNotice();
    showTemporaryWalkieNotice("Refreshing walkie signal...", 3600);
    const refreshed = await walkie.refreshSignal?.({ propagate: true });
    if (refreshed !== false) {
      showTemporaryWalkieNotice("Signal refreshed. Walkie stays on.", 3400);
      return;
    }
    showTemporaryWalkieNotice(
      "Walkie refresh is waiting for the live channel.",
      3400,
    );
  }, [showTemporaryWalkieNotice, walkie]);

  const handleSpeakerSwitchChange = useCallback(
    async (nextChecked) => {
      if (nextChecked) {
        micPrepareRequestedRef.current = true;
        const prepared = await micMonitor.prepare({ requestPermission: true });
        if (prepared && !micMonitor.isActive && !micMonitor.isPaused) {
          const primed = await micMonitor.start({
            pauseMedia: false,
            startPaused: true,
            playStartCue: false,
          });
          if (!primed) {
            return;
          }
        }
        setActivePanel("mic");
        return;
      }

      clearSpeakerHoldTimer();
      speakerHeldRef.current = false;
      setQuickSpeakerTalking(false);
      await micMonitor.stop({ resumeMedia: true });
      setActivePanel((current) => (current === "mic" ? null : current));
    },
    [micMonitor],
  );

  const handleAnnounceSwitchChange = useCallback(
    (nextChecked) => {
      updateSetting("enabled", nextChecked);

      if (nextChecked) {
        if (settings.mode === "silent") {
          updateSetting("mode", "full");
        }
        setActivePanel("announce");
        prime({ userGesture: true });
        announcerInitialSummaryRef.current = "";
        announceCurrentScore({ userGesture: true, interrupt: true });
        return;
      }

      stop();
      setActivePanel((current) => (current === "announce" ? null : current));
    },
    [announceCurrentScore, prime, settings.mode, stop, updateSetting],
  );

  if (!sessionId) return <SplashMsg>No Session ID provided.</SplashMsg>;
  if (streamError)
    return <SplashMsg>Could not load the session data.</SplashMsg>;
  if (!sessionData) return <SplashMsg loading>Loading Session...</SplashMsg>;
  if (!match) {
    return (
      <SplashMsg>The match for this session has not started yet.</SplashMsg>
    );
  }

  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const announcerStatusText = !isSupported
    ? "Speech is not supported in this browser."
    : needsGesture && !audioUnlocked
      ? "Tap Read Live Score once to enable audio on this device."
      : needsGesture
        ? "Tap once to enable the announcer on this device."
        : announcerStatus === "blocked"
          ? "Speech is blocked. Check your browser audio settings."
          : settings.enabled
            ? "Announces every new score update."
            : "Turn it on to hear live score updates.";
  const showWalkieLauncher = Boolean(match?._id && isLiveMatch);
  const speakerMicOn = Boolean(micMonitor.isActive || micMonitor.isPaused);
  const walkieCardTalking = quickWalkieTalking || walkie.isSelfTalking;
  const walkieCardFinishing = walkie.isFinishing;
  const walkieSwitchOn = spectatorWalkieEnabled;
  const walkieUi =
    walkie.nonUmpireUi ||
    getNonUmpireWalkieUiState({
      sharedEnabled: Boolean(walkie.snapshot?.enabled),
      localEnabled: walkieSwitchOn,
      isTalking: walkieCardTalking,
      isFinishing: walkieCardFinishing,
      requestState: walkie.requestState,
      hasOwnPendingRequest: walkie.hasOwnPendingRequest,
    });
  const walkiePendingRequest = Boolean(walkieUi.pendingRequest);
  const walkieNeedsLocalEnableNotice = Boolean(walkieUi.needsLocalEnableNotice);
  const walkieLoading = Boolean(
    walkie.preparingToTalk ||
    walkie.claiming ||
    walkie.recoveringAudio ||
    walkie.recoveringSignaling,
  );
  const walkieRemoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot: walkie.snapshot,
    participantId: walkie.participantId,
    isSelfTalking: walkieCardTalking,
  });
  const speakerCardTalking = quickSpeakerTalking || micMonitor.isActive;
  const speakerSwitchOn = Boolean(speakerMicOn || activePanel === "mic");
  const announceSwitchOn = Boolean(settings.enabled);
  const walkieCardDescription = walkieLoading
    ? walkie.recoveringAudio || walkie.recoveringSignaling
      ? "Reconnecting walkie..."
      : "Connecting walkie..."
    : walkieRemoteSpeakerState.isRemoteTalking
      ? walkieRemoteSpeakerState.shortStatus
      : walkieCardFinishing
        ? "Finishing..."
        : walkieCardTalking
          ? "You are live."
          : walkiePendingRequest
            ? "Waiting for umpire approval."
            : walkie.snapshot?.enabled && walkieSwitchOn
              ? "Tap and hold to talk."
              : walkie.snapshot?.enabled
                ? walkieUi.notice
                : "Turn it on to request access.";
  const shouldSurfaceWalkieNotice = Boolean(
    walkie.snapshot?.enabled || walkieSwitchOn || walkieNeedsLocalEnableNotice,
  );
  const hideGenericSharedWalkieNotice = Boolean(
    !localWalkieNotice &&
    (walkie.notice === "Walkie-talkie is live." ||
      walkie.notice === "Walkie-talkie is off."),
  );
  const rawWalkieNotice = walkieUi.notice
    ? walkieUi.notice
    : localWalkieNotice ||
      (shouldSurfaceWalkieNotice && !hideGenericSharedWalkieNotice
        ? walkie.notice || ""
        : "");
  const walkieStatusNotice = walkieRemoteSpeakerState.isRemoteTalking
    ? walkieRemoteSpeakerState.title
    : walkie.snapshot?.enabled && !walkieCardTalking
      ? walkie.snapshot?.busy
        ? walkie.snapshot?.activeSpeakerRole === "umpire"
          ? "Umpire is talking."
          : walkie.snapshot?.activeSpeakerRole === "director"
            ? "Director is talking."
            : walkie.snapshot?.activeSpeakerRole === "spectator"
              ? "Spectator is talking."
              : "Live channel is busy."
        : "Channel is free."
      : "";
  const walkieNoticeText =
    rawWalkieNotice === "Retrying audio..." ||
    rawWalkieNotice === "Retrying live walkie..."
      ? walkieStatusNotice || rawWalkieNotice
      : rawWalkieNotice || walkieStatusNotice;
  const speakerCardDescription = speakerCardTalking
    ? "Live now."
    : micMonitor.isStarting
      ? "Starting mic..."
      : speakerMicOn
        ? "Hold to talk."
        : "Use phone as a mic.";
  const announcerCardDescription = announceSwitchOn
    ? "Reads each update."
    : "Turn on for scores.";
  const activeInningsHistory =
    match?.innings === "second"
      ? match?.innings2?.history || []
      : match?.innings1?.history || [];
  const hasRecordedOvers = activeInningsHistory.some(
    (over) => Array.isArray(over?.balls) && over.balls.length > 0,
  );
  let trackerHistory = activeInningsHistory;

  if (
    !hasRecordedOvers &&
    Array.isArray(match?.balls) &&
    match.balls.length > 0
  ) {
    const inningsKey = match?.innings === "second" ? "innings2" : "innings1";
    const reconstructedMatch = {
      innings: match?.innings === "second" ? "second" : "first",
      innings1: { history: [] },
      innings2: { history: [] },
    };

    for (const ball of match.balls) {
      addBallToHistory(reconstructedMatch, ball);
    }

    trackerHistory =
      reconstructedMatch[inningsKey]?.history || activeInningsHistory;
  }
  const launcherCardClass =
    "relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] text-left shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-sm transition-transform hover:-translate-y-0.5";
  const innings1Complete =
    match?.innings === "second" || Boolean(match?.result);
  const innings2Complete = match?.innings === "second" && !isLiveMatch;
  const targetRuns = Number(match?.innings1?.score || 0) + 1;
  const runsNeeded = Math.max(
    0,
    targetRuns - Number(match?.innings2?.score || 0),
  );
  const inningsCards =
    match?.innings === "second"
      ? [
          {
            key: "innings2",
            title: match.innings2?.team || teamB.name,
            inningsData: match.innings2,
            statusLabel: innings2Complete ? "Innings completed" : "Live",
            targetSummary:
              Number(match?.innings1?.score || 0) > 0
                ? runsNeeded > 0
                  ? `Target ${targetRuns} • Need ${runsNeeded} • ${formatOversLeftLocal(match)}`
                  : `Target ${targetRuns}`
                : "",
          },
          {
            key: "innings1",
            title: match.innings1?.team || teamA.name,
            inningsData: match.innings1,
            statusLabel: innings1Complete ? "Innings completed" : "",
            targetSummary:
              Number(match?.innings1?.score || 0) > 0
                ? `Target set: ${targetRuns}`
                : "",
          },
        ]
      : [
          {
            key: "innings1",
            title: match.innings1?.team || teamA.name,
            inningsData: match.innings1,
            statusLabel: isLiveMatch
              ? "Live"
              : innings1Complete
                ? "Innings completed"
                : "",
            targetSummary: "",
          },
          {
            key: "innings2",
            title: match.innings2?.team || teamB.name,
            inningsData: match.innings2,
            statusLabel: innings2Complete ? "Innings completed" : "",
            targetSummary: "",
          },
        ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white font-sans p-4 pb-10 flex flex-col items-center">
      <div className="w-full max-w-4xl mt-4 mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1">
        <LoadingButton
          onClick={handleBackToSessions}
          loading={isLeavingToSessions}
          pendingLabel="Opening..."
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          aria-label="Back to Sessions"
        >
          <FaArrowLeft size={15} />
          Back
        </LoadingButton>
        <div className="flex min-w-0 items-center justify-center justify-self-center text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="truncate">Live Spectator View</span>
          </span>
        </div>
        <button
          onClick={handleShare}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center justify-self-end rounded-full border border-white/10 bg-white/4 text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          aria-label="Share Link"
        >
          {copied ? (
            <FaCheck className="text-green-500" size={18} />
          ) : (
            <FaShareAlt size={18} />
          )}
        </button>
      </div>

      <MatchHeroBackdrop match={match} className="w-full max-w-4xl mt-5 mb-2">
        <div className="px-5 py-7 sm:px-7">
          <header className="w-full text-center">
            <div>
              <LiquidSportText
                as="h1"
                text={sessionData.name}
                variant="hero-bright"
                simplifyMotion
                className="text-3xl font-semibold tracking-tight sm:text-[2.15rem]"
                lineClassName="leading-[0.94]"
              />
            </div>
          </header>

          <div className="mt-7 flex justify-center">
            <LiveScoreCard match={match} />
          </div>
          <div className="mt-3 flex justify-center">
            <div className="w-full max-w-xl">
              <BallTracker history={trackerHistory} />
            </div>
          </div>
        </div>
      </MatchHeroBackdrop>

      <OptionalFeatureBoundary
        fallback={
          <div className="w-full max-w-4xl mt-1 rounded-3xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-zinc-400">
            Optional audio tools are unavailable right now.
          </div>
        }
      >
        <div className="w-full max-w-4xl mt-1">
          {showWalkieLauncher ? (
            <div
              className={`${launcherCardClass} mb-4 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_26%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-3`}
            >
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-emerald-300/50 to-transparent" />
              <div
                className="flex w-full flex-col gap-4"
                style={{
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg shadow-[0_12px_26px_rgba(16,185,129,0.16)] ${
                      walkieCardTalking
                        ? "bg-emerald-500 text-black"
                        : "bg-emerald-500/14 text-emerald-300"
                    }`}
                  >
                    {walkieCardTalking ? <FaMicrophone /> : <DualWalkieIcon />}
                  </span>
                  <span
                    className="min-w-0 flex-1"
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      WebkitTouchCallout: "none",
                    }}
                  >
                    <span className="block text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
                      Walkie-Talkie
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-zinc-400">
                      {walkieCardDescription}
                    </span>
                  </span>
                  <div className="shrink-0 pt-0.5">
                    <IosGlassSwitch
                      checked={walkieSwitchOn}
                      onChange={handleWalkieSwitchChange}
                      label="Toggle walkie-talkie for this device"
                      disabled={
                        walkie.requestState === "pending" ||
                        walkie.updatingEnabled
                      }
                    />
                  </div>
                </div>
                <div
                  className={
                    walkieSwitchOn ||
                    localWalkieNotice ||
                    walkie.notice ||
                    walkieNeedsLocalEnableNotice
                      ? "min-h-18"
                      : ""
                  }
                >
                  <WalkieNotice
                    embedded
                    notice={walkieNoticeText}
                    attention={walkieUi.attentionMode}
                    onDismiss={() => {
                      setLocalWalkieNotice("");
                      walkie.dismissNotice();
                    }}
                  />
                </div>
                {walkieSwitchOn ? (
                  <div className="flex flex-col items-center justify-center pt-1 pb-1">
                    {walkieRemoteSpeakerState.isRemoteTalking ? (
                      <div className="w-full max-w-[320px] rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,18,26,0.92),rgba(8,10,16,0.98))] px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                        <div className="mb-2 inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                          {walkieRemoteSpeakerState.capsuleLabel}
                        </div>
                        <p className="text-sm font-medium text-white">
                          {walkieRemoteSpeakerState.title}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">
                          {walkieRemoteSpeakerState.detail}
                        </p>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label="Tap and hold walkie-talkie mic"
                          {...HOLD_BUTTON_INTERACTION_PROPS}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            handleWalkieLauncherPressStart();
                          }}
                          onPointerUp={(event) => {
                            event.preventDefault();
                            void handleWalkieLauncherPressEnd();
                          }}
                          onPointerCancel={(event) => {
                            event.preventDefault();
                            void handleWalkieLauncherPressEnd();
                          }}
                          onPointerLeave={(event) => {
                            event.preventDefault();
                            void handleWalkieLauncherPressEnd();
                          }}
                          className={`inline-flex h-24 w-24 items-center justify-center rounded-full border transition ${
                            walkieCardTalking
                              ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_28px_rgba(16,185,129,0.38)]"
                              : walkieLoading
                                ? "border-cyan-300/40 bg-cyan-500/12 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.16)]"
                                : walkieCardFinishing
                                  ? "border-amber-300/40 bg-amber-500/12 text-amber-100 shadow-[0_0_22px_rgba(245,158,11,0.18)]"
                                  : "border-white/12 bg-white/5 text-white"
                          }`}
                        >
                          {walkieCardTalking ? (
                            <FaMicrophone className="text-[2rem]" />
                          ) : walkieLoading ? (
                            <FaMicrophone className="animate-pulse text-[2rem]" />
                          ) : (
                            <FaMicrophoneSlash className="text-[2rem]" />
                          )}
                        </button>
                        <span
                          className="mt-3 text-xs font-medium tracking-[0.18em] text-zinc-400 uppercase"
                          style={{
                            userSelect: "none",
                            WebkitUserSelect: "none",
                            WebkitTouchCallout: "none",
                            WebkitTapHighlightColor: "transparent",
                            touchAction: "none",
                          }}
                        >
                          {walkieCardTalking
                            ? "Release to stop"
                            : walkieLoading
                              ? "Connecting..."
                              : walkieCardFinishing
                                ? "Finishing..."
                                : "Tap and hold to talk"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void handleWalkieSignalRefresh();
                          }}
                          disabled={walkieLoading}
                          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(8,18,24,0.82))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_16px_32px_rgba(8,145,178,0.18)] transition hover:border-cyan-200/30 hover:bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(10,18,24,0.86))] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {walkieLoading ? "Refreshing..." : "Refresh signal"}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActivePanel("mic")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActivePanel("mic");
                }
              }}
              className={`${launcherCardClass} min-h-34.5 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.11),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-3.5`}
              aria-label="Open loudspeaker"
            >
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-amber-300/50 to-transparent" />
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base text-black shadow-[0_12px_26px_rgba(16,185,129,0.28)]"
                    aria-hidden="true"
                  >
                    <PaMicSpeakerIcon />
                  </span>
                  <span className="shrink-0 pt-0.5">
                    <IosGlassSwitch
                      checked={speakerSwitchOn}
                      onChange={(nextChecked) => {
                        void handleSpeakerSwitchChange(nextChecked);
                      }}
                      label="Toggle loudspeaker"
                    />
                  </span>
                </div>
                <div className="pt-4">
                  <span className="block text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
                    Loudspeaker
                  </span>
                  <span className="mt-1.5 block max-w-56 text-[13px] leading-5 text-zinc-400">
                    {speakerCardDescription}
                  </span>
                </div>
                {speakerMicOn ? (
                  <div className="mt-auto flex justify-end pt-3">
                    <button
                      type="button"
                      aria-label="Hold loudspeaker"
                      {...HOLD_BUTTON_INTERACTION_PROPS}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        handleSpeakerLauncherPressStart();
                      }}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        void handleSpeakerLauncherPressEnd();
                      }}
                      onPointerCancel={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        void handleSpeakerLauncherPressEnd();
                      }}
                      onPointerLeave={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        void handleSpeakerLauncherPressEnd();
                      }}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                        speakerCardTalking
                          ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                          : "border-white/12 bg-white/5 text-white"
                      }`}
                    >
                      {speakerCardTalking ? (
                        <FaMicrophone />
                      ) : (
                        <FaMicrophoneSlash />
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (
                  suppressAnnouncerCardClickRef.current ||
                  announcerHoldStartedRef.current
                ) {
                  announcerHoldStartedRef.current = false;
                  return;
                }
                handleOpenAnnouncePanel();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenAnnouncePanel();
                }
              }}
              onPointerDown={handleAnnouncerCardPressStart}
              onPointerUp={handleAnnouncerCardPressEnd}
              onPointerCancel={handleAnnouncerCardPressEnd}
              onPointerLeave={handleAnnouncerCardPressEnd}
              className={`${launcherCardClass} min-h-34.5 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-3.5`}
              aria-label="Open score announcer"
            >
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-violet-300/46 to-transparent" />
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleQuickAnnounce();
                    }}
                    aria-label="Announce current score"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-400/14 text-sm text-violet-200 transition hover:bg-violet-400/20"
                  >
                    <FaBullhorn />
                  </button>
                  <span className="shrink-0 pt-0.5">
                    <IosGlassSwitch
                      checked={announceSwitchOn}
                      onChange={handleAnnounceSwitchChange}
                      label="Toggle score announcer"
                    />
                  </span>
                </div>
                <div className="pt-4">
                  <span className="block text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
                    Score Announcer
                  </span>
                  <span className="mt-1.5 block max-w-56 text-[13px] leading-5 text-zinc-400">
                    {announcerCardDescription}
                  </span>
                </div>
                <div className="mt-auto flex justify-end pt-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400">
                    <FaBullhorn className="text-sm" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </OptionalFeatureBoundary>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        {inningsCards.map((inningsCard) => (
          <TeamInningsDetail
            key={inningsCard.key}
            title={inningsCard.title}
            inningsData={inningsCard.inningsData}
            statusLabel={inningsCard.statusLabel}
            targetSummary={inningsCard.targetSummary}
            teamSide={
              inningsCard.title === teamB.name ||
              inningsCard.inningsData?.team === teamB.name
                ? "red"
                : "blue"
            }
          />
        ))}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
      {activePanel === "mic" ? (
        <OptionalFeatureBoundary
          fallback={
            <ModalBase title="Unavailable" onExit={() => setActivePanel(null)}>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-center text-sm text-zinc-400">
                Live mic is unavailable right now.
              </div>
            </ModalBase>
          }
        >
          <LiveMicModal
            title="Spectator Commentary Mic"
            monitor={micMonitor}
            onClose={() => setActivePanel(null)}
          />
        </OptionalFeatureBoundary>
      ) : null}
      {activePanel === "announce" ? (
        <OptionalFeatureBoundary
          fallback={
            <ModalBase
              title="Unavailable"
              onExit={() => setActivePanel(null)}
              hideHeader
            >
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-center text-sm text-zinc-400">
                Score announcer is unavailable right now.
              </div>
            </ModalBase>
          }
        >
          <ModalBase title="" onExit={() => setActivePanel(null)} hideHeader>
            <AnnouncementControls
              title="Announce Score"
              settings={settings}
              updateSetting={updateSetting}
              simpleMode
              showScoreSoundEffectsToggle
              variant="modal"
              onClose={() => setActivePanel(null)}
              onToggleEnabled={(nextEnabled) => {
                if (nextEnabled) {
                  prime({ userGesture: true });
                  speakSequenceWithDuck(
                    [
                      {
                        text: "Score announcer is now on.",
                        pauseAfterMs: 420,
                        rate: 0.82,
                      },
                      {
                        text: "I will announce the next update.",
                        pauseAfterMs: 0,
                        rate: 0.81,
                      },
                    ],
                    {
                      key: "spectator-voice-enabled",
                      priority: 3,
                      interrupt: true,
                      userGesture: true,
                      ignoreEnabled: true,
                    },
                    1700,
                  );
                } else {
                  stop();
                }
              }}
              statusText={announcerStatusText}
              onAnnounceNow={() =>
                speakSequenceWithDuck(
                  [
                    {
                      text: buildCurrentScoreAnnouncement(match),
                      pauseAfterMs: 0,
                      rate: 0.82,
                    },
                  ],
                  {
                    key: "spectator-manual-score",
                    priority: 3,
                    userGesture: true,
                  },
                  2400,
                )
              }
              announceLabel="Read Live Score"
            />
          </ModalBase>
        </OptionalFeatureBoundary>
      ) : null}
      {activePanel === "walkie" && showWalkieLauncher ? (
        <OptionalFeatureBoundary
          fallback={
            <ModalBase title="Unavailable" onExit={() => setActivePanel(null)}>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-center text-sm text-zinc-400">
                Walkie is unavailable right now.
              </div>
            </ModalBase>
          }
        >
          <ModalBase title="Walkie-Talkie" onExit={() => setActivePanel(null)}>
            <WalkiePanel
              role="spectator"
              snapshot={walkie.snapshot}
              notice={walkieNoticeText}
              error={walkie.error}
              canEnable={false}
              canRequestEnable={walkie.canRequestEnable}
              canTalk={walkie.canTalk}
              claiming={walkie.claiming}
              preparingToTalk={walkie.preparingToTalk}
              updatingEnabled={walkie.updatingEnabled}
              recoveringAudio={walkie.recoveringAudio}
              recoveringSignaling={walkie.recoveringSignaling}
              isSelfTalking={walkie.isSelfTalking}
              isFinishing={walkie.isFinishing}
              countdown={walkie.countdown}
              finishDelayLeft={walkie.finishDelayLeft}
              needsAudioUnlock={walkie.needsAudioUnlock}
              requestCooldownLeft={walkie.requestCooldownLeft}
              requestState={walkie.requestState}
              pendingRequests={walkie.pendingRequests}
              onRequestEnable={walkie.requestEnable}
              onToggleEnabled={() => {}}
              onStartTalking={walkie.startTalking}
              onStopTalking={walkie.stopTalking}
              onUnlockAudio={walkie.unlockAudio}
              onPrepareTalking={walkie.prepareToTalk}
              onDismissNotice={walkie.dismissNotice}
              onAcceptRequest={() => {}}
              onDismissRequest={() => {}}
            />
          </ModalBase>
        </OptionalFeatureBoundary>
      ) : null}
      <audio ref={soundEffectsAudioRef} hidden />
    </main>
  );
}
