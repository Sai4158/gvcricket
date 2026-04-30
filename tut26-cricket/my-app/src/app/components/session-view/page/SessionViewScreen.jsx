"use client";

/**
 * File overview:
 * Purpose: Renders the spectator session-view screen, live data hydration, and result navigation.
 * Main exports: SessionViewClient.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import useLocalMicMonitor from "../../live/useLocalMicMonitor";
import useAnnouncementSettings from "../../live/useAnnouncementSettings";
import useWalkieTalkie from "../../live/useWalkieTalkie";
import useEventSource from "../../live/useEventSource";
import useSpeechAnnouncer from "../../live/useSpeechAnnouncer";
import useLiveSoundEffectsPlayer from "../../live/useLiveSoundEffectsPlayer";
import SplashMsg from "../SplashMsg";
import {
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
} from "../../../lib/live-announcements";
import {
  readWalkieDevicePreference,
  didSharedWalkieDisable,
  didSharedWalkieEnable,
  getNonUmpireWalkieUiState,
  getNonUmpireWalkieToggleAction,
  NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
  writeWalkieDevicePreference,
} from "../../../lib/walkie-device-state";
import { getWalkieRemoteSpeakerState } from "../../../lib/walkie-ui";
import { getTeamBundle } from "../../../lib/team-utils";
import { duckPageMedia, restorePageMedia } from "../../../lib/page-audio";
import { buildShareUrl } from "../../../lib/site-metadata";
import OptionalFeatureBoundary from "../../shared/OptionalFeatureBoundary";
import SiteFooter from "../../shared/SiteFooter";
import StreamingOverlayAccessCard from "../../shared/StreamingOverlayAccessCard";
import YouTubeLiveStreamCard from "../../shared/YouTubeLiveStreamCard";
import { useRouteFeedback } from "../../shared/RouteFeedbackProvider";
import { navigateToSessions } from "./result-navigation";
import {
  buildSessionViewInningsCards,
  buildSessionViewTrackerHistory,
} from "./session-view-data";
import {
  SessionViewInningsGrid,
  SessionViewTopShell,
} from "./session-view-layout";
import {
  SpectatorAudioLaunchers,
  SpectatorAudioModals,
} from "./spectator-announcer";
import {
  SpectatorWalkieModal,
  SpectatorWalkieSection,
} from "./spectator-walkie";
import { applySessionStreamPayload } from "./stream-hydration";
import {
  ANNOUNCER_GESTURE_READ_DELAY_MS,
  getDerivedScoreSoundEffectDelayMs,
  getSessionStreamPayloadSignature,
  isSixBoundaryScoreEvent,
  resolveSpectatorScoreSoundEffect,
  SCORE_EFFECT_FALLBACK_BUFFER_MS,
  SIX_PRE_EFFECT_DELAY_MS,
} from "./session-view-helpers";

export default function SessionViewClient({ sessionId, initialData }) {
  const initialWalkiePreferenceScope = initialData?.match?._id || sessionId || "";
  const [copied, setCopied] = useState(false);
  const [overlayCopied, setOverlayCopied] = useState(false);
  const [isLeavingToSessions, setIsLeavingToSessions] = useState(false);
  const [data, setData] = useState(initialData || null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [liveToolsReady, setLiveToolsReady] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [localWalkieNotice, setLocalWalkieNotice] = useState("");
  const [streamError, setStreamError] = useState("");
  const [spectatorWalkieEnabled, setSpectatorWalkieEnabled] = useState(false);
  const [quickWalkieTalking, setQuickWalkieTalking] = useState(false);
  const [quickSpeakerTalking, setQuickSpeakerTalking] = useState(false);
  const [shouldLoadHistoryDetail, setShouldLoadHistoryDetail] = useState(false);
  const [clientOrigin, setClientOrigin] = useState("");
  const lastAnnouncedEventRef = useRef("");
  const announcementDuckRef = useRef([]);
  const announcementRestoreTimerRef = useRef(null);
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
  const walkiePreferenceScopeRef = useRef(initialWalkiePreferenceScope);
  const walkiePreferenceHydratingRef = useRef(false);
  const initialWalkieStateResolvedRef = useRef(false);
  const micPrepareRequestedRef = useRef(false);
  const lastStreamPayloadSignatureRef = useRef(
    getSessionStreamPayloadSignature(initialData),
  );
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
  const pendingDerivedScoreSoundRef = useRef(null);
  const handledDerivedScoreSoundActionIdsRef = useRef(new Map());
  const pendingResultNavigationRef = useRef("");
  const requestedHistoryVersionRef = useRef("");
  const inningsGridRef = useRef(null);
  const router = useRouter();
  const { startNavigation } = useRouteFeedback();
  const sessionData = data?.session;
  const match = useMemo(() => {
    const baseMatch = data?.match;
    if (!baseMatch) {
      return null;
    }

    return {
      ...baseMatch,
      innings1: historyDetail?.innings1 || baseMatch.innings1,
      innings2: historyDetail?.innings2 || baseMatch.innings2,
    };
  }, [data?.match, historyDetail]);
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
    navigateToSessions({
      router,
      setIsLeavingToSessions,
      startNavigation,
    });
  }, [router, startNavigation]);

  const loadSessionHistory = useCallback(async () => {
    if (!sessionId || isHistoryLoading) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/view-history`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });
      if (!response.ok) {
        throw new Error("Could not load innings history.");
      }

      const payload = await response.json().catch(() => null);
      if (!payload) {
        throw new Error("Could not load innings history.");
      }

      setHistoryDetail(payload);
    } catch {
      // Keep the compact shell visible even if deferred history fails.
    } finally {
      setIsHistoryLoading(false);
    }
  }, [isHistoryLoading, sessionId]);

  useEffect(() => {
    setHistoryDetail(null);
    setLiveToolsReady(false);
    setShouldLoadHistoryDetail(false);
    requestedHistoryVersionRef.current = "";

    const frameId = window.requestAnimationFrame(() => {
      setLiveToolsReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setClientOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const element = inningsGridRef.current;
    if (!element || shouldLoadHistoryDetail || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadHistoryDetail(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "240px 0px",
        threshold: 0.05,
      },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [shouldLoadHistoryDetail, match?._id]);

  useEffect(() => {
    if (!match?._id || !shouldLoadHistoryDetail) {
      return;
    }
    const nextHistoryVersion = String(match.historyVersion || "");
    if (!nextHistoryVersion || requestedHistoryVersionRef.current === nextHistoryVersion) {
      return;
    }

    requestedHistoryVersionRef.current = nextHistoryVersion;
    void loadSessionHistory();
  }, [loadSessionHistory, match?._id, match?.historyVersion, shouldLoadHistoryDetail]);

  useEventSource({
    url: sessionId ? `/api/live/sessions/${sessionId}` : null,
    event: "session",
    enabled: Boolean(sessionId),
    disconnectWhenHidden: false,
    onMessage: (payload) => {
      applySessionStreamPayload({
        payload,
        lastSignatureRef: lastStreamPayloadSignatureRef,
        setData,
        setStreamError,
        getSignature: getSessionStreamPayloadSignature,
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
  const isLiveMatch = Boolean(
    match?.isOngoing && !match?.result && !match?.pendingResult
  );
  const walkiePreferenceScope = match?._id || sessionId || "";
  const spectatorWalkieSignalActive = Boolean(
    liveToolsReady && isLiveMatch && (spectatorWalkieEnabled || quickWalkieTalking),
  );
  const walkie = useWalkieTalkie({
    matchId: match?._id || "",
    enabled: Boolean(match?._id && isLiveMatch && liveToolsReady),
    role: "spectator",
    displayName: sessionData?.name
      ? `${sessionData.name} Spectator`
      : "Spectator",
    autoConnectAudio: spectatorWalkieEnabled,
    signalingActive: spectatorWalkieSignalActive,
  });

  const speakSequenceWithDuck = useCallback(
    (items, options = {}, restoreAfterMs = 2600) => {
      const spoke = speakSequence(items, options);
      if (!spoke) {
        return false;
      }

      duckPageMedia(announcementDuckRef, 0.12);
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

  const pruneHandledDerivedScoreSoundActionIds = useCallback(() => {
    const now = Date.now();
    for (const [actionId, recordedAt] of handledDerivedScoreSoundActionIdsRef.current) {
      if (now - Number(recordedAt || 0) > 30_000) {
        handledDerivedScoreSoundActionIdsRef.current.delete(actionId);
      }
    }
  }, []);

  const markDerivedScoreSoundActionHandled = useCallback((actionId = "") => {
    const safeActionId = String(actionId || "").trim();
    if (!safeActionId) {
      return;
    }

    pruneHandledDerivedScoreSoundActionIds();
    handledDerivedScoreSoundActionIdsRef.current.set(safeActionId, Date.now());
  }, [pruneHandledDerivedScoreSoundActionIds]);

  const hasHandledDerivedScoreSoundAction = useCallback((actionId = "") => {
    const safeActionId = String(actionId || "").trim();
    if (!safeActionId) {
      return false;
    }

    pruneHandledDerivedScoreSoundActionIds();
    return handledDerivedScoreSoundActionIdsRef.current.has(safeActionId);
  }, [pruneHandledDerivedScoreSoundActionIds]);

  const clearPendingDerivedScoreSound = useCallback((actionId = "") => {
    const pending = pendingDerivedScoreSoundRef.current;
    if (!pending) {
      return false;
    }

    if (actionId && pending.actionId !== String(actionId || "").trim()) {
      return false;
    }

    if (pending.timerId) {
      window.clearTimeout(pending.timerId);
    }
    pendingDerivedScoreSoundRef.current = null;
    return true;
  }, []);

  const hasSpectatorPlaybackInFlight = useCallback(
    () =>
      Boolean(
        pendingSoundEffectTimerRef.current ||
          soundEffectPlayingRef.current ||
          activeBoundarySoundEffectRef.current ||
          announcerStatus === "speaking",
      ),
    [announcerStatus],
  );

  const waitForSpectatorPlaybackToSettle = useCallback(
    (timeoutMs = 6000) =>
      new Promise((resolve) => {
        const startedAt = Date.now();

        const poll = () => {
          if (
            !hasSpectatorPlaybackInFlight() ||
            Date.now() - startedAt >= timeoutMs
          ) {
            resolve();
            return;
          }

          window.setTimeout(poll, 80);
        };

        poll();
      }),
    [hasSpectatorPlaybackInFlight],
  );

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
      if (announcementRestoreTimerRef.current) {
        window.clearTimeout(announcementRestoreTimerRef.current);
        announcementRestoreTimerRef.current = null;
      }
      duckPageMedia(announcementDuckRef, 0.12);
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
    clearPendingDerivedScoreSound();
    if (pendingSoundEffectTimerRef.current) {
      window.clearTimeout(pendingSoundEffectTimerRef.current);
      pendingSoundEffectTimerRef.current = null;
    }
    stop();
    stopLiveSoundEffect();
  }, [clearPendingDerivedScoreSound, stop, stopLiveSoundEffect]);

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
    if (!walkiePreferenceScope) {
      walkiePreferenceScopeRef.current = "";
      walkiePreferenceHydratingRef.current = false;
      return;
    }

    if (walkiePreferenceScopeRef.current === walkiePreferenceScope) {
      return;
    }

    walkiePreferenceHydratingRef.current = true;
    walkiePreferenceScopeRef.current = walkiePreferenceScope;
    const savedPreference = readWalkieDevicePreference({
      role: "spectator",
      scopeId: walkiePreferenceScope,
      fallback: false,
    });
    queueMicrotask(() => {
      if (walkiePreferenceScopeRef.current === walkiePreferenceScope) {
        setSpectatorWalkieEnabled(savedPreference);
        walkiePreferenceHydratingRef.current = false;
      }
    });
  }, [walkiePreferenceScope]);

  useEffect(() => {
    if (
      !walkiePreferenceScope ||
      walkiePreferenceScopeRef.current !== walkiePreferenceScope ||
      walkiePreferenceHydratingRef.current
    ) {
      return;
    }

    writeWalkieDevicePreference({
      role: "spectator",
      scopeId: walkiePreferenceScope,
      enabled: spectatorWalkieEnabled,
    });
  }, [spectatorWalkieEnabled, walkiePreferenceScope]);

  useEffect(() => {
    if (announcerAutoReadTimerRef.current) {
      window.clearTimeout(announcerAutoReadTimerRef.current);
      announcerAutoReadTimerRef.current = null;
    }
    if (pendingSoundEffectTimerRef.current) {
      window.clearTimeout(pendingSoundEffectTimerRef.current);
      pendingSoundEffectTimerRef.current = null;
    }
    clearPendingDerivedScoreSound();
    handledDerivedScoreSoundActionIdsRef.current.clear();
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
      setLocalWalkieNotice("");
      setQuickWalkieTalking(false);
    });
    clearAnnouncementTimers();
    stop();
    stopLiveSoundEffect();
  }, [clearAnnouncementTimers, clearPendingDerivedScoreSound, match?._id, stop, stopLiveSoundEffect]);

  useEffect(() => {
    const nextMatchId = match?._id || "";
    if (previousSoundEffectMatchIdRef.current === nextMatchId) {
      return;
    }

    previousSoundEffectMatchIdRef.current = nextMatchId;
    handledDerivedScoreSoundActionIdsRef.current.clear();
    clearPendingDerivedScoreSound();
    lastHandledSoundEffectEventRef.current =
      match?.lastLiveEvent?.type === "sound_effect"
        ? match.lastLiveEvent.id || ""
        : "";
  }, [
    clearPendingDerivedScoreSound,
    match?._id,
    match?.lastLiveEvent?.id,
    match?.lastLiveEvent?.type,
  ]);

  useEffect(() => {
    if (!match?._id || !isLiveMatch) {
      initialWalkieStateResolvedRef.current = false;
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
    stopLiveSoundEffect();
  }, [
    clearAnnouncementTimers,
    isLiveMatch,
    match?._id,
    stop,
    stopLiveSoundEffect,
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
    const sourceActionId = String(liveEvent.sourceActionId || "").trim();
    if (sourceActionId) {
      clearPendingDerivedScoreSound(sourceActionId);
      if (
        liveEvent.trigger === "score_boundary" &&
        hasHandledDerivedScoreSoundAction(sourceActionId)
      ) {
        return;
      }
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
          if (played && sourceActionId) {
            markDerivedScoreSoundActionHandled(sourceActionId);
          }
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
    clearPendingDerivedScoreSound,
    hasHandledDerivedScoreSoundAction,
    interruptAndCapture,
    markDerivedScoreSoundActionHandled,
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
    const sourceActionId = String(liveEvent?.actionId || "").trim();
    const shouldHandleDerivedScoreSound = Boolean(
      liveEvent?.id &&
        sourceActionId &&
        (liveEvent.type === "score_update" ||
          liveEvent.type === "target_chased" ||
          liveEvent.type === "match_end") &&
        liveEvent.ball &&
        isLiveMatch &&
        settings.playScoreSoundEffects !== false &&
        match?.announcerBroadcastScoreSoundEffectsEnabled !== false,
    );

    if (!shouldHandleDerivedScoreSound) {
      return;
    }

    if (hasHandledDerivedScoreSoundAction(sourceActionId)) {
      return;
    }

    const derivedEffect = resolveSpectatorScoreSoundEffect(match, liveEvent);
    if (!derivedEffect?.src) {
      return;
    }

    clearPendingDerivedScoreSound();
    const delayMs =
      getDerivedScoreSoundEffectDelayMs(
        liveEvent,
        settings.enabled,
        settings.mode,
      ) + SCORE_EFFECT_FALLBACK_BUFFER_MS;
    const timerId = window.setTimeout(() => {
      pendingDerivedScoreSoundRef.current = null;
      if (hasHandledDerivedScoreSoundAction(sourceActionId)) {
        return;
      }

      void playLiveSoundEffect(derivedEffect, { userGesture: false }).then(
        (played) => {
          if (played) {
            markDerivedScoreSoundActionHandled(sourceActionId);
            return;
          }

          resumeSpectatorAnnouncementsAfterSoundEffect();
        },
      );
    }, Math.max(0, delayMs));

    pendingDerivedScoreSoundRef.current = {
      actionId: sourceActionId,
      effectId: derivedEffect.id,
      timerId,
    };

    return () => {
      if (
        pendingDerivedScoreSoundRef.current?.timerId === timerId
      ) {
        window.clearTimeout(timerId);
        pendingDerivedScoreSoundRef.current = null;
      }
    };
  }, [
    clearPendingDerivedScoreSound,
    hasHandledDerivedScoreSoundAction,
    isLiveMatch,
    markDerivedScoreSoundActionHandled,
    match,
    playLiveSoundEffect,
    resumeSpectatorAnnouncementsAfterSoundEffect,
    settings.enabled,
    settings.mode,
    settings.playScoreSoundEffects,
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
      if (pendingSoundEffectTimerRef.current) {
        window.clearTimeout(pendingSoundEffectTimerRef.current);
        pendingSoundEffectTimerRef.current = null;
      }
      clearPendingDerivedScoreSound();
      clearAnnouncementTimers();
      if (walkieNoticeTimerRef.current) {
        window.clearTimeout(walkieNoticeTimerRef.current);
        walkieNoticeTimerRef.current = null;
      }
    };
  }, [clearAnnouncementTimers, clearPendingDerivedScoreSound]);

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

  const walkieCardTalking = quickWalkieTalking || walkie.isSelfTalking;
  const walkieRemoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot: walkie.snapshot,
    participantId: walkie.participantId,
    isSelfTalking: walkieCardTalking,
  });

  useEffect(() => {
    if (!match?._id || !match?.result || match?.pendingResult) {
      pendingResultNavigationRef.current = "";
      return undefined;
    }

    const targetPath = `/result/${match._id}`;
    if (pendingResultNavigationRef.current === targetPath) {
      return undefined;
    }

    pendingResultNavigationRef.current = targetPath;
    let cancelled = false;

    void (async () => {
      if (
        settings.enabled &&
        settings.mode !== "silent" &&
        hasSpectatorPlaybackInFlight()
      ) {
        await waitForSpectatorPlaybackToSettle();
      }

      if (cancelled || pendingResultNavigationRef.current !== targetPath) {
        return;
      }

      router.push(targetPath);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hasSpectatorPlaybackInFlight,
    match?._id,
    match?.pendingResult,
    match?.result,
    router,
    settings.enabled,
    settings.mode,
    waitForSpectatorPlaybackToSettle,
  ]);

  useEffect(() => {
    if (!match?._id || !match?.pendingResult || !match?.resultAutoFinalizeAt) {
      return undefined;
    }

    const autoFinalizeAtMs = Date.parse(String(match.resultAutoFinalizeAt || ""));
    if (!Number.isFinite(autoFinalizeAtMs)) {
      return undefined;
    }

    const delayMs = autoFinalizeAtMs - Date.now();
    if (delayMs <= 0) {
      router.push(`/result/${match._id}`);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      router.push(`/result/${match._id}`);
    }, delayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [match?._id, match?.pendingResult, match?.resultAutoFinalizeAt, router]);

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

  const overlayPath = `/session/${sessionId}/overlay`;
  const overlayUrl = clientOrigin
    ? new URL(overlayPath, clientOrigin).toString()
    : overlayPath;

  const handleCopyOverlayLink = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(overlayUrl);
        setOverlayCopied(true);
        window.setTimeout(() => setOverlayCopied(false), 2000);
        return;
      }

      window.prompt("Copy overlay link", overlayUrl);
    } catch (error) {
      console.error("Overlay link copy failed:", error);
    }
  }, [overlayUrl]);

  const handleOpenOverlayLink = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.open(overlayUrl, "_blank", "noopener,noreferrer");
  }, [overlayUrl]);

  const handleScrollToBottom = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const ensureSpectatorAnnouncerReady = useCallback(
    ({ userGesture = false, openPanel = false, forceEnable = false } = {}) => {
      if (forceEnable && !settings.enabled) {
        updateSetting("enabled", true);
      }

      if (forceEnable && settings.mode === "silent") {
        updateSetting("mode", "full");
      }

      if (openPanel) {
        setActivePanel("announce");
      }

      if (userGesture) {
        prime({ userGesture: true });
      }
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

    ensureSpectatorAnnouncerReady({ userGesture: true, forceEnable: true });
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
        : micMonitor.isActive
          ? true
          : await micMonitor.start({
              pauseMedia: true,
              startPaused: false,
              playStartCue: false,
            });
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
    if (micMonitor.isActive && !micMonitor.isPaused) {
      await micMonitor.pause({ resumeMedia: true });
      return;
    }

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
    walkie.recoveringAudio ||
    walkie.recoveringSignaling ||
    (!walkie.talkPathPrimed &&
      (walkie.preparingToTalk || walkie.claiming)),
  );
  const speakerCardTalking =
    quickSpeakerTalking || (micMonitor.isActive && !micMonitor.isPaused);
  const speakerSwitchOn = Boolean(speakerMicOn || activePanel === "mic");
  const announceSwitchOn = Boolean(settings.enabled);
  const umpireBroadcastScoreSoundsEnabled =
    match?.announcerBroadcastScoreSoundEffectsEnabled !== false;
  const spectatorScoreSoundsDescription =
    settings.playScoreSoundEffects === false
      ? "Turn it on to hear score sounds on this device."
      : umpireBroadcastScoreSoundsEnabled
        ? "Play score sounds on this device."
        : "Local sound is on, but umpire relay is off.";
  const spectatorBroadcastStatusText = umpireBroadcastScoreSoundsEnabled
    ? "Umpire is sending score sounds to spectators."
    : "Umpire has score sounds off for spectators.";
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
            : !walkie.snapshot?.enabled && walkieSwitchOn
              ? "Walkie is standing by for the umpire."
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
  const trackerHistory = buildSessionViewTrackerHistory(match, historyDetail);
  const launcherCardClass =
    "relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] text-left shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-sm transition-transform hover:-translate-y-0.5";
  const handleSpectatorAnnouncerToggle = (nextEnabled) => {
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
      return;
    }

    stop();
  };
  const handleSpectatorAnnounceNow = () =>
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
    );
  const inningsCards = buildSessionViewInningsCards({
    match,
    teamA,
    teamB,
    isLiveMatch,
    historyDetail,
    historyLoading: isHistoryLoading && !historyDetail,
  });

  return (
    <main id="top" className="min-h-screen bg-zinc-950 text-white font-sans p-4 pb-10 flex flex-col items-center">
      <SessionViewTopShell
        handleBackToSessions={handleBackToSessions}
        isLeavingToSessions={isLeavingToSessions}
        handleShare={handleShare}
        copied={copied}
        handleScrollToBottom={handleScrollToBottom}
        sessionName={sessionData.name}
        match={match}
        trackerHistory={trackerHistory}
        activeOverBalls={match?.activeOverBalls || []}
        activeOverNumber={match?.activeOverNumber || 1}
        liveStreamCard={null}
        liveStreamVideo={
          match?.liveStream ? (
            <YouTubeLiveStreamCard
              stream={match.liveStream}
              title="Live Match Stream Video"
              videoOnly
              className="w-full"
            />
          ) : null
        }
      />

      <OptionalFeatureBoundary
        fallback={
          <div className="w-full max-w-4xl mt-1 rounded-3xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-zinc-400">
            Optional audio tools are unavailable right now.
          </div>
        }
      >
        <div className="w-full max-w-4xl mt-1">
          <SpectatorWalkieSection
            showWalkieLauncher={showWalkieLauncher}
            launcherCardClass={launcherCardClass}
            walkieCardTalking={walkieCardTalking}
            walkieCardDescription={walkieCardDescription}
            walkieSwitchOn={walkieSwitchOn}
            handleWalkieSwitchChange={handleWalkieSwitchChange}
            walkieNoticeText={walkieNoticeText}
            walkieUi={walkieUi}
            localWalkieNotice={localWalkieNotice}
            walkieNeedsLocalEnableNotice={walkieNeedsLocalEnableNotice}
            setLocalWalkieNotice={setLocalWalkieNotice}
            walkie={walkie}
            walkieRemoteSpeakerState={walkieRemoteSpeakerState}
            handleWalkieLauncherPressStart={handleWalkieLauncherPressStart}
            handleWalkieLauncherPressEnd={handleWalkieLauncherPressEnd}
            walkieLoading={walkieLoading}
            walkieCardFinishing={walkieCardFinishing}
            handleWalkieSignalRefresh={handleWalkieSignalRefresh}
          />
          <SpectatorAudioLaunchers
            launcherCardClass={launcherCardClass}
            setActivePanel={setActivePanel}
            speakerSwitchOn={speakerSwitchOn}
            handleSpeakerSwitchChange={handleSpeakerSwitchChange}
            speakerCardDescription={speakerCardDescription}
            speakerMicOn={speakerMicOn}
            speakerCardTalking={speakerCardTalking}
            handleSpeakerLauncherPressStart={handleSpeakerLauncherPressStart}
            handleSpeakerLauncherPressEnd={handleSpeakerLauncherPressEnd}
            suppressAnnouncerCardClickRef={suppressAnnouncerCardClickRef}
            announcerHoldStartedRef={announcerHoldStartedRef}
            handleOpenAnnouncePanel={handleOpenAnnouncePanel}
            handleAnnouncerCardPressStart={handleAnnouncerCardPressStart}
            handleAnnouncerCardPressEnd={handleAnnouncerCardPressEnd}
            handleQuickAnnounce={handleQuickAnnounce}
            announceSwitchOn={announceSwitchOn}
            handleAnnounceSwitchChange={handleAnnounceSwitchChange}
            announcerCardDescription={announcerCardDescription}
          />
        </div>
      </OptionalFeatureBoundary>

      <SessionViewInningsGrid
        inningsCards={inningsCards}
        teamBName={teamB.name}
        gridRef={inningsGridRef}
      />
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
      <SpectatorAudioModals
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        micMonitor={micMonitor}
        settings={settings}
        updateSetting={updateSetting}
        spectatorScoreSoundsDescription={spectatorScoreSoundsDescription}
        spectatorBroadcastStatusText={spectatorBroadcastStatusText}
        umpireBroadcastScoreSoundsEnabled={umpireBroadcastScoreSoundsEnabled}
        onAnnouncerToggleEnabled={handleSpectatorAnnouncerToggle}
        announcerStatusText={announcerStatusText}
        onAnnounceNow={handleSpectatorAnnounceNow}
      />
      <SpectatorWalkieModal
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        showWalkieLauncher={showWalkieLauncher}
        walkieNoticeText={walkieNoticeText}
        walkie={walkie}
      />
      {overlayUrl ? (
        <section className="mt-12 w-full max-w-4xl">
          <StreamingOverlayAccessCard
            overlayUrl={overlayUrl}
            onCopy={handleCopyOverlayLink}
            onOpen={handleOpenOverlayLink}
            copied={overlayCopied}
            description="Open this live-score overlay for streaming."
          />
        </section>
      ) : null}
      <audio ref={soundEffectsAudioRef} hidden />
      <SiteFooter className="mt-16" />
    </main>
  );
}



