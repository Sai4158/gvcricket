/**
 * File overview:
 * Purpose: Pause and resume umpire announcement playback around live walkie conversations.
 * Main exports: useMatchWalkieInterruptions.
 * Major callers: MatchPageScreen.
 * Side effects: interrupts speech and live effect playback while walkie is active.
 * Read next: ./useMatchStageCardFlow.js
 */

import { useCallback, useEffect } from "react";

export default function useMatchWalkieInterruptions({
  activeSoundEffectStatus,
  interruptAndCapture,
  isWalkieConversationActive,
  localAnnouncementIdRef,
  pendingManualScoreAnnouncementRef,
  queueDeferredUmpireAnnouncement,
  soundEffectPlayingRef,
  speakSequenceWithAnnouncementDuck,
  stopActiveSoundEffect,
  umpireSettings,
  walkieAnnouncementPauseActiveRef,
  activeBoundarySequenceRef,
  boundarySequenceTimerRef,
  boundarySequenceVersionRef,
  deferredUmpireAnnouncementRef,
  interruptedUmpireAnnouncementQueueRef,
  pendingUmpireAnnouncementRef,
  shouldResumeAfterSoundEffectRef,
  umpireAnnouncementTimerRef,
} = {}) {
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
    activeBoundarySequenceRef,
    activeSoundEffectStatus,
    boundarySequenceTimerRef,
    boundarySequenceVersionRef,
    interruptAndCapture,
    interruptedUmpireAnnouncementQueueRef,
    pendingUmpireAnnouncementRef,
    queueDeferredUmpireAnnouncement,
    shouldResumeAfterSoundEffectRef,
    soundEffectPlayingRef,
    stopActiveSoundEffect,
    umpireAnnouncementTimerRef,
    walkieAnnouncementPauseActiveRef,
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
      },
    );
  }, [
    deferredUmpireAnnouncementRef,
    interruptedUmpireAnnouncementQueueRef,
    localAnnouncementIdRef,
    pendingManualScoreAnnouncementRef,
    soundEffectPlayingRef,
    speakSequenceWithAnnouncementDuck,
    umpireSettings.enabled,
    umpireSettings.mode,
    walkieAnnouncementPauseActiveRef,
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

  return {
    pauseUmpireAnnouncementsForWalkie,
    resumeUmpireAnnouncementsAfterWalkie,
  };
}
