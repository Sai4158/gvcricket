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
import { playUiTone, primeUiAudio } from "../../lib/page-audio";
import {
  buildAgoraSignalingChannelName,
  buildAgoraUserId,
} from "../../lib/agora-channels";
import { getNonUmpireWalkieUiState } from "../../lib/walkie-device-state";
import {
  buildAgoraWalkieSnapshot,
  filterAgoraWalkieRequests,
  removeAgoraWalkieRequest,
  upsertAgoraWalkieRequest,
  WALKIE_CHANNEL_TYPE,
  WALKIE_SPEAKER_TTL_SECONDS,
  WALKIE_REQUEST_MAX_AGE_MS,
} from "../../lib/walkie-agora-runtime";
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

  const setManualSignalingActive = useCallback((nextActive) => {
    const next = Boolean(nextActive);
    if (manualSignalingActiveRef.current === next) {
      return;
    }
    manualSignalingActiveRef.current = next;
    shouldMaintainSignalingRef.current = shouldMaintainWalkieSignaling({
      enabled,
      matchId,
      pageVisible: pageVisibleRef.current,
      signalingActive: signalingPropActiveRef.current,
      manualSignalingActive: next,
    });
    setManualSignalingActiveState(next);
  }, [enabled, matchId]);

  const enableManualSignaling = useCallback(() => {
    if (!enabled || !matchId) {
      return;
    }
    setManualSignalingActive(true);
  }, [enabled, matchId, setManualSignalingActive]);

  const dismissNotice = useCallback(() => {
    noticeRef.current = "";
    setNotice("");
  }, []);

  const updateNotice = useCallback((next) => {
    const safe = String(next || "");
    if (noticeRef.current === safe) return;
    noticeRef.current = safe;
    setNotice(safe);
  }, []);

  const stopConnectingCueLoop = useCallback(() => {
    clearTimer(connectCueLoopTimerRef);
  }, []);

  const startConnectingCueLoop = useCallback(() => {
    if (typeof window === "undefined" || connectCueLoopTimerRef.current) {
      return;
    }

    const playConnectPattern = () => {
      playUiTone({ frequency: 880, durationMs: 180, type: "sine", volume: 0.09 });
      window.setTimeout(() => {
        playUiTone({ frequency: 980, durationMs: 180, type: "sine", volume: 0.095 });
      }, 170);
      window.setTimeout(() => {
        playUiTone({ frequency: 1080, durationMs: 180, type: "sine", volume: 0.1 });
      }, 340);
    };

    const loop = () => {
      playConnectPattern();
      connectCueLoopTimerRef.current = window.setTimeout(loop, 980);
    };

    loop();
  }, []);

  const stopRemoteAudioPlayback = useCallback((uid = "") => {
    const safeUid = String(uid || "");
    if (!safeUid) {
      return;
    }

    const track = remoteAudioTracksRef.current.get(safeUid);
    if (!track) {
      remoteAudioPlayingRef.current.delete(safeUid);
      return;
    }

    try {
      track.stop?.();
    } catch {
    }
    remoteAudioPlayingRef.current.delete(safeUid);
  }, []);

  const stopAllRemoteAudioPlayback = useCallback(() => {
    for (const uid of remoteAudioPlayingRef.current) {
      stopRemoteAudioPlayback(uid);
    }
    remoteAudioPlayingRef.current.clear();
  }, [stopRemoteAudioPlayback]);

  const playRemoteAudioTrack = useCallback(
    (uid = "") => {
      const safeUid = String(uid || "");
      if (!safeUid || remoteAudioPlayingRef.current.has(safeUid)) {
        return;
      }

      const track = remoteAudioTracksRef.current.get(safeUid);
      if (!track) {
        return;
      }

      try {
        track.setVolume?.(100);
      } catch {
      }

      try {
        track.play?.();
        remoteAudioPlayingRef.current.add(safeUid);
      } catch (playError) {
        setNeedsAudioUnlock(isSafari);
        updateNotice("Enable Audio if Safari blocks walkie playback.");
        walkieConsole("error", "RTC remote playback failed", {
          stage: "rtc-playback",
          message: messageFor(playError, "Remote playback failed."),
        });
      }
    },
    [isSafari, updateNotice]
  );

  const syncRemoteAudioPlayback = useCallback(() => {
    const shouldPlay = shouldPlayWalkieRemoteAudio({
      participantId: participantIdRef.current,
      snapshot: snapshotRef.current,
      isSelfTalking,
      isFinishing,
    });

    for (const [uid] of remoteAudioTracksRef.current) {
      if (shouldPlay) {
        playRemoteAudioTrack(uid);
      } else {
        stopRemoteAudioPlayback(uid);
      }
    }
  }, [isFinishing, isSelfTalking, playRemoteAudioTrack, stopRemoteAudioPlayback]);

  const subscribeRemoteAudioUser = useCallback(
    async (client, user) => {
      const uid = String(user?.uid || "");
      if (!client || !uid) {
        return false;
      }

      try {
        if (!user.audioTrack) {
          await client.subscribe(user, "audio");
        }

        const track = user.audioTrack;
        if (track) {
          try {
            track.setVolume?.(100);
          } catch {
          }
          remoteAudioTracksRef.current.set(uid, track);
        }

        syncRemoteAudioPlayback();
        return true;
      } catch (subscribeError) {
        setNeedsAudioUnlock(isSafari);
        updateNotice("Enable Audio if Safari blocks walkie playback.");
        walkieConsole("error", "RTC remote subscribe failed", {
          stage: "rtc-subscribe",
          uid,
          message: messageFor(subscribeError, "Remote subscribe failed."),
        });
        return false;
      }
    },
    [isSafari, syncRemoteAudioPlayback, updateNotice]
  );

  const syncExistingRemoteAudioUsers = useCallback(
    async (client = rtcClientRef.current) => {
      if (!client) {
        return;
      }

      const remoteUsers = Array.isArray(client.remoteUsers) ? client.remoteUsers : [];
      const audioUsers = remoteUsers.filter(
        (user) => Boolean(user?.hasAudio || user?.audioTrack)
      );

      if (!audioUsers.length) {
        syncRemoteAudioPlayback();
        return;
      }

      await Promise.allSettled(
        audioUsers.map((user) => subscribeRemoteAudioUser(client, user))
      );
      syncRemoteAudioPlayback();
    },
    [subscribeRemoteAudioUser, syncRemoteAudioPlayback]
  );

  const syncSnapshot = useCallback(() => {
    const runtimeSnapshot = buildAgoraWalkieSnapshot({
      enabled: metadataStateRef.current.enabled,
      pendingRequests: metadataStateRef.current.pendingRequests,
      participants: participantsRef.current,
      activeSpeaker: activeSpeakerRef.current,
    });
    const next = mergeWalkieSnapshots({
      authoritativeSnapshot: authoritativeSnapshotRef.current,
      runtimeSnapshot,
      runtimeSubscribed: rtmSubscribedRef.current,
      runtimePresenceAvailable: participantsRef.current.size > 0,
      activeSpeakerSource: activeSpeakerSourceRef.current,
    });
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const applyAuthoritativeSnapshot = useCallback(
    (nextSnapshot) => {
      const normalized = normalizeAuthoritativeWalkieSnapshot(nextSnapshot);
      if (!normalized) {
        return null;
      }

      authoritativeSnapshotRef.current = normalized;
      activeSpeakerSourceRef.current = "authoritative";
      metadataStateRef.current = {
        enabled: normalized.enabled,
        pendingRequests: normalized.pendingRequests,
      };
      activeSpeakerRef.current = buildLocalSpeakerFromSnapshot(normalized);
      syncSnapshot();
      return normalized;
    },
    [syncSnapshot]
  );

  const scheduleRequestReset = useCallback(() => {
    clearTimer(requestResetRef);
    requestResetRef.current = window.setTimeout(() => {
      setRequestState((current) => (current === "pending" ? current : "idle"));
      requestResetRef.current = null;
    }, REQUEST_RESET_MS);
  }, []);

  const setCooldown = useCallback((seconds) => {
    clearTimer(cooldownTimerRef, window.clearInterval);
    const next = Math.max(0, Number(seconds || 0));
    setRequestCooldownLeft(next);
    if (!next) return;
    const until = Date.now() + next * 1000;
    cooldownTimerRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRequestCooldownLeft(left);
      if (!left) clearTimer(cooldownTimerRef, window.clearInterval);
    }, 250);
  }, []);

  const ensureParticipantId = useCallback(() => {
    if (participantId) return participantId;
    const next = storageParticipantId(matchId, role, walkieConsole);
    if (next) setParticipantId(next);
    return next;
  }, [matchId, participantId, role]);

  const ensureRtcSessionId = useCallback(() => {
    const participant = ensureParticipantId();
    if (!matchId || !role || !participant) return "";
    if (rtcSessionIdRef.current) return rtcSessionIdRef.current;
    const key = `gv-walkie:${matchId}:${role}:${participant}:rtc-session`;
    const existing = readSessionValue(key);
    if (existing) {
      rtcSessionIdRef.current = existing;
      return existing;
    }
    const next = (crypto?.randomUUID?.() || `rtc${Math.random().toString(36).slice(2, 14)}`)
      .replace(/-/g, "")
      .slice(0, 16);
    writeSessionValue(key, next);
    rtcSessionIdRef.current = next;
    return next;
  }, [ensureParticipantId, matchId, role]);

  const rotateRtcSessionId = useCallback(() => {
    const participant = ensureParticipantId();
    if (!matchId || !role || !participant) return "";
    const key = `gv-walkie:${matchId}:${role}:${participant}:rtc-session`;
    const next = (crypto?.randomUUID?.() || `rtc${Math.random().toString(36).slice(2, 14)}`)
      .replace(/-/g, "")
      .slice(0, 16);
    writeSessionValue(key, next);
    rtcSessionIdRef.current = next;
    return next;
  }, [ensureParticipantId, matchId, role]);

  const resetRtcSessionForReload = useCallback(() => {
    const participant = participantIdRef.current || ensureParticipantId();
    if (!matchId || !role || !participant) {
      return;
    }

    clearStoredWalkieToken("rtc", matchId, role, participant);
    rtcTokenRef.current = null;
    rtcTokenPromiseRef.current = null;
    rotateRtcSessionId();
  }, [ensureParticipantId, matchId, role, rotateRtcSessionId]);

  const ensureAudioUnlock = useCallback(async () => {
    if (!isSafari) return true;
    const primed = await primeUiAudio();
    setNeedsAudioUnlock(!primed);
    return primed;
  }, [isSafari]);

  const fetchRtcToken = useCallback(async () => {
    if (isTokenFresh(rtcTokenRef.current, RTC_TOKEN_REFRESH_BUFFER_MS)) {
      return rtcTokenRef.current;
    }
    if (rtcTokenPromiseRef.current) {
      return rtcTokenPromiseRef.current;
    }
    const id = ensureParticipantId();
    const rtcSessionId = ensureRtcSessionId();
    if (!matchId || !id) throw new Error("Walkie is not ready yet.");
    const cached = readStoredWalkieToken("rtc", matchId, role, id, parseJson);
    if (isTokenFresh(cached, RTC_TOKEN_REFRESH_BUFFER_MS)) {
      const next = validateWalkieTokenPayload(cached, "RTC");
      rtcTokenRef.current = next;
      return next;
    }
    rtcTokenPromiseRef.current = requestJson("/api/agora/rtc-token", {
      matchId,
      participantId: id,
      rtcSessionId,
      role,
    })
      .then((payload) => {
        const next = withTokenExpiry(validateWalkieTokenPayload(payload, "RTC"));
        rtcTokenRef.current = next;
        writeStoredWalkieToken("rtc", matchId, role, id, next);
        walkieConsole("info", "RTC token ready", {
          channelName: next.channelName,
          userId: next.userId,
          expiresInSeconds: next.expiresInSeconds || 0,
        });
        return next;
      })
      .finally(() => {
        rtcTokenPromiseRef.current = null;
      });
    return rtcTokenPromiseRef.current;
  }, [ensureParticipantId, ensureRtcSessionId, matchId, role]);

  const fetchSignalingToken = useCallback(async () => {
    if (
      isTokenFresh(signalTokenRef.current, SIGNAL_TOKEN_REFRESH_BUFFER_MS) &&
      signalTokenRef.current?.participantToken
    ) {
      return signalTokenRef.current;
    }
    if (signalTokenPromiseRef.current) {
      return signalTokenPromiseRef.current;
    }
    const id = ensureParticipantId();
    if (!matchId || !id) throw new Error("Walkie is not ready yet.");
    const cached = readStoredWalkieToken("signal", matchId, role, id, parseJson);
    if (
      isTokenFresh(cached, SIGNAL_TOKEN_REFRESH_BUFFER_MS) &&
      cached?.participantToken
    ) {
      const next = validateWalkieTokenPayload(cached, "Signaling");
      signalTokenRef.current = next;
      participantTokenRef.current = String(next.participantToken || "");
      signalingUserIdRef.current = next?.userId || buildAgoraUserId(matchId, id, role);
      signalingChannelRef.current =
        next?.channelName || buildAgoraSignalingChannelName(matchId);
      setHasWalkieToken(Boolean(next?.token));
      return next;
    }
    clearStoredWalkieToken("signal", matchId, role, id);
    signalTokenPromiseRef.current = requestJson("/api/agora/signaling-token", {
      matchId,
      participantId: id,
      role,
    })
      .then((payload) => {
        const next = withTokenExpiry(validateWalkieTokenPayload(payload, "Signaling"));
        signalTokenRef.current = next;
        participantTokenRef.current = String(next.participantToken || "");
        writeStoredWalkieToken("signal", matchId, role, id, next);
        signalingUserIdRef.current = next?.userId || buildAgoraUserId(matchId, id, role);
        signalingChannelRef.current =
          next?.channelName || buildAgoraSignalingChannelName(matchId);
        setHasWalkieToken(Boolean(next?.token));
        walkieConsole("info", "Signaling token ready", {
          channelName: signalingChannelRef.current,
          userId: signalingUserIdRef.current,
          expiresInSeconds: next.expiresInSeconds || 0,
        });
        return next;
      })
      .finally(() => {
        signalTokenPromiseRef.current = null;
      });
    return signalTokenPromiseRef.current;
  }, [ensureParticipantId, matchId, role]);

  const ensureParticipantToken = useCallback(async () => {
    if (participantTokenRef.current) {
      return participantTokenRef.current;
    }

    if (signalTokenRef.current?.participantToken) {
      participantTokenRef.current = String(signalTokenRef.current.participantToken || "");
      return participantTokenRef.current;
    }

    const payload = await fetchSignalingToken();
    participantTokenRef.current = String(payload?.participantToken || "");
    return participantTokenRef.current;
  }, [fetchSignalingToken]);

  const startCountdown = useCallback((expiresAt) => {
    clearTimer(countdownTimerRef, window.clearInterval);
    const left = () =>
      Math.max(0, Math.ceil((new Date(expiresAt || Date.now()).getTime() - Date.now()) / 1000));
    setCountdown(left());
    countdownTimerRef.current = window.setInterval(() => {
      const next = left();
      setCountdown(next);
      if (!next) clearTimer(countdownTimerRef, window.clearInterval);
    }, 250);
  }, []);

  const ensureRtcClient = useCallback(async () => {
    if (rtcClientRef.current) return rtcClientRef.current;
    const AgoraRTC = await loadRtc();
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    client.on("user-published", async (user, mediaType) => {
      if (mediaType !== "audio") return;
      await subscribeRemoteAudioUser(client, user);
    });
    client.on("user-unpublished", (user, mediaType) => {
      if (mediaType === "audio") {
        const uid = String(user.uid || "");
        stopRemoteAudioPlayback(uid);
        remoteAudioTracksRef.current.delete(uid);
      }
    });
    client.on("user-left", (user) => {
      const uid = String(user?.uid || "");
      stopRemoteAudioPlayback(uid);
      remoteAudioTracksRef.current.delete(uid);
    });
    client.on("connection-state-change", (state) => {
      if (rtcClientRef.current !== client) {
        return;
      }
      if (state === "CONNECTED") {
        setRecoveringAudio(false);
        clearTimer(audioRetryTimerRef);
        void syncExistingRemoteAudioUsers(client);
      } else if (
        snapshotRef.current.enabled &&
        (state === "CONNECTING" || state === "RECONNECTING")
      ) {
        setRecoveringAudio(true);
      }
      if (state === "DISCONNECTED" && snapshotRef.current.enabled) {
        rtcJoinedRef.current = false;
        rtcPublishedRef.current = false;
        publishPromiseRef.current = null;
        setRecoveringAudio(true);
        updateNotice("Retrying audio...");
        setAudioReconnectTick((current) => current + 1);
      }
      walkieConsole("info", "RTC connection state", { state });
    });
    rtcClientRef.current = client;
    return client;
  }, [
    stopRemoteAudioPlayback,
    subscribeRemoteAudioUser,
    syncExistingRemoteAudioUsers,
    updateNotice,
  ]);

  const joinRtc = useCallback(async () => {
    if (!enabled || !snapshotRef.current.enabled) return null;
    if (rtcJoinedRef.current && rtcClientRef.current) return rtcClientRef.current;
    if (rtcJoinPromiseRef.current) return rtcJoinPromiseRef.current;
    rtcJoinPromiseRef.current = (async () => {
      let token = await fetchRtcToken();
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const client = await ensureRtcClient();
          await client.setClientRole("audience");
          await client.join(token.appId, token.channelName, token.token, token.userId);
          rtcJoinedRef.current = true;
          await syncExistingRemoteAudioUsers(client);
          walkieConsole("info", "RTC joined", {
            channelName: token.channelName,
            userId: token.userId,
          });
          return client;
        } catch (joinError) {
          lastError = joinError;
          clearStoredWalkieToken(
            "rtc",
            matchId,
            role,
            participantIdRef.current || ensureParticipantId()
          );
          if (isRtcUidConflictError(joinError)) {
            rotateRtcSessionId();
            const failedClient = rtcClientRef.current;
            rtcClientRef.current = null;
            rtcJoinedRef.current = false;
            rtcPublishedRef.current = false;
            if (failedClient) {
              try {
                await failedClient.leave?.();
              } catch {
              }
            }
          }
          rtcTokenRef.current = null;
          if (attempt < 3) {
            token = await fetchRtcToken();
          }
        }
      }
      throw lastError || new Error("Could not join walkie audio.");
    })().finally(() => {
      rtcJoinPromiseRef.current = null;
    });
    return rtcJoinPromiseRef.current;
  }, [
    enabled,
    ensureParticipantId,
    ensureRtcClient,
    fetchRtcToken,
    matchId,
    role,
    rotateRtcSessionId,
    syncExistingRemoteAudioUsers,
  ]);

  const ensureTrack = useCallback(async () => {
    if (rtcTrackRef.current) return rtcTrackRef.current;
    if (trackPromiseRef.current) return trackPromiseRef.current;
    trackPromiseRef.current = (async () => {
      const AgoraRTC = await loadRtc();
      const track = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        AGC: true,
        ANS: true,
        encoderConfig: {
          sampleRate: 48000,
          stereo: false,
          bitrate: 48,
        },
      });
      const mediaTrack = track.getMediaStreamTrack?.();
      if (mediaTrack) mediaTrack.contentHint = "speech";
      if (typeof track.setMuted === "function") await track.setMuted(true);
      rtcTrackRef.current = track;
      return track;
    })().finally(() => {
      trackPromiseRef.current = null;
    });
    return trackPromiseRef.current;
  }, []);

  const muteRtcTrack = useCallback(async () => {
    const track = rtcTrackRef.current;
    if (track && typeof track.setMuted === "function") {
      try {
        await track.setMuted(true);
      } catch {
      }
    }
  }, []);

  const resetRtcRuntimeState = useCallback(async (client = null) => {
    const targetClient = client || rtcClientRef.current || null;
    rtcJoinedRef.current = false;
    rtcPublishedRef.current = false;
    rtcJoinPromiseRef.current = null;
    publishPromiseRef.current = null;

    if (targetClient && rtcClientRef.current === targetClient) {
      rtcClientRef.current = null;
    }

    if (targetClient) {
      try {
        await targetClient.leave?.();
      } catch {
      }
    }
  }, []);

  const ensurePublishedTrack = useCallback(async () => {
    if (!rtcPublishedRef.current) {
      if (!publishPromiseRef.current) {
        publishPromiseRef.current = (async () => {
          const trackPromise = ensureTrack();
          const [rtcClient, track] = await Promise.all([joinRtc(), trackPromise]);
          if (!rtcClient || !track) {
            throw new Error("Walkie audio is unavailable.");
          }

          await waitForRtcConnected(rtcClient, 1500);
          if (rtcClient.connectionState !== "CONNECTED") {
            throw new Error("Walkie audio is still connecting.");
          }

          try {
            await rtcClient.setClientRole("host");
            await waitForRtcConnected(rtcClient, 600);
            if (rtcClient.connectionState !== "CONNECTED") {
              throw new Error("Walkie audio is still connecting.");
            }

            if (!rtcPublishedRef.current) {
              if (typeof track.setMuted === "function") {
                await track.setMuted(true);
              }
              await rtcClient.publish([track]);
              rtcPublishedRef.current = true;
              await wait(80);
            }
          } catch (publishError) {
            if (
              rtcClient.connectionState !== "CONNECTED" ||
              isExpectedWalkieTransportError(publishError)
            ) {
              await resetRtcRuntimeState(rtcClient);
              throw new Error("Walkie audio is still connecting.");
            }
            throw publishError;
          }

          return { rtcClient, track };
        })().finally(() => {
          publishPromiseRef.current = null;
        });
      }
      return publishPromiseRef.current;
    }

    const trackPromise = ensureTrack();
    const [rtcClient, track] = await Promise.all([joinRtc(), trackPromise]);
    return { rtcClient, track };
  }, [ensureTrack, joinRtc, resetRtcRuntimeState]);

  const unpublishRtc = useCallback(async () => {
    const client = rtcClientRef.current;
    const track = rtcTrackRef.current;
    if (client && rtcPublishedRef.current && track) {
      try {
        await client.unpublish([track]);
      } catch {
      }
    }
    await muteRtcTrack();
    if (client && rtcJoinedRef.current) {
      try {
        await client.setClientRole("audience");
      } catch {
      }
    }
    rtcPublishedRef.current = false;
  }, [muteRtcTrack]);

  const cleanupLocalTrack = useCallback(async () => {
    await unpublishRtc();
    const track = rtcTrackRef.current;
    rtcTrackRef.current = null;
    if (track) {
      try {
        track.stop();
        track.close();
      } catch {
      }
    }
    trackPromiseRef.current = null;
    publishPromiseRef.current = null;
  }, [unpublishRtc]);

  const cleanupTransport = useCallback(async () => {
    clearTimer(releaseTimerRef);
    clearTimer(finishTimerRef, window.clearInterval);
    clearTimer(countdownTimerRef, window.clearInterval);
    clearTimer(cooldownTimerRef, window.clearInterval);
    stopAllRemoteAudioPlayback();
    remoteAudioTracksRef.current.clear();
    await cleanupLocalTrack();
    const client = rtcClientRef.current;
    rtcClientRef.current = null;
    if (client && rtcJoinedRef.current) {
      try {
        await client.leave();
      } catch {
      }
    }
    rtcJoinedRef.current = false;
    rtcPublishedRef.current = false;
    rtcTokenRef.current = null;
    rtcJoinPromiseRef.current = null;
    rtcTokenPromiseRef.current = null;
  }, [cleanupLocalTrack, stopAllRemoteAudioPlayback]);

  const resolveActiveSpeaker = useCallback((owner, ttlSeconds = WALKIE_SPEAKER_TTL_SECONDS) => {
    if (!owner) {
      activeSpeakerSourceRef.current = "runtime";
      activeSpeakerRef.current = null;
      syncSnapshot();
      return;
    }
    const participant = participantsRef.current.get(owner);
    const now = Date.now();
    activeSpeakerSourceRef.current = "runtime";
    activeSpeakerRef.current = {
      owner,
      participantId: participant?.participantId || "",
      role: participant?.role || "",
      name: participant?.name || "",
      lockStartedAt: nowIso(),
      expiresAt: new Date(now + Number(ttlSeconds || WALKIE_SPEAKER_TTL_SECONDS) * 1000).toISOString(),
      transmissionId:
        activeSpeakerRef.current?.owner === owner && activeSpeakerRef.current?.transmissionId
          ? activeSpeakerRef.current.transmissionId
          : `agora:${owner}:${now}`,
    };
    syncSnapshot();
  }, [syncSnapshot]);

  const reconcileActiveSpeaker = useCallback(
    (participants = participantsRef.current) => {
      const current = activeSpeakerRef.current;
      if (!current?.owner) {
        syncSnapshot();
        return;
      }

      const expiresAtMs = Date.parse(current.expiresAt || "");
      if (
        !participants.has(current.owner) ||
        (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now())
      ) {
        activeSpeakerSourceRef.current = "runtime";
        activeSpeakerRef.current = null;
        syncSnapshot();
        return;
      }

      const participant = participants.get(current.owner);
      activeSpeakerSourceRef.current = "runtime";
      activeSpeakerRef.current = {
        ...current,
        participantId: participant?.participantId || current.participantId || "",
        role: participant?.role || current.role || "",
        name: participant?.name || current.name || "",
      };
      syncSnapshot();
    },
    [syncSnapshot]
  );

  const applyPresenceSnapshot = useCallback(
    (occupants) => {
      const next = new Map();
      for (const occupant of occupants || []) {
        const state = occupant?.states || {};
        const nextRole =
          state.role === "umpire"
            ? "umpire"
            : state.role === "director"
            ? "director"
            : state.role === "spectator"
            ? "spectator"
            : "";
        next.set(String(occupant.userId || ""), {
          userId: String(occupant.userId || ""),
          participantId: String(state.participantId || ""),
          role: nextRole,
          name: defaultDisplayName(nextRole || role, state.name || ""),
        });
      }
      participantsRef.current = next;
      reconcileActiveSpeaker(next);
    },
    [reconcileActiveSpeaker, role]
  );

  const applyMetadataState = useCallback(
    (nextState) => {
      metadataStateRef.current = {
        enabled: Boolean(nextState?.enabled),
        pendingRequests: filterAgoraWalkieRequests(nextState?.pendingRequests),
      };
      syncSnapshot();
    },
    [syncSnapshot]
  );

  const publishWalkieMessage = useCallback(
    async (payload, { client = rtmClientRef.current, bestEffort = false } = {}) => {
      const message =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      let activeClient = client;
      let lastError = null;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          if (!activeClient || !rtmLoggedInRef.current || !rtmSubscribedRef.current) {
            activeClient = await ensureRtmSessionHandlerRef.current?.();
          }

          const channelName = signalingChannelRef.current;
          if (!activeClient || !channelName) {
            throw new Error("Walkie signaling is reconnecting.");
          }

          await activeClient.publish(channelName, message);
          return true;
        } catch (publishError) {
          lastError = publishError;
          if (!isRtmPublishDisconnectedError(publishError) || attempt >= 2) {
            if (bestEffort) {
              walkieConsole("warn", "Walkie publish skipped", {
                stage: "rtm-publish",
                message: messageFor(
                  publishError,
                  "Walkie message could not be sent.",
                ),
              });
              return false;
            }
            throw publishError;
          }

          rtmReadyPromiseRef.current = null;
          try {
            await cleanupSignalingHandlerRef.current?.();
          } catch {
            // Retry with a fresh RTM session below.
          }
          activeClient = null;
        }
      }

      if (bestEffort) {
        return false;
      }
      throw lastError || new Error("Walkie signaling is reconnecting.");
    },
    [],
  );

  const broadcastMetadataState = useCallback(
    async (client = rtmClientRef.current, nextState = metadataStateRef.current) => {
      if (!client || !signalingChannelRef.current) return;
      const normalized = {
        enabled: Boolean(nextState?.enabled),
        pendingRequests: filterAgoraWalkieRequests(nextState?.pendingRequests),
      };
      await publishWalkieMessage(
        {
          type: "walkie-sync-state",
          enabled: normalized.enabled,
          pendingRequests: normalized.pendingRequests,
        },
        { client, bestEffort: true },
      );
    },
    [publishWalkieMessage]
  );

  const refreshPresenceSnapshot = useCallback(
    async (client = rtmClientRef.current) => {
      if (!client || !signalingChannelRef.current) return;
      const response = await client.presence.getOnlineUsers(
        signalingChannelRef.current,
        WALKIE_CHANNEL_TYPE,
        {
          includedUserId: true,
          includedState: true,
        }
      );
      applyPresenceSnapshot(response?.occupants || []);
    },
    [applyPresenceSnapshot]
  );

  const schedulePresenceRefresh = useCallback(
    (client = rtmClientRef.current, delayMs = PRESENCE_REFRESH_DEBOUNCE_MS) => {
      if (!client || !signalingChannelRef.current) {
        return;
      }

      presenceRefreshPendingRef.current = true;
      if (presenceRefreshTimerRef.current) {
        return;
      }

      presenceRefreshTimerRef.current = window.setTimeout(async () => {
        presenceRefreshTimerRef.current = null;
        if (presenceRefreshInFlightRef.current) {
          schedulePresenceRefresh(client, delayMs);
          return;
        }

        presenceRefreshPendingRef.current = false;
        presenceRefreshInFlightRef.current = true;
        try {
          await refreshPresenceSnapshot(client);
        } finally {
          presenceRefreshInFlightRef.current = false;
          if (presenceRefreshPendingRef.current) {
            schedulePresenceRefresh(client, delayMs);
          }
        }
      }, Math.max(0, Number(delayMs || 0)));
    },
    [refreshPresenceSnapshot]
  );

  const refreshRuntimeState = useCallback(
    async (client = rtmClientRef.current) => {
      try {
        await refreshPresenceSnapshot(client);
      } catch (presenceError) {
        walkieConsole("error", "Walkie presence refresh failed", {
          stage: "presence-refresh",
          message: messageFor(presenceError, "Walkie presence refresh failed."),
        });
      }
    },
    [refreshPresenceSnapshot]
  );

  const syncMetadataState = useCallback(
    async (nextState, client = rtmClientRef.current) => {
      const normalized = {
        enabled: Boolean(nextState?.enabled),
        pendingRequests: filterAgoraWalkieRequests(nextState?.pendingRequests),
      };
      applyMetadataState(normalized);
      await broadcastMetadataState(client, normalized);
      return normalized;
    },
    [applyMetadataState, broadcastMetadataState]
  );

  const syncPersistentWalkieState = useCallback(async () => {
    if (!matchId) {
      return null;
    }

    const payload = await requestWalkieState(`/api/matches/${matchId}/walkie`);
    return applyAuthoritativeSnapshot(payload?.walkie);
  }, [applyAuthoritativeSnapshot, matchId]);

  const getStartGateSnapshot = useCallback(async () => {
    const authoritative =
      (await syncPersistentWalkieState().catch(() => null)) ||
      authoritativeSnapshotRef.current ||
      normalizeAuthoritativeWalkieSnapshot(snapshotRef.current);

    return authoritative || EMPTY_WALKIE_SNAPSHOT;
  }, [syncPersistentWalkieState]);

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

  const ensureRtmSession = useCallback(async () => {
    if (
      !enabled ||
      !matchId ||
      (!signalingPropActiveRef.current && !manualSignalingActiveRef.current)
    ) {
      throw new Error("Walkie is not available.");
    }
    if (rtmCleanupPromiseRef.current) {
      await rtmCleanupPromiseRef.current.catch(() => {});
    }
    if (rtmClientRef.current && rtmLoggedInRef.current && rtmSubscribedRef.current) {
      return rtmClientRef.current;
    }
    if (rtmReadyPromiseRef.current) {
      return rtmReadyPromiseRef.current;
    }
    rtmReadyPromiseRef.current = (async () => {
      const generation = signalingGenerationRef.current;
      const token = await fetchSignalingToken();
      const AgoraRTM = await loadRtm();
      const RTM = AgoraRTM?.RTM || AgoraRTM;
      if (!RTM) {
        throw new Error("Agora signaling is unavailable.");
      }
      if (
        generation !== signalingGenerationRef.current ||
        !shouldMaintainSignalingRef.current
      ) {
        throw new Error("Walkie signaling changed before setup completed.");
      }
      const id = ensureParticipantId();
      const userId = token?.userId || buildAgoraUserId(matchId, id, role);
      const channelName = token?.channelName || buildAgoraSignalingChannelName(matchId);
      if (!token?.token) {
        throw new Error("Signaling token missing.");
      }
      if (!token?.appId) {
        throw new Error("Signaling app id missing.");
      }
      signalingUserIdRef.current = userId;
      signalingChannelRef.current = channelName;

      if (rtmClientRef.current && (!rtmLoggedInRef.current || !rtmSubscribedRef.current)) {
        walkieConsole("warn", "Discarding partial signaling client", {
          stage: "rtm-reset",
          loggedIn: rtmLoggedInRef.current,
          subscribed: rtmSubscribedRef.current,
        });
        try {
          await rtmClientRef.current.logout?.();
        } catch {
        }
        rtmClientRef.current = null;
        rtmListenersRef.current = null;
        rtmLoggedInRef.current = false;
        rtmSubscribedRef.current = false;
      }

      if (!rtmClientRef.current) {
        const client = new RTM(token.appId, userId, {
          logUpload: false,
          logLevel: "none",
          presenceTimeout: 20,
          useStringUserId: true,
        });

        const onStatus = (event) => {
          if (event?.reason === "TOKEN_EXPIRED") {
            setError("Walkie connection expired. Reconnecting...");
          }
        };

        const onPresence = (event) => {
          if (event?.channelName !== signalingChannelRef.current) return;
          if (Array.isArray(event?.snapshot) && event.snapshot.length) {
            applyPresenceSnapshot(
              event.snapshot.map((item) => ({
                userId: item.userId,
                states: item.states,
              }))
            );
            return;
          }
          schedulePresenceRefresh(client);
        };

        const onLock = () => {};

        const onMessage = (event) => {
          if (
            event?.channelType === WALKIE_CHANNEL_TYPE &&
            event?.channelName !== signalingChannelRef.current
          ) {
            return;
          }
          const payload =
            typeof event?.message === "string" ? parseJson(event.message) : null;
          if (!payload?.type) return;

          if (payload.type === "walkie-request") {
            applyMetadataState({
              enabled: metadataStateRef.current.enabled,
              pendingRequests: upsertAgoraWalkieRequest(
                metadataStateRef.current.pendingRequests,
                {
                  requestId: String(payload.requestId || ""),
                  participantId: String(payload.participantId || ""),
                  role:
                    payload.role === "director"
                      ? "director"
                      : payload.role === "spectator"
                      ? "spectator"
                      : "",
                  name: String(payload.name || ""),
                  signalingUserId: String(payload.signalingUserId || ""),
                  requestedAt: String(payload.requestedAt || nowIso()),
                  expiresAt: String(
                    payload.expiresAt ||
                      new Date(Date.now() + WALKIE_REQUEST_MAX_AGE_MS).toISOString()
                  ),
                }
              ),
            });
            if (role === "umpire") {
              updateNotice(`${payload.name || "Someone"} wants to use walkie-talkie.`);
            }
            return;
          }

          if (payload.type === "walkie-request-accepted") {
            applyMetadataState({
              enabled: true,
              pendingRequests: removeAgoraWalkieRequest(
                metadataStateRef.current.pendingRequests,
                String(payload.requestId || "")
              ),
            });
            if (payload.participantId === participantIdRef.current) {
              const requestId = String(payload.requestId || "");
              if (requestId && lastAcceptedRequestIdRef.current === requestId) {
                return;
              }
              lastAcceptedRequestIdRef.current = requestId;
              setRequestState("accepted");
              updateNotice("Walkie-talkie is live.");
              scheduleRequestReset();
            }
            return;
          }

          if (payload.type === "walkie-request-dismissed") {
            applyMetadataState({
              enabled: metadataStateRef.current.enabled,
              pendingRequests: removeAgoraWalkieRequest(
                metadataStateRef.current.pendingRequests,
                String(payload.requestId || "")
              ),
            });
            if (payload.participantId === participantIdRef.current) {
              const requestId = String(payload.requestId || "");
              if (requestId && lastDismissedRequestIdRef.current === requestId) {
                return;
              }
              lastDismissedRequestIdRef.current = requestId;
              setRequestState("dismissed");
              updateNotice("Walkie request dismissed.");
              scheduleRequestReset();
            }
            return;
          }

          if (payload.type === "walkie-sync-state") {
            applyMetadataState({
              enabled: Boolean(payload.enabled),
              pendingRequests: payload.pendingRequests,
            });
            return;
          }

          if (payload.type === "walkie-sync-request") {
            if (
              metadataStateRef.current.enabled ||
              metadataStateRef.current.pendingRequests.length > 0 ||
              role === "umpire"
            ) {
              void broadcastMetadataState(client, metadataStateRef.current);
            }
            return;
          }

          if (payload.type === "walkie-enabled") {
            const nextPendingRequests = Array.isArray(payload.pendingRequests)
              ? payload.pendingRequests
              : payload.enabled
              ? metadataStateRef.current.pendingRequests
              : [];
            applyMetadataState({
              enabled: Boolean(payload.enabled),
              pendingRequests: nextPendingRequests,
            });
            updateNotice(payload.enabled ? "Walkie-talkie is live." : "Walkie-talkie is off.");
            return;
          }

          if (payload.type === "walkie-refresh-request") {
            const requestId = String(payload.requestId || "");
            const sourceParticipantId = String(payload.participantId || "");
            if (
              (requestId && requestId === lastRefreshRequestIdRef.current) ||
              sourceParticipantId === participantIdRef.current
            ) {
              return;
            }
            lastRefreshRequestIdRef.current = requestId;
            updateNotice(payload.message || `${payload.name || "Someone"} refreshed walkie signal.`);
            void refreshSignalHandlerRef.current?.({
              propagate: false,
              source: "remote",
            });
            return;
          }

          if (payload.type === "walkie-speaker-started") {
            activeSpeakerSourceRef.current = "runtime";
            activeSpeakerRef.current = {
              owner: String(payload.userId || payload.signalingUserId || ""),
              participantId: String(payload.participantId || ""),
              role:
                payload.role === "umpire"
                  ? "umpire"
                  : payload.role === "director"
                  ? "director"
                  : payload.role === "spectator"
                  ? "spectator"
                  : "",
              name: String(payload.name || ""),
              lockStartedAt: String(payload.lockStartedAt || nowIso()),
              expiresAt: String(
                payload.expiresAt ||
                  new Date(Date.now() + WALKIE_SPEAKER_TTL_SECONDS * 1000).toISOString()
              ),
              transmissionId: String(payload.transmissionId || ""),
            };
            syncSnapshot();
            if (payload.participantId !== participantIdRef.current) {
              playWalkieCue("start");
              updateNotice(payload.message || `${payload.name || "Someone"} is talking.`);
            }
            return;
          }

          if (payload.type === "walkie-speaker-ended") {
            const transmissionId = String(payload.transmissionId || "");
            const wasRemoteSpeaker = Boolean(
              activeSpeakerRef.current?.participantId &&
                activeSpeakerRef.current.participantId !== participantIdRef.current
            );
            if (
              !transmissionId ||
              transmissionId === String(activeSpeakerRef.current?.transmissionId || "")
            ) {
              activeSpeakerSourceRef.current = "runtime";
              activeSpeakerRef.current = null;
              syncSnapshot();
            }
            if (wasRemoteSpeaker) {
              playWalkieCue("end");
            }
            updateNotice(payload.message || "Channel is free.");
          }
        };

        const onTokenWillExpire = async () => {
          try {
            clearStoredWalkieToken("signal", matchId, role, participantIdRef.current || id);
            signalTokenRef.current = null;
            const next = await fetchSignalingToken();
            await client.renewToken(next.token);
          } catch (renewError) {
            walkieConsole("error", "Signaling token renew failed", {
              stage: "rtm-renew",
              message: messageFor(renewError, "Could not renew signaling token."),
            });
          }
        };

        client.addEventListener("status", onStatus);
        client.addEventListener("presence", onPresence);
        client.addEventListener("message", onMessage);
        client.addEventListener("tokenPrivilegeWillExpire", onTokenWillExpire);

        rtmListenersRef.current = {
          onStatus,
          onPresence,
          onMessage,
          onTokenWillExpire,
        };
        rtmClientRef.current = client;
      }

      const client = rtmClientRef.current;
      await client
        .updateConfig?.({
          logUpload: false,
          logLevel: "none",
        })
        .catch(() => {});

      if (!rtmLoggedInRef.current) {
        walkieConsole("info", "Signaling login starting", {
          channelName,
          userId,
        });
        await client.login({ token: token.token });
        rtmLoggedInRef.current = true;
        walkieConsole("info", "Signaling login ready", {
          channelName,
          userId,
        });
      }

      if (!rtmSubscribedRef.current) {
        await client.subscribe(channelName, {
          withMessage: true,
          withPresence: true,
        });
        rtmSubscribedRef.current = true;
        walkieConsole("info", "Signaling subscribed", { channelName });
      }

      await client.presence.setState(channelName, WALKIE_CHANNEL_TYPE, {
        participantId: id,
        role,
        name: defaultDisplayName(role, displayName),
      });

      await refreshRuntimeState(client);
      if (Number(authoritativeSnapshotRef.current?.version || 0) <= 0) {
        try {
          await syncPersistentWalkieState();
        } catch (syncError) {
          walkieConsole("warn", "Walkie persistent state sync skipped", {
            stage: "persistent-sync",
            message: messageFor(
              syncError,
              "Walkie persistent state could not be loaded."
            ),
          });
        }
      }
      const now = Date.now();
      const shouldRequestSync =
        now - lastSyncRequestAtRef.current >= SIGNALING_SYNC_REQUEST_MIN_GAP_MS;
      if (shouldRequestSync) {
        lastSyncRequestAtRef.current = now;
        try {
          await publishWalkieMessage(
            {
              type: "walkie-sync-request",
            },
            { client, bestEffort: true },
          );
        } catch (syncRequestError) {
          walkieConsole("warn", "Walkie sync request skipped", {
            stage: "rtm-sync-request",
            message: messageFor(
              syncRequestError,
              "Walkie sync request could not be sent."
            ),
          });
        }
      }
      signalingRecoverableFailuresRef.current = 0;
      setRecoveringSignaling(false);
      setHasWalkieToken(true);
      walkieConsole("info", "Walkie signaling ready", {
        channelName,
        userId,
        enabled: metadataStateRef.current.enabled,
      });
      return client;
    })().finally(() => {
      rtmReadyPromiseRef.current = null;
    });
    return rtmReadyPromiseRef.current;
  }, [
    applyMetadataState,
    applyPresenceSnapshot,
    broadcastMetadataState,
    displayName,
    enabled,
    ensureParticipantId,
    fetchSignalingToken,
    matchId,
    refreshRuntimeState,
    role,
    schedulePresenceRefresh,
    scheduleRequestReset,
    syncPersistentWalkieState,
    syncSnapshot,
    updateNotice,
    publishWalkieMessage,
  ]);

  ensureRtmSessionHandlerRef.current = ensureRtmSession;

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

  const cleanupSignaling = useCallback(async () => {
    if (rtmCleanupPromiseRef.current) {
      await rtmCleanupPromiseRef.current.catch(() => {});
      return;
    }
    clearTimer(requestResetRef);
    clearTimer(presenceRefreshTimerRef);
    presenceRefreshInFlightRef.current = false;
    presenceRefreshPendingRef.current = false;
    signalingGenerationRef.current += 1;
    const cleanupTask = (async () => {
      const client = rtmClientRef.current;
      const listeners = rtmListenersRef.current;
      const channelName = signalingChannelRef.current;
      rtmReadyPromiseRef.current = null;
      signalTokenRef.current = null;
      signalTokenPromiseRef.current = null;
      signalingUserIdRef.current = "";
      signalingChannelRef.current = "";
      if (client) {
        try {
          if (channelName && rtmSubscribedRef.current) {
            try {
              await client.presence.removeState(channelName, WALKIE_CHANNEL_TYPE);
            } catch {
            }
            await client.unsubscribe(channelName).catch(() => {});
          }
        } catch {
        }
        if (listeners) {
          client.removeEventListener("status", listeners.onStatus);
          client.removeEventListener("presence", listeners.onPresence);
          if (listeners.onLock) {
            client.removeEventListener("lock", listeners.onLock);
          }
          client.removeEventListener("message", listeners.onMessage);
          client.removeEventListener("tokenPrivilegeWillExpire", listeners.onTokenWillExpire);
        }
        try {
          if (rtmLoggedInRef.current) {
            await client.logout();
          }
        } catch {
        }
      }
      rtmClientRef.current = null;
      rtmListenersRef.current = null;
      rtmLoggedInRef.current = false;
      rtmSubscribedRef.current = false;
      participantsRef.current = new Map();
      metadataStateRef.current = { enabled: false, pendingRequests: [] };
      activeSpeakerRef.current = null;
      setHasWalkieToken(Boolean(participantTokenRef.current));
      syncSnapshot();
      if (channelName) {
        walkieConsole("info", "Walkie signaling cleaned up", {
          channelName,
        });
      }
    })();
    rtmCleanupPromiseRef.current = cleanupTask.finally(() => {
      startTalkingPromiseRef.current = null;
      if (rtmCleanupPromiseRef.current) {
        rtmCleanupPromiseRef.current = null;
      }
    });
    await rtmCleanupPromiseRef.current;
  }, [syncSnapshot]);

  cleanupSignalingHandlerRef.current = cleanupSignaling;

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

  const refreshSignal = useCallback(
    async ({ propagate = false, source = "local" } = {}) => {
      if (refreshSignalPromiseRef.current) {
        return refreshSignalPromiseRef.current;
      }

      refreshSignalPromiseRef.current = (async () => {
        const participant = participantIdRef.current || ensureParticipantId();
        const requestId = `walkie-refresh:${Date.now()}:${Math.random()
          .toString(36)
          .slice(2, 10)}`;
        lastRefreshRequestIdRef.current = requestId;
        setError("");
        clearTimer(audioRetryTimerRef);
        clearTimer(signalingRetryTimerRef);
        clearTimer(remoteAudioLingerTimerRef);
        if (source !== "remote") {
          updateNotice("Refreshing walkie signal...");
        }

        if (
          propagate &&
          rtmClientRef.current &&
          signalingChannelRef.current &&
          participant
        ) {
          try {
            await publishWalkieMessage(
              {
                type: "walkie-refresh-request",
                requestId,
                participantId: participant,
                role,
                name: defaultDisplayName(role, displayName),
                requestedAt: nowIso(),
                message: `${defaultDisplayName(role, displayName)} refreshed walkie signal.`,
              },
              { client: rtmClientRef.current, bestEffort: true },
            );
          } catch (refreshBroadcastError) {
            walkieConsole("warn", "Walkie refresh broadcast skipped", {
              stage: "refresh-broadcast",
              message: messageFor(
                refreshBroadcastError,
                "Walkie refresh broadcast could not be sent."
              ),
            });
          }
        }

        if (matchId && role && participant) {
          clearStoredWalkieToken("signal", matchId, role, participant);
        }

        cancelPendingStartRef.current = true;
        setRecoveringAudio(Boolean(autoConnectAudio));
        setRecoveringSignaling(true);

        await stopTalking(source === "remote" ? "remote-refresh" : "refreshing");
        await cleanupTransport();
        resetRtcSessionForReload();
        await cleanupSignaling();

        if (mountedRef.current && shouldMaintainSignalingRef.current) {
          setSignalingReconnectTick((current) => current + 1);
          return true;
        }

        setRecoveringAudio(false);
        setRecoveringSignaling(false);
        return false;
      })().finally(() => {
        refreshSignalPromiseRef.current = null;
      });

      return refreshSignalPromiseRef.current;
    },
    [
      autoConnectAudio,
      cleanupSignaling,
      cleanupTransport,
      displayName,
      ensureParticipantId,
      matchId,
      publishWalkieMessage,
      resetRtcSessionForReload,
      role,
      stopTalking,
      updateNotice,
    ]
  );

  refreshSignalHandlerRef.current = refreshSignal;

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
