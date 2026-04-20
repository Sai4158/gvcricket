/**
 * File overview:
 * Purpose: Encapsulates Match browser state, effects, and runtime coordination.
 * Main exports: useMatchStageCardFlow.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

/* eslint-disable react-hooks/refs */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildUmpireSecondInningsStartSequence,
  buildUmpireStageAnnouncement,
} from "../../../../lib/live-announcements";
import {
  estimateSpeechSequenceDelayMs,
  getMatchEndStageState,
  STAGE_CARD_REVEAL_TIMEOUT_MS,
} from "../match-page-helpers";

export default function useMatchStageCardFlow({
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
} = {}) {
  const MIN_STAGE_CARD_CONFIRM_DELAY_MS = 450;
  const [stageContinuePrompt, setStageContinuePrompt] = useState(null);
  const [initialStageState] = useState(() =>
    getMatchEndStageState(match, matchId),
  );
  const [visibleStageCardKey, setVisibleStageCardKey] = useState(
    initialStageState.key,
  );
  const [dismissedStageCardKey, setDismissedStageCardKey] = useState("");
  const [stageCardRevealDeadlineMs, setStageCardRevealDeadlineMs] = useState(null);
  const [stageCardCountdownNow, setStageCardCountdownNow] = useState(() =>
    Date.now(),
  );
  const stageCardVisibleAtRef = useRef(0);

  const {
    showInningsEnd,
    key: stageCardKey,
  } = getMatchEndStageState(match, matchId);
  const displayResult = String(match?.pendingResult || match?.result || "").trim();
  const isStageCardDismissed = Boolean(
    showInningsEnd && stageCardKey && dismissedStageCardKey === stageCardKey,
  );
  const showVisibleInningsEndCard = Boolean(
    showInningsEnd && !isStageCardDismissed && visibleStageCardKey === stageCardKey,
  );
  const showPendingMatchOverCountdown = Boolean(
    displayResult &&
      showInningsEnd &&
      !isStageCardDismissed &&
      !showVisibleInningsEndCard,
  );

  const getRemainingActiveSoundEffectMs = useCallback(() => {
      if (!isAnySoundEffectActive) {
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
    },
    [
      activeSoundEffectCurrentTime,
      activeSoundEffectId,
      activeSoundEffectStatus,
      isAnySoundEffectActive,
      soundEffectDurations,
    ],
  );

  const estimateStageCardRevealDelayMs = useCallback(() => {
      const remainingSoundEffectMs = getRemainingActiveSoundEffectMs();
      const shortRevealDelayMs = displayResult ? 260 : 200;
      const soundEffectDelayMs =
        remainingSoundEffectMs > 0
          ? Math.min(420, Math.max(160, remainingSoundEffectMs))
          : 0;

      return Math.min(
        STAGE_CARD_REVEAL_TIMEOUT_MS,
        Math.max(shortRevealDelayMs, soundEffectDelayMs),
      );
    },
    [displayResult, getRemainingActiveSoundEffectMs],
  );

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
    stageCardPlaybackBlockUntilRef,
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
              isAnySoundEffectActive,
          );

          if (!isBusy || Date.now() - startedAt >= timeoutMs) {
            resolve();
            return;
          }

          window.setTimeout(poll, 80);
        };

        poll();
      }),
    [
      activeBoundarySequenceRef,
      deferredUmpireAnnouncementRef,
      isAnySoundEffectActive,
      pendingUmpireAnnouncementRef,
      soundEffectPlayingRef,
      status,
      umpireAnnouncementTimerRef,
      walkieAnnouncementPauseActiveRef,
    ],
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
    [
      activeBoundarySequenceRef,
      deferredUmpireAnnouncementRef,
      isAnySoundEffectActive,
      pendingUmpireAnnouncementRef,
      soundEffectPlayingRef,
      status,
      umpireAnnouncementTimerRef,
      walkieAnnouncementPauseActiveRef,
    ],
  );

  useEffect(() => {
    if (!stageCardKey) {
      if (dismissedStageCardKey) {
        setDismissedStageCardKey("");
      }
      return;
    }

    if (dismissedStageCardKey && dismissedStageCardKey !== stageCardKey) {
      setDismissedStageCardKey("");
    }
  }, [dismissedStageCardKey, stageCardKey]);

  useEffect(() => {
    stageCardRevealVersionRef.current += 1;
    const revealVersion = stageCardRevealVersionRef.current;

    if (!showInningsEnd || !stageCardKey) {
      stageCardPlaybackBlockUntilRef.current = 0;
      setStageCardRevealDeadlineMs(null);
      setVisibleStageCardKey("");
      stageCardVisibleAtRef.current = 0;
      return;
    }

    if (isStageCardDismissed) {
      stageCardPlaybackBlockUntilRef.current = 0;
      setStageCardRevealDeadlineMs(null);
      setVisibleStageCardKey("");
      stageCardVisibleAtRef.current = 0;
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
        isAnySoundEffectActive,
    );

    if (!hasPlaybackInFlight) {
      stageCardPlaybackBlockUntilRef.current = 0;
      setStageCardRevealDeadlineMs(null);
      stageCardVisibleAtRef.current = Date.now();
      setVisibleStageCardKey(stageCardKey);
      return;
    }

    setStageCardRevealDeadlineMs(Date.now() + estimateStageCardRevealDelayMs());

    const revealDelayMs = estimateStageCardRevealDelayMs();
    const timerId = window.setTimeout(() => {
      if (stageCardRevealVersionRef.current !== revealVersion) {
        return;
      }
      stageCardPlaybackBlockUntilRef.current = 0;
      setStageCardRevealDeadlineMs(null);
      stageCardVisibleAtRef.current = Date.now();
      setVisibleStageCardKey(stageCardKey);
    }, revealDelayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    activeBoundarySequenceRef,
    deferredUmpireAnnouncementRef,
    estimateStageCardRevealDelayMs,
    isAnySoundEffectActive,
    pendingUmpireAnnouncementRef,
    showInningsEnd,
    isStageCardDismissed,
    soundEffectPlayingRef,
    stageCardKey,
    stageCardPlaybackBlockUntilRef,
    stageCardRevealVersionRef,
    status,
    umpireAnnouncementTimerRef,
    visibleStageCardKey,
    walkieAnnouncementPauseActiveRef,
  ]);

  const dismissVisibleStageCard = useCallback(() => {
    if (!stageCardKey) {
      return;
    }

    stageCardPlaybackBlockUntilRef.current = 0;
    stageCardVisibleAtRef.current = 0;
    setStageCardRevealDeadlineMs(null);
    setVisibleStageCardKey("");
    setDismissedStageCardKey(stageCardKey);
  }, [stageCardKey, stageCardPlaybackBlockUntilRef]);

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
  }, [hasPendingStageContinueSpeech, stageContinuePrompt]);

  useEffect(() => {
    if (!showVisibleInningsEndCard || !displayResult) {
      if (!showVisibleInningsEndCard) {
        endStageAnnouncementKeyRef.current = "";
      }
      return;
    }

    const text = buildUmpireStageAnnouncement(match);
    if (!text) {
      return;
    }

    const nextKey = displayResult
      ? `result:${match._id || matchId}:${displayResult}`
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
    endStageAnnouncementKeyRef,
    displayResult,
    match,
    matchId,
    queueOrSpeakUmpireSequence,
    showVisibleInningsEndCard,
  ]);

  const handleAnnouncedNextInningsOrEnd = useCallback(
    async ({ force = false } = {}) => {
      setStageContinuePrompt(null);

      if (force) {
        cancelBoundarySequence({ stopEffect: true });
      }

      if (match?.result && !match?.pendingResult && !match?.isOngoing) {
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
            isAnySoundEffectActive,
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
        match && match.innings === "first" && !match.result && showInningsEnd,
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
    },
    [
      cancelBoundarySequence,
      activeBoundarySequenceRef,
      deferredUmpireAnnouncementRef,
      handleNextInningsOrEnd,
      isAnySoundEffectActive,
      match,
      matchId,
      pendingUmpireAnnouncementRef,
      queueOrSpeakUmpireSequence,
      router,
      showInningsEnd,
      soundEffectPlayingRef,
      speakImmediateUmpireSequence,
      status,
      umpireAnnouncementTimerRef,
      waitForUmpirePlaybackToSettle,
      walkieAnnouncementPauseActiveRef,
    ],
  );

  const handleProtectedNextInningsOrEnd = useCallback(async () => {
    if (
      showVisibleInningsEndCard &&
      stageCardVisibleAtRef.current > 0 &&
      Date.now() - stageCardVisibleAtRef.current <
        MIN_STAGE_CARD_CONFIRM_DELAY_MS
    ) {
      return null;
    }

    if (hasPendingStageContinueSpeech()) {
      setStageContinuePrompt({
        mode:
          (match?.pendingResult || (match?.result && !match?.isOngoing))
            ? "result"
            : "innings",
      });
      return null;
    }

    return handleAnnouncedNextInningsOrEnd();
  }, [
    handleAnnouncedNextInningsOrEnd,
    hasPendingStageContinueSpeech,
    match?.isOngoing,
    match?.pendingResult,
    match?.result,
    showVisibleInningsEndCard,
  ]);

  useEffect(() => {
    if (!matchId || !match?.pendingResult || !match?.resultAutoFinalizeAt) {
      return undefined;
    }

    const autoFinalizeAtMs = Date.parse(String(match.resultAutoFinalizeAt || ""));
    if (!Number.isFinite(autoFinalizeAtMs)) {
      return undefined;
    }

    const delayMs = autoFinalizeAtMs - Date.now();
    if (delayMs <= 0) {
      router.push(`/result/${matchId}`);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      router.push(`/result/${matchId}`);
    }, delayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [match?.pendingResult, match?.resultAutoFinalizeAt, matchId, router]);

  const handleForceContinuePastSpeech = useCallback(async () => {
    return handleAnnouncedNextInningsOrEnd({ force: true });
  }, [handleAnnouncedNextInningsOrEnd]);

  return {
    handleForceContinuePastSpeech,
    handleProtectedNextInningsOrEnd,
    pendingStageCardCountdownLabel,
    setStageContinuePrompt,
    showInningsEnd,
    showPendingMatchOverCountdown,
    showVisibleInningsEndCard,
    stageContinuePrompt,
    dismissVisibleStageCard,
    waitForUmpirePlaybackToSettle,
    hasPendingStageContinueSpeech,
  };
}


