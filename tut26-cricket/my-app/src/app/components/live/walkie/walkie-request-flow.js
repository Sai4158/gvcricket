/**
 * File overview:
 * Purpose: Request, toggle, unlock, and deactivation actions for the walkie runtime.
 * Main exports: createWalkieRequestFlowApi.
 * Major callers: useWalkieTalkieRuntime.
 * Side effects: sends request and toggle mutations to walkie endpoints.
 * Read next: ./walkie-transport-effects.js
 */

import { defaultDisplayName, nowIso } from "./walkie-talkie-state";
import {
  clearTimer,
  isWalkieNetworkError,
  messageFor,
  parseWalkieCooldownSeconds,
  requestJson,
  walkieConsole,
  walkieMessageFor,
} from "./walkie-talkie-support";

export function createWalkieRequestFlowApi({
  activeSpeakerRef,
  applyAuthoritativeSnapshot,
  applyMetadataState,
  audioRetryTimerRef,
  canEnable,
  cancelPendingStartRef,
  cleanupSignaling,
  cleanupTransport,
  cooldownTimerRef,
  countdownTimerRef,
  displayName,
  enableManualSignaling,
  ensureAudioUnlock,
  ensureParticipantId,
  fetchSignalingToken,
  isFinishing,
  isSelfTalking,
  joinRtc,
  matchId,
  metadataStateRef,
  mountedRef,
  noticeRef,
  participantId,
  participantsRef,
  publishWalkieMessage,
  refreshSignal,
  releaseTimerRef,
  remoteAudioLingerTimerRef,
  requestEnablePromiseRef,
  requestResetRef,
  resetRtcSessionForReload,
  respondPromiseRef,
  role,
  rtmClientRef,
  rtmLoggedInRef,
  rtmSubscribedRef,
  scheduleRequestReset,
  setCooldown,
  setCountdown,
  setError,
  setFinishDelayLeft,
  setHasWalkieToken,
  setIsFinishing,
  setIsSelfTalking,
  setListeningGraceActive,
  setManualAudioReady,
  setManualSignalingActive,
  setRecoveringAudio,
  setRecoveringSignaling,
  setSignalingReconnectTick,
  setUpdatingEnabled,
  shouldMaintainSignalingRef,
  signalTokenRef,
  signalingRetryTimerRef,
  signalingUserIdRef,
  snapshotRef,
  stopTalking,
  syncPersistentWalkieState,
  syncSnapshot,
  talkRetryMessages,
  toggleEnabledPromiseRef,
  updateNotice,
  walkieRequestMaxAgeMs,
} = {}) {
  const requestEnable = async () => {
    if (requestEnablePromiseRef.current) {
      return requestEnablePromiseRef.current;
    }

    requestEnablePromiseRef.current = (async () => {
      enableManualSignaling();
      const selfId = ensureParticipantId();
      if (!selfId) {
        setError("Walkie is still connecting.");
        return false;
      }

      const tokenPayload = await fetchSignalingToken().catch((requestError) => {
        setError(walkieMessageFor(requestError, "Could not request walkie."));
        return null;
      });
      if (!tokenPayload?.participantToken) {
        setError("Could not request walkie.");
        return false;
      }

      try {
        setError("");
        setCooldown(0);
        const participant =
          participantsRef.current.get(signalingUserIdRef.current) || {
            participantId: selfId,
            role,
            name: defaultDisplayName(role, displayName),
          };
        if (metadataStateRef.current.enabled) {
          updateNotice("Walkie-talkie is live.");
          scheduleRequestReset();
          return true;
        }
        if (
          metadataStateRef.current.pendingRequests.some(
            (item) => item.participantId === participant.participantId,
          )
        ) {
          updateNotice("Waiting for umpire approval.");
          return true;
        }

        const response = await requestJson(`/api/matches/${matchId}/walkie/request`, {
          participantId: participant.participantId,
          role: participant.role,
          token: tokenPayload.participantToken,
        });
        const nextState = applyAuthoritativeSnapshot(response?.walkie);
        const request = nextState.pendingRequests.find(
          (item) => item.participantId === participant.participantId,
        );

        const activeClient =
          rtmClientRef.current &&
          rtmLoggedInRef.current &&
          rtmSubscribedRef.current
            ? rtmClientRef.current
            : null;

        if (request && activeClient) {
          void publishWalkieMessage(
            {
              type: "walkie-request",
              requestId: request.requestId,
              participantId: request.participantId,
              role: request.role,
              name: request.name,
              signalingUserId:
                signalingUserIdRef.current || String(tokenPayload.userId || ""),
              requestedAt: request.requestedAt || nowIso(),
              expiresAt:
                request.expiresAt ||
                new Date(Date.now() + walkieRequestMaxAgeMs).toISOString(),
            },
            { client: activeClient, bestEffort: true },
          );
        }

        if (nextState.enabled) {
          updateNotice("Walkie-talkie is live.");
          scheduleRequestReset();
        } else {
          updateNotice("Waiting for umpire approval.");
        }
        walkieConsole("info", "Walkie requested", {
          participantId: participant.participantId,
          role: participant.role,
        });
        return true;
      } catch (requestError) {
        const message = walkieMessageFor(
          requestError,
          "Could not request walkie.",
        );
        const cooldownSeconds = parseWalkieCooldownSeconds(message);
        const refreshedState = await syncPersistentWalkieState().catch(
          () => null,
        );
        const hasRefreshedOwnPendingRequest = Boolean(
          refreshedState?.pendingRequests?.some(
            (item) => item?.participantId === selfId,
          ),
        );

        if (message === "Walkie-talkie is already on.") {
          if (!refreshedState) {
            await syncPersistentWalkieState().catch(() => {
              applyMetadataState({
                enabled: true,
                pendingRequests: [],
              });
            });
          } else {
            applyMetadataState({
              enabled: true,
              pendingRequests: [],
            });
          }
          updateNotice("Walkie-talkie is live.");
          scheduleRequestReset();
          return true;
        }

        if (
          message === "Request already sent. Waiting for the umpire." ||
          hasRefreshedOwnPendingRequest
        ) {
          updateNotice("Waiting for umpire approval.");
          setCooldown(cooldownSeconds);
          return true;
        }

        setCooldown(cooldownSeconds);
        setError(message);
        walkieConsole(
          isWalkieNetworkError(requestError) ? "warn" : "error",
          "Walkie request failed",
          {
            stage: "request-enable",
            message,
          },
        );
        return false;
      }
    })().finally(() => {
      requestEnablePromiseRef.current = null;
    });

    return requestEnablePromiseRef.current;
  };

  const toggleEnabled = async (nextEnabled) => {
    if (toggleEnabledPromiseRef.current) {
      return toggleEnabledPromiseRef.current;
    }

    toggleEnabledPromiseRef.current = (async () => {
      setUpdatingEnabled(true);
      enableManualSignaling();
      if (!canEnable) return false;
      try {
        setError("");
        const response = await requestJson(`/api/matches/${matchId}/walkie`, {
          enabled: Boolean(nextEnabled),
        });
        const nextState = applyAuthoritativeSnapshot(response?.walkie);

        if (!nextEnabled && activeSpeakerRef.current?.owner) {
          activeSpeakerRef.current = null;
          syncSnapshot();
        }

        const activeClient =
          rtmClientRef.current &&
          rtmLoggedInRef.current &&
          rtmSubscribedRef.current
            ? rtmClientRef.current
            : null;
        if (activeClient) {
          void publishWalkieMessage(
            {
              type: "walkie-enabled",
              enabled: nextState.enabled,
              pendingRequests: nextState.pendingRequests,
            },
            { client: activeClient, bestEffort: true },
          );
        }

        if (!nextEnabled) {
          setManualAudioReady(false);
          if (isSelfTalking || isFinishing) {
            await stopTalking("disabled");
          } else {
            activeSpeakerRef.current = null;
            syncSnapshot();
            await cleanupTransport();
          }
        }

        updateNotice(
          nextEnabled ? "Walkie-talkie is live." : "Walkie-talkie is off.",
        );
        walkieConsole("info", "Walkie enabled state changed", {
          enabled: Boolean(nextEnabled),
        });
        return true;
      } catch (toggleError) {
        const message = walkieMessageFor(toggleError, "Could not update walkie.");
        setError(message);
        walkieConsole(
          isWalkieNetworkError(toggleError) ? "warn" : "error",
          "Walkie toggle failed",
          {
            stage: "toggle-enabled",
            message,
          },
        );
        return false;
      }
    })().finally(() => {
      setUpdatingEnabled(false);
      toggleEnabledPromiseRef.current = null;
    });

    return toggleEnabledPromiseRef.current;
  };

  const respond = async (requestId, action) => {
    if (respondPromiseRef.current) {
      return respondPromiseRef.current;
    }

    respondPromiseRef.current = (async () => {
      enableManualSignaling();
      try {
        setError("");
        const targetRequest =
          metadataStateRef.current.pendingRequests.find(
            (item) => item.requestId === requestId,
          ) || null;
        const response = await requestJson(`/api/matches/${matchId}/walkie/respond`, {
          requestId,
          action,
        });
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
              type:
                action === "accept"
                  ? "walkie-request-accepted"
                  : "walkie-request-dismissed",
              requestId,
              participantId: targetRequest?.participantId || "",
            },
            { client: activeClient, bestEffort: true },
          );
        }
        updateNotice(
          action === "accept"
            ? "Walkie-talkie is live."
            : "Walkie request dismissed.",
        );
        walkieConsole("info", "Walkie request resolved", {
          action,
          requestId,
          participantId: targetRequest?.participantId || "",
        });
        return true;
      } catch (respondError) {
        const message = walkieMessageFor(
          respondError,
          "Could not update walkie request.",
        );
        setError(message);
        walkieConsole(
          isWalkieNetworkError(respondError) ? "warn" : "error",
          "Walkie request resolve failed",
          {
            stage: "request-response",
            action,
            message,
          },
        );
        return false;
      }
    })().finally(() => {
      respondPromiseRef.current = null;
    });

    return respondPromiseRef.current;
  };

  const acceptRequest = (requestId) => respond(requestId, "accept");
  const dismissRequest = (requestId) => respond(requestId, "dismiss");

  const unlockAudio = async () => {
    await ensureAudioUnlock();
    try {
      if (
        snapshotRef.current.enabled &&
        snapshotRef.current.activeSpeakerId &&
        snapshotRef.current.activeSpeakerId !== participantId
      ) {
        enableManualSignaling();
        await joinRtc();
      }
      return true;
    } catch (unlockError) {
      setError(walkieMessageFor(unlockError, "Could not enable walkie audio."));
      walkieConsole("error", "Walkie audio unlock failed", {
        stage: "audio-unlock",
        message: messageFor(unlockError, "Could not enable walkie audio."),
      });
      return false;
    }
  };

  const deactivateAudio = async ({ restartSignaling = false } = {}) => {
    clearTimer(audioRetryTimerRef);
    clearTimer(signalingRetryTimerRef);
    clearTimer(remoteAudioLingerTimerRef);
    cancelPendingStartRef.current = true;
    setManualAudioReady(false);
    setManualSignalingActive(false);
    setListeningGraceActive(false);
    setRecoveringAudio(false);
    setRecoveringSignaling(Boolean(restartSignaling));
    setError("");
    if (noticeRef.current && talkRetryMessages.includes(noticeRef.current)) {
      updateNotice("");
    }
    await stopTalking("deactivated");
    await cleanupTransport();
    resetRtcSessionForReload();
    if (!restartSignaling) {
      return;
    }

    await cleanupSignaling();
    if (mountedRef.current && shouldMaintainSignalingRef.current) {
      setSignalingReconnectTick((current) => current + 1);
      return;
    }
    setRecoveringSignaling(false);
  };

  return {
    acceptRequest,
    deactivateAudio,
    dismissRequest,
    requestEnable,
    respond,
    toggleEnabled,
    unlockAudio,
  };
}
