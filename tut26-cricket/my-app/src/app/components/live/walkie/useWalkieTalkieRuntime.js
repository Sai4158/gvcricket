"use client";


/**
 * File overview:
 * Purpose: React hook for Live behavior and browser state.
 * Main exports: useWalkieTalkie.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playUiTone, primeUiAudio } from "../../../lib/page-audio";
import {
  buildAgoraSignalingChannelName,
  buildAgoraUserId,
} from "../../../lib/agora-channels";
import { getNonUmpireWalkieUiState } from "../../../lib/walkie-device-state";
import {
  buildAgoraWalkieSnapshot,
  filterAgoraWalkieRequests,
  removeAgoraWalkieRequest,
  upsertAgoraWalkieRequest,
  WALKIE_CHANNEL_TYPE,
  WALKIE_SPEAKER_TTL_SECONDS,
  WALKIE_REQUEST_MAX_AGE_MS,
} from "../../../lib/walkie-agora-runtime";
import {
  shouldMaintainWalkieAudioTransport,
  shouldMaintainWalkieSignaling,
  shouldPlayWalkieRemoteAudio,
  shouldReceiveWalkieAudio,
} from "./walkie-talkie-gates";
import {
  buildLocalSpeakerFromSnapshot,
  defaultDisplayName,
  EMPTY_WALKIE_SNAPSHOT,
  isTokenFresh,
  mergeWalkieSnapshots,
  normalizeAuthoritativeWalkieSnapshot,
  nowIso,
  validateWalkieTokenPayload,
  withTokenExpiry,
} from "./walkie-talkie-state";
import {
  clearStoredWalkieToken,
  readSessionValue,
  readStoredWalkieToken,
  storageParticipantId,
  writeSessionValue,
  writeStoredWalkieToken,
} from "./walkie-talkie-storage";
import {
  classifyWalkieSignalingSetupError,
  clearTimer,
  isExpectedWalkieTransportError,
  isRtcUidConflictError,
  isRtmPublishDisconnectedError,
  isWalkieNetworkError,
  loadRtc,
  loadRtm,
  messageFor,
  parseJson,
  parseWalkieCooldownSeconds,
  playWalkieCue,
  readPageVisibility,
  requestJson,
  requestWalkieState,
  safariBrowser,
  shouldRetryWalkieStartError,
  wait,
  waitForRtcConnected,
  walkieConsole,
  walkieMessageFor,
} from "./walkie-talkie-support";
import { createWalkieTokenLifecycleApi } from "./token-lifecycle";
import { createWalkiePresenceSnapshotApi } from "./presence-snapshot";
import { createWalkieRtcTransportApi } from "./rtc-transport";
import { createWalkieRtmSignalingApi } from "./rtm-signaling";
import { createWalkieRuntimeUiApi } from "./runtime-ui";

export {
  classifyWalkieSignalingSetupError,
  isWalkieNetworkError,
} from "./walkie-talkie-support";
export {
  mergeWalkieSnapshots,
} from "./walkie-talkie-state";
export {
  shouldMaintainWalkieAudioTransport,
  shouldMaintainWalkieSignaling,
  shouldPlayWalkieRemoteAudio,
  shouldReceiveWalkieAudio,
} from "./walkie-talkie-gates";

const FINISH_TAIL_MS = 120;
const REQUEST_RESET_MS = 1800;
const REMOTE_AUDIO_LINGER_MS = 12000;
const RTC_TOKEN_REFRESH_BUFFER_MS = 90 * 1000;
const SIGNAL_TOKEN_REFRESH_BUFFER_MS = 90 * 1000;
const SIGNALING_RETRY_BASE_MS = 1500;
const SIGNALING_RETRY_MAX_MS = 12000;
const SIGNALING_RETRY_COOLDOWN_MS = 45000;
const SIGNALING_MAX_RECOVERABLE_RETRIES = 4;
const SIGNALING_SYNC_REQUEST_MIN_GAP_MS = 15000;
const PRESENCE_REFRESH_DEBOUNCE_MS = 180;
const TALK_RETRY_MESSAGES = [
  "Connecting walkie...",
  "Retrying audio...",
  "Direct audio could not connect yet. Retrying...",
];

export default function useWalkieTalkie({
  matchId,
  enabled,
  role,
  displayName = "",
  hasUmpireAccess = false,
  autoConnectAudio = false,
  signalingActive = enabled,
}) {
  const [participantId, setParticipantId] = useState("");
  const [snapshot, setSnapshot] = useState(EMPTY_WALKIE_SNAPSHOT);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [finishDelayLeft, setFinishDelayLeft] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [isSelfTalking, setIsSelfTalking] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [requestState, setRequestState] = useState("idle");
  const [requestCooldownLeft, setRequestCooldownLeft] = useState(0);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [hasWalkieToken, setHasWalkieToken] = useState(false);
  const [manualAudioReady, setManualAudioReady] = useState(false);
  const [manualSignalingActive, setManualSignalingActiveState] = useState(false);
  const [preparingToTalk, setPreparingToTalk] = useState(false);
  const [updatingEnabled, setUpdatingEnabled] = useState(false);
  const [recoveringAudio, setRecoveringAudio] = useState(false);
  const [recoveringSignaling, setRecoveringSignaling] = useState(false);
  const [audioReconnectTick, setAudioReconnectTick] = useState(0);
  const [signalingReconnectTick, setSignalingReconnectTick] = useState(0);
  const [isPageVisible, setIsPageVisible] = useState(readPageVisibility);

  const rtcClientRef = useRef(null);
  const rtcTrackRef = useRef(null);
  const remoteAudioTracksRef = useRef(new Map());
  const remoteAudioPlayingRef = useRef(new Set());
  const rtcTokenRef = useRef(null);
  const rtcJoinedRef = useRef(false);
  const rtcPublishedRef = useRef(false);
  const rtcTokenPromiseRef = useRef(null);
  const rtcJoinPromiseRef = useRef(null);
  const trackPromiseRef = useRef(null);
  const publishPromiseRef = useRef(null);
  const preparePromiseRef = useRef(null);
  const startTalkingPromiseRef = useRef(null);
  const cancelPendingStartRef = useRef(false);
  const ensureRtmSessionHandlerRef = useRef(null);
  const cleanupSignalingHandlerRef = useRef(null);

  const rtmClientRef = useRef(null);
  const rtmReadyPromiseRef = useRef(null);
  const rtmCleanupPromiseRef = useRef(null);
  const rtmLoggedInRef = useRef(false);
  const rtmSubscribedRef = useRef(false);
  const rtmListenersRef = useRef(null);
  const signalTokenRef = useRef(null);
  const signalTokenPromiseRef = useRef(null);
  const participantTokenRef = useRef("");
  const rtcSessionIdRef = useRef("");
  const signalingUserIdRef = useRef("");
  const signalingChannelRef = useRef("");
  const signalingGenerationRef = useRef(0);
  const toggleEnabledPromiseRef = useRef(null);
  const requestEnablePromiseRef = useRef(null);
  const respondPromiseRef = useRef(null);
  const refreshSignalPromiseRef = useRef(null);
  const refreshSignalHandlerRef = useRef(null);
  const stopTalkingHandlerRef = useRef(null);
  const lastRefreshRequestIdRef = useRef("");
  const lastAcceptedRequestIdRef = useRef("");
  const lastDismissedRequestIdRef = useRef("");

  const snapshotRef = useRef(EMPTY_WALKIE_SNAPSHOT);
  const authoritativeSnapshotRef = useRef(null);
  const participantIdRef = useRef("");
  const activeSpeakerSourceRef = useRef("authoritative");
  const metadataStateRef = useRef({
    enabled: false,
    pendingRequests: [],
  });
  const participantsRef = useRef(new Map());
  const activeSpeakerRef = useRef(null);
  const releaseTimerRef = useRef(null);
  const finishTimerRef = useRef(null);
  const requestResetRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const audioRetryTimerRef = useRef(null);
  const signalingRetryTimerRef = useRef(null);
  const remoteAudioLingerTimerRef = useRef(null);
  const presenceRefreshTimerRef = useRef(null);
  const connectCueLoopTimerRef = useRef(null);
  const presenceRefreshInFlightRef = useRef(false);
  const presenceRefreshPendingRef = useRef(false);
  const mountedRef = useRef(false);
  const pageVisibleRef = useRef(isPageVisible);
  const shouldMaintainSignalingRef = useRef(false);
  const signalingPropActiveRef = useRef(Boolean(signalingActive));
  const manualSignalingActiveRef = useRef(false);
  const signalingRecoverableFailuresRef = useRef(0);
  const lastSyncRequestAtRef = useRef(0);
  const noticeRef = useRef("");
  const isSafari = useMemo(() => safariBrowser(), []);
  signalingPropActiveRef.current = Boolean(signalingActive);
  const canEnable = Boolean(enabled && role === "umpire" && hasUmpireAccess);
  const pendingRequests = snapshot.pendingRequests || [];
  const hasOwnPendingRequest = Boolean(
    participantId &&
      pendingRequests.some((request) => request?.participantId === participantId)
  );
  const canRequestEnable = Boolean(
    enabled &&
      role !== "umpire" &&
      participantId &&
      !hasOwnPendingRequest &&
      requestState !== "pending" &&
      !snapshot.enabled
  );
  const connectedSpectatorCount = Number(snapshot.spectatorCount || 0);
  const connectedDirectorCount = Number(snapshot.directorCount || 0);
  const hasRemoteAudience = Boolean(
    connectedSpectatorCount + connectedDirectorCount > 0
  );
  const keepReadyForTalk = Boolean(
    autoConnectAudio &&
      snapshot.enabled &&
      participantId &&
      hasWalkieToken &&
      (role !== "umpire" || hasRemoteAudience)
  );
  const canTalk = Boolean(
    enabled &&
      snapshot.enabled &&
      participantId &&
      hasWalkieToken &&
      !claiming &&
      (role !== "umpire" || hasRemoteAudience) &&
      (!snapshot.busy || snapshot.activeSpeakerId === participantId)
  );
  const isBusy = Boolean(snapshot.busy);
  const otherSpeakerBusy = Boolean(snapshot.busy && snapshot.activeSpeakerId !== participantId);
  const isLiveOrFinishing = Boolean(isSelfTalking || isFinishing);
  const [listeningGraceActive, setListeningGraceActive] = useState(false);
  const shouldMaintainAudioTransport = shouldMaintainWalkieAudioTransport({
    enabled,
    snapshot,
    participantId,
    hasWalkieToken,
    pageVisible: isPageVisible,
    autoConnectAudio,
    listeningGraceActive,
    manualAudioReady,
    isSelfTalking,
    isFinishing,
    keepReadyForTalk,
  });
  const shouldMaintainSignaling = shouldMaintainWalkieSignaling({
    enabled,
    matchId,
    signalingActive,
    manualSignalingActive,
  });
  const talkPathPrimed = Boolean(
    keepReadyForTalk &&
      shouldMaintainAudioTransport &&
      !recoveringAudio &&
      !recoveringSignaling &&
      !needsAudioUnlock
  );
  const persistentReadyState = Boolean(
    enabled &&
      snapshot.enabled &&
      participantId &&
      (role === "umpire" ? true : autoConnectAudio)
  );
  const shouldMaintainWalkiePresence = Boolean(
    enabled &&
      matchId &&
      participantId &&
      (
        isPageVisible ||
        shouldMaintainSignaling ||
        persistentReadyState ||
        hasOwnPendingRequest ||
        requestState === "pending" ||
        isSelfTalking ||
        isFinishing
      )
  );
  const nonUmpireUi = getNonUmpireWalkieUiState({
    sharedEnabled: snapshot.enabled,
    localEnabled: autoConnectAudio,
    isTalking: isSelfTalking,
    isFinishing,
    requestState,
    hasOwnPendingRequest,
  });
  shouldMaintainSignalingRef.current = shouldMaintainSignaling;
  pageVisibleRef.current = isPageVisible;

  const {
    dismissNotice,
    enableManualSignaling,
    scheduleRequestReset,
    setCooldown,
    setManualSignalingActive,
    startConnectingCueLoop,
    stopConnectingCueLoop,
    updateNotice,
  } = useMemo(
    () =>
      createWalkieRuntimeUiApi({
        connectCueLoopTimerRef,
        cooldownTimerRef,
        enabled,
        manualSignalingActiveRef,
        matchId,
        noticeRef,
        pageVisibleRef,
        requestResetMs: REQUEST_RESET_MS,
        requestResetRef,
        setManualSignalingActiveState,
        setNotice,
        setRequestCooldownLeft,
        setRequestState,
        shouldMaintainSignalingRef,
        signalingPropActiveRef,
      }),
    [enabled, matchId],
  );

  const {
    ensureAudioUnlock,
    ensureParticipantId,
    ensureParticipantToken,
    ensureRtcSessionId,
    fetchRtcToken,
    fetchSignalingToken,
    resetRtcSessionForReload,
    rotateRtcSessionId,
    startCountdown,
  } = useMemo(
    () =>
      createWalkieTokenLifecycleApi({
        countdownTimerRef,
        ensureRtcTokenFreshBufferMs: RTC_TOKEN_REFRESH_BUFFER_MS,
        ensureSignalTokenFreshBufferMs: SIGNAL_TOKEN_REFRESH_BUFFER_MS,
        isSafari,
        matchId,
        participantId,
        participantIdRef,
        participantTokenRef,
        role,
        rtcSessionIdRef,
        rtcTokenPromiseRef,
        rtcTokenRef,
        setCountdown,
        setHasWalkieToken,
        setNeedsAudioUnlock,
        setParticipantId,
        signalTokenPromiseRef,
        signalTokenRef,
        signalingChannelRef,
        signalingUserIdRef,
      }),
    [isSafari, matchId, participantId, role],
  );

  const {
    applyAuthoritativeSnapshot,
    applyMetadataState,
    applyPresenceSnapshot,
    broadcastMetadataState,
    getStartGateSnapshot,
    publishWalkieMessage,
    reconcileActiveSpeaker,
    refreshPresenceSnapshot,
    refreshRuntimeState,
    resolveActiveSpeaker,
    schedulePresenceRefresh,
    syncMetadataState,
    syncPersistentWalkieState,
    syncSnapshot,
  } = useMemo(
    () =>
      createWalkiePresenceSnapshotApi({
        activeSpeakerRef,
        activeSpeakerSourceRef,
        applyStateDelayMs: PRESENCE_REFRESH_DEBOUNCE_MS,
        authoritativeSnapshotRef,
        cleanupSignalingHandlerRef,
        ensureRtmSessionHandlerRef,
        matchId,
        metadataStateRef,
        participantsRef,
        presenceRefreshInFlightRef,
        presenceRefreshPendingRef,
        presenceRefreshTimerRef,
        role,
        rtmClientRef,
        rtmLoggedInRef,
        rtmReadyPromiseRef,
        rtmSubscribedRef,
        setSnapshot,
        signalingChannelRef,
        snapshotRef,
      }),
    [matchId, role],
  );

  const {
    cleanupLocalTrack,
    cleanupTransport,
    ensurePublishedTrack,
    ensureRtcClient,
    ensureTrack,
    joinRtc,
    muteRtcTrack,
    playRemoteAudioTrack,
    resetRtcRuntimeState,
    stopAllRemoteAudioPlayback,
    stopRemoteAudioPlayback,
    subscribeRemoteAudioUser,
    syncExistingRemoteAudioUsers,
    syncRemoteAudioPlayback,
    unpublishRtc,
  } = useMemo(
    () =>
      createWalkieRtcTransportApi({
        audioRetryTimerRef,
        countdownTimerRef,
        cooldownTimerRef,
        enabled,
        ensureParticipantId,
        fetchRtcToken,
        finishTimerRef,
        isFinishing,
        isSafari,
        isSelfTalking,
        matchId,
        participantIdRef,
        publishPromiseRef,
        releaseTimerRef,
        remoteAudioPlayingRef,
        remoteAudioTracksRef,
        role,
        rotateRtcSessionId,
        rtcClientRef,
        rtcJoinPromiseRef,
        rtcJoinedRef,
        rtcPublishedRef,
        rtcTokenPromiseRef,
        rtcTokenRef,
        rtcTrackRef,
        setAudioReconnectTick,
        setNeedsAudioUnlock,
        setRecoveringAudio,
        snapshotRef,
        trackPromiseRef,
        updateNotice,
      }),
    [
      enabled,
      ensureParticipantId,
      fetchRtcToken,
      isFinishing,
      isSafari,
      isSelfTalking,
      matchId,
      role,
      rotateRtcSessionId,
      updateNotice,
    ],
  );

  useEffect(() => {
    if (!shouldMaintainWalkiePresence) {
      return undefined;
    }

    const params = new URLSearchParams({
      role,
      participantId,
      name: defaultDisplayName(role, displayName),
      ready: persistentReadyState ? "1" : "0",
    });
    const source = new EventSource(`/api/live/walkie/${matchId}?${params.toString()}`);

    const handleState = (event) => {
      const payload = parseJson(event?.data);
      if (!payload || typeof payload !== "object") {
        return;
      }

      if (payload.token) {
        participantTokenRef.current = String(payload.token || "");
        setHasWalkieToken(Boolean(participantTokenRef.current || signalTokenRef.current?.token));
      }

      if (payload.snapshot) {
        applyAuthoritativeSnapshot(payload.snapshot);
      }
    };

    const handleParticipant = (event) => {
      const payload = parseJson(event?.data);
      if (!payload || typeof payload !== "object") {
        return;
      }

      if (payload.snapshot) {
        applyAuthoritativeSnapshot(payload.snapshot);
      }

      if (payload.type === "walkie-request" && role === "umpire") {
        updateNotice(`${payload.name || "Someone"} wants to use walkie-talkie.`);
        return;
      }

      if (payload.type === "request-sent") {
        setRequestState("pending");
        updateNotice("Waiting for umpire approval.");
        return;
      }

      if (payload.type === "request-accepted") {
        const requestId = String(payload.requestId || "");
        if (requestId && lastAcceptedRequestIdRef.current === requestId) {
          return;
        }
        lastAcceptedRequestIdRef.current = requestId;
        setRequestState("accepted");
        updateNotice("Walkie-talkie is live.");
        scheduleRequestReset();
        return;
      }

      if (payload.type === "request-dismissed") {
        const requestId = String(payload.requestId || "");
        if (requestId && lastDismissedRequestIdRef.current === requestId) {
          return;
        }
        lastDismissedRequestIdRef.current = requestId;
        setRequestState("dismissed");
        updateNotice("Walkie request dismissed.");
        scheduleRequestReset();
        return;
      }

      if (payload.type === "transmission-ended") {
        const remoteSpeakerEnded = Boolean(
          snapshotRef.current.activeSpeakerId &&
            snapshotRef.current.activeSpeakerId !== participantIdRef.current
        );
        if (remoteSpeakerEnded) {
          playWalkieCue("end");
        }
        updateNotice(
          payload.reason === "disabled" ? "Walkie-talkie is off." : "Channel is free."
        );
      }
    };

    const handleError = () => {
      void syncPersistentWalkieState().catch(() => {});
    };

    source.addEventListener("state", handleState);
    source.addEventListener("participant", handleParticipant);
    source.addEventListener("error", handleError);

    return () => {
      source.removeEventListener("state", handleState);
      source.removeEventListener("participant", handleParticipant);
      source.removeEventListener("error", handleError);
      source.close();
    };
  }, [
    applyAuthoritativeSnapshot,
    displayName,
    enabled,
    matchId,
    participantId,
    persistentReadyState,
    shouldMaintainWalkiePresence,
    role,
    scheduleRequestReset,
    syncPersistentWalkieState,
    updateNotice,
  ]);

  const {
    cleanupSignaling,
    ensureRtmSession,
    refreshSignal,
  } = useMemo(
    () =>
      createWalkieRtmSignalingApi({
        activeSpeakerRef,
        activeSpeakerSourceRef,
        applyAuthoritativeSnapshot,
        applyMetadataState,
        applyPresenceSnapshot,
        audioRetryTimerRef,
        autoConnectAudio,
        authoritativeSnapshotRef,
        broadcastMetadataState,
        cancelPendingStartRef,
        cleanupSignalingHandlerRef,
        cleanupTransport,
        displayName,
        enabled,
        ensureParticipantId,
        ensureRtmSessionHandlerRef,
        fetchSignalingToken,
        lastAcceptedRequestIdRef,
        lastDismissedRequestIdRef,
        lastRefreshRequestIdRef,
        lastSyncRequestAtRef,
        manualSignalingActiveRef,
        matchId,
        metadataStateRef,
        mountedRef,
        participantIdRef,
        participantTokenRef,
        participantsRef,
        presenceRefreshInFlightRef,
        presenceRefreshPendingRef,
        presenceRefreshTimerRef,
        publishWalkieMessage,
        refreshRuntimeState,
        refreshSignalPromiseRef,
        refreshSignalHandlerRef,
        remoteAudioLingerTimerRef,
        requestResetRef,
        resetRtcSessionForReload,
        role,
        rtmCleanupPromiseRef,
        rtmClientRef,
        rtmListenersRef,
        rtmLoggedInRef,
        rtmReadyPromiseRef,
        rtmSubscribedRef,
        schedulePresenceRefresh,
        scheduleRequestReset,
        setError,
        setHasWalkieToken,
        setRecoveringAudio,
        setRecoveringSignaling,
        setRequestState,
        setSignalingReconnectTick,
        shouldMaintainSignalingRef,
        signalTokenPromiseRef,
        signalTokenRef,
        signalingChannelRef,
        signalingGenerationRef,
        signalingPropActiveRef,
        signalingRecoverableFailuresRef,
        signalingRetryTimerRef,
        signalingUserIdRef,
        startTalkingPromiseRef,
        stopTalkingHandlerRef,
        syncPersistentWalkieState,
        syncSnapshot,
        updateNotice,
      }),
    [
      applyAuthoritativeSnapshot,
      applyMetadataState,
      applyPresenceSnapshot,
      autoConnectAudio,
      broadcastMetadataState,
      cleanupTransport,
      displayName,
      enabled,
      ensureParticipantId,
      fetchSignalingToken,
      matchId,
      publishWalkieMessage,
      refreshRuntimeState,
      resetRtcSessionForReload,
      role,
      schedulePresenceRefresh,
      scheduleRequestReset,
      syncPersistentWalkieState,
      syncSnapshot,
      updateNotice,
    ],
  );

  const prepareToTalk = useCallback(async () => {
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
  }, [
    enabled,
    ensureAudioUnlock,
    ensureParticipantId,
    ensureParticipantToken,
    ensurePublishedTrack,
    ensureTrack,
    enableManualSignaling,
    getStartGateSnapshot,
    isSafari,
    joinRtc,
    role,
    updateNotice,
  ]);

  const stopTalking = useCallback(
    async (reason = "released") => {
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
          snapshotRef.current.activeSpeakerId === selfId
      );
      if (!ownsSpeakerLock) {
        if (startTalkingPromiseRef.current) {
          cancelPendingStartRef.current = true;
          stopConnectingCueLoop();
          setClaiming(false);
          setManualAudioReady(false);
          return true;
        }
        if (manualAudioReady || rtcJoinedRef.current || rtcTrackRef.current) {
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
      const releaseDelayMs = immediateStop ? 0 : FINISH_TAIL_MS;
      const currentTransmissionId = String(activeSpeakerRef.current?.transmissionId || "");
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
            keepReadyForTalk
        );
        if (shouldKeepWarmAfterRelease) {
          await unpublishRtc();
        } else {
          await cleanupLocalTrack();
        }
        try {
          const participantToken = await ensureParticipantToken();
          const response = await requestJson(`/api/matches/${matchId}/walkie/release`, {
            participantId: selfId,
            role,
            token: participantToken,
          });
          applyAuthoritativeSnapshot(response?.walkie);

          const activeClient =
            rtmClientRef.current && rtmLoggedInRef.current && rtmSubscribedRef.current
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
                message: reason === "disabled" ? "Walkie-talkie is off." : "Channel is free.",
              },
              { client: activeClient, bestEffort: true }
            );
          }
        } catch (releaseError) {
          const releaseMessage = walkieMessageFor(releaseError, "Could not release walkie.");
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
        playWalkieCue("end");
        updateNotice(reason === "disabled" ? "Walkie-talkie is off." : "Channel is free.");
        setIsFinishing(false);
        setFinishDelayLeft(0);
        clearTimer(finishTimerRef, window.clearInterval);
        walkieConsole("info", "Walkie speaker stopped", {
          reason,
          participantId: selfId,
        });
      }, releaseDelayMs);
      return true;
    },
    [
      applyAuthoritativeSnapshot,
      cleanupTransport,
      cleanupLocalTrack,
      enabled,
      ensureParticipantToken,
      ensureParticipantId,
      keepReadyForTalk,
      manualAudioReady,
      matchId,
      publishWalkieMessage,
      role,
      stopConnectingCueLoop,
      syncPersistentWalkieState,
      syncSnapshot,
      unpublishRtc,
      updateNotice,
    ]
  );

  const startTalking = useCallback(
    async () => {
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
          updateNotice(`${gateSnapshot.activeSpeakerName || "Someone"} is talking.`);
          return false;
        }

        enableManualSignaling();

        clearTimer(releaseTimerRef);
        clearTimer(finishTimerRef, window.clearInterval);
        setError("");
        updateNotice("");
        setManualAudioReady(true);
        setIsFinishing(false);
        setFinishDelayLeft(0);
        setClaiming(true);

        const unlocked =
          manualAudioReady || rtcTrackRef.current ? true : await ensureAudioUnlock();
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
          updateNotice(TALK_RETRY_MESSAGES[Math.min(attempt - 1, TALK_RETRY_MESSAGES.length - 1)]);
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

            const claimResponse = await requestJson(`/api/matches/${matchId}/walkie/claim`, {
              participantId: selfId,
              role,
              token: participantToken,
            });
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
              new Date(Date.now() + WALKIE_SPEAKER_TTL_SECONDS * 1000).toISOString();

            startCountdown(expiresAt);
            setIsSelfTalking(true);
            stopConnectingCueLoop();
            playWalkieCue("start");
            updateNotice("");
            setClaiming(false);

            const participantName =
              nextSnapshot?.activeSpeakerName || defaultDisplayName(role, displayName);
            const activeClient =
              rtmClientRef.current && rtmLoggedInRef.current && rtmSubscribedRef.current
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
                { client: activeClient, bestEffort: true }
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
        const message = walkieMessageFor(lastError, "Could not start walkie audio.");
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
    },
    [
      applyAuthoritativeSnapshot,
      displayName,
      enabled,
      ensureParticipantToken,
      ensureAudioUnlock,
      ensureParticipantId,
      ensurePublishedTrack,
      enableManualSignaling,
      getStartGateSnapshot,
      isSafari,
      manualAudioReady,
      matchId,
      publishWalkieMessage,
      role,
      startConnectingCueLoop,
      startCountdown,
      startTalkingPromiseRef,
      stopConnectingCueLoop,
      stopTalking,
      syncPersistentWalkieState,
      syncSnapshot,
      cleanupTransport,
      updateNotice,
    ]
  );

  const requestEnable = useCallback(async () => {
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
        setRequestState("pending");
        const participant = participantsRef.current.get(signalingUserIdRef.current) || {
          participantId: selfId,
          role,
          name: defaultDisplayName(role, displayName),
        };
        if (metadataStateRef.current.enabled) {
          setRequestState("accepted");
          updateNotice("Walkie-talkie is live.");
          scheduleRequestReset();
          return true;
        }
        if (
          metadataStateRef.current.pendingRequests.some(
            (item) => item.participantId === participant.participantId
          )
        ) {
          setRequestState("pending");
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
          (item) => item.participantId === participant.participantId
        );

        const activeClient =
          rtmClientRef.current && rtmLoggedInRef.current && rtmSubscribedRef.current
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
                new Date(Date.now() + WALKIE_REQUEST_MAX_AGE_MS).toISOString(),
            },
            { client: activeClient, bestEffort: true },
          );
        }

        if (nextState.enabled) {
          setRequestState("accepted");
          updateNotice("Walkie-talkie is live.");
          scheduleRequestReset();
        } else {
          setRequestState("pending");
          updateNotice("Waiting for umpire approval.");
        }
        walkieConsole("info", "Walkie requested", {
          participantId: participant.participantId,
          role: participant.role,
        });
        return true;
      } catch (requestError) {
        const message = walkieMessageFor(requestError, "Could not request walkie.");
        const cooldownSeconds = parseWalkieCooldownSeconds(message);
        const refreshedState = await syncPersistentWalkieState().catch(() => null);
        const hasRefreshedOwnPendingRequest = Boolean(
          refreshedState?.pendingRequests?.some(
            (item) => item?.participantId === selfId
          )
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
          setRequestState("accepted");
          updateNotice("Walkie-talkie is live.");
          scheduleRequestReset();
          return true;
        }

        if (
          message === "Request already sent. Waiting for the umpire." ||
          hasRefreshedOwnPendingRequest
        ) {
          setRequestState("pending");
          updateNotice("Waiting for umpire approval.");
          setCooldown(cooldownSeconds);
          return true;
        }

        setCooldown(cooldownSeconds);
        setError(message);
        setRequestState("idle");
        walkieConsole(
          isWalkieNetworkError(requestError) ? "warn" : "error",
          "Walkie request failed",
          {
            stage: "request-enable",
            message,
          }
        );
        return false;
      }
    })().finally(() => {
      requestEnablePromiseRef.current = null;
    });

    return requestEnablePromiseRef.current;
  }, [
    applyAuthoritativeSnapshot,
    applyMetadataState,
    displayName,
    ensureParticipantId,
    enableManualSignaling,
    fetchSignalingToken,
    matchId,
    publishWalkieMessage,
    role,
    scheduleRequestReset,
    setCooldown,
    syncPersistentWalkieState,
    updateNotice,
  ]);

  const toggleEnabled = useCallback(
    async (nextEnabled) => {
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
            rtmClientRef.current && rtmLoggedInRef.current && rtmSubscribedRef.current
              ? rtmClientRef.current
              : null;
          if (activeClient) {
            void publishWalkieMessage(
              {
                type: "walkie-enabled",
                enabled: nextState.enabled,
                pendingRequests: nextState.pendingRequests,
              },
              { client: activeClient, bestEffort: true }
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

          updateNotice(nextEnabled ? "Walkie-talkie is live." : "Walkie-talkie is off.");
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
            }
          );
          return false;
        }
      })().finally(() => {
        setUpdatingEnabled(false);
        toggleEnabledPromiseRef.current = null;
      });

      return toggleEnabledPromiseRef.current;
    },
    [
      applyAuthoritativeSnapshot,
      canEnable,
      cleanupTransport,
      enableManualSignaling,
      isFinishing,
      isSelfTalking,
      matchId,
      publishWalkieMessage,
      stopTalking,
      syncSnapshot,
      updateNotice,
    ]
  );

  const respond = useCallback(
    async (requestId, action) => {
      if (respondPromiseRef.current) {
        return respondPromiseRef.current;
      }

      respondPromiseRef.current = (async () => {
        enableManualSignaling();
        try {
          setError("");
          const targetRequest =
            metadataStateRef.current.pendingRequests.find(
              (item) => item.requestId === requestId
            ) || null;
          const response = await requestJson(`/api/matches/${matchId}/walkie/respond`, {
            requestId,
            action,
          });
          applyAuthoritativeSnapshot(response?.walkie);

          const activeClient =
            rtmClientRef.current && rtmLoggedInRef.current && rtmSubscribedRef.current
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
              { client: activeClient, bestEffort: true }
            );
          }
          updateNotice(
            action === "accept"
              ? "Walkie-talkie is live."
              : "Walkie request dismissed."
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
            "Could not update walkie request."
          );
          setError(message);
          walkieConsole(
            isWalkieNetworkError(respondError) ? "warn" : "error",
            "Walkie request resolve failed",
            {
              stage: "request-response",
              action,
              message,
            }
          );
          return false;
        }
      })().finally(() => {
        respondPromiseRef.current = null;
      });

      return respondPromiseRef.current;
    },
    [
      applyAuthoritativeSnapshot,
      enableManualSignaling,
      matchId,
      publishWalkieMessage,
      updateNotice,
    ]
  );

  const acceptRequest = useCallback((requestId) => respond(requestId, "accept"), [respond]);
  const dismissRequest = useCallback((requestId) => respond(requestId, "dismiss"), [respond]);

  const unlockAudio = useCallback(async () => {
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
  }, [enableManualSignaling, ensureAudioUnlock, joinRtc, participantId]);

  stopTalkingHandlerRef.current = stopTalking;

  const deactivateAudio = useCallback(async ({ restartSignaling = false } = {}) => {
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
    if (noticeRef.current && TALK_RETRY_MESSAGES.includes(noticeRef.current)) {
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
  }, [
    cleanupSignaling,
    cleanupTransport,
    resetRtcSessionForReload,
    setManualSignalingActive,
    stopTalking,
    updateNotice,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopConnectingCueLoop();
    };
  }, [stopConnectingCueLoop]);

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
  }, []);

  useEffect(() => {
    if (matchId && enabled) {
      setParticipantId(storageParticipantId(matchId, role, walkieConsole));
    }
  }, [enabled, matchId, role]);

  useEffect(() => {
    participantIdRef.current = participantId;
  }, [participantId]);

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
    if (!shouldMaintainSignaling) {
      manualSignalingActiveRef.current = false;
      setManualSignalingActiveState(false);
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
      clearTimer(releaseTimerRef);
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

      const message = walkieMessageFor(connectError, "Walkie live connection is unavailable.");
      if (classification === "recoverable") {
        const failureCount = signalingRecoverableFailuresRef.current + 1;
        signalingRecoverableFailuresRef.current = failureCount;
        const retryDelay =
          failureCount >= SIGNALING_MAX_RECOVERABLE_RETRIES
            ? SIGNALING_RETRY_COOLDOWN_MS
            : Math.min(
                SIGNALING_RETRY_BASE_MS * 2 ** Math.max(0, failureCount - 1),
                SIGNALING_RETRY_MAX_MS
              );
        setRecoveringSignaling(true);
        walkieConsole("warn", "Walkie signaling setup delayed", {
          stage: "signaling-setup",
          retryDelay,
          failureCount,
          message,
        });
        if (failureCount >= SIGNALING_MAX_RECOVERABLE_RETRIES) {
          void cleanupSignaling();
          setError(
            "Walkie live connection looks blocked on this network or browser. Retrying automatically."
          );
          updateNotice(
            `Walkie live connection is blocked. Retrying in ${Math.ceil(
              retryDelay / 1000
            )}s.`
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
    ensureRtmSession,
    matchId,
    signalingReconnectTick,
    shouldMaintainSignaling,
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
      }, REMOTE_AUDIO_LINGER_MS);
      return;
    }

    if (!remoteAudioLingerTimerRef.current) {
      setListeningGraceActive(false);
    }
  }, [autoConnectAudio, participantId, snapshot, snapshot.activeSpeakerId, snapshot.enabled]);

  useEffect(() => {
    clearTimer(audioRetryTimerRef);
    if (shouldMaintainAudioTransport) {
      let cancelled = false;
      const shouldKeepPublishedTrack = Boolean(
        snapshot.enabled && (claiming || isSelfTalking || isFinishing)
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

          const message = walkieMessageFor(joinError, "Could not connect walkie audio.");
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
    if (noticeRef.current && TALK_RETRY_MESSAGES.includes(noticeRef.current)) {
      updateNotice("");
    }
    void cleanupTransport();
  }, [
    audioReconnectTick,
    autoConnectAudio,
    cleanupTransport,
    claiming,
    ensurePublishedTrack,
    isFinishing,
    isSelfTalking,
    joinRtc,
    manualAudioReady,
    shouldMaintainAudioTransport,
    snapshot.enabled,
    updateNotice,
  ]);

  useEffect(() => {
    const shouldPrefetchRtcToken = Boolean(
      enabled &&
        participantId &&
        snapshot.enabled &&
        hasWalkieToken &&
        (
          shouldMaintainAudioTransport ||
          manualAudioReady ||
          canTalk ||
          isSelfTalking ||
          isFinishing
        )
    );

    if (!shouldPrefetchRtcToken) {
      return;
    }

    void fetchRtcToken().catch(() => {});
  }, [
    autoConnectAudio,
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
    if (isSelfTalking || rtcPublishedRef.current) {
      void unpublishRtc();
      setIsSelfTalking(false);
      setIsFinishing(false);
      setFinishDelayLeft(0);
    }
    clearTimer(countdownTimerRef, window.clearInterval);
    setCountdown(0);
  }, [isSelfTalking, participantId, snapshot.activeSpeakerId, snapshot.expiresAt, startCountdown, unpublishRtc]);

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
        const activeExpiresAtMs = Date.parse(activeSpeakerRef.current.expiresAt || "");
        if (!Number.isFinite(activeExpiresAtMs) || activeExpiresAtMs <= Date.now()) {
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

  useEffect(() => {
    if (!enabled) {
      setNeedsAudioUnlock(false);
    }
  }, [enabled]);

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
        (!rtmClientRef.current || !rtmLoggedInRef.current || !rtmSubscribedRef.current)
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
  }, [shouldMaintainAudioTransport]);

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
      void cleanupTransport();
      void cleanupSignaling();
    },
    [cleanupSignaling, cleanupTransport]
  );

  return {
    participantId,
    snapshot,
    notice,
    error,
    countdown,
    finishDelayLeft,
    claiming,
    preparingToTalk,
    updatingEnabled,
    recoveringAudio,
    recoveringSignaling,
    isSelfTalking,
    isFinishing,
    isLiveOrFinishing,
    isBusy,
    otherSpeakerBusy,
    canEnable,
    canRequestEnable,
    hasOwnPendingRequest,
    canTalk,
    talkPathPrimed,
    hasRemoteAudience,
    nonUmpireUi,
    requestCooldownLeft,
    requestState,
    pendingRequests,
    needsAudioUnlock,
    toggleEnabled,
    startTalking,
    stopTalking,
    requestEnable,
    dismissNotice,
    unlockAudio,
    prepareToTalk,
    deactivateAudio,
    refreshSignal,
    acceptRequest,
    dismissRequest,
  };
}
