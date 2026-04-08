/**
 * File overview:
 * Purpose: React effects for maintaining walkie signaling, transport, and remote playback.
 * Main exports: useWalkieTransportEffects.
 * Major callers: useWalkieTalkieRuntime.
 * Side effects: opens or closes signaling and RTC transport based on runtime state.
 * Read next: ./walkie-page-lifecycle.js
 */

import { useEffect } from "react";
import { shouldReceiveWalkieAudio } from "./walkie-talkie-gates";
import {
  clearTimer,
  classifyWalkieSignalingSetupError,
  isExpectedWalkieTransportError,
  walkieConsole,
  walkieMessageFor,
} from "./walkie-talkie-support";

export function useWalkieTransportEffects({
  activeSpeakerRef,
  activeSpeakerSourceRef,
  audioReconnectTick,
  audioRetryTimerRef,
  autoConnectAudio,
  authoritativeSnapshotRef,
  canTalk,
  claiming,
  cleanupSignaling,
  cleanupTransport,
  countdownTimerRef,
  cooldownTimerRef,
  enabled,
  ensurePublishedTrack,
  ensureRtmSession,
  fetchRtcToken,
  finishTimerRef,
  hasOwnPendingRequest,
  hasWalkieToken,
  isFinishing,
  isSelfTalking,
  joinRtc,
  lastAcceptedRequestIdRef,
  lastDismissedRequestIdRef,
  lastSyncRequestAtRef,
  matchId,
  metadataStateRef,
  manualAudioReady,
  mountedRef,
  noticeRef,
  participantId,
  participantTokenRef,
  participantsRef,
  presenceRefreshInFlightRef,
  presenceRefreshPendingRef,
  presenceRefreshTimerRef,
  recoverableRetryCooldownMs,
  recoverableRetryLimit,
  remoteAudioLingerMs,
  remoteAudioLingerTimerRef,
  requestResetRef,
  requestState,
  role,
  scheduleRequestReset,
  setCountdown,
  setError,
  setFinishDelayLeft,
  setHasWalkieToken,
  setIsFinishing,
  setIsSelfTalking,
  setListeningGraceActive,
  setManualAudioReady,
  setManualSignalingActive,
  setNotice,
  setRecoveringAudio,
  setRecoveringSignaling,
  setRequestCooldownLeft,
  setRequestState,
  setSignalingReconnectTick,
  shouldMaintainAudioTransport,
  shouldMaintainSignaling,
  shouldMaintainSignalingRef,
  signalingReconnectTick,
  signalingRecoverableFailuresRef,
  signalingRetryBaseMs,
  signalingRetryMaxMs,
  signalingRetryTimerRef,
  snapshot,
  startCountdown,
  stopTalking,
  syncPersistentWalkieState,
  syncRemoteAudioPlayback,
  syncSnapshot,
  talkRetryMessages,
  unpublishRtc,
  updateNotice,
} = {}) {
  useEffect(() => {
    if (!shouldMaintainSignaling) {
      setManualSignalingActive(false);
      signalingRecoverableFailuresRef.current = 0;
      lastSyncRequestAtRef.current = 0;
      authoritativeSnapshotRef.current = null;
      activeSpeakerSourceRef.current = "authoritative";
      participantTokenRef.current = "";
      lastAcceptedRequestIdRef.current = "";
      lastDismissedRequestIdRef.current = "";
      setHasWalkieToken(false);
      setManualAudioReady(false);
      metadataStateRef.current = { enabled: false, pendingRequests: [] };
      participantsRef.current = new Map();
      activeSpeakerRef.current = null;
      syncSnapshot();
      setRequestState("idle");
      setRequestCooldownLeft(0);
      setIsSelfTalking(false);
      setIsFinishing(false);
      setFinishDelayLeft(0);
      setCountdown(0);
      setError("");
      setRecoveringAudio(false);
      setRecoveringSignaling(false);
      noticeRef.current = "";
      setNotice("");
      clearTimer(finishTimerRef, window.clearInterval);
      clearTimer(countdownTimerRef, window.clearInterval);
      clearTimer(cooldownTimerRef, window.clearInterval);
      clearTimer(requestResetRef);
      clearTimer(signalingRetryTimerRef);
      clearTimer(presenceRefreshTimerRef);
      presenceRefreshInFlightRef.current = false;
      presenceRefreshPendingRef.current = false;
      void cleanupTransport();
      void cleanupSignaling();
      return;
    }

    clearTimer(signalingRetryTimerRef);
    void ensureRtmSession().catch((connectError) => {
      if (!mountedRef.current || !shouldMaintainSignalingRef.current) {
        return;
      }

      const classification = classifyWalkieSignalingSetupError(connectError);
      if (classification === "ignore") {
        return;
      }

      const message = walkieMessageFor(
        connectError,
        "Walkie live connection is unavailable.",
      );
      if (classification === "recoverable") {
        const failureCount = signalingRecoverableFailuresRef.current + 1;
        signalingRecoverableFailuresRef.current = failureCount;
        const retryDelay =
          failureCount >= recoverableRetryLimit
            ? recoverableRetryCooldownMs
            : Math.min(
                signalingRetryBaseMs * 2 ** Math.max(0, failureCount - 1),
                signalingRetryMaxMs,
              );
        setRecoveringSignaling(true);
        walkieConsole("warn", "Walkie signaling setup delayed", {
          stage: "signaling-setup",
          retryDelay,
          failureCount,
          message,
        });
        if (failureCount >= recoverableRetryLimit) {
          void cleanupSignaling();
          setError(
            "Walkie live connection looks blocked on this network or browser. Retrying automatically.",
          );
          updateNotice(
            `Walkie live connection is blocked. Retrying in ${Math.ceil(
              retryDelay / 1000,
            )}s.`,
          );
        } else {
          updateNotice("Retrying live walkie...");
        }
        clearTimer(signalingRetryTimerRef);
        signalingRetryTimerRef.current = window.setTimeout(() => {
          signalingRetryTimerRef.current = null;
          if (mountedRef.current && shouldMaintainSignalingRef.current) {
            setSignalingReconnectTick((current) => current + 1);
          }
        }, retryDelay);
        return;
      }

      signalingRecoverableFailuresRef.current = 0;
      setRecoveringSignaling(false);
      walkieConsole("error", "Walkie signaling setup failed", {
        stage: "signaling-setup",
        message,
      });
      setError(message);
    });
  }, [
    cleanupSignaling,
    cleanupTransport,
    countdownTimerRef,
    cooldownTimerRef,
    ensureRtmSession,
    finishTimerRef,
    matchId,
    recoverableRetryCooldownMs,
    recoverableRetryLimit,
    setCountdown,
    setError,
    setFinishDelayLeft,
    setHasWalkieToken,
    setIsFinishing,
    setIsSelfTalking,
    setManualAudioReady,
    setManualSignalingActive,
    setNotice,
    setRecoveringAudio,
    setRecoveringSignaling,
    setRequestCooldownLeft,
    setRequestState,
    shouldMaintainSignaling,
    signalingReconnectTick,
    signalingRetryBaseMs,
    signalingRetryMaxMs,
    syncSnapshot,
    updateNotice,
  ]);

  useEffect(() => {
    const remoteSpeakerActive =
      autoConnectAudio &&
      shouldReceiveWalkieAudio({
        participantId,
        snapshot,
      });

    if (!snapshot.enabled || !autoConnectAudio || !participantId) {
      clearTimer(remoteAudioLingerTimerRef);
      setListeningGraceActive(false);
      return;
    }

    if (remoteSpeakerActive) {
      setListeningGraceActive(true);
      clearTimer(remoteAudioLingerTimerRef);
      remoteAudioLingerTimerRef.current = window.setTimeout(() => {
        remoteAudioLingerTimerRef.current = null;
        setListeningGraceActive(false);
      }, remoteAudioLingerMs);
      return;
    }

    if (!remoteAudioLingerTimerRef.current) {
      setListeningGraceActive(false);
    }
  }, [
    autoConnectAudio,
    participantId,
    remoteAudioLingerMs,
    snapshot,
    snapshot.activeSpeakerId,
    snapshot.enabled,
    setListeningGraceActive,
  ]);

  useEffect(() => {
    clearTimer(audioRetryTimerRef);
    if (shouldMaintainAudioTransport) {
      let cancelled = false;
      const shouldKeepPublishedTrack = Boolean(
        snapshot.enabled && (claiming || isSelfTalking || isFinishing),
      );

      const attemptJoin = async () => {
        try {
          setRecoveringAudio(true);
          if (shouldKeepPublishedTrack) {
            await ensurePublishedTrack();
          } else {
            await joinRtc();
          }
          if (cancelled) {
            return;
          }
          setRecoveringAudio(false);
          if (noticeRef.current === "Retrying audio...") {
            updateNotice("");
          }
        } catch (joinError) {
          if (cancelled) {
            return;
          }

          const message = walkieMessageFor(
            joinError,
            "Could not connect walkie audio.",
          );
          await cleanupTransport();

          if (isExpectedWalkieTransportError(joinError)) {
            setRecoveringAudio(true);
            updateNotice("Retrying audio...");
            walkieConsole("warn", "Walkie audio connect delayed", {
              stage: "rtc-join",
              message,
            });
            audioRetryTimerRef.current = window.setTimeout(() => {
              if (!cancelled) {
                void attemptJoin();
              }
            }, 900);
            return;
          }

          setRecoveringAudio(false);
          setError(message);
          walkieConsole("warn", "Walkie audio connect failed", {
            stage: "rtc-join",
            message,
          });
        }
      };

      void attemptJoin();

      return () => {
        cancelled = true;
        clearTimer(audioRetryTimerRef);
      };
    }
    clearTimer(audioRetryTimerRef);
    setRecoveringAudio(false);
    if (noticeRef.current && talkRetryMessages.includes(noticeRef.current)) {
      updateNotice("");
    }
    void cleanupTransport();
  }, [
    audioReconnectTick,
    cleanupTransport,
    claiming,
    ensurePublishedTrack,
    isFinishing,
    isSelfTalking,
    joinRtc,
    setError,
    setRecoveringAudio,
    shouldMaintainAudioTransport,
    snapshot.enabled,
    talkRetryMessages,
    updateNotice,
  ]);

  useEffect(() => {
    const shouldPrefetchRtcToken = Boolean(
      enabled &&
        participantId &&
        snapshot.enabled &&
        hasWalkieToken &&
        (shouldMaintainAudioTransport ||
          manualAudioReady ||
          canTalk ||
          isSelfTalking ||
          isFinishing),
    );

    if (!shouldPrefetchRtcToken) {
      return;
    }

    void fetchRtcToken().catch(() => {});
  }, [
    canTalk,
    enabled,
    fetchRtcToken,
    hasWalkieToken,
    isFinishing,
    isSelfTalking,
    manualAudioReady,
    participantId,
    shouldMaintainAudioTransport,
    snapshot.enabled,
  ]);

  useEffect(() => {
    if (role === "umpire") {
      return;
    }

    if (snapshot.enabled) {
      if (requestState === "pending") {
        setRequestState("accepted");
        updateNotice("Walkie-talkie is live.");
        scheduleRequestReset();
      }
      return;
    }

    if (hasOwnPendingRequest) {
      setRequestState("pending");
      updateNotice("Waiting for umpire approval.");
      return;
    }

    setRequestState((current) => (current === "pending" ? "idle" : current));
  }, [
    hasOwnPendingRequest,
    requestState,
    role,
    scheduleRequestReset,
    snapshot.enabled,
    updateNotice,
  ]);

  useEffect(() => {
    if (!snapshot.enabled && (isSelfTalking || isFinishing)) {
      void stopTalking("disabled");
    }
  }, [isFinishing, isSelfTalking, snapshot.enabled, stopTalking]);

  useEffect(() => {
    syncRemoteAudioPlayback();
  }, [
    isFinishing,
    isSelfTalking,
    participantId,
    snapshot.activeSpeakerId,
    snapshot.enabled,
    syncRemoteAudioPlayback,
  ]);

  useEffect(() => {
    if (!snapshot.activeSpeakerId || snapshot.activeSpeakerId === participantId) {
      if (snapshot.activeSpeakerId === participantId && snapshot.expiresAt) {
        startCountdown(snapshot.expiresAt);
      } else {
        clearTimer(countdownTimerRef, window.clearInterval);
        setCountdown(0);
      }
      return;
    }
    if (isSelfTalking) {
      void unpublishRtc();
      setIsSelfTalking(false);
      setIsFinishing(false);
      setFinishDelayLeft(0);
    }
    clearTimer(countdownTimerRef, window.clearInterval);
    setCountdown(0);
  }, [
    countdownTimerRef,
    isSelfTalking,
    participantId,
    setCountdown,
    setFinishDelayLeft,
    setIsFinishing,
    setIsSelfTalking,
    snapshot.activeSpeakerId,
    snapshot.expiresAt,
    startCountdown,
    unpublishRtc,
  ]);

  useEffect(() => {
    const activeSpeakerId = String(snapshot.activeSpeakerId || "");
    const transmissionId = String(snapshot.transmissionId || "");
    const expiresAtMs = Date.parse(snapshot.expiresAt || "");

    if (!activeSpeakerId || !Number.isFinite(expiresAtMs)) {
      return undefined;
    }

    const timeoutMs = Math.max(0, expiresAtMs - Date.now()) + 250;
    const timerId = window.setTimeout(() => {
      if (
        activeSpeakerRef.current &&
        String(activeSpeakerRef.current.transmissionId || "") === transmissionId
      ) {
        const activeExpiresAtMs = Date.parse(
          activeSpeakerRef.current.expiresAt || "",
        );
        if (
          !Number.isFinite(activeExpiresAtMs) ||
          activeExpiresAtMs <= Date.now()
        ) {
          activeSpeakerRef.current = null;
          syncSnapshot();
          if (!isSelfTalking && !isFinishing) {
            updateNotice("Channel is free.");
          }
        }
      }
    }, timeoutMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    isFinishing,
    isSelfTalking,
    snapshot.activeSpeakerId,
    snapshot.expiresAt,
    snapshot.transmissionId,
    syncSnapshot,
    updateNotice,
  ]);
}
