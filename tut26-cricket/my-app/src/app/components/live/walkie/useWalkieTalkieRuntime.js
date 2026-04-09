"use client";

/**
 * File overview:
 * Purpose: Encapsulates Live browser state, effects, and runtime coordination.
 * Main exports: useWalkieTalkie.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

/* eslint-disable react-hooks/refs */



import { useEffect, useMemo, useRef, useState } from "react";
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
  defaultDisplayName,
  EMPTY_WALKIE_SNAPSHOT,
  mergeWalkieSnapshots,
  normalizeAuthoritativeWalkieSnapshot,
} from "./walkie-talkie-state";
import {
  clearTimer,
  isExpectedWalkieTransportError,
  isRtcUidConflictError,
  isRtmPublishDisconnectedError,
  isWalkieNetworkError,
  loadRtc,
  loadRtm,
  parseJson,
  playWalkieCue,
  readPageVisibility,
  requestWalkieState,
  safariBrowser,
  waitForRtcConnected,
  walkieConsole,
} from "./walkie-talkie-support";
import { createWalkieTokenLifecycleApi } from "./token-lifecycle";
import { createWalkiePresenceSnapshotApi } from "./presence-snapshot";
import { createWalkieRtcTransportApi } from "./rtc-transport";
import { createWalkieRtmSignalingApi } from "./rtm-signaling";
import { createWalkieRuntimeUiApi } from "./runtime-ui";
import { createWalkieTalkActionsApi } from "./walkie-talk-actions";
import { createWalkieRequestFlowApi } from "./walkie-request-flow";
import { useWalkieTransportEffects } from "./walkie-transport-effects";
import { useWalkiePageLifecycle } from "./walkie-page-lifecycle";

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

  const talkActions = useMemo(
    () =>
      createWalkieTalkActionsApi({
        activeSpeakerRef,
        applyAuthoritativeSnapshot,
        cancelPendingStartRef,
        cleanupLocalTrack,
        cleanupTransport,
        countdownTimerRef,
        displayName,
        enabled,
        ensureAudioUnlock,
        ensureParticipantId,
        ensureParticipantToken,
        ensurePublishedTrack,
        ensureTrack,
        enableManualSignaling,
        finishTailMs: FINISH_TAIL_MS,
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
        talkRetryMessages: TALK_RETRY_MESSAGES,
        unpublishRtc,
        updateNotice,
        walkieSpeakerTtlSeconds: WALKIE_SPEAKER_TTL_SECONDS,
      }),
    [
      applyAuthoritativeSnapshot,
      cleanupLocalTrack,
      cleanupTransport,
      displayName,
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
      keepReadyForTalk,
      manualAudioReady,
      matchId,
      publishWalkieMessage,
      role,
      startConnectingCueLoop,
      startCountdown,
      stopConnectingCueLoop,
      syncPersistentWalkieState,
      syncSnapshot,
      unpublishRtc,
      updateNotice,
    ],
  );

  const { prepareToTalk, startTalking, stopTalking } = talkActions;

  const requestFlow = useMemo(
    () =>
      createWalkieRequestFlowApi({
        activeSpeakerRef,
        applyAuthoritativeSnapshot,
        applyMetadataState,
        audioRetryTimerRef,
        canEnable,
        cancelPendingStartRef,
        cleanupSignaling,
        cleanupTransport,
        countdownTimerRef,
        cooldownTimerRef,
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
        talkRetryMessages: TALK_RETRY_MESSAGES,
        toggleEnabledPromiseRef,
        updateNotice,
        walkieRequestMaxAgeMs: WALKIE_REQUEST_MAX_AGE_MS,
      }),
    [
      applyAuthoritativeSnapshot,
      applyMetadataState,
      canEnable,
      cleanupSignaling,
      cleanupTransport,
      displayName,
      enableManualSignaling,
      ensureAudioUnlock,
      ensureParticipantId,
      fetchSignalingToken,
      isFinishing,
      isSelfTalking,
      joinRtc,
      matchId,
      participantId,
      publishWalkieMessage,
      refreshSignal,
      role,
      scheduleRequestReset,
      setCooldown,
      setManualSignalingActive,
      resetRtcSessionForReload,
      stopTalking,
      syncPersistentWalkieState,
      syncSnapshot,
      updateNotice,
    ],
  );

  const {
    requestEnable,
    toggleEnabled,
    respond,
    acceptRequest,
    dismissRequest,
    unlockAudio,
    deactivateAudio,
  } = requestFlow;

  stopTalkingHandlerRef.current = stopTalking;

  useWalkiePageLifecycle({
    audioRetryTimerRef,
    cleanupSignaling,
    cleanupTransport,
    countdownTimerRef,
    cooldownTimerRef,
    enabled,
    hasOwnPendingRequest,
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
    snapshot,
    stopConnectingCueLoop,
    stopTalking,
  });

  useWalkieTransportEffects({
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
    recoverableRetryCooldownMs: SIGNALING_RETRY_COOLDOWN_MS,
    recoverableRetryLimit: SIGNALING_MAX_RECOVERABLE_RETRIES,
    remoteAudioLingerMs: REMOTE_AUDIO_LINGER_MS,
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
    signalingRetryBaseMs: SIGNALING_RETRY_BASE_MS,
    signalingRetryMaxMs: SIGNALING_RETRY_MAX_MS,
    signalingRetryTimerRef,
    snapshot,
    startCountdown,
    stopTalking,
    syncPersistentWalkieState,
    syncRemoteAudioPlayback,
    syncSnapshot,
    talkRetryMessages: TALK_RETRY_MESSAGES,
    unpublishRtc,
    updateNotice,
  });

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


