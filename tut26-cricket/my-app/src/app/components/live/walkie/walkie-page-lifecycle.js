/**
 * File overview:
 * Purpose: React effects for page visibility, reconnect recovery, and cleanup in the walkie runtime.
 * Main exports: useWalkiePageLifecycle.
 * Major callers: useWalkieTalkieRuntime.
 * Side effects: listens for browser lifecycle events and resets walkie state around page transitions.
 * Read next: ./useWalkieTalkieRuntime.js
 */

import { useEffect } from "react";
import { storageParticipantId } from "./walkie-talkie-storage";
import {
  clearTimer,
  readPageVisibility,
  walkieConsole,
} from "./walkie-talkie-support";

export function useWalkiePageLifecycle({
  audioRetryTimerRef,
  cleanupSignaling,
  cleanupTransport,
  countdownTimerRef,
  cooldownTimerRef,
  enabled,
  isFinishing,
  isSelfTalking,
  manualAudioReady,
  manualSignalingActive,
  matchId,
  mountedRef,
  participantId,
  participantIdRef,
  presenceRefreshTimerRef,
  releaseTimerRef,
  remoteAudioLingerTimerRef,
  requestResetRef,
  requestState,
  resetRtcSessionForReload,
  role,
  rtcClientRef,
  rtmClientRef,
  rtmLoggedInRef,
  rtmSubscribedRef,
  setAudioReconnectTick,
  setIsPageVisible,
  setManualSignalingActive,
  setNeedsAudioUnlock,
  setParticipantId,
  setRecoveringAudio,
  setRecoveringSignaling,
  setSignalingReconnectTick,
  shouldMaintainAudioTransport,
  shouldMaintainSignalingRef,
  signalingActive,
  signalingRetryTimerRef,
  stopConnectingCueLoop,
  stopTalking,
  hasOwnPendingRequest,
  snapshot,
} = {}) {
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopConnectingCueLoop();
    };
  }, [mountedRef, stopConnectingCueLoop]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleVisibilityChange = () => {
      setIsPageVisible(readPageVisibility());
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [setIsPageVisible]);

  useEffect(() => {
    if (matchId && enabled) {
      setParticipantId(storageParticipantId(matchId, role, walkieConsole));
    }
  }, [enabled, matchId, role, setParticipantId]);

  useEffect(() => {
    participantIdRef.current = participantId;
  }, [participantId, participantIdRef]);

  useEffect(() => {
    if (
      signalingActive ||
      !manualSignalingActive ||
      snapshot.enabled ||
      hasOwnPendingRequest ||
      requestState === "pending" ||
      isSelfTalking ||
      isFinishing ||
      manualAudioReady
    ) {
      return;
    }

    setManualSignalingActive(false);
  }, [
    hasOwnPendingRequest,
    isFinishing,
    isSelfTalking,
    manualAudioReady,
    manualSignalingActive,
    requestState,
    setManualSignalingActive,
    signalingActive,
    snapshot.enabled,
  ]);

  useEffect(() => {
    if (!enabled) {
      setNeedsAudioUnlock(false);
    }
  }, [enabled, setNeedsAudioUnlock]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const requestRecovery = () => {
      if (document.visibilityState && document.visibilityState !== "visible") {
        return;
      }

      if (
        shouldMaintainSignalingRef.current &&
        (!rtmClientRef.current ||
          !rtmLoggedInRef.current ||
          !rtmSubscribedRef.current)
      ) {
        setRecoveringSignaling(true);
        setSignalingReconnectTick((current) => current + 1);
      }

      if (shouldMaintainAudioTransport) {
        const rtcConnectionState = rtcClientRef.current?.connectionState || "";
        if (!rtcClientRef.current || rtcConnectionState !== "CONNECTED") {
          setRecoveringAudio(true);
          setAudioReconnectTick((current) => current + 1);
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestRecovery();
      }
    };

    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const handleConnectionChange = () => {
      if (navigator.onLine === false) {
        return;
      }
      requestRecovery();
    };

    window.addEventListener("online", requestRecovery);
    document.addEventListener("visibilitychange", handleVisibility);
    connection?.addEventListener?.("change", handleConnectionChange);

    return () => {
      window.removeEventListener("online", requestRecovery);
      document.removeEventListener("visibilitychange", handleVisibility);
      connection?.removeEventListener?.("change", handleConnectionChange);
    };
  }, [
    rtcClientRef,
    rtmClientRef,
    rtmLoggedInRef,
    rtmSubscribedRef,
    setAudioReconnectTick,
    setRecoveringAudio,
    setRecoveringSignaling,
    setSignalingReconnectTick,
    shouldMaintainAudioTransport,
    shouldMaintainSignalingRef,
  ]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && (isSelfTalking || isFinishing)) {
        void stopTalking("backgrounded");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isFinishing, isSelfTalking, stopTalking]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onPageHide = () => {
      resetRtcSessionForReload();
      if (isSelfTalking || isFinishing) {
        void stopTalking("backgrounded");
        return;
      }
      void cleanupTransport();
      void cleanupSignaling();
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [
    cleanupSignaling,
    cleanupTransport,
    isFinishing,
    isSelfTalking,
    resetRtcSessionForReload,
    stopTalking,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onBeforeUnload = () => {
      resetRtcSessionForReload();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [resetRtcSessionForReload]);

  useEffect(
    () => () => {
      clearTimer(requestResetRef);
      clearTimer(audioRetryTimerRef);
      clearTimer(signalingRetryTimerRef);
      clearTimer(remoteAudioLingerTimerRef);
      clearTimer(presenceRefreshTimerRef);
      clearTimer(releaseTimerRef);
      clearTimer(countdownTimerRef, window.clearInterval);
      clearTimer(cooldownTimerRef, window.clearInterval);
      void cleanupTransport();
      void cleanupSignaling();
    },
    [
      audioRetryTimerRef,
      cleanupSignaling,
      cleanupTransport,
      countdownTimerRef,
      cooldownTimerRef,
      presenceRefreshTimerRef,
      releaseTimerRef,
      remoteAudioLingerTimerRef,
      requestResetRef,
      signalingRetryTimerRef,
    ],
  );
}
