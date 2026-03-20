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
import LiveScoreCard from "./LiveScoreCard";
import SplashMsg from "./SplashMsg";
import TeamInningsDetail from "./TeamInningsDetail";
import LiquidSportText from "../home/LiquidSportText";
import {
  buildCurrentScoreAnnouncement,
  buildSpectatorAnnouncement,
  getSpectatorAnnouncementPriority,
  buildSpectatorOverCompleteAnnouncement,
  buildSpectatorScoreAnnouncement,
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
import { getTeamBundle } from "../../lib/team-utils";
import { duckPageMedia, restorePageMedia } from "../../lib/page-audio";
import { ModalBase } from "../match/MatchBaseModals";
import OptionalFeatureBoundary from "../shared/OptionalFeatureBoundary";

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
    <span className="inline-flex h-7 w-7 items-center justify-center text-[1.05rem]" aria-hidden="true">
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
      balls.filter((ball) => ball?.extraType !== "wide" && ball?.extraType !== "noball").length
    );
  }, 0);
}

function formatOversLeftLocal(match) {
  const totalBalls = Math.max(Number(match?.overs || 0), 0) * 6;
  const legalBalls = countLegalBallsLocal(match?.innings2?.history || []);
  const ballsLeft = Math.max(totalBalls - legalBalls, 0);
  const overs = Math.floor(ballsLeft / 6);
  const balls = ballsLeft % 6;
  return balls > 0 ? `${overs}.${balls} overs left` : `${overs} overs left`;
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

export default function SessionViewClient({ sessionId, initialData }) {
  const [copied, setCopied] = useState(false);
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
  const walkieNoticeTimerRef = useRef(null);
  const walkieHoldTimerRef = useRef(null);
  const walkieHeldRef = useRef(false);
  const speakerHoldTimerRef = useRef(null);
  const speakerHeldRef = useRef(false);
  const previousEnabledRef = useRef(false);
  const previousWalkieEnabledRef = useRef(false);
  const previousWalkieRequestStateRef = useRef("idle");
  const micPrepareRequestedRef = useRef(false);
  const lastStreamUpdateRef = useRef(initialData?.updatedAt || "");
  const announcerAutoEnabledMatchRef = useRef("");
  const announcerInitialSummaryRef = useRef("");
  const router = useRouter();
  const sessionData = data?.session;
  const match = data?.match;
  const { settings, updateSetting } = useAnnouncementSettings(
    "spectator",
    match?._id || sessionId || ""
  );
  const micMonitor = useLocalMicMonitor();
  const {
    speakSequence,
    prime,
    stop,
    isSupported,
    needsGesture,
    audioUnlocked,
    status: announcerStatus,
  } = useSpeechAnnouncer(settings);

  useEventSource({
    url: sessionId ? `/api/live/sessions/${sessionId}` : null,
    event: "session",
    enabled: Boolean(sessionId),
    onMessage: (payload) => {
      if (payload.updatedAt && payload.updatedAt === lastStreamUpdateRef.current) {
        return;
      }

      lastStreamUpdateRef.current = payload.updatedAt || "";
      startTransition(() => {
        setData(payload);
        setStreamError("");
      });
    },
    onError: () => {
      if (!data) {
        setStreamError("Could not load the session data.");
      }
    },
  });

  const currentLiveEventId = match?.lastLiveEvent?.id || "";
  const isLiveMatch = Boolean(match?.isOngoing && !match?.result);
  const walkie = useWalkieTalkie({
    matchId: match?._id || "",
    enabled: Boolean(match?._id && isLiveMatch),
    role: "spectator",
    displayName: sessionData?.name ? `${sessionData.name} Spectator` : "Spectator",
    autoConnectAudio: spectatorWalkieEnabled,
    signalingActive: Boolean(match?._id && isLiveMatch),
  });

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
    [speakSequence]
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

      return speakSequenceWithDuck(
        [
          {
            text,
            pauseAfterMs: 0,
            rate: 0.8,
          },
        ],
        {
          key: `spectator-current-score-${match._id}-${currentLiveEventId || "snapshot"}`,
          priority: 3,
          interrupt: Boolean(options.interrupt),
          minGapMs: 0,
          ignoreEnabled: true,
          userGesture: Boolean(options.userGesture),
        },
        2400
      );
    },
    [currentLiveEventId, match, speakSequenceWithDuck]
  );

  const clearAnnouncementTimers = useCallback(() => {
    if (announcementRestoreTimerRef.current) {
      window.clearTimeout(announcementRestoreTimerRef.current);
      announcementRestoreTimerRef.current = null;
    }
    restorePageMedia(announcementDuckRef);
  }, []);

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
    lastAnnouncedEventRef.current = "";
    previousEnabledRef.current = false;
    previousWalkieEnabledRef.current = false;
    previousWalkieRequestStateRef.current = "idle";
    announcerAutoEnabledMatchRef.current = "";
    announcerInitialSummaryRef.current = "";
    queueMicrotask(() => {
      setSpectatorWalkieEnabled(false);
      setLocalWalkieNotice("");
      setQuickWalkieTalking(false);
    });
    clearAnnouncementTimers();
    stop();
  }, [clearAnnouncementTimers, match?._id, stop]);

  useEffect(() => {
    if (!match?._id || !isLiveMatch) {
      return;
    }

    if (announcerAutoEnabledMatchRef.current === match._id) {
      return;
    }

    announcerAutoEnabledMatchRef.current = match._id;
    if (!settings.enabled) {
      updateSetting("enabled", true);
    }
  }, [isLiveMatch, match?._id, settings.enabled, updateSetting]);

  useEffect(() => {
    const announcerEnabled = Boolean(match && isLiveMatch && settings.enabled && settings.mode !== "silent");

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
      lastAnnouncedEventRef.current = currentLiveEventId;
      clearAnnouncementTimers();
      stop();
    }

    previousEnabledRef.current = true;
  }, [clearAnnouncementTimers, currentLiveEventId, isLiveMatch, match, settings.enabled, settings.mode, stop]);

  useEffect(() => {
    const announcerEnabled = Boolean(match && isLiveMatch && settings.enabled && settings.mode !== "silent");
    if (!announcerEnabled || !match?._id) {
      return;
    }

    const initialSummaryKey = `${match._id}:${currentLiveEventId || "snapshot"}`;
    if (announcerInitialSummaryRef.current === initialSummaryKey) {
      return;
    }

    if (needsGesture) {
      return;
    }

    const spoke = announceCurrentScore();
    if (!spoke) {
      return;
    }

    announcerInitialSummaryRef.current = initialSummaryKey;
  }, [
    announceCurrentScore,
    currentLiveEventId,
    isLiveMatch,
    match,
    needsGesture,
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

    lastAnnouncedEventRef.current = event.id;
    const line = buildSpectatorAnnouncement(event, match, settings.mode);
    if (!line) return;
    const scoreLine = buildSpectatorScoreAnnouncement(event, match);
    const overSummary = event.overCompleted
      ? buildSpectatorOverCompleteAnnouncement(match)
      : "";
    const priority = getSpectatorAnnouncementPriority(event);
    const items = [
      {
        text: line,
        pauseAfterMs: scoreLine || overSummary ? 180 : 0,
        rate: 0.78,
      },
      scoreLine
        ? {
            text: scoreLine,
            pauseAfterMs: overSummary ? 220 : 0,
            rate: 0.8,
          }
        : null,
      overSummary
        ? {
            text: overSummary,
            pauseAfterMs: 0,
            rate: 0.8,
          }
        : null,
    ].filter(Boolean);
    speakSequenceWithDuck(
      items,
      {
        key: event.id,
        priority,
        interrupt: true,
        minGapMs: 0,
      },
      overSummary ? 3300 : scoreLine ? 2300 : 1500
    );
  }, [
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
    return () => {
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
      const sharedEnableMessage =
        walkie.nonUmpireUi?.sharedEnableNotice ||
        NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT;
      queueMicrotask(() => {
        setSpectatorWalkieEnabled(true);
        setActivePanel("walkie");
        showTemporaryWalkieNotice(sharedEnableMessage, 3600);
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
        1800
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
    showTemporaryWalkieNotice,
    speakSequenceWithDuck,
    walkie.nonUmpireUi?.sharedEnableAnnouncement,
    walkie.nonUmpireUi?.sharedEnableNotice,
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
        setActivePanel("walkie");
        showTemporaryWalkieNotice(NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT, 3200);
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
        1800
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
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: sessionData?.name || "GV Cricket live score",
            text: "View the live cricket score.",
            url: window.location.href,
          });
          return;
        } catch {
          // Fall back to copy below if native share is dismissed or unavailable.
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      window.prompt("Copy spectator link", window.location.href);
    } catch (error) {
      console.error("Spectator share failed:", error);
    }
  };

  const handleQuickAnnounce = () => {
    if (!match) {
      return;
    }

    prime();
    announceCurrentScore({ userGesture: true, interrupt: true });
  };

  const clearWalkieHoldTimer = () => {
    if (walkieHoldTimerRef.current) {
      window.clearTimeout(walkieHoldTimerRef.current);
      walkieHoldTimerRef.current = null;
    }
  };

  const clearSpeakerHoldTimer = () => {
    if (speakerHoldTimerRef.current) {
      window.clearTimeout(speakerHoldTimerRef.current);
      speakerHoldTimerRef.current = null;
    }
  };

  const handleWalkieLauncherPressStart = () => {
    if (!walkie.snapshot?.enabled || !spectatorWalkieEnabled || !walkie.canTalk) {
      return;
    }

    clearWalkieHoldTimer();
    walkieHeldRef.current = true;
    setQuickWalkieTalking(true);
    void (async () => {
      const prepared = await walkie.prepareToTalk?.();
      if (!walkieHeldRef.current || prepared === false) {
        walkieHeldRef.current = false;
        setQuickWalkieTalking(false);
        return;
      }

      const started = await walkie.startTalking();
      if (!walkieHeldRef.current || !started) {
        walkieHeldRef.current = false;
        setQuickWalkieTalking(false);
      }
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
      const started = await micMonitor.start({ pauseMedia: true });
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
      clearSpeakerHoldTimer();
      walkieHeldRef.current = false;
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
        showTemporaryWalkieNotice("Walkie-talkie is on. Tap and hold to talk.");
        return;
      }

      if (action === "pending") {
        showTemporaryWalkieNotice("Waiting for umpire approval.");
        return;
      }

      if (action === "request") {
        setSpectatorWalkieEnabled(true);
        prime();
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
          1200
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
    ]
  );

  const handleSpeakerSwitchChange = useCallback(
    async (nextChecked) => {
      if (nextChecked) {
        micPrepareRequestedRef.current = true;
        void micMonitor.prepare({ requestPermission: true });
        setActivePanel("mic");
        return;
      }

      clearSpeakerHoldTimer();
      speakerHeldRef.current = false;
      setQuickSpeakerTalking(false);
      await micMonitor.stop({ resumeMedia: true });
      setActivePanel((current) => (current === "mic" ? null : current));
    },
    [micMonitor]
  );

  const handleAnnounceSwitchChange = useCallback(
    (nextChecked) => {
      updateSetting("enabled", nextChecked);

      if (nextChecked) {
        setActivePanel("announce");
        prime();
        announcerInitialSummaryRef.current = "";
        announceCurrentScore({ userGesture: true, interrupt: true });
        return;
      }

      stop();
      setActivePanel((current) => (current === "announce" ? null : current));
    },
    [announceCurrentScore, prime, stop, updateSetting]
  );

  if (!sessionId) return <SplashMsg>No Session ID provided.</SplashMsg>;
  if (streamError) return <SplashMsg>Could not load the session data.</SplashMsg>;
  if (!sessionData) return <SplashMsg loading>Loading Session...</SplashMsg>;
  if (!match) {
    return <SplashMsg>The match for this session has not started yet.</SplashMsg>;
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
  const speakerCardTalking = quickSpeakerTalking || micMonitor.isActive;
  const speakerSwitchOn = Boolean(speakerMicOn || activePanel === "mic");
  const announceSwitchOn = Boolean(settings.enabled);
  const walkieCardDescription = walkieCardFinishing
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
    walkie.snapshot?.enabled || walkieSwitchOn || walkieNeedsLocalEnableNotice
  );
  const rawWalkieNotice = walkieUi.notice
    ? walkieUi.notice
    : localWalkieNotice || (shouldSurfaceWalkieNotice ? walkie.notice || "" : "");
  const walkieStatusNotice =
    walkie.snapshot?.enabled && !walkieCardTalking
      ? walkie.snapshot?.busy
        ? walkie.snapshot?.activeSpeakerRole === "umpire"
          ? "Umpire is live."
          : "Live channel is busy."
        : "Channel is free."
      : "";
  const walkieNoticeText =
    rawWalkieNotice === "Retrying audio..." || rawWalkieNotice === "Retrying live walkie..."
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
    (over) => Array.isArray(over?.balls) && over.balls.length > 0
  );
  let trackerHistory = activeInningsHistory;

  if (!hasRecordedOvers && Array.isArray(match?.balls) && match.balls.length > 0) {
    const inningsKey = match?.innings === "second" ? "innings2" : "innings1";
    const reconstructedMatch = {
      innings: match?.innings === "second" ? "second" : "first",
      innings1: { history: [] },
      innings2: { history: [] },
    };

    for (const ball of match.balls) {
      addBallToHistory(reconstructedMatch, ball);
    }

    trackerHistory = reconstructedMatch[inningsKey]?.history || activeInningsHistory;
  }
  const launcherCardClass =
    "relative w-full overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] text-left shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-sm transition-transform hover:-translate-y-0.5";
  const innings1Complete = match?.innings === "second" || Boolean(match?.result);
  const innings2Complete = match?.innings === "second" && !isLiveMatch;
  const targetRuns = Number(match?.innings1?.score || 0) + 1;
  const runsNeeded = Math.max(0, targetRuns - Number(match?.innings2?.score || 0));
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
              Number(match?.innings1?.score || 0) > 0 ? `Target set: ${targetRuns}` : "",
          },
        ]
      : [
          {
            key: "innings1",
            title: match.innings1?.team || teamA.name,
            inningsData: match.innings1,
            statusLabel: isLiveMatch ? "Live" : innings1Complete ? "Innings completed" : "",
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
        <button
          onClick={() => router.push("/session")}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          aria-label="Back to Sessions"
        >
          <FaArrowLeft size={15} />
          <span>Back</span>
        </button>
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
            <div className={`${launcherCardClass} mb-4 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_26%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-3`}>
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
            <div
              className="flex w-full flex-col gap-4"
              style={{
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            >
              <div className="flex items-start gap-3">
                <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg shadow-[0_12px_26px_rgba(16,185,129,0.16)] ${
                  walkieCardTalking
                    ? "bg-emerald-500 text-black"
                    : "bg-emerald-500/14 text-emerald-300"
                }`}>
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
                  />
                </div>
              </div>
              <div
                className={
                  walkieSwitchOn ||
                  localWalkieNotice ||
                  walkie.notice ||
                  walkieNeedsLocalEnableNotice
                    ? "min-h-[72px]"
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
                    className={`inline-flex h-20 w-20 items-center justify-center rounded-full border transition ${
                      walkieCardTalking
                        ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_28px_rgba(16,185,129,0.38)]"
                        : walkieCardFinishing
                        ? "border-amber-300/40 bg-amber-500/12 text-amber-100 shadow-[0_0_22px_rgba(245,158,11,0.18)]"
                        : "border-white/12 bg-white/5 text-white"
                    }`}
                  >
                    {walkieCardTalking ? (
                      <FaMicrophone className="text-[1.75rem]" />
                    ) : (
                      <FaMicrophoneSlash className="text-[1.75rem]" />
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
                      : walkieCardFinishing
                        ? "Finishing..."
                        : "Tap and hold to talk"}
                  </span>
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
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
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
                    {speakerCardTalking ? <FaMicrophone /> : <FaMicrophoneSlash />}
                  </button>
                </div>
              ) : null}
            </div>
            </div>

            <div
            role="button"
            tabIndex={0}
            onClick={() => setActivePanel("announce")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActivePanel("announce");
              }
            }}
            className={`${launcherCardClass} min-h-34.5 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-3.5`}
            aria-label="Open score announcer"
          >
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/46 to-transparent" />
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
            <ModalBase title="Unavailable" onExit={() => setActivePanel(null)} hideHeader>
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
              variant="modal"
              onClose={() => setActivePanel(null)}
              onToggleEnabled={(nextEnabled) => {
                if (nextEnabled) {
                  prime();
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
                    1700
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
                  2400
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
              notice={walkieUi.notice || localWalkieNotice || walkie.notice}
              error={walkie.error}
              canEnable={false}
              canRequestEnable={walkie.canRequestEnable}
              canTalk={walkie.canTalk}
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
    </main>
  );
}
