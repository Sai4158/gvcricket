/**
 * File overview:
 * Purpose: Talking lifecycle actions for the walkie runtime.
 * Main exports: createWalkieTalkActionsApi.
 * Major callers: useWalkieTalkieRuntime.
 * Side effects: claims, releases, and publishes live walkie audio.
 * Read next: ./walkie-request-flow.js
 */

import { defaultDisplayName, nowIso } from "./walkie-talkie-state";
import {
  clearTimer,
  isExpectedWalkieTransportError,
  messageFor,
  requestJson,
  shouldRetryWalkieStartError,
  wait,
  walkieConsole,
  walkieMessageFor,
} from "./walkie-talkie-support";

export function createWalkieTalkActionsApi({
  activeSpeakerRef,
  applyAuthoritativeSnapshot,
  cancelPendingStartRef,
  cleanupLocalTrack,
  cleanupTransport,
  countdownTimerRef,
  defaultNotice = "",
  displayName,
  enabled,
  ensureAudioUnlock,
  ensureParticipantId,
  ensureParticipantToken,
  ensurePublishedTrack,
  ensureTrack,
  enableManualSignaling,
  finishTailMs,
  finishTimerRef,
  getStartGateSnapshot,
  isSafari,
  joinRtc,
  keepReadyForTalk,
  manualAudioReady,
  matchId,
  preparePromiseRef,
  publishWalkieMessage,
  releaseTimerRef,
  role,
  rtmClientRef,
  rtmLoggedInRef,
  rtmSubscribedRef,
  setClaiming,
  setCountdown,
  setError,
  setFinishDelayLeft,
  setIsFinishing,
  setIsSelfTalking,
  setManualAudioReady,
  setPreparingToTalk,
  signalingUserIdRef,
  snapshotRef,
  startConnectingCueLoop,
  startCountdown,
  startTalkingPromiseRef,
  stopConnectingCueLoop,
  syncPersistentWalkieState,
  syncSnapshot,
  talkRetryMessages,
  unpublishRtc,
  updateNotice,
  walkieSpeakerTtlSeconds,
} = {}) {
  const prepareToTalk = async () => {
    if (preparePromiseRef.current) {
      return preparePromiseRef.current;
    }

    preparePromiseRef.current = (async () => {
      setPreparingToTalk(true);
      if (!enabled) {
        return false;
      }
      const selfId = ensureParticipantId();
      if (!selfId) {
        return false;
      }

      const gateSnapshot = await getStartGateSnapshot();

      if (
        role === "umpire" &&
        Number(gateSnapshot.spectatorCount || 0) +
          Number(gateSnapshot.directorCount || 0) <=
          0
      ) {
        setManualAudioReady(false);
        setError("A spectator or director needs to join first.");
        updateNotice("Waiting for spectators to join.");
        return false;
      }

      enableManualSignaling();

      try {
        setManualAudioReady(true);
        const unlocked = await ensureAudioUnlock();
        if (!unlocked && isSafari) {
          updateNotice("Enable Audio once on this device for Safari walkie.");
          return false;
        }

        await ensureParticipantToken();
        if (snapshotRef.current.enabled) {
          void ensurePublishedTrack().catch(() => {});
        } else {
          void Promise.allSettled([ensureTrack(), joinRtc()]);
        }
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      setPreparingToTalk(false);
      preparePromiseRef.current = null;
    });

    return preparePromiseRef.current;
  };

  const stopTalking = async (reason = "released") => {
    const selfId = ensureParticipantId();
    if (!selfId) {
      setIsSelfTalking(false);
      setIsFinishing(false);
      return false;
    }
    if (releaseTimerRef.current) {
      return true;
    }
    const ownsSpeakerLock = Boolean(
      activeSpeakerRef.current?.participantId === selfId ||
        activeSpeakerRef.current?.owner === signalingUserIdRef.current ||
        snapshotRef.current.activeSpeakerId === selfId,
    );
    if (!ownsSpeakerLock) {
      if (startTalkingPromiseRef.current) {
        cancelPendingStartRef.current = true;
        stopConnectingCueLoop();
        setClaiming(false);
        setManualAudioReady(false);
        return true;
      }
      if (manualAudioReady) {
        stopConnectingCueLoop();
        setManualAudioReady(false);
        await cleanupTransport();
        return true;
      }
      setIsSelfTalking(false);
      setIsFinishing(false);
      setFinishDelayLeft(0);
      stopConnectingCueLoop();
      return false;
    }
    const immediateStop =
      reason === "disabled" ||
      reason === "backgrounded" ||
      reason === "deactivated" ||
      reason === "cleanup";
    const releaseDelayMs = immediateStop ? 0 : finishTailMs;
    const currentTransmissionId = String(
      activeSpeakerRef.current?.transmissionId || "",
    );
    setIsSelfTalking(false);
    setIsFinishing(!immediateStop);
    setFinishDelayLeft(immediateStop ? 0 : Math.ceil(releaseDelayMs / 1000));
    stopConnectingCueLoop();
    clearTimer(finishTimerRef, window.clearInterval);
    if (!immediateStop) {
      finishTimerRef.current = window.setInterval(() => {
        setFinishDelayLeft((current) => {
          if (current <= 1) {
            clearTimer(finishTimerRef, window.clearInterval);
            return 0;
          }
          return current - 1;
        });
      }, 250);
    }
    releaseTimerRef.current = window.setTimeout(async () => {
      releaseTimerRef.current = null;
      const shouldKeepWarmAfterRelease = Boolean(
        reason === "released" &&
          enabled &&
          snapshotRef.current.enabled &&
          keepReadyForTalk,
      );
      if (shouldKeepWarmAfterRelease) {
        await unpublishRtc();
      } else {
        await cleanupLocalTrack();
      }
      try {
        const participantToken = await ensureParticipantToken();
        const response = await requestJson(
          `/api/matches/${matchId}/walkie/release`,
          {
            participantId: selfId,
            role,
            token: participantToken,
          },
        );
        applyAuthoritativeSnapshot(response?.walkie);

        const activeClient =
          rtmClientRef.current &&
          rtmLoggedInRef.current &&
          rtmSubscribedRef.current
            ? rtmClientRef.current
            : null;
        if (activeClient) {
          void publishWalkieMessage(
            {
              type: "walkie-speaker-ended",
              participantId: selfId,
              userId: signalingUserIdRef.current,
              transmissionId: currentTransmissionId,
              reason,
              message:
                reason === "disabled"
                  ? "Walkie-talkie is off."
                  : "Channel is free.",
            },
            { client: activeClient, bestEffort: true },
          );
        }
      } catch (releaseError) {
        const releaseMessage = walkieMessageFor(
          releaseError,
          "Could not release walkie.",
        );
        if (releaseMessage !== "This participant is not speaking.") {
          setError(releaseMessage);
          walkieConsole("error", "Walkie release failed", {
            stage: "speaker-release",
            message: messageFor(releaseError, "Could not release walkie."),
          });
        }
        await syncPersistentWalkieState().catch(() => {});
      }
      activeSpeakerRef.current = null;
      setManualAudioReady(false);
      syncSnapshot();
      setCountdown(0);
      updateNotice(
        reason === "disabled" ? "Walkie-talkie is off." : "Channel is free.",
      );
      setIsFinishing(false);
      setFinishDelayLeft(0);
      clearTimer(finishTimerRef, window.clearInterval);
      clearTimer(countdownTimerRef, window.clearInterval);
      walkieConsole("info", "Walkie speaker stopped", {
        reason,
        participantId: selfId,
      });
    }, releaseDelayMs);
    return true;
  };

  const startTalking = async () => {
    if (startTalkingPromiseRef.current) {
      return startTalkingPromiseRef.current;
    }

    startTalkingPromiseRef.current = (async () => {
      cancelPendingStartRef.current = false;
      if (!enabled) {
        cancelPendingStartRef.current = false;
        return false;
      }

      const selfId = ensureParticipantId();
      if (!selfId) {
        cancelPendingStartRef.current = false;
        setError("Walkie is still connecting.");
        return false;
      }

      if (!snapshotRef.current.enabled) {
        cancelPendingStartRef.current = false;
        setError("Walkie-talkie is off.");
        return false;
      }

      const gateSnapshot = await getStartGateSnapshot();
      if (!gateSnapshot.enabled) {
        cancelPendingStartRef.current = false;
        setError("Walkie-talkie is off.");
        return false;
      }

      if (
        role === "umpire" &&
        Number(gateSnapshot.spectatorCount || 0) +
          Number(gateSnapshot.directorCount || 0) <=
          0
      ) {
        cancelPendingStartRef.current = false;
        setError("A spectator or director needs to join first.");
        updateNotice("Waiting for spectators to join.");
        return false;
      }

      if (
        gateSnapshot.activeSpeakerId &&
        gateSnapshot.activeSpeakerId !== selfId &&
        new Date(gateSnapshot.expiresAt || 0).getTime() > Date.now()
      ) {
        cancelPendingStartRef.current = false;
        setError("Channel is busy.");
        updateNotice(
          `${gateSnapshot.activeSpeakerName || "Someone"} is talking.`,
        );
        return false;
      }

      enableManualSignaling();

      clearTimer(releaseTimerRef);
      clearTimer(finishTimerRef, window.clearInterval);
      setError("");
      updateNotice(defaultNotice);
      setManualAudioReady(true);
      setIsFinishing(false);
      setFinishDelayLeft(0);
      setClaiming(true);

      const unlocked = manualAudioReady ? true : await ensureAudioUnlock();
      if (!unlocked && isSafari) {
        cancelPendingStartRef.current = false;
        setClaiming(false);
        setManualAudioReady(false);
        stopConnectingCueLoop();
        updateNotice("Enable Audio once on this device for Safari walkie.");
        return false;
      }

      const participantToken = await ensureParticipantToken().catch(() => "");
      if (!participantToken) {
        cancelPendingStartRef.current = false;
        setClaiming(false);
        setManualAudioReady(false);
        stopConnectingCueLoop();
        setError("Walkie is still connecting.");
        return false;
      }

      startConnectingCueLoop();
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        let claimedSpeaker = false;
        let preparedTransport = false;
        updateNotice(
          talkRetryMessages[
            Math.min(attempt - 1, talkRetryMessages.length - 1)
          ],
        );
        const publishReadyPromise = preparePromiseRef.current
          ? preparePromiseRef.current.then(async (prepared) => {
              if (prepared === false) {
                throw new Error("Walkie audio is unavailable.");
              }
              return ensurePublishedTrack();
            })
          : ensurePublishedTrack();
        try {
          const { track } = await publishReadyPromise;
          preparedTransport = true;

          if (cancelPendingStartRef.current) {
            cancelPendingStartRef.current = false;
            setClaiming(false);
            stopConnectingCueLoop();
            await cleanupTransport();
            return false;
          }

          const claimResponse = await requestJson(
            `/api/matches/${matchId}/walkie/claim`,
            {
              participantId: selfId,
              role,
              token: participantToken,
            },
          );
          const nextSnapshot = applyAuthoritativeSnapshot(claimResponse?.walkie);
          claimedSpeaker = Boolean(nextSnapshot?.activeSpeakerId === selfId);

          if (!claimedSpeaker) {
            throw new Error("Could not claim walkie channel.");
          }
          if (typeof track.setMuted === "function") {
            await track.setMuted(false);
          }
          await wait(10);

          if (cancelPendingStartRef.current) {
            cancelPendingStartRef.current = false;
            setClaiming(false);
            stopConnectingCueLoop();
            await stopTalking();
            return false;
          }

          const expiresAt =
            nextSnapshot?.expiresAt ||
            new Date(
              Date.now() + walkieSpeakerTtlSeconds * 1000,
            ).toISOString();

          startCountdown(expiresAt);
          setIsSelfTalking(true);
          stopConnectingCueLoop();
          updateNotice(defaultNotice);
          setClaiming(false);

          const participantName =
            nextSnapshot?.activeSpeakerName ||
            defaultDisplayName(role, displayName);
          const activeClient =
            rtmClientRef.current &&
            rtmLoggedInRef.current &&
            rtmSubscribedRef.current
              ? rtmClientRef.current
              : null;

          if (activeClient) {
            void publishWalkieMessage(
              {
                type: "walkie-speaker-started",
                userId: signalingUserIdRef.current,
                participantId: selfId,
                role,
                name: participantName,
                lockStartedAt: nextSnapshot?.lockStartedAt || nowIso(),
                expiresAt,
                transmissionId: nextSnapshot?.transmissionId || "",
                message: `${participantName} is talking.`,
              },
              { client: activeClient, bestEffort: true },
            );
          }

          walkieConsole("info", "Walkie speaker started", {
            participantId: selfId,
            role,
            transmissionId: nextSnapshot?.transmissionId || "",
          });
          return true;
        } catch (talkError) {
          lastError = talkError;
          const retryableStartError = shouldRetryWalkieStartError(talkError);
          if (claimedSpeaker) {
            await requestJson(`/api/matches/${matchId}/walkie/release`, {
              participantId: selfId,
              role,
              token: participantToken,
            }).catch(() => {});
            await syncPersistentWalkieState().catch(() => {});
            await cleanupTransport();
          }
          if (!claimedSpeaker && preparedTransport) {
            await cleanupTransport();
          } else if (!claimedSpeaker && retryableStartError) {
            await cleanupTransport();
          }
          if (!retryableStartError) {
            await syncPersistentWalkieState().catch(() => {});
            break;
          }
          if (attempt < 3) {
            await wait(120 * attempt);
          }
        }
      }

      setClaiming(false);
      setIsSelfTalking(false);
      setIsFinishing(false);
      setManualAudioReady(false);
      cancelPendingStartRef.current = false;
      activeSpeakerRef.current = null;
      stopConnectingCueLoop();
      await syncPersistentWalkieState().catch(() => {
        syncSnapshot();
      });
      clearTimer(countdownTimerRef, window.clearInterval);
      setCountdown(0);
      setFinishDelayLeft(0);
      const message = walkieMessageFor(
        lastError,
        "Could not start walkie audio.",
      );
      setError(message);
      if (isExpectedWalkieTransportError(lastError)) {
        updateNotice("Retrying audio...");
      }
      walkieConsole("warn", "Walkie speaker start failed", {
        stage: "speaker-start",
        message,
      });
      return false;
    })().finally(() => {
      startTalkingPromiseRef.current = null;
    });

    return startTalkingPromiseRef.current;
  };

  return {
    prepareToTalk,
    startTalking,
    stopTalking,
  };
}
