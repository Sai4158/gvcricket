"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: MatchPageClient.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */




import SiteFooter from "../../shared/SiteFooter";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaBroadcastTower, FaEllipsisV } from "react-icons/fa";
import {
  buildFallbackSoundEffectFromId,
  createScoreActionId,
  createSoundEffectRequestId,
  ENTRY_SCORE_SOUND_EFFECTS_MODAL,
  estimateBoundaryLeadDelayMs,
  estimateSpeechSequenceDelayMs,
  getConfiguredScoreEffectDelayMs,
  getMatchEndStageState,
  getSelectedScoreSoundEffectIds,
  IPL_HORN_EFFECT,
  readCachedSoundEffectDurations,
  SCORE_PRE_EFFECT_RATE,
  STAGE_CARD_REVEAL_TIMEOUT_MS,
  writeCachedSoundEffectDurations,
} from "./match-page-helpers";
import MatchPageLayout from "./MatchPageLayout";
import useMatchWalkieInterruptions from "./hooks/useMatchWalkieInterruptions";
import useMatchScoreSoundEffects from "./hooks/useMatchScoreSoundEffects";
import useMatchStageCardFlow from "./hooks/useMatchStageCardFlow";
import useLocalMicMonitor from "../../live/useLocalMicMonitor";
import useAnnouncementSettings from "../../live/useAnnouncementSettings";
import useLiveSoundEffectsPlayer from "../../live/useLiveSoundEffectsPlayer";
import { WalkieNotice, WalkieRequestQueue } from "../../live/WalkiePanel";
import useWalkieTalkie from "../../live/useWalkieTalkie";
import MatchHeroBackdrop from "../MatchHeroBackdrop";
import {
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
  buildUmpireSecondInningsStartSequence,
  buildUmpireStageAnnouncement,
  buildUmpireAnnouncement,
  buildSpectatorScoreAnnouncement,
  createScoreLiveEvent,
  createUndoLiveEvent,
} from "../../../lib/live-announcements";
import {
  EMPTY_SCORE_SOUND_EFFECT_MAP,
  getScoreSoundEffectMapSignature,
  getScoreSoundEffectEventKey,
  getScoreSoundEffectPreviewInput,
  normalizeScoreSoundEffectMap,
  RANDOM_SCORE_EFFECT_ID,
  SCORE_SOUND_EFFECT_KEYS,
  shouldHydrateScoreSoundEffectMapFromRemote,
} from "../../../lib/score-sound-effects";
import { getWalkieRemoteSpeakerState } from "../../../lib/walkie-ui";
import {
  MatchHeader,
  Scoreboard,
  Splash,
  AccessGate,
} from "../MatchStatusShell";
import { Controls } from "../MatchControls";
import { BallTracker } from "../MatchBallHistory";
import MatchActionGrid from "../MatchActionGrid";
import MatchModalLayer from "../MatchModalLayer";
import MatchSoundEffectsPanel from "../MatchSoundEffectsPanel";
import useLiveRelativeTime from "../../live/useLiveRelativeTime";
import useSpeechAnnouncer from "../../live/useSpeechAnnouncer";
import useMatch, { triggerMatchHapticFeedback } from "../useMatch";
import useMatchAccess from "../useMatchAccess";
import OptionalFeatureBoundary from "../../shared/OptionalFeatureBoundary";
import { buildShareUrl } from "../../../lib/site-metadata";
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
} from "../../../lib/sound-effects-client";
import { countLegalBalls } from "../../../lib/match-scoring";
import { duckPageMedia, restorePageMedia } from "../../../lib/page-audio";
import { buildMatchScorePreview } from "./match-score-preview";

const SCORE_CONTROL_COOLDOWN_MS = 1000;
const UNDO_CONTROL_KEY = "undo";

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
  const micHoldRequestedRef = useRef(false);
  const skipNextBoundaryLeadRef = useRef(false);
  const activeBoundarySequenceRef = useRef(false);
  const boundarySequenceVersionRef = useRef(0);
  const boundarySequenceTimerRef = useRef(null);
  const lastPersistedAnnouncerSettingsRef = useRef("");
  const lastPersistedScoreSoundEffectMapRef = useRef("");
  const scoreSoundEffectMapSyncReadyRef = useRef(false);
  const scoreSoundEffectMapDirtyRef = useRef(false);
  const scoreSoundEffectMapPersistInFlightRef = useRef(false);
  const currentScoreSoundEffectMapRef = useRef({
    ...EMPTY_SCORE_SOUND_EFFECT_MAP,
  });
  const currentScoreSoundEffectMapSignatureRef = useRef("");
  const isMountedRef = useRef(true);
  const contentStartRef = useRef(null);
  const announcementDuckRef = useRef([]);
  const announcementRestoreTimerRef = useRef(null);
  const speechEffectPlayerDuckRef = useRef([]);
  const speechEffectPlayerRestoreTimerRef = useRef(null);
  const micMonitorDuckingRef = useRef(false);
  const speechPlaybackActiveRef = useRef(false);
  const soundEffectPlaybackActiveRef = useRef(false);
  const entryScoreSoundPromptShownRef = useRef(false);
  const endStageAnnouncementKeyRef = useRef("");
  const stageCardRevealVersionRef = useRef(0);
  const stageCardPlaybackBlockUntilRef = useRef(0);
  const scoreControlCooldownTimersRef = useRef({});
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
  const [entryScoreAnnouncementsEnabled, setEntryScoreAnnouncementsEnabled] =
    useState(true);
  const [entryScoreSoundEffectsEnabled, setEntryScoreSoundEffectsEnabled] =
    useState(false);
  const [stageCardUndoPending, setStageCardUndoPending] = useState(false);
  const [liveToolsReady, setLiveToolsReady] = useState(false);
  const [scoreControlCooldowns, setScoreControlCooldowns] = useState({});
  const micMonitor = useLocalMicMonitor();
  const clearAllScoreControlCooldownTimers = useCallback(() => {
    Object.values(scoreControlCooldownTimersRef.current || {}).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    scoreControlCooldownTimersRef.current = {};
  }, []);
  const deferredUmpireSettings = useMemo(
    () => (
      liveToolsReady
        ? umpireSettings
        : {
            ...umpireSettings,
            enabled: false,
            playScoreSoundEffects: false,
            broadcastScoreSoundEffects: false,
          }
    ),
    [liveToolsReady, umpireSettings],
  );
  const {
    speak,
    speakSequence,
    prime,
    stop,
    status,
    voiceName,
    interruptAndCapture,
  } =
    useSpeechAnnouncer(deferredUmpireSettings);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setLiveToolsReady(true);
    });

    return () => {
      clearAllScoreControlCooldownTimers();
      window.cancelAnimationFrame(frameId);
      isMountedRef.current = false;
    };
  }, [clearAllScoreControlCooldownTimers]);

  const isScoreControlCoolingDown = useCallback((controlKey = "") => {
    const safeControlKey = String(controlKey || "").trim();
    if (!safeControlKey) {
      return false;
    }

    return Number(scoreControlCooldowns?.[safeControlKey] || 0) > Date.now();
  }, [scoreControlCooldowns]);

  const armScoreControlCooldown = useCallback((controlKey = "") => {
    const safeControlKey = String(controlKey || "").trim();
    if (!safeControlKey) {
      return;
    }

    const expiresAt = Date.now() + SCORE_CONTROL_COOLDOWN_MS;
    const existingTimer = scoreControlCooldownTimersRef.current?.[safeControlKey];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    scoreControlCooldownTimersRef.current[safeControlKey] = window.setTimeout(() => {
      setScoreControlCooldowns((current) => {
        if (!current?.[safeControlKey]) {
          return current;
        }

        const nextCooldowns = { ...(current || {}) };
        delete nextCooldowns[safeControlKey];
        return nextCooldowns;
      });
      delete scoreControlCooldownTimersRef.current[safeControlKey];
    }, SCORE_CONTROL_COOLDOWN_MS + 40);

    setScoreControlCooldowns((current) => ({
      ...(current || {}),
      [safeControlKey]: expiresAt,
    }));
  }, []);

  const resolveScoreControlKey = useCallback((runs, isOut = false, extraType = null, options = {}) => {
    const explicitControlKey = String(options?.controlKey || "").trim();
    if (explicitControlKey) {
      return explicitControlKey;
    }

    if (isOut) {
      return "out";
    }
    if (extraType === "wide") {
      return "wide";
    }
    if (extraType === "noball") {
      return "noball";
    }
    if (Number(runs || 0) === 0) {
      return "dot";
    }

    return String(Number(runs || 0));
  }, []);

  useEffect(() => {
    micMonitorDuckingRef.current = Boolean(
      micMonitor.isStarting || (micMonitor.isActive && !micMonitor.isPaused),
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

    restorePageMedia(announcementDuckRef);
  }, []);

  const clearSpeechEffectPlayerDuck = useCallback(() => {
    if (speechEffectPlayerRestoreTimerRef.current) {
      window.clearTimeout(speechEffectPlayerRestoreTimerRef.current);
      speechEffectPlayerRestoreTimerRef.current = null;
    }

    restorePageMedia(speechEffectPlayerDuckRef);
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

  const scheduleSpeechEffectPlayerDuckRestore = useCallback(
    (delayMs = 220) => {
      if (speechEffectPlayerRestoreTimerRef.current) {
        window.clearTimeout(speechEffectPlayerRestoreTimerRef.current);
        speechEffectPlayerRestoreTimerRef.current = null;
      }

      speechEffectPlayerRestoreTimerRef.current = window.setTimeout(() => {
        speechEffectPlayerRestoreTimerRef.current = null;
        if (micMonitorDuckingRef.current || speechPlaybackActiveRef.current) {
          return;
        }
        clearSpeechEffectPlayerDuck();
      }, Math.max(0, delayMs));
    },
    [clearSpeechEffectPlayerDuck],
  );

  const duckAnnouncementMedia = useCallback(() => {
    if (typeof document === "undefined" || micMonitorDuckingRef.current) {
      return false;
    }

    if (announcementRestoreTimerRef.current) {
      window.clearTimeout(announcementRestoreTimerRef.current);
      announcementRestoreTimerRef.current = null;
    }

    if (
      Array.isArray(announcementDuckRef.current) &&
      announcementDuckRef.current.length
    ) {
      return true;
    }

    return duckPageMedia(announcementDuckRef, 0.12, {
      excludedElements: Array.from(
        document.querySelectorAll('[data-gv-umpire-effects-player="true"]'),
      ),
    });
  }, []);

  const duckSpeechEffectPlayerMedia = useCallback(() => {
    if (typeof document === "undefined" || micMonitorDuckingRef.current) {
      return false;
    }

    if (speechEffectPlayerRestoreTimerRef.current) {
      window.clearTimeout(speechEffectPlayerRestoreTimerRef.current);
      speechEffectPlayerRestoreTimerRef.current = null;
    }

    if (
      Array.isArray(speechEffectPlayerDuckRef.current) &&
      speechEffectPlayerDuckRef.current.length
    ) {
      return true;
    }

    const targetElements = Array.from(
      document.querySelectorAll('[data-gv-umpire-effects-player="true"]'),
    );
    if (!targetElements.length) {
      return false;
    }

    const targetSet = new Set(targetElements);
    return duckPageMedia(speechEffectPlayerDuckRef, 0.12, {
      excludedElements: Array.from(document.querySelectorAll("audio, video")).filter(
        (element) => !targetSet.has(element),
      ),
    });
  }, []);

  const speakWithAnnouncementDuck = useCallback(
    (text, options = {}) => {
      duckAnnouncementMedia();
      duckSpeechEffectPlayerMedia();
      const spoke = speak(text, options);
      if (!spoke) {
        scheduleAnnouncementDuckRestore(120);
        scheduleSpeechEffectPlayerDuckRestore(120);
      }
      return spoke;
    },
    [
      duckAnnouncementMedia,
      duckSpeechEffectPlayerMedia,
      scheduleAnnouncementDuckRestore,
      scheduleSpeechEffectPlayerDuckRestore,
      speak,
    ],
  );

  const speakSequenceWithAnnouncementDuck = useCallback(
    (items, options = {}) => {
      duckAnnouncementMedia();
      duckSpeechEffectPlayerMedia();
      const spoke = speakSequence(items, options);
      if (!spoke) {
        scheduleAnnouncementDuckRestore(120);
        scheduleSpeechEffectPlayerDuckRestore(120);
      }
      return spoke;
    },
    [
      duckAnnouncementMedia,
      duckSpeechEffectPlayerMedia,
      scheduleAnnouncementDuckRestore,
      scheduleSpeechEffectPlayerDuckRestore,
      speakSequence,
    ],
  );
  const beginAnnouncementSoundEffectDuck = useCallback(() => {
    duckAnnouncementMedia();
    soundEffectPlaybackActiveRef.current = true;
  }, [duckAnnouncementMedia]);
  const failAnnouncementSoundEffectDuck = useCallback(
    (delayMs = 120) => {
      soundEffectPlaybackActiveRef.current = false;
      scheduleAnnouncementDuckRestore(delayMs);
    },
    [scheduleAnnouncementDuckRestore],
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
    prime: primeLocalSoundEffects,
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

  const flushDeferredUmpireAnnouncement = useCallback(() => {
    if (
      walkieAnnouncementPauseActiveRef.current ||
      soundEffectPlayingRef.current ||
      activeBoundarySequenceRef.current ||
      umpireAnnouncementTimerRef.current ||
      pendingUmpireAnnouncementRef.current?.items?.length ||
      status === "speaking" ||
      isAnySoundEffectActive
    ) {
      return false;
    }

    const deferredAnnouncement = deferredUmpireAnnouncementRef.current;
    if (
      !deferredAnnouncement?.items?.length ||
      !umpireSettings.enabled ||
      umpireSettings.mode === "silent"
    ) {
      return false;
    }

    deferredUmpireAnnouncementRef.current = null;
    localAnnouncementIdRef.current += 1;
    speakSequenceWithAnnouncementDuck(deferredAnnouncement.items, {
      key:
        deferredAnnouncement.options?.key ||
        `umpire-deferred-${localAnnouncementIdRef.current}`,
      priority: Number(deferredAnnouncement.options?.priority || 2),
      interrupt: true,
      minGapMs: 0,
      userGesture: true,
    });
    return true;
  }, [
    isAnySoundEffectActive,
    speakSequenceWithAnnouncementDuck,
    status,
    umpireSettings.enabled,
    umpireSettings.mode,
  ]);

  useEffect(() => {
    soundEffectPlaybackActiveRef.current = isAnySoundEffectActive;
  }, [isAnySoundEffectActive]);

  useEffect(() => {
    if (micMonitor.isActive || micMonitor.isPaused || micMonitor.isStarting) {
      if (announcementRestoreTimerRef.current) {
        window.clearTimeout(announcementRestoreTimerRef.current);
        announcementRestoreTimerRef.current = null;
      }
      clearSpeechEffectPlayerDuck();
      return;
    }

    if (status === "speaking") {
      duckSpeechEffectPlayerMedia();
    } else {
      scheduleSpeechEffectPlayerDuckRestore(220);
    }

    if (status === "speaking" || isAnySoundEffectActive) {
      duckAnnouncementMedia();
      return;
    }

    scheduleAnnouncementDuckRestore(220);
  }, [
    duckAnnouncementMedia,
    duckSpeechEffectPlayerMedia,
    clearSpeechEffectPlayerDuck,
    isAnySoundEffectActive,
    micMonitor.isActive,
    micMonitor.isPaused,
    micMonitor.isStarting,
    scheduleAnnouncementDuckRestore,
    scheduleSpeechEffectPlayerDuckRestore,
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
  const normalizedScoreSoundEffectMap = useMemo(
    () => normalizeScoreSoundEffectMap(umpireSettings.scoreSoundEffectMap || {}),
    [umpireSettings.scoreSoundEffectMap],
  );
  const scoreSoundEffectMapSignature = useMemo(
    () => getScoreSoundEffectMapSignature(normalizedScoreSoundEffectMap),
    [normalizedScoreSoundEffectMap],
  );
  const selectedScoreSoundEffectIds = useMemo(
    () => getSelectedScoreSoundEffectIds(normalizedScoreSoundEffectMap),
    [normalizedScoreSoundEffectMap],
  );

  useEffect(() => {
    currentScoreSoundEffectMapRef.current = normalizedScoreSoundEffectMap;
    currentScoreSoundEffectMapSignatureRef.current = scoreSoundEffectMapSignature;
  }, [normalizedScoreSoundEffectMap, scoreSoundEffectMapSignature]);
  useEffect(() => {
    if (modal.type === ENTRY_SCORE_SOUND_EFFECTS_MODAL) {
      return;
    }

    setEntryScoreAnnouncementsEnabled(umpireSettings.enabled !== false);
    setEntryScoreSoundEffectsEnabled(
      umpireSettings.playScoreSoundEffects !== false,
    );
  }, [
    modal.type,
    umpireSettings.enabled,
    umpireSettings.playScoreSoundEffects,
  ]);
  const [scoreSoundEffectMapSaveNonce, setScoreSoundEffectMapSaveNonce] =
    useState(0);
  const queueScoreSoundEffectMapSave = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    setScoreSoundEffectMapSaveNonce((value) => value + 1);
  }, []);
  const updateUmpireScoreSoundSettings = useCallback(
    (key, value) => {
      if (key !== "scoreSoundEffectMap") {
        updateUmpireSetting(key, value);
        return;
      }

      const normalizedValue = normalizeScoreSoundEffectMap(value || {});
      scoreSoundEffectMapDirtyRef.current = true;
      currentScoreSoundEffectMapRef.current = normalizedValue;
      currentScoreSoundEffectMapSignatureRef.current =
        getScoreSoundEffectMapSignature(normalizedValue);
      updateUmpireSetting(key, normalizedValue);
    },
    [updateUmpireSetting],
  );
  const liveUpdatedLabel = useLiveRelativeTime(lastUpdatedAt);
  const isLiveMatch = Boolean(match?.isOngoing && !match?.result);
  const liveToolsEnabled = liveToolsReady && isLiveMatch;
  const tossPending = Boolean(match && !match.tossReady);
  const walkie = useWalkieTalkie({
    matchId,
    enabled: Boolean(authStatus === "granted" && liveToolsEnabled),
    role: "umpire",
    hasUmpireAccess: authStatus === "granted",
    displayName: "Umpire",
    autoConnectAudio: Boolean(authStatus === "granted" && liveToolsEnabled),
    signalingActive: Boolean(
      authStatus === "granted" &&
        liveToolsEnabled &&
        match?.walkieTalkieEnabled,
    ),
  });
  const hasPendingWalkieRequests = Boolean(isLiveMatch && walkie.pendingRequests?.length);
  const umpireRemoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot: walkie.snapshot,
    participantId: walkie.participantId,
    isSelfTalking: walkie.isSelfTalking,
  });
  const isLocalWalkieInteractionActive = Boolean(
    walkie.updatingEnabled ||
      walkie.isSelfTalking ||
      walkie.isFinishing ||
      (!walkie.talkPathPrimed &&
        (walkie.claiming || walkie.preparingToTalk))
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
      if (!selectedScoreSoundEffectIds.length) {
        return;
      }

      void warmCachedSoundEffectAssets(files, {
        preferredIds: selectedScoreSoundEffectIds,
        limit: selectedScoreSoundEffectIds.length,
      }).catch(() => {});
    },
    [selectedScoreSoundEffectIds],
  );

  useEffect(() => {
    if (!liveToolsReady) {
      return;
    }

    const cachedFiles = sortSoundEffectsByOrder(
      readCachedSoundEffectsLibrary(),
      readCachedSoundEffectsOrder(),
    );
    const cachedDurations = readCachedSoundEffectDurations();

    if (cachedFiles.length) {
      setSoundEffectFiles((current) =>
        current.length ? current : cachedFiles,
      );
      setSoundEffectLibraryStatus((current) =>
        current === "idle" ? "ready" : current,
      );
    }

    if (Object.keys(cachedDurations).length) {
      setSoundEffectDurations((current) =>
        Object.keys(current).length ? current : cachedDurations,
      );
    }
  }, [liveToolsReady]);

  useEffect(() => {
    if (authStatus === "granted" && match && tossPending) {
      router.replace(`/toss/${matchId}`);
    }
  }, [authStatus, match, matchId, router, tossPending]);

  useEffect(() => {
    if (!liveToolsEnabled) {
      stop();
    }
  }, [liveToolsEnabled, stop]);

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
      clearSpeechEffectPlayerDuck();
    };
  }, [clearAnnouncementDuck, clearSpeechEffectPlayerDuck]);

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

  const queueOrSpeakUmpireSequence = useCallback((sequence, keyPrefix) => {
    if (!sequence?.items?.length || !umpireSettings.enabled || umpireSettings.mode === "silent") {
      return false;
    }

    if (
      walkieAnnouncementPauseActiveRef.current ||
      soundEffectPlayingRef.current ||
      activeBoundarySequenceRef.current ||
      umpireAnnouncementTimerRef.current ||
      pendingUmpireAnnouncementRef.current?.items?.length ||
      status === "speaking" ||
      isAnySoundEffectActive
    ) {
      queueDeferredUmpireAnnouncement({
        items: sequence.items,
        options: {
          key: keyPrefix,
          priority: sequence.priority || 2,
        },
      });
      return false;
    }

    speakImmediateUmpireSequence(sequence, keyPrefix);
    return true;
  }, [
    isAnySoundEffectActive,
    queueDeferredUmpireAnnouncement,
    speakImmediateUmpireSequence,
    status,
    umpireSettings.enabled,
    umpireSettings.mode,
  ]);

  const buildUmpireScorePreview = useCallback(
    (runs, isOut = false, extraType = null) =>
      buildMatchScorePreview({
        extraType,
        isOut,
        match,
        mode: umpireSettings.mode,
        runs,
      }),
    [match, umpireSettings.mode],
  );

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

  const findConfiguredScoreSoundEffectFromMap = useCallback((
    configuredMap,
    runs,
    isOut = false,
    extraType = null,
  ) => {
    const effectKey = getScoreSoundEffectEventKey(runs, isOut, extraType);
    if (!effectKey) {
      return null;
    }

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
      (effectId === IPL_HORN_EFFECT.id
        ? IPL_HORN_EFFECT
        : buildFallbackSoundEffectFromId(effectId))
    );
  }, [pickRandomScoreSoundEffect, soundEffectFiles]);

  const findConfiguredScoreSoundEffect = useCallback((runs, isOut = false, extraType = null) => (
    findConfiguredScoreSoundEffectFromMap(
      umpireSettings.scoreSoundEffectMap || {},
      runs,
      isOut,
      extraType,
    )
  ), [findConfiguredScoreSoundEffectFromMap, umpireSettings.scoreSoundEffectMap]);

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

    const { sequence, nextMatch, endsFirstInnings } = buildUmpireScorePreview(
      runs,
      isOut,
      extraType,
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

    if (endsFirstInnings || nextMatch?.result) {
      stageCardPlaybackBlockUntilRef.current =
        Date.now() + 140 + estimateSpeechSequenceDelayMs(sequenceItems);
    }

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
    extraType = null,
    options = {},
  ) => {
    if (!match || match.result || match.pendingResult || tossPending) {
      return false;
    }

    const controlKey = resolveScoreControlKey(runs, isOut, extraType, options);
    if (isScoreControlCoolingDown(controlKey)) {
      return false;
    }

    armScoreControlCooldown(controlKey);

    if (activeBoundarySequenceRef.current || soundEffectPlayingRef.current) {
      cancelBoundarySequence({ stopEffect: true });
    }

    const scorePreview = buildUmpireScorePreview(runs, isOut, extraType);
    const shouldSuppressScoreEffectForInningsEnd =
      scorePreview.endsFirstInnings;
    const shouldDelayStageCardForScoreFlow = Boolean(
      scorePreview.endsFirstInnings || scorePreview.nextMatch?.result,
    );
    const shouldPlayLocalScoreEffect =
      umpireSettings.playScoreSoundEffects !== false &&
      !shouldSuppressScoreEffectForInningsEnd;
    const shouldBroadcastScoreEffect =
      umpireSettings.broadcastScoreSoundEffects !== false &&
      !shouldSuppressScoreEffectForInningsEnd;
    const scoreActionId = createScoreActionId();
    const configuredScoreEffectPromise =
      shouldPlayLocalScoreEffect || shouldBroadcastScoreEffect
        ? resolveConfiguredScoreSoundEffect(runs, isOut, extraType)
        : Promise.resolve(null);

    handleScoreEvent(runs, isOut, extraType, {
      actionId: scoreActionId,
    });

    const configuredScoreEffect = await configuredScoreEffectPromise;

    if (configuredScoreEffect) {
      if (shouldPlayLocalScoreEffect) {
        void primeLocalSoundEffects({ userGesture: true });
      }

      if (!shouldPlayLocalScoreEffect && shouldBroadcastScoreEffect) {
        void fetch(`/api/matches/${matchId}/sound-effects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            effectId: configuredScoreEffect.id,
            clientRequestId: createSoundEffectRequestId(),
            sourceActionId: scoreActionId,
            resumeAnnouncements: false,
            trigger: "score_boundary",
            preAnnouncementText: String(scorePreview.leadItem?.text || "").trim(),
            preAnnouncementDelayMs: getConfiguredScoreEffectDelayMs(
              runs,
              isOut,
              extraType,
              String(scorePreview.leadItem?.text || "").trim(),
              Number(scorePreview.leadItem?.rate || SCORE_PRE_EFFECT_RATE),
            ),
          }),
        }).catch(() => {
          // Spectator relay is best-effort and should not block scoring.
        });
        announceUmpireAction(runs, isOut, extraType);
        return;
      }

      const boundarySequenceVersion = boundarySequenceVersionRef.current + 1;
      const leadText = String(scorePreview.leadItem?.text || "").trim();
      const leadRate = Number(scorePreview.leadItem?.rate || SCORE_PRE_EFFECT_RATE);
      const leadDelayMs = getConfiguredScoreEffectDelayMs(
        runs,
        isOut,
        extraType,
        leadText,
        leadRate,
      );
      const followUpDelayMs = scorePreview.followUpItems.length
        ? estimateSpeechSequenceDelayMs(scorePreview.followUpItems)
        : 0;
      const configuredEffectDurationMs = shouldPlayLocalScoreEffect
        ? getEstimatedConfiguredScoreEffectDurationMs(configuredScoreEffect.id)
        : 0;
      const clientRequestId = createSoundEffectRequestId();
      boundarySequenceVersionRef.current = boundarySequenceVersion;
      activeBoundarySequenceRef.current = true;
      if (shouldDelayStageCardForScoreFlow && shouldPlayLocalScoreEffect) {
        stageCardPlaybackBlockUntilRef.current =
          Date.now() +
          leadDelayMs +
          configuredEffectDurationMs +
          followUpDelayMs;
      }

      if (shouldBroadcastScoreEffect) {
        localSoundEffectRequestIdRef.current = clientRequestId;
        void fetch(`/api/matches/${matchId}/sound-effects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            effectId: configuredScoreEffect.id,
            clientRequestId,
            sourceActionId: scoreActionId,
            resumeAnnouncements: false,
            trigger: "score_boundary",
            preAnnouncementText: leadText,
            preAnnouncementDelayMs: leadDelayMs,
          }),
        }).catch(() => {
          // Spectator relay is best-effort and should not block scoring.
        });
      }

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
    return true;
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
  const {
    pauseUmpireAnnouncementsForWalkie,
    resumeUmpireAnnouncementsAfterWalkie,
  } = useMatchWalkieInterruptions({
    activeBoundarySequenceRef,
    activeSoundEffectStatus,
    boundarySequenceTimerRef,
    boundarySequenceVersionRef,
    deferredUmpireAnnouncementRef,
    interruptedUmpireAnnouncementQueueRef,
    interruptAndCapture,
    isWalkieConversationActive,
    localAnnouncementIdRef,
    pendingManualScoreAnnouncementRef,
    pendingUmpireAnnouncementRef,
    queueDeferredUmpireAnnouncement,
    soundEffectPlayingRef,
    speakSequenceWithAnnouncementDuck,
    stopActiveSoundEffect,
    shouldResumeAfterSoundEffectRef,
    umpireAnnouncementTimerRef,
    umpireSettings,
    walkieAnnouncementPauseActiveRef,
  });
  const {
    commentarySoundEffectOptions,
    handleCommentaryReadScoreAction,
    handleCommentaryTestSequenceAction,
    handleEntryScoreSoundPromptSave,
    handleHeroReadScoreAction,
    handlePlaySoundEffect,
    handlePreviewCommentarySoundEffect,
    handleReorderSoundEffects,
    handleStopLiveSoundEffect,
    hydrateRemoteScoreSoundEffectMap,
    isReadScoreActionActive,
    isTestSequenceActionActive,
    loadSoundEffectsLibrary,
    previewingCommentarySoundEffectId,
    resolveConfiguredScoreSoundEffect,
    stopCommentaryPlayback,
    toggleSoundEffectsPanel,
    triggerSharedSoundEffect,
  } = useMatchScoreSoundEffects({
    activeCommentaryAction,
    activeCommentaryPreviewId,
    activeSoundEffectId,
    activeSoundEffectStatus,
    authStatus,
    beginAnnouncementSoundEffectDuck,
    buildUmpireScorePreview,
    cancelBoundarySequence,
    currentScoreSoundEffectMapRef,
    currentScoreSoundEffectMapSignatureRef,
    entryScoreAnnouncementsEnabled,
    entryScoreSoundEffectsEnabled,
    entryScoreSoundPromptShownRef,
    failAnnouncementSoundEffectDuck,
    handleManualScoreAnnouncement,
    isAnySoundEffectActive,
    isLiveMatch: liveToolsEnabled,
    isLoading,
    lastHandledSoundEffectEventRef,
    lastPersistedScoreSoundEffectMapRef,
    lastSoundEffectTriggerRef,
    localSoundEffectRequestIdRef,
    match,
    matchId,
    playLocalSoundEffect,
    prime,
    resumeUmpireAnnouncementsAfterSoundEffect,
    scheduleAnnouncementDuckRestore,
    scheduleSpeechEffectPlayerDuckRestore,
    scoreSoundEffectMapDirtyRef,
    selectedScoreSoundEffectIds,
    setActiveCommentaryAction,
    setActiveCommentaryPreviewId,
    setEntryScoreAnnouncementsEnabled,
    setEntryScoreSoundEffectsEnabled,
    setModal,
    setSoundEffectError,
    setSoundEffectFiles,
    setSoundEffectLibraryStatus,
    setSoundEffectsOpen,
    shouldResumeAfterSoundEffectRef,
    soundEffectDurations,
    soundEffectFiles,
    soundEffectLibraryStatus,
    soundEffectPlaybackCutoffRef,
    speakSequenceWithAnnouncementDuck,
    speakWithAnnouncementDuck,
    status,
    stop,
    stopActiveSoundEffect,
    tossPending,
    triggerHapticFeedback: triggerMatchHapticFeedback,
    updateUmpireScoreSoundSettings,
    updateUmpireSetting,
    umpireSettings,
    warmKnownSoundEffects,
  });

  const handleAnnouncedUndo = async () => {
    if (
      !match?.undoCount ||
      !currentInningsHasHistory ||
      isScoreControlCoolingDown(UNDO_CONTROL_KEY)
    ) {
      return;
    }

    armScoreControlCooldown(UNDO_CONTROL_KEY);
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
    const currentTeamALength = Array.isArray(match?.teamA) ? match.teamA.length : 0;
    const currentTeamBLength = Array.isArray(match?.teamB) ? match.teamB.length : 0;
    const teamASizeChanged =
      Array.isArray(payload?.teamA) && payload.teamA.length !== currentTeamALength;
    const teamBSizeChanged =
      Array.isArray(payload?.teamB) && payload.teamB.length !== currentTeamBLength;
    const nextMatch = await patchAndUpdate(payload);
    if (!nextMatch) {
      return null;
    }

    if (
      payload?.innings1Score === undefined &&
      payload?.overs === undefined &&
      !teamASizeChanged &&
      !teamBSizeChanged
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

    const prepared = await walkie.prepareToTalk();
    if (prepared === false) {
      return;
    }

    await walkie.startTalking();
  };

  const handleMicHoldStart = useCallback(async () => {
    if (!isLiveMatch) {
      return;
    }

    micHoldRequestedRef.current = true;

    if (micMonitor.isPaused) {
      const resumed = await micMonitor.resume({ pauseMedia: true });
      if (resumed && !micHoldRequestedRef.current) {
        await micMonitor.pause({ resumeMedia: true });
      }
      return;
    }

    if (!micMonitor.isActive) {
      const started = await micMonitor.start({
        pauseMedia: true,
        startPaused: false,
        playStartCue: false,
      });
      if (started && !micHoldRequestedRef.current) {
        await micMonitor.pause({ resumeMedia: true });
      }
    }
  }, [isLiveMatch, micMonitor]);

  const handleMicHoldEnd = useCallback(async () => {
    micHoldRequestedRef.current = false;

    if (!micMonitor.isActive || micMonitor.isPaused) {
      return;
    }

    await micMonitor.pause({ resumeMedia: true });
  }, [micMonitor]);

  useEffect(() => {
    if (!liveToolsReady || authStatus !== "granted" || !match?._id) {
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
    liveToolsReady,
  ]);

  useEffect(() => {
    if (!liveToolsReady || authStatus !== "granted" || !match?._id) {
      scoreSoundEffectMapSyncReadyRef.current = false;
      scoreSoundEffectMapDirtyRef.current = false;
      scoreSoundEffectMapPersistInFlightRef.current = false;
      lastPersistedScoreSoundEffectMapRef.current = "";
      return;
    }

    let cancelled = false;
    scoreSoundEffectMapSyncReadyRef.current = false;

    void (async () => {
      try {
        if (cancelled) {
          return;
        }

        await hydrateRemoteScoreSoundEffectMap();
      } catch {
        // Keep local settings and fall back to the next save.
      } finally {
        if (!cancelled) {
          scoreSoundEffectMapSyncReadyRef.current = true;
          queueScoreSoundEffectMapSave();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authStatus,
    hydrateRemoteScoreSoundEffectMap,
    liveToolsReady,
    match?._id,
    matchId,
    queueScoreSoundEffectMapSave,
  ]);

  useEffect(() => {
    if (
      authStatus !== "granted" ||
      !liveToolsReady ||
      !match?._id ||
      !scoreSoundEffectMapSyncReadyRef.current ||
      scoreSoundEffectMapPersistInFlightRef.current
    ) {
      return;
    }

    const requestSignature = currentScoreSoundEffectMapSignatureRef.current;

    if (lastPersistedScoreSoundEffectMapRef.current === requestSignature) {
      scoreSoundEffectMapDirtyRef.current = false;
      return;
    }

    let didPersistLatestKnownValue = false;
    const mapToPersist = currentScoreSoundEffectMapRef.current;
    scoreSoundEffectMapPersistInFlightRef.current = true;

    void (async () => {
      try {
        const response = await fetch(`/api/matches/${matchId}/announcer-settings`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scoreSoundEffectMap: mapToPersist,
          }),
        });

        if (!response.ok) {
          lastPersistedScoreSoundEffectMapRef.current = "";
          return;
        }

        lastPersistedScoreSoundEffectMapRef.current = requestSignature;
        if (currentScoreSoundEffectMapSignatureRef.current === requestSignature) {
          scoreSoundEffectMapDirtyRef.current = false;
        }
        didPersistLatestKnownValue = true;
      } catch {
        lastPersistedScoreSoundEffectMapRef.current = "";
      } finally {
        scoreSoundEffectMapPersistInFlightRef.current = false;
        if (
          didPersistLatestKnownValue &&
          lastPersistedScoreSoundEffectMapRef.current !==
            currentScoreSoundEffectMapSignatureRef.current
        ) {
          queueScoreSoundEffectMapSave();
        }
      }
    })();
  }, [
    authStatus,
    liveToolsReady,
    match?._id,
    matchId,
    scoreSoundEffectMapSignature,
    scoreSoundEffectMapSaveNonce,
    queueScoreSoundEffectMapSave,
  ]);

  const activeInningsKey = match?.innings === "second" ? "innings2" : "innings1";
  const oversHistory = Array.isArray(match?.[activeInningsKey]?.history)
    ? match[activeInningsKey].history
    : [];
  const currentOverNumber = Number(match?.activeOverNumber || oversHistory.at(-1)?.overNumber || 1);
  const firstInningsOversPlayed = Math.max(
    1,
    Math.ceil(Number(match?.firstInningsLegalBallCount || countLegalBalls(match?.innings1?.history ?? [])) / 6)
  );
  const {
    dismissVisibleStageCard,
    handleForceContinuePastSpeech,
    handleProtectedNextInningsOrEnd,
    pendingStageCardCountdownLabel,
    setStageContinuePrompt,
    showInningsEnd,
    showPendingMatchOverCountdown,
    showVisibleInningsEndCard,
    stageContinuePrompt,
  } = useMatchStageCardFlow({
    activeBoundarySequenceRef,
    activeSoundEffectCurrentTime,
    activeSoundEffectId,
    activeSoundEffectStatus,
    cancelBoundarySequence,
    deferredUmpireAnnouncementRef,
    endStageAnnouncementKeyRef,
    handleNextInningsOrEnd,
    isAnySoundEffectActive,
    match,
    matchId,
    pendingUmpireAnnouncementRef,
    queueOrSpeakUmpireSequence,
    router,
    soundEffectDurations,
    soundEffectPlayingRef,
    speakImmediateUmpireSequence,
    stageCardPlaybackBlockUntilRef,
    stageCardRevealVersionRef,
    status,
    umpireAnnouncementTimerRef,
    walkieAnnouncementPauseActiveRef,
  });

  const handleStageCardUndo = useCallback(async () => {
    if (
      stageCardUndoPending ||
      isScoreControlCoolingDown(UNDO_CONTROL_KEY)
    ) {
      return;
    }
    if (!match?.undoCount || !currentInningsHasHistory) {
      return;
    }

    armScoreControlCooldown(UNDO_CONTROL_KEY);
    setStageCardUndoPending(true);
    dismissVisibleStageCard();
    setStageContinuePrompt(null);
    cancelBoundarySequence({ stopEffect: true });
    clearAnnouncementDuck();
    clearSpeechEffectPlayerDuck();

    try {
      await handleUndo();
    } finally {
      setStageCardUndoPending(false);
    }
  }, [
    armScoreControlCooldown,
    cancelBoundarySequence,
    clearAnnouncementDuck,
    clearSpeechEffectPlayerDuck,
    currentInningsHasHistory,
    dismissVisibleStageCard,
    handleUndo,
    isScoreControlCoolingDown,
    match?.undoCount,
    stageCardUndoPending,
    setStageCardUndoPending,
    setStageContinuePrompt,
  ]);

  useEffect(() => {
    if (!showInningsEnd) {
      return;
    }

    setModal((current) =>
      current.type === ENTRY_SCORE_SOUND_EFFECTS_MODAL
        ? { type: null }
        : current,
    );
  }, [showInningsEnd]);

  const getEstimatedConfiguredScoreEffectDurationMs = useCallback(
    (effectId = "") => {
      const safeEffectId = String(effectId || "").trim();
      const durationSeconds = Number(soundEffectDurations?.[safeEffectId] || 0);

      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return Math.round(durationSeconds * 1000) + 250;
      }

      return 2200;
    },
    [soundEffectDurations],
  );

  useEffect(() => {
    void flushDeferredUmpireAnnouncement();
  }, [flushDeferredUmpireAnnouncement]);

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
  const controlsDisabled =
    showInningsEnd || Boolean(match.result) || Boolean(match.pendingResult) || tossPending;
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
      !umpireRemoteSpeakerState.isRemoteTalking
  );
  const canGridHoldMic = Boolean(isLiveMatch);

  return (
    <MatchPageLayout
      {...{
        activeSoundEffectCurrentTime,
        activeSoundEffectId,
        activeSoundEffectStatus,
        canGridHoldMic,
        canGridHoldWalkie,
        commentarySoundEffectOptions,
        contentStartRef,
        controlsDisabled,
        currentInningsHasHistory,
        currentOverNumber,
        entryScoreAnnouncementsEnabled,
        entryScoreSoundEffectsEnabled,
        error,
        firstInningsOversPlayed,
        handleAnnouncedPatchUpdate,
        handleAnnouncedScoreEvent,
        handleAnnouncedUndo,
        handleCommentaryReadScoreAction,
        handleCommentaryTestSequenceAction,
        handleCopyShareLink,
        handleEntryScoreSoundPromptSave,
        handleForceContinuePastSpeech,
        handleHeroMenuScroll,
        handleHeroReadScoreAction,
        handleMicHoldEnd,
        handleMicHoldStart,
        handlePlaySoundEffect,
        handlePreviewCommentarySoundEffect,
        handleProtectedNextInningsOrEnd,
        handleReorderSoundEffects,
        handleStageCardUndo,
        handleStopLiveSoundEffect,
        handleUmpirePressFeedback,
        handleWalkieHoldStart,
        historyStack,
        infoText,
        isLiveMatch,
        isReadScoreActionActive,
        isStageCardUndoPending:
          stageCardUndoPending ||
          isScoreControlCoolingDown(UNDO_CONTROL_KEY),
        isTestSequenceActionActive,
        isUndoCoolingDown: isScoreControlCoolingDown(UNDO_CONTROL_KEY),
        isUpdating,
        liveUpdatedLabel,
        loadSoundEffectsLibrary,
        match,
        micMonitor,
        modal,
        openModalWithFeedback,
        oversHistory,
        pendingStageCardCountdownLabel,
        pendingUmpireAnnouncementRef,
        previewingCommentarySoundEffectId,
        prime,
        replaceMatch,
        scoreControlDisabledKeys: scoreControlCooldowns,
        setEntryScoreAnnouncementsEnabled,
        setEntryScoreSoundEffectsEnabled,
        setInfoText,
        setModal,
        setSoundEffectsOpen,
        setStageContinuePrompt,
        showCompactUmpireWalkie,
        showPendingMatchOverCountdown,
        showVisibleInningsEndCard,
        soundEffectDurations,
        soundEffectError,
        soundEffectFiles,
        soundEffectLibraryStatus,
        soundEffectsAudioRef,
        soundEffectsNeedsUnlock,
        soundEffectsOpen,
        stageContinuePrompt,
        status,
        stop,
        speakWithAnnouncementDuck,
        toggleSoundEffectsPanel,
        umpireAnnouncementTimerRef,
        umpireRemoteSpeakerState,
        umpireSettings,
        updateUmpireScoreSoundSettings,
        updateUmpireSetting,
        voiceName,
        walkie,
      }}
    />
  );
}

