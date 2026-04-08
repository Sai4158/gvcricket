/**
 * File overview:
 * Purpose: Match-stage countdown and continue-flow logic for innings transitions and result cards.
 * Main exports: useMatchStageCardFlow.
 * Major callers: MatchPageScreen.
 * Side effects: delays result-card reveal until commentary or effects settle and navigates to results.
 * Read next: ../MatchPageScreen.jsx
 */

/* eslint-disable react-hooks/refs */

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [stageContinuePrompt, setStageContinuePrompt] = useState(null);
  const [initialStageState] = useState(() =>
    getMatchEndStageState(match, matchId),
  );
  const [visibleStageCardKey, setVisibleStageCardKey] = useState(
    initialStageState.key,
  );
  const [stageCardRevealDeadlineMs, setStageCardRevealDeadlineMs] = useState(null);
  const [stageCardCountdownNow, setStageCardCountdownNow] = useState(() =>
    Date.now(),
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
      if (walkieAnnouncementPauseActiveRef.current || soundEffectPlayingRef.current) {
        estimateMs = Math.max(estimateMs, 3200);
      }

      return Math.max(
        1800,
        Math.min(STAGE_CARD_REVEAL_TIMEOUT_MS, estimateMs || 2200),
      );
    },
    [
      activeBoundarySequenceRef,
      deferredUmpireAnnouncementRef,
      getRemainingActiveSoundEffectMs,
      pendingUmpireAnnouncementRef,
      soundEffectPlayingRef,
      stageCardPlaybackBlockUntilRef,
      status,
      umpireAnnouncementTimerRef,
      walkieAnnouncementPauseActiveRef,
    ],
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
        isAnySoundEffectActive,
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
    activeBoundarySequenceRef,
    deferredUmpireAnnouncementRef,
    estimateStageCardRevealDelayMs,
    isAnySoundEffectActive,
    pendingUmpireAnnouncementRef,
    showInningsEnd,
    soundEffectPlayingRef,
    stageCardKey,
    stageCardPlaybackBlockUntilRef,
    stageCardRevealVersionRef,
    status,
    umpireAnnouncementTimerRef,
    visibleStageCardKey,
    waitForUmpirePlaybackToSettle,
    walkieAnnouncementPauseActiveRef,
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
  }, [hasPendingStageContinueSpeech, stageContinuePrompt]);

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
    endStageAnnouncementKeyRef,
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

  return {
    handleForceContinuePastSpeech,
    handleProtectedNextInningsOrEnd,
    pendingStageCardCountdownLabel,
    setStageContinuePrompt,
    showInningsEnd,
    showPendingMatchOverCountdown,
    showVisibleInningsEndCard,
    stageContinuePrompt,
    waitForUmpirePlaybackToSettle,
    hasPendingStageContinueSpeech,
  };
}
