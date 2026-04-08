"use client";


/**
 * File overview:
 * Purpose: UI component for Match screens and flows.
 * Main exports: MatchPageClient.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
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
import { applyMatchAction } from "../../../lib/match-engine";
import { duckPageMedia, restorePageMedia } from "../../../lib/page-audio";

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
  const [stageContinuePrompt, setStageContinuePrompt] = useState(null);
  const initialStageStateRef = useRef(
    getMatchEndStageState(initialMatch, matchId),
  );
  const [visibleStageCardKey, setVisibleStageCardKey] = useState(
    initialStageStateRef.current.key,
  );
  const [stageCardRevealDeadlineMs, setStageCardRevealDeadlineMs] = useState(null);
  const [stageCardCountdownNow, setStageCardCountdownNow] = useState(() =>
    Date.now(),
  );
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
  const [entryScoreSoundEffectsEnabled, setEntryScoreSoundEffectsEnabled] =
    useState(true);
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
    return () => {
      isMountedRef.current = false;
    };
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

    setEntryScoreSoundEffectsEnabled(true);
  }, [modal.type]);
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

  const buildUmpireScorePreview = useCallback((runs, isOut = false, extraType = null) => {
    if (!match) {
      return {
        nextMatch: match,
        event: null,
        sequence: { items: [], priority: 2 },
        leadItem: null,
        followUpItems: [],
        endsFirstInnings: false,
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
    const nextInningsHistory = nextMatch?.innings1?.history ?? [];
    const nextLegalBalls = countLegalBalls(nextInningsHistory);
    const nextOversDone =
      nextMatch?.innings === "first" &&
      nextLegalBalls >= Number(nextMatch?.overs || 0) * 6;
    const nextMaxWickets = getTotalDismissalsAllowed(nextMatch || match);
    const nextAllOut =
      nextMatch?.innings === "first" &&
      nextMaxWickets > 0 &&
      Number(nextMatch?.outs || 0) >= nextMaxWickets;
    const endsFirstInnings = Boolean(
      nextMatch?.innings === "first" &&
        !nextMatch?.result &&
        (nextOversDone || nextAllOut)
    );

    let sequence = {
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

    if (endsFirstInnings) {
      const inningsStageText =
        buildUmpireStageAnnouncement(nextMatch || match) ||
        "First innings complete.";
      const inningsCompleteItem = {
        text: inningsStageText,
        pauseAfterMs: 0,
        rate: 0.79,
      };

      sequence = {
        ...sequence,
        items: sequence.items?.length
          ? [sequence.items[0], inningsCompleteItem]
          : [inningsCompleteItem],
        priority: 4,
        restoreAfterMs: 2200,
      };
    }

    const leadItem = sequence.items?.[0] || null;
    const followUpItems = sequence.items?.slice(1) || [];

    if (!followUpItems.length && !endsFirstInnings) {
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
      endsFirstInnings,
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
    extraType = null
  ) => {
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
    const configuredScoreEffect =
      shouldPlayLocalScoreEffect || shouldBroadcastScoreEffect
        ? await resolveConfiguredScoreSoundEffect(runs, isOut, extraType)
        : null;

    if (configuredScoreEffect) {
      if (shouldPlayLocalScoreEffect) {
        void primeLocalSoundEffects({ userGesture: true });
      }

      if (!shouldPlayLocalScoreEffect && shouldBroadcastScoreEffect) {
        handleScoreEvent(runs, isOut, extraType, {
          actionId: scoreActionId,
        });
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
      handleScoreEvent(runs, isOut, extraType, {
        actionId: scoreActionId,
      });

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
    handleScoreEvent(runs, isOut, extraType, {
      actionId: scoreActionId,
    });
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
    scheduleSpeechEffectPlayerDuckRestore(120);
    setActiveCommentaryPreviewId("");
    setActiveCommentaryAction("");
  }, [
    cancelBoundarySequence,
    scheduleAnnouncementDuckRestore,
    scheduleSpeechEffectPlayerDuckRestore,
    stop,
  ]);

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

  const handleEntryScoreSoundPromptSave = useCallback(() => {
    updateUmpireScoreSoundSettings(
      "playScoreSoundEffects",
      entryScoreSoundEffectsEnabled,
    );
    if (entryScoreSoundEffectsEnabled) {
      void loadSoundEffectsLibrary({ silent: true });
    }
    setModal((current) =>
      current.type === ENTRY_SCORE_SOUND_EFFECTS_MODAL
        ? { type: null }
        : current,
    );
  }, [
    entryScoreSoundEffectsEnabled,
    loadSoundEffectsLibrary,
    updateUmpireScoreSoundSettings,
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

  const hydrateRemoteScoreSoundEffectMap = useCallback(async () => {
    if (!matchId) {
      return normalizeScoreSoundEffectMap(
        currentScoreSoundEffectMapRef.current || {},
      );
    }

    try {
      const response = await fetch(`/api/matches/${matchId}/announcer-settings`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json().catch(() => null);
      const remoteScoreSoundEffectMap = normalizeScoreSoundEffectMap(
        payload?.scoreSoundEffectMap || {},
      );
      const remoteSignature =
        getScoreSoundEffectMapSignature(remoteScoreSoundEffectMap);

      lastPersistedScoreSoundEffectMapRef.current = remoteSignature;
      if (
        scoreSoundEffectMapDirtyRef.current &&
        remoteSignature === currentScoreSoundEffectMapSignatureRef.current
      ) {
        scoreSoundEffectMapDirtyRef.current = false;
      } else if (
        shouldHydrateScoreSoundEffectMapFromRemote(
          remoteScoreSoundEffectMap,
          currentScoreSoundEffectMapSignatureRef.current,
          scoreSoundEffectMapDirtyRef.current,
        )
      ) {
        updateUmpireSetting("scoreSoundEffectMap", remoteScoreSoundEffectMap);
      }

      return remoteScoreSoundEffectMap;
    } catch {
      return null;
    }
  }, [matchId, updateUmpireSetting]);

  const resolveConfiguredScoreSoundEffect = useCallback(
    async (runs, isOut = false, extraType = null) => {
      let configuredMap = umpireSettings.scoreSoundEffectMap || {};
      let nextEffect = findConfiguredScoreSoundEffectFromMap(
        configuredMap,
        runs,
        isOut,
        extraType,
      );
      if (nextEffect) {
        return nextEffect;
      }

      const effectKey = getScoreSoundEffectEventKey(runs, isOut, extraType);
      if (!effectKey) {
        return null;
      }

      let configuredEffectId = String(configuredMap?.[effectKey] || "").trim();
      if (!configuredEffectId && authStatus === "granted") {
        const remoteScoreSoundEffectMap =
          await hydrateRemoteScoreSoundEffectMap();
        if (remoteScoreSoundEffectMap) {
          configuredMap = remoteScoreSoundEffectMap;
          configuredEffectId = String(
            remoteScoreSoundEffectMap?.[effectKey] || "",
          ).trim();
          nextEffect = findConfiguredScoreSoundEffectFromMap(
            configuredMap,
            runs,
            isOut,
            extraType,
          );
          if (nextEffect) {
            return nextEffect;
          }
        }
      }

      if (!configuredEffectId) {
        return null;
      }

      if (
        configuredEffectId === RANDOM_SCORE_EFFECT_ID ||
        !soundEffectFiles.length
      ) {
        try {
          await loadSoundEffectsLibrary({ silent: true });
        } catch {
          // Fall back to the direct file source below if library warm-up fails.
        }
        nextEffect = findConfiguredScoreSoundEffectFromMap(
          configuredMap,
          runs,
          isOut,
          extraType,
        );
        if (nextEffect) {
          return nextEffect;
        }
      }

      return configuredEffectId === IPL_HORN_EFFECT.id
        ? IPL_HORN_EFFECT
        : buildFallbackSoundEffectFromId(configuredEffectId);
    },
    [
      authStatus,
      findConfiguredScoreSoundEffectFromMap,
      hydrateRemoteScoreSoundEffectMap,
      loadSoundEffectsLibrary,
      soundEffectFiles.length,
      umpireSettings.scoreSoundEffectMap,
    ],
  );

  useEffect(() => {
    if (!soundEffectFiles.length) {
      return;
    }

    warmKnownSoundEffects(soundEffectFiles);
  }, [soundEffectFiles, warmKnownSoundEffects]);

  useEffect(() => {
    if (
      authStatus !== "granted" ||
      umpireSettings.playScoreSoundEffects === false ||
      !selectedScoreSoundEffectIds.length
    ) {
      return;
    }

    void loadSoundEffectsLibrary({ silent: true });
  }, [
    authStatus,
    loadSoundEffectsLibrary,
    selectedScoreSoundEffectIds,
    umpireSettings.playScoreSoundEffects,
  ]);

  useEffect(() => {
    if (
      entryScoreSoundPromptShownRef.current ||
      authStatus !== "granted" ||
      isLoading ||
      !match?._id ||
      !isLiveMatch ||
      tossPending
    ) {
      return;
    }

    entryScoreSoundPromptShownRef.current = true;
    setEntryScoreSoundEffectsEnabled(true);
    setModal({ type: ENTRY_SCORE_SOUND_EFFECTS_MODAL });
  }, [
    authStatus,
    isLiveMatch,
    isLoading,
    match?._id,
    tossPending,
  ]);

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
      beginAnnouncementSoundEffectDuck();

      const clientRequestId = createSoundEffectRequestId();
      const playedLocally = await playLocalSoundEffect(file, {
        userGesture: true,
      });
      if (!playedLocally) {
        failAnnouncementSoundEffectDuck();
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
      beginAnnouncementSoundEffectDuck,
      failAnnouncementSoundEffectDuck,
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
      beginAnnouncementSoundEffectDuck();
      const played = await playLocalSoundEffect(file, { userGesture: true });
      if (!played) {
        failAnnouncementSoundEffectDuck();
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
      beginAnnouncementSoundEffectDuck,
      cancelBoundarySequence,
      failAnnouncementSoundEffectDuck,
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

    if (micMonitor.isPaused) {
      await micMonitor.resume({ pauseMedia: true });
      return;
    }

    if (!micMonitor.isActive) {
      await micMonitor.start({
        pauseMedia: true,
        startPaused: false,
        playStartCue: false,
      });
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

  useEffect(() => {
    if (authStatus !== "granted" || !match?._id) {
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
    match?._id,
    matchId,
    queueScoreSoundEffectMapSave,
  ]);

  useEffect(() => {
    if (
      authStatus !== "granted" ||
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
    match?._id,
    matchId,
    scoreSoundEffectMapSignature,
    scoreSoundEffectMapSaveNonce,
    queueScoreSoundEffectMapSave,
  ]);

  const activeInningsKey = match?.innings === "second" ? "innings2" : "innings1";
  const oversHistory = match?.[activeInningsKey]?.history ?? [];
  const currentOverNumber = oversHistory.at(-1)?.overNumber ?? 1;
  const firstInningsOversPlayed = Math.max(
    1,
    Math.ceil(countLegalBalls(match?.innings1?.history ?? []) / 6)
  );
  const {
    showInningsEnd,
    key: stageCardKey,
  } = getMatchEndStageState(match, matchId);
  const showVisibleInningsEndCard = Boolean(
    showInningsEnd && visibleStageCardKey === stageCardKey,
  );
  const showPendingMatchOverCountdown = Boolean(
    match?.result && showInningsEnd && !showVisibleInningsEndCard,
  );

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

  const getRemainingActiveSoundEffectMs = useCallback(() => {
    if (!(soundEffectPlayingRef.current || isAnySoundEffectActive)) {
      return 0;
    }

    const effectId = String(activeSoundEffectId || "").trim();
    const durationSeconds = Number(soundEffectDurations?.[effectId] || 0);
    const currentTimeSeconds = Number(activeSoundEffectCurrentTime || 0);

    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      return Math.max(
        0,
        Math.round((durationSeconds - currentTimeSeconds) * 1000) + 250,
      );
    }

    return activeSoundEffectStatus === "loading" ? 2400 : 2200;
  }, [
    activeSoundEffectCurrentTime,
    activeSoundEffectId,
    activeSoundEffectStatus,
    isAnySoundEffectActive,
    soundEffectDurations,
  ]);

  const estimateStageCardRevealDelayMs = useCallback(() => {
    let estimateMs = Math.max(
      0,
      stageCardPlaybackBlockUntilRef.current - Date.now(),
    );
    const remainingSoundEffectMs = getRemainingActiveSoundEffectMs();

    if (pendingUmpireAnnouncementRef.current?.items?.length) {
      estimateMs = Math.max(
        estimateMs,
        estimateSpeechSequenceDelayMs(pendingUmpireAnnouncementRef.current.items),
      );
    }
    if (deferredUmpireAnnouncementRef.current?.items?.length) {
      estimateMs = Math.max(
        estimateMs,
        estimateSpeechSequenceDelayMs(deferredUmpireAnnouncementRef.current.items),
      );
    }
    if (status === "speaking") {
      estimateMs = Math.max(estimateMs, 2600);
    }
    if (umpireAnnouncementTimerRef.current) {
      estimateMs = Math.max(estimateMs, 1800);
    }
    if (activeBoundarySequenceRef.current) {
      estimateMs = Math.max(estimateMs, 2800);
    }
    if (remainingSoundEffectMs > 0) {
      estimateMs = Math.max(estimateMs, remainingSoundEffectMs);
    }
    if (walkieAnnouncementPauseActiveRef.current) {
      estimateMs = Math.max(estimateMs, 3200);
    }

    return Math.max(
      1800,
      Math.min(STAGE_CARD_REVEAL_TIMEOUT_MS, estimateMs || 2200),
    );
  }, [getRemainingActiveSoundEffectMs, status]);

  const pendingStageCardEffectiveDeadlineMs = useMemo(() => {
    if (!showPendingMatchOverCountdown) {
      return null;
    }

    const playbackBlockUntilMs =
      stageCardPlaybackBlockUntilRef.current > stageCardCountdownNow
        ? stageCardPlaybackBlockUntilRef.current
        : 0;
    const revealDeadlineMs = Number.isFinite(stageCardRevealDeadlineMs)
      ? Number(stageCardRevealDeadlineMs)
      : 0;
    const nextDeadlineMs = Math.max(revealDeadlineMs, playbackBlockUntilMs);

    return nextDeadlineMs > 0 ? nextDeadlineMs : null;
  }, [
    showPendingMatchOverCountdown,
    stageCardCountdownNow,
    stageCardRevealDeadlineMs,
  ]);

  const pendingStageCardCountdownLabel = useMemo(() => {
    if (!showPendingMatchOverCountdown || !pendingStageCardEffectiveDeadlineMs) {
      return "";
    }

    const msRemaining =
      pendingStageCardEffectiveDeadlineMs - stageCardCountdownNow;
    if (msRemaining <= 500) {
      return "Results card opening...";
    }

    const secondsRemaining = Math.max(1, Math.ceil(msRemaining / 1000));
    return `Results card in about ${secondsRemaining}s`;
  }, [
    pendingStageCardEffectiveDeadlineMs,
    showPendingMatchOverCountdown,
    stageCardCountdownNow,
  ]);

  const waitForUmpirePlaybackToSettle = useCallback(
    (timeoutMs = 5000) =>
      new Promise((resolve) => {
        const startedAt = Date.now();

        const poll = () => {
          const isBusy = Boolean(
            walkieAnnouncementPauseActiveRef.current ||
              soundEffectPlayingRef.current ||
              activeBoundarySequenceRef.current ||
              umpireAnnouncementTimerRef.current ||
              pendingUmpireAnnouncementRef.current?.items?.length ||
              deferredUmpireAnnouncementRef.current?.items?.length ||
              status === "speaking" ||
              isAnySoundEffectActive
          );

          if (!isBusy || Date.now() - startedAt >= timeoutMs) {
            resolve();
            return;
          }

          window.setTimeout(poll, 80);
        };

        poll();
      }),
    [isAnySoundEffectActive, status],
  );

  const hasPendingStageContinueSpeech = useCallback(
    () =>
      Boolean(
        walkieAnnouncementPauseActiveRef.current ||
          soundEffectPlayingRef.current ||
          activeBoundarySequenceRef.current ||
          umpireAnnouncementTimerRef.current ||
          pendingUmpireAnnouncementRef.current?.items?.length ||
          deferredUmpireAnnouncementRef.current?.items?.length ||
          status === "speaking" ||
          isAnySoundEffectActive,
      ),
    [isAnySoundEffectActive, status],
  );

  useEffect(() => {
    stageCardRevealVersionRef.current += 1;
    const revealVersion = stageCardRevealVersionRef.current;

    if (!showInningsEnd || !stageCardKey) {
      stageCardPlaybackBlockUntilRef.current = 0;
      setStageCardRevealDeadlineMs(null);
      setVisibleStageCardKey("");
      return;
    }

    if (visibleStageCardKey === stageCardKey) {
      stageCardPlaybackBlockUntilRef.current = 0;
      setStageCardRevealDeadlineMs(null);
      return;
    }

    const hasPlaybackInFlight = Boolean(
      walkieAnnouncementPauseActiveRef.current ||
        soundEffectPlayingRef.current ||
        activeBoundarySequenceRef.current ||
        umpireAnnouncementTimerRef.current ||
        pendingUmpireAnnouncementRef.current?.items?.length ||
        deferredUmpireAnnouncementRef.current?.items?.length ||
        status === "speaking" ||
        isAnySoundEffectActive
    );

    if (!hasPlaybackInFlight) {
      stageCardPlaybackBlockUntilRef.current = 0;
      setStageCardRevealDeadlineMs(null);
      setVisibleStageCardKey(stageCardKey);
      return;
    }

    setStageCardRevealDeadlineMs(Date.now() + estimateStageCardRevealDelayMs());

    void (async () => {
      await waitForUmpirePlaybackToSettle(STAGE_CARD_REVEAL_TIMEOUT_MS);
      if (stageCardRevealVersionRef.current !== revealVersion) {
        return;
      }
      stageCardPlaybackBlockUntilRef.current = 0;
      setStageCardRevealDeadlineMs(null);
      setVisibleStageCardKey(stageCardKey);
    })();
  }, [
    estimateStageCardRevealDelayMs,
    isAnySoundEffectActive,
    showInningsEnd,
    stageCardKey,
    status,
    visibleStageCardKey,
    waitForUmpirePlaybackToSettle,
  ]);

  useEffect(() => {
    if (!showPendingMatchOverCountdown || !pendingStageCardEffectiveDeadlineMs) {
      return undefined;
    }

    setStageCardCountdownNow(Date.now());
    const countdownTimer = window.setInterval(() => {
      setStageCardCountdownNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(countdownTimer);
    };
  }, [pendingStageCardEffectiveDeadlineMs, showPendingMatchOverCountdown]);

  useEffect(() => {
    if (stageContinuePrompt && !hasPendingStageContinueSpeech()) {
      setStageContinuePrompt(null);
    }
  }, [hasPendingStageContinueSpeech, isAnySoundEffectActive, stageContinuePrompt, status]);

  useEffect(() => {
    if (!showVisibleInningsEndCard || !match?.result) {
      if (!showVisibleInningsEndCard) {
        endStageAnnouncementKeyRef.current = "";
      }
      return;
    }

    const text = buildUmpireStageAnnouncement(match);
    if (!text) {
      return;
    }

    const nextKey = match.result
      ? `result:${match._id || matchId}:${match.result}`
      : `innings:${match._id || matchId}:${match?.innings1?.score ?? match.score}:${match?.innings1?.outs ?? match.outs}`;

    if (endStageAnnouncementKeyRef.current === nextKey) {
      return;
    }

    endStageAnnouncementKeyRef.current = nextKey;
    const stageSequence = {
      items: [
        {
          text,
          pauseAfterMs: 0,
          rate: 0.82,
        },
      ],
      priority: 4,
    };
    queueOrSpeakUmpireSequence(stageSequence, "umpire-match-over-modal");
  }, [
    match,
    matchId,
    queueOrSpeakUmpireSequence,
    showVisibleInningsEndCard,
  ]);

  useEffect(() => {
    void flushDeferredUmpireAnnouncement();
  }, [flushDeferredUmpireAnnouncement]);

  const handleAnnouncedNextInningsOrEnd = useCallback(async (options = {}) => {
    const force = Boolean(options?.force);
    setStageContinuePrompt(null);

    if (force) {
      cancelBoundarySequence({ stopEffect: true });
    }

    if (match?.result && !match?.isOngoing) {
      const matchOverText = buildUmpireStageAnnouncement(match);
      const matchOverSequence = {
        items: matchOverText
          ? [
              {
                text: matchOverText,
                pauseAfterMs: 0,
                rate: 0.82,
              },
            ]
          : [],
        priority: 4,
      };
      const hasAnnouncementInFlight = Boolean(
        walkieAnnouncementPauseActiveRef.current ||
          soundEffectPlayingRef.current ||
          activeBoundarySequenceRef.current ||
          umpireAnnouncementTimerRef.current ||
          pendingUmpireAnnouncementRef.current?.items?.length ||
          deferredUmpireAnnouncementRef.current?.items?.length ||
          status === "speaking" ||
          isAnySoundEffectActive
      );

      if (hasAnnouncementInFlight && !force) {
        await waitForUmpirePlaybackToSettle(
          estimateSpeechSequenceDelayMs(matchOverSequence.items),
        );
      }

      router.push(`/result/${matchId}`);
      return match;
    }

    const shouldAnnounceSecondInningsStart = Boolean(
      match &&
        match.innings === "first" &&
        !match.result &&
        showInningsEnd
    );

    const updatedMatch = await handleNextInningsOrEnd();

    if (
      !shouldAnnounceSecondInningsStart ||
      !updatedMatch ||
      updatedMatch.result ||
      updatedMatch.innings !== "second"
    ) {
      return updatedMatch;
    }

    const secondInningsSequence =
      buildUmpireSecondInningsStartSequence(updatedMatch);

    if (force) {
      speakImmediateUmpireSequence(
        secondInningsSequence,
        "umpire-second-innings-start",
      );
    } else {
      queueOrSpeakUmpireSequence(
        secondInningsSequence,
        "umpire-second-innings-start",
      );
    }
    return updatedMatch;
  }, [
    cancelBoundarySequence,
    isAnySoundEffectActive,
    handleNextInningsOrEnd,
    match,
    matchId,
    speakImmediateUmpireSequence,
    queueOrSpeakUmpireSequence,
    router,
    showInningsEnd,
    status,
    waitForUmpirePlaybackToSettle,
  ]);

  const handleProtectedNextInningsOrEnd = useCallback(async () => {
    if (hasPendingStageContinueSpeech()) {
      setStageContinuePrompt({
        mode: match?.result && !match?.isOngoing ? "result" : "innings",
      });
      return null;
    }

    return handleAnnouncedNextInningsOrEnd();
  }, [
    handleAnnouncedNextInningsOrEnd,
    hasPendingStageContinueSpeech,
    match?.isOngoing,
    match?.result,
  ]);

  const handleForceContinuePastSpeech = useCallback(async () => {
    return handleAnnouncedNextInningsOrEnd({ force: true });
  }, [handleAnnouncedNextInningsOrEnd]);

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
      !umpireRemoteSpeakerState.isRemoteTalking
  );
  const canGridHoldMic = Boolean(
    isLiveMatch && (micMonitor.isActive || micMonitor.isPaused)
  );

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
        handleScoreFeedbackHoldStart,
        handleStopLiveSoundEffect,
        handleUmpirePressFeedback,
        handleWalkieHoldStart,
        historyStack,
        infoText,
        isLiveMatch,
        isReadScoreActionActive,
        isTestSequenceActionActive,
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
