/**
 * File overview:
 * Purpose: Encapsulates Match browser state, effects, and runtime coordination.
 * Main exports: useMatchScoreSoundEffects.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useCallback, useEffect, useMemo } from "react";
import { buildCurrentScoreAnnouncement } from "../../../../lib/live-announcements";
import {
  getScoreSoundEffectMapSignature,
  getScoreSoundEffectEventKey,
  getScoreSoundEffectPreviewInput,
  normalizeScoreSoundEffectMap,
  RANDOM_SCORE_EFFECT_ID,
  SCORE_SOUND_EFFECT_KEYS,
  shouldHydrateScoreSoundEffectMapFromRemote,
} from "../../../../lib/score-sound-effects";
import {
  fetchCachedSoundEffectsLibrary,
  persistSoundEffectsOrder,
  readCachedSoundEffectsLibrary,
  readCachedSoundEffectsOrder,
  sortSoundEffectsByOrder,
  subscribeSoundEffectsLibrarySync,
  writeCachedSoundEffectsLibrary,
  writeCachedSoundEffectsOrder,
} from "../../../../lib/sound-effects-client";
import {
  buildFallbackSoundEffectFromId,
  createSoundEffectRequestId,
  ENTRY_SCORE_SOUND_EFFECTS_MODAL,
  estimateBoundaryLeadDelayMs,
  IPL_HORN_EFFECT,
  SCORE_PRE_EFFECT_RATE,
} from "../match-page-helpers";

export default function useMatchScoreSoundEffects({
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
  entryScoreSoundEffectsEnabled,
  entryScoreSoundPromptShownRef,
  failAnnouncementSoundEffectDuck,
  handleManualScoreAnnouncement,
  isAnySoundEffectActive,
  isLiveMatch,
  isLoading,
  lastHandledSoundEffectEventRef,
  lastPersistedScoreSoundEffectMapRef,
  lastSoundEffectTriggerRef,
  localSoundEffectRequestIdRef,
  match,
  matchId,
  playLocalSoundEffect,
  prime,
  readScoreActionEnabled = true,
  resumeUmpireAnnouncementsAfterSoundEffect,
  scheduleAnnouncementDuckRestore,
  scheduleSpeechEffectPlayerDuckRestore,
  scoreSoundEffectMapDirtyRef,
  selectedScoreSoundEffectIds,
  setActiveCommentaryAction,
  setActiveCommentaryPreviewId,
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
  triggerHapticFeedback,
  updateUmpireScoreSoundSettings,
  updateUmpireSetting,
  umpireSettings,
  warmKnownSoundEffects,
} = {}) {
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
    setActiveCommentaryAction,
    setActiveCommentaryPreviewId,
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

  const handleScoreFeedbackHoldStart = useCallback(() => {
    if (!match) {
      return;
    }

    ensureUmpireScoreFeedbackEnabled();
    void prime({ userGesture: true });
    handleManualScoreAnnouncement();
    void broadcastManualScoreAnnouncement();
  }, [
    broadcastManualScoreAnnouncement,
    ensureUmpireScoreFeedbackEnabled,
    handleManualScoreAnnouncement,
    match,
    prime,
  ]);

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
    setSoundEffectError,
    setSoundEffectFiles,
    setSoundEffectLibraryStatus,
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
    setModal,
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
  }, [setSoundEffectFiles, setSoundEffectLibraryStatus]);

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
  }, [
    currentScoreSoundEffectMapRef,
    currentScoreSoundEffectMapSignatureRef,
    lastPersistedScoreSoundEffectMapRef,
    matchId,
    scoreSoundEffectMapDirtyRef,
    updateUmpireSetting,
  ]);

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
    setEntryScoreSoundEffectsEnabled,
    setModal,
    tossPending,
    entryScoreSoundPromptShownRef,
  ]);

  const toggleSoundEffectsPanel = useCallback(() => {
    setSoundEffectsOpen((current) => {
      const nextOpen = !current;
      if (nextOpen && !soundEffectFiles.length) {
        void loadSoundEffectsLibrary();
      }
      return nextOpen;
    });
  }, [loadSoundEffectsLibrary, setSoundEffectsOpen, soundEffectFiles.length]);

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

      triggerHapticFeedback();
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
      lastSoundEffectTriggerRef,
      localSoundEffectRequestIdRef,
      match?._id,
      matchId,
      playLocalSoundEffect,
      resumeUmpireAnnouncementsAfterSoundEffect,
      setSoundEffectError,
      shouldResumeAfterSoundEffectRef,
      stopActiveSoundEffect,
      triggerHapticFeedback,
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
  }, [activeSoundEffectId, localSoundEffectRequestIdRef, matchId, stopActiveSoundEffect]);

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
      } = {},
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
      localSoundEffectRequestIdRef,
      match?._id,
      matchId,
      playLocalSoundEffect,
      resumeUmpireAnnouncementsAfterSoundEffect,
      setSoundEffectError,
      shouldResumeAfterSoundEffectRef,
    ],
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
          current === "event-preview" ? "" : current,
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
      setActiveCommentaryAction,
      setActiveCommentaryPreviewId,
      setSoundEffectError,
      shouldResumeAfterSoundEffectRef,
      stopCommentaryPlayback,
    ],
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
            window.setTimeout(resolve, estimateBoundaryLeadDelayMs(
              leadText,
              SCORE_PRE_EFFECT_RATE,
            ));
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
          },
        );
      }
    },
    [
      buildUmpireScorePreview,
      cancelBoundarySequence,
      handlePreviewCommentarySoundEffect,
      resolveConfiguredScoreSoundEffect,
      setActiveCommentaryAction,
      soundEffectDurations,
      speakSequenceWithAnnouncementDuck,
      speakWithAnnouncementDuck,
      umpireSettings.enabled,
      umpireSettings.mode,
      umpireSettings.playScoreSoundEffects,
    ],
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
    setActiveCommentaryAction,
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
  }, [setSoundEffectFiles]);

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
        liveEvent.resumeAnnouncements,
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
      liveEvent.resumeAnnouncements,
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
    lastHandledSoundEffectEventRef,
    localSoundEffectRequestIdRef,
    match?.lastLiveEvent,
    playLocalSoundEffect,
    resumeUmpireAnnouncementsAfterSoundEffect,
    shouldResumeAfterSoundEffectRef,
    soundEffectPlaybackCutoffRef,
    stop,
    stopActiveSoundEffect,
  ]);

  return {
    commentarySoundEffectOptions,
    handleCommentaryReadScoreAction,
    handleCommentaryTestSequenceAction,
    handleEntryScoreSoundPromptSave,
    handleHeroReadScoreAction,
    handlePlaySoundEffect,
    handlePreviewCommentarySoundEffect,
    handleReorderSoundEffects,
    handleScoreFeedbackHoldStart,
    handleStopLiveSoundEffect,
    handleTestCommentarySequence,
    hydrateRemoteScoreSoundEffectMap,
    isReadScoreActionActive,
    isTestSequenceActionActive,
    loadSoundEffectsLibrary,
    previewingCommentarySoundEffectId,
    resolveConfiguredScoreSoundEffect,
    stopCommentaryPlayback,
    toggleSoundEffectsPanel,
    triggerSharedSoundEffect,
  };
}


