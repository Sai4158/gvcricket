"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { primeUiAudio } from "../../lib/page-audio";
import {
  buildAgoraSignalingChannelName,
  buildAgoraUserId,
} from "../../lib/agora-channels";
import {
  buildAgoraWalkieSnapshot,
  filterAgoraWalkieRequests,
  parseAgoraWalkieMetadata,
  removeAgoraWalkieRequest,
  serializeAgoraWalkieMetadata,
  upsertAgoraWalkieRequest,
  WALKIE_CHANNEL_TYPE,
  WALKIE_CONTROL_LOCK_NAME,
  WALKIE_CONTROL_TTL_SECONDS,
  WALKIE_SPEAKER_LOCK_NAME,
  WALKIE_SPEAKER_TTL_SECONDS,
  WALKIE_REQUEST_MAX_AGE_MS,
} from "../../lib/walkie-agora-runtime";

const EMPTY = {
  enabled: false,
  spectatorCount: 0,
  umpireCount: 0,
  directorCount: 0,
  busy: false,
  activeSpeakerRole: "",
  activeSpeakerId: "",
  activeSpeakerName: "",
  lockStartedAt: "",
  expiresAt: "",
  transmissionId: "",
  pendingRequests: [],
  updatedAt: "",
  version: 0,
};

const FINISH_TAIL_MS = 320;
const REQUEST_RESET_MS = 1800;
const RTC_TOKEN_REFRESH_BUFFER_MS = 90 * 1000;
const SIGNAL_TOKEN_REFRESH_BUFFER_MS = 90 * 1000;
const TALK_RETRY_MESSAGES = [
  "Connecting walkie...",
  "Retrying audio...",
  "Direct audio could not connect yet. Retrying...",
];
const participantIdCache = new Map();

function safariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/i.test(ua);
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function messageFor(error, fallback) {
  return error?.message || fallback;
}

function withTokenExpiry(payload) {
  if (!payload) return null;
  const expiresInSeconds = Number(payload.expiresInSeconds || 0);
  return {
    ...payload,
    expiresAt:
      Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? Date.now() + expiresInSeconds * 1000
        : 0,
  };
}

function isTokenFresh(payload, refreshBufferMs) {
  if (!payload?.token) return false;
  if (!payload.expiresAt) return true;
  return payload.expiresAt - Date.now() > refreshBufferMs;
}

function nowIso() {
  return new Date().toISOString();
}

function defaultDisplayName(role, name = "") {
  if (name) return name;
  if (role === "umpire") return "Umpire";
  if (role === "director") return "Director";
  return "Spectator";
}

function storageParticipantId(matchId, role) {
  if (typeof window === "undefined" || !matchId) return "";
  const key = `gv-walkie:${matchId}:${role}:participant`;
  const existing = (() => {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      console.error("Walkie session storage unavailable:", error);
      return participantIdCache.get(key) || "";
    }
  })();
  if (existing) return existing;
  const next = (crypto?.randomUUID?.() || `walkie${Math.random().toString(36).slice(2, 18)}`)
    .replace(/-/g, "")
    .slice(0, 24);
  try {
    window.sessionStorage.setItem(key, next);
  } catch (error) {
    console.error("Walkie session storage unavailable:", error);
    participantIdCache.set(key, next);
  }
  return next;
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Request failed.");
  return payload;
}

async function loadRtc() {
  const mod = await import("agora-rtc-sdk-ng");
  const rtc = mod.default || mod;
  rtc.disableLogUpload?.();
  rtc.setLogLevel?.(4);
  return rtc;
}

async function loadRtm() {
  const mod = await import("agora-rtm-sdk");
  return mod.default || mod;
}

function clearTimer(ref, clearFn = window.clearTimeout) {
  if (ref.current) {
    clearFn(ref.current);
    ref.current = null;
  }
}

export function shouldReceiveWalkieAudio({ participantId = "", snapshot = EMPTY } = {}) {
  if (!snapshot?.enabled) {
    return false;
  }

  const activeSpeakerId = snapshot.activeSpeakerId || "";
  if (!activeSpeakerId) {
    return false;
  }

  return activeSpeakerId !== participantId;
}

export function shouldMaintainWalkieAudioTransport({
  enabled = false,
  snapshot = EMPTY,
  participantId = "",
  hasWalkieToken = false,
  autoConnectAudio = false,
  manualAudioReady = false,
  isSelfTalking = false,
  isFinishing = false,
} = {}) {
  if (!enabled || !snapshot?.enabled || !participantId || !hasWalkieToken) {
    return false;
  }
  if (!autoConnectAudio && !manualAudioReady) {
    return false;
  }
  if (isSelfTalking || isFinishing) {
    return true;
  }
  return Boolean(snapshot.activeSpeakerId && snapshot.activeSpeakerId !== participantId);
}

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
  const [snapshot, setSnapshot] = useState(EMPTY);
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

  const rtcClientRef = useRef(null);
  const rtcTrackRef = useRef(null);
  const rtcTokenRef = useRef(null);
  const rtcJoinedRef = useRef(false);
  const rtcPublishedRef = useRef(false);
  const rtcTokenPromiseRef = useRef(null);
  const rtcJoinPromiseRef = useRef(null);
  const trackPromiseRef = useRef(null);

  const rtmClientRef = useRef(null);
  const rtmReadyPromiseRef = useRef(null);
  const rtmCleanupPromiseRef = useRef(null);
  const rtmLoggedInRef = useRef(false);
  const rtmSubscribedRef = useRef(false);
  const rtmListenersRef = useRef(null);
  const signalTokenRef = useRef(null);
  const signalTokenPromiseRef = useRef(null);
  const signalingUserIdRef = useRef("");
  const signalingChannelRef = useRef("");
  const controlLockReadyRef = useRef(false);
  const speakerLockReadyRef = useRef(false);
  const metadataOperationRef = useRef(Promise.resolve());
  const signalingGenerationRef = useRef(0);

  const snapshotRef = useRef(EMPTY);
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
  const mountedRef = useRef(false);
  const noticeRef = useRef("");
  const isSafari = useMemo(() => safariBrowser(), []);
  const canEnable = Boolean(enabled && role === "umpire" && hasUmpireAccess);
  const pendingRequests = snapshot.pendingRequests || [];
  const canRequestEnable = Boolean(
    enabled &&
      role !== "umpire" &&
      participantId &&
      hasWalkieToken &&
      requestState !== "pending" &&
      !snapshot.enabled
  );
  const canTalk = Boolean(
    enabled &&
      snapshot.enabled &&
      participantId &&
      hasWalkieToken &&
      !claiming &&
      (!snapshot.busy || snapshot.activeSpeakerId === participantId)
  );
  const isBusy = Boolean(snapshot.busy);
  const otherSpeakerBusy = Boolean(snapshot.busy && snapshot.activeSpeakerId !== participantId);
  const isLiveOrFinishing = Boolean(isSelfTalking || isFinishing);
  const shouldMaintainAudioTransport = shouldMaintainWalkieAudioTransport({
    enabled,
    snapshot,
    participantId,
    hasWalkieToken,
    autoConnectAudio,
    manualAudioReady,
    isSelfTalking,
    isFinishing,
  });
  const shouldMaintainSignaling = Boolean(enabled && matchId && signalingActive);

  const syncSnapshot = useCallback(() => {
    const next = buildAgoraWalkieSnapshot({
      enabled: metadataStateRef.current.enabled,
      pendingRequests: metadataStateRef.current.pendingRequests,
      participants: participantsRef.current,
      activeSpeaker: activeSpeakerRef.current,
    });
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

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
    const next = storageParticipantId(matchId, role);
    if (next) setParticipantId(next);
    return next;
  }, [matchId, participantId, role]);

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
    if (!matchId || !id) throw new Error("Walkie is not ready yet.");
    rtcTokenPromiseRef.current = requestJson("/api/agora/rtc-token", {
      matchId,
      participantId: id,
      role,
    })
      .then((payload) => {
        const next = withTokenExpiry(payload);
        rtcTokenRef.current = next;
        return next;
      })
      .finally(() => {
        rtcTokenPromiseRef.current = null;
      });
    return rtcTokenPromiseRef.current;
  }, [ensureParticipantId, matchId, role]);

  const fetchSignalingToken = useCallback(async () => {
    if (isTokenFresh(signalTokenRef.current, SIGNAL_TOKEN_REFRESH_BUFFER_MS)) {
      return signalTokenRef.current;
    }
    if (signalTokenPromiseRef.current) {
      return signalTokenPromiseRef.current;
    }
    const id = ensureParticipantId();
    if (!matchId || !id) throw new Error("Walkie is not ready yet.");
    signalTokenPromiseRef.current = requestJson("/api/agora/signaling-token", {
      matchId,
      participantId: id,
      role,
    })
      .then((payload) => {
        const next = withTokenExpiry(payload);
        signalTokenRef.current = next;
        signalingUserIdRef.current = next?.userId || buildAgoraUserId(matchId, id, role);
        signalingChannelRef.current =
          next?.channelName || buildAgoraSignalingChannelName(matchId);
        setHasWalkieToken(Boolean(next?.token));
        return next;
      })
      .finally(() => {
        signalTokenPromiseRef.current = null;
      });
    return signalTokenPromiseRef.current;
  }, [ensureParticipantId, matchId, role]);

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
      try {
        await client.subscribe(user, mediaType);
        user.audioTrack?.play();
      } catch (subscribeError) {
        setNeedsAudioUnlock(isSafari);
        updateNotice("Enable Audio if Safari blocks walkie playback.");
        console.error("Walkie remote subscribe failed:", subscribeError);
      }
    });
    client.on("user-unpublished", (user, mediaType) => {
      if (mediaType === "audio") {
        try {
          user.audioTrack?.stop();
        } catch {
        }
      }
    });
    client.on("connection-state-change", (state) => {
      if (state === "DISCONNECTED" && snapshotRef.current.enabled) {
        updateNotice("Retrying audio...");
      }
    });
    rtcClientRef.current = client;
    return client;
  }, [isSafari, updateNotice]);

  const joinRtc = useCallback(async () => {
    if (!enabled || !snapshotRef.current.enabled) return null;
    if (rtcJoinedRef.current && rtcClientRef.current) return rtcClientRef.current;
    if (rtcJoinPromiseRef.current) return rtcJoinPromiseRef.current;
    rtcJoinPromiseRef.current = (async () => {
      const client = await ensureRtcClient();
      let token = await fetchRtcToken();
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          await client.setClientRole("audience");
          await client.join(token.appId, token.channelName, token.token, token.userId);
          rtcJoinedRef.current = true;
          return client;
        } catch (joinError) {
          lastError = joinError;
          rtcTokenRef.current = null;
          if (attempt < 2) {
            token = await fetchRtcToken();
          }
        }
      }
      throw lastError || new Error("Could not join walkie audio.");
    })().finally(() => {
      rtcJoinPromiseRef.current = null;
    });
    return rtcJoinPromiseRef.current;
  }, [enabled, ensureRtcClient, fetchRtcToken]);

  const ensureTrack = useCallback(async () => {
    if (rtcTrackRef.current) return rtcTrackRef.current;
    if (trackPromiseRef.current) return trackPromiseRef.current;
    trackPromiseRef.current = (async () => {
      const AgoraRTC = await loadRtc();
      const track = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        AGC: true,
        ANS: true,
        encoderConfig: "speech_low_quality",
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

  const unpublishRtc = useCallback(async () => {
    const client = rtcClientRef.current;
    const track = rtcTrackRef.current;
    if (client && rtcPublishedRef.current && track) {
      try {
        await client.unpublish([track]);
      } catch {
      }
    }
    if (track && typeof track.setMuted === "function") {
      try {
        await track.setMuted(true);
      } catch {
      }
    }
    if (client && rtcJoinedRef.current) {
      try {
        await client.setClientRole("audience");
      } catch {
      }
    }
    rtcPublishedRef.current = false;
  }, []);

  const cleanupTransport = useCallback(async () => {
    clearTimer(releaseTimerRef);
    clearTimer(finishTimerRef, window.clearInterval);
    clearTimer(countdownTimerRef, window.clearInterval);
    clearTimer(cooldownTimerRef, window.clearInterval);
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
    trackPromiseRef.current = null;
  }, [unpublishRtc]);

  const resolveActiveSpeaker = useCallback((owner, ttlSeconds = WALKIE_SPEAKER_TTL_SECONDS) => {
    if (!owner) {
      activeSpeakerRef.current = null;
      syncSnapshot();
      return;
    }
    const participant = participantsRef.current.get(owner);
    const now = Date.now();
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
      if (activeSpeakerRef.current?.owner) {
        resolveActiveSpeaker(activeSpeakerRef.current.owner, WALKIE_SPEAKER_TTL_SECONDS);
      } else {
        syncSnapshot();
      }
    },
    [resolveActiveSpeaker, role, syncSnapshot]
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

  const refreshMetadataSnapshot = useCallback(
    async (client = rtmClientRef.current) => {
      if (!client || !signalingChannelRef.current) return;
      const response = await client.storage.getChannelMetadata(
        signalingChannelRef.current,
        WALKIE_CHANNEL_TYPE
      );
      applyMetadataState(parseAgoraWalkieMetadata(response?.metadata || {}));
    },
    [applyMetadataState]
  );

  const refreshSpeakerLock = useCallback(
    async (client = rtmClientRef.current) => {
      if (!client || !signalingChannelRef.current) return;
      const response = await client.lock.getLock(signalingChannelRef.current, WALKIE_CHANNEL_TYPE);
      const detail =
        response?.lockDetails?.find((lock) => lock.lockName === WALKIE_SPEAKER_LOCK_NAME) || null;
      if (detail?.owner) {
        resolveActiveSpeaker(detail.owner, detail.ttl);
      } else {
        activeSpeakerRef.current = null;
        syncSnapshot();
      }
    },
    [resolveActiveSpeaker, syncSnapshot]
  );

  const refreshRuntimeState = useCallback(
    async (client = rtmClientRef.current) => {
      const [presenceResult, metadataResult, lockResult] = await Promise.allSettled([
        refreshPresenceSnapshot(client),
        refreshMetadataSnapshot(client),
        refreshSpeakerLock(client),
      ]);
      if (presenceResult.status === "rejected") {
        console.error("Walkie presence refresh failed:", presenceResult.reason);
      }
      if (metadataResult.status === "rejected") {
        console.error("Walkie metadata refresh failed:", metadataResult.reason);
      }
      if (lockResult.status === "rejected") {
        console.error("Walkie lock refresh failed:", lockResult.reason);
      }
    },
    [refreshMetadataSnapshot, refreshPresenceSnapshot, refreshSpeakerLock]
  );

  const ensureChannelLock = useCallback(async (client, lockName) => {
    if (!client || !signalingChannelRef.current) return;
    const isSpeakerLock = lockName === WALKIE_SPEAKER_LOCK_NAME;
    if (isSpeakerLock ? speakerLockReadyRef.current : controlLockReadyRef.current) {
      return;
    }
    try {
      await client.lock.setLock(signalingChannelRef.current, WALKIE_CHANNEL_TYPE, lockName, {
        ttl: isSpeakerLock ? WALKIE_SPEAKER_TTL_SECONDS : WALKIE_CONTROL_TTL_SECONDS,
      });
    } catch {
    }
    if (isSpeakerLock) {
      speakerLockReadyRef.current = true;
    } else {
      controlLockReadyRef.current = true;
    }
  }, []);

  const ensureRtmSession = useCallback(async () => {
    if (!shouldMaintainSignaling) {
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
        !shouldMaintainSignaling
      ) {
        throw new Error("Walkie signaling changed before setup completed.");
      }
      const id = ensureParticipantId();
      const userId = token?.userId || buildAgoraUserId(matchId, id, role);
      const channelName = token?.channelName || buildAgoraSignalingChannelName(matchId);
      signalingUserIdRef.current = userId;
      signalingChannelRef.current = channelName;

      if (!rtmClientRef.current) {
        const client = new RTM(token.appId, userId, {
          logUpload: false,
          logLevel: "none",
          heartbeatInterval: 30,
          presenceTimeout: 20,
          privateConfig: {
            eventUploadHosts: [],
            logUploadHosts: [],
          },
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
          void refreshPresenceSnapshot(client);
        };

        const onStorage = (event) => {
          if (event?.channelName !== signalingChannelRef.current) return;
          applyMetadataState(parseAgoraWalkieMetadata(event?.data?.metadata || {}));
        };

        const onLock = (event) => {
          if (event?.channelName !== signalingChannelRef.current) return;
          const detail =
            event?.snapshot?.find((lock) => lock.lockName === WALKIE_SPEAKER_LOCK_NAME) || null;
          if (detail?.owner) {
            resolveActiveSpeaker(detail.owner, detail.ttl);
          } else {
            activeSpeakerRef.current = null;
            syncSnapshot();
          }
        };

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
            if (role === "umpire") {
              updateNotice(`${payload.name || "Someone"} wants to use walkie-talkie.`);
            }
            return;
          }

          if (payload.type === "walkie-request-accepted") {
            if (payload.participantId === participantId) {
              setRequestState("accepted");
              updateNotice("Walkie-talkie is live.");
              scheduleRequestReset();
            }
            return;
          }

          if (payload.type === "walkie-request-dismissed") {
            if (payload.participantId === participantId) {
              setRequestState("dismissed");
              updateNotice("Walkie request dismissed.");
              scheduleRequestReset();
            }
            return;
          }

          if (payload.type === "walkie-enabled") {
            updateNotice(payload.enabled ? "Walkie-talkie is live." : "Walkie-talkie is off.");
            return;
          }

          if (payload.type === "walkie-speaker-started") {
            if (payload.participantId !== participantId) {
              updateNotice(payload.message || `${payload.name || "Someone"} is talking.`);
            }
            return;
          }

          if (payload.type === "walkie-speaker-ended") {
            updateNotice(payload.message || "Channel is free.");
          }
        };

        const onTokenWillExpire = async () => {
          try {
            signalTokenRef.current = null;
            const next = await fetchSignalingToken();
            await client.renewToken(next.token);
          } catch (renewError) {
            console.error("Walkie signaling token renew failed:", renewError);
          }
        };

        client.addEventListener("status", onStatus);
        client.addEventListener("presence", onPresence);
        client.addEventListener("storage", onStorage);
        client.addEventListener("lock", onLock);
        client.addEventListener("message", onMessage);
        client.addEventListener("tokenPrivilegeWillExpire", onTokenWillExpire);

        rtmListenersRef.current = {
          onStatus,
          onPresence,
          onStorage,
          onLock,
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
        await client.login({ token: token.token });
        rtmLoggedInRef.current = true;
      }

      if (!rtmSubscribedRef.current) {
        await client.subscribe(channelName, {
          withMessage: true,
          withPresence: true,
          withMetadata: true,
          withLock: true,
        });
        rtmSubscribedRef.current = true;
      }

      await client.presence.setState(channelName, WALKIE_CHANNEL_TYPE, {
        participantId: id,
        role,
        name: defaultDisplayName(role, displayName),
      });

      await Promise.all([
        ensureChannelLock(client, WALKIE_CONTROL_LOCK_NAME),
        ensureChannelLock(client, WALKIE_SPEAKER_LOCK_NAME),
      ]);
      await refreshRuntimeState(client);
      setHasWalkieToken(true);
      return client;
    })().finally(() => {
      rtmReadyPromiseRef.current = null;
    });
    return rtmReadyPromiseRef.current;
  }, [
    applyMetadataState,
    applyPresenceSnapshot,
    displayName,
    ensureChannelLock,
    ensureParticipantId,
    fetchSignalingToken,
    matchId,
    participantId,
    refreshPresenceSnapshot,
    refreshRuntimeState,
    resolveActiveSpeaker,
    role,
    scheduleRequestReset,
    shouldMaintainSignaling,
    syncSnapshot,
    updateNotice,
  ]);

  const cleanupSignaling = useCallback(async () => {
    if (rtmCleanupPromiseRef.current) {
      await rtmCleanupPromiseRef.current.catch(() => {});
      return;
    }
    clearTimer(requestResetRef);
    signalingGenerationRef.current += 1;
    const cleanupTask = (async () => {
      const client = rtmClientRef.current;
      const listeners = rtmListenersRef.current;
      const channelName = signalingChannelRef.current;
      rtmReadyPromiseRef.current = null;
      signalTokenRef.current = null;
      signalTokenPromiseRef.current = null;
      controlLockReadyRef.current = false;
      speakerLockReadyRef.current = false;
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
          client.removeEventListener("storage", listeners.onStorage);
          client.removeEventListener("lock", listeners.onLock);
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
      setHasWalkieToken(false);
      syncSnapshot();
    })();
    rtmCleanupPromiseRef.current = cleanupTask.finally(() => {
      if (rtmCleanupPromiseRef.current === cleanupTask) {
        rtmCleanupPromiseRef.current = null;
      }
    });
    await rtmCleanupPromiseRef.current;
  }, [syncSnapshot]);

  const runWithControlMetadata = useCallback(
    async (updater) => {
      const schedule = metadataOperationRef.current.catch(() => {}).then(async () => {
        const client = await ensureRtmSession();
        const channelName = signalingChannelRef.current;
        await ensureChannelLock(client, WALKIE_CONTROL_LOCK_NAME);
        await client.lock.acquireLock(channelName, WALKIE_CHANNEL_TYPE, WALKIE_CONTROL_LOCK_NAME, {
          retry: true,
        });
        try {
          const metadataResponse = await client.storage.getChannelMetadata(
            channelName,
            WALKIE_CHANNEL_TYPE
          );
          const current = parseAgoraWalkieMetadata(metadataResponse?.metadata || {});
          const next = (await updater(current, client)) || current;
          const normalized = {
            enabled: Boolean(next.enabled),
            pendingRequests: filterAgoraWalkieRequests(next.pendingRequests),
          };
          await client.storage.setChannelMetadata(
            channelName,
            WALKIE_CHANNEL_TYPE,
            serializeAgoraWalkieMetadata(normalized),
            {
              lockName: WALKIE_CONTROL_LOCK_NAME,
            }
          );
          applyMetadataState(normalized);
          return normalized;
        } finally {
          await client.lock
            .releaseLock(channelName, WALKIE_CHANNEL_TYPE, WALKIE_CONTROL_LOCK_NAME)
            .catch(() => {});
        }
      });
      metadataOperationRef.current = schedule.catch(() => {});
      return schedule;
    },
    [applyMetadataState, ensureChannelLock, ensureRtmSession]
  );

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
        rtcPublishedRef.current ||
          activeSpeakerRef.current?.owner === signalingUserIdRef.current ||
          snapshotRef.current.activeSpeakerId === selfId
      );
      if (!ownsSpeakerLock) {
        setIsSelfTalking(false);
        setIsFinishing(false);
        setFinishDelayLeft(0);
        return false;
      }
      const immediateStop =
        reason === "disabled" ||
        reason === "backgrounded" ||
        reason === "deactivated" ||
        reason === "cleanup";
      const releaseDelayMs = immediateStop ? 0 : FINISH_TAIL_MS;
      setIsSelfTalking(false);
      setIsFinishing(!immediateStop);
      setFinishDelayLeft(immediateStop ? 0 : Math.ceil(releaseDelayMs / 1000));
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
        await unpublishRtc();
        try {
          const client = await ensureRtmSession();
          const channelName = signalingChannelRef.current;
          await client.lock
            .releaseLock(channelName, WALKIE_CHANNEL_TYPE, WALKIE_SPEAKER_LOCK_NAME)
            .catch(() => {});
          await client.publish(
            channelName,
            JSON.stringify({
              type: "walkie-speaker-ended",
              participantId: selfId,
              reason,
              message: reason === "disabled" ? "Walkie-talkie is off." : "Channel is free.",
            })
          );
        } catch (releaseError) {
          setError(messageFor(releaseError, "Could not release walkie."));
        }
        activeSpeakerRef.current = null;
        syncSnapshot();
        updateNotice(reason === "disabled" ? "Walkie-talkie is off." : "Channel is free.");
        setIsFinishing(false);
        setFinishDelayLeft(0);
        clearTimer(finishTimerRef, window.clearInterval);
        if (!autoConnectAudio) {
          setManualAudioReady(false);
          await cleanupTransport();
        }
      }, releaseDelayMs);
      return true;
    },
    [
      autoConnectAudio,
      cleanupTransport,
      ensureParticipantId,
      ensureRtmSession,
      syncSnapshot,
      unpublishRtc,
      updateNotice,
    ]
  );

  const startTalking = useCallback(
    async () => {
      if (!enabled) return false;
      const selfId = ensureParticipantId();
      if (!selfId) {
        setError("Walkie is still connecting.");
        return false;
      }
      if (!metadataStateRef.current.enabled) {
        setError("Walkie-talkie is off.");
        return false;
      }
      if ((role === "spectator" || role === "director") && snapshotRef.current.umpireCount === 0) {
        setError("Umpire is not connected.");
        return false;
      }
      if (role === "umpire" && snapshotRef.current.spectatorCount + snapshotRef.current.directorCount === 0) {
        setError("No listener is connected.");
        return false;
      }

      clearTimer(releaseTimerRef);
      clearTimer(finishTimerRef, window.clearInterval);
      setError("");
      updateNotice("");
      setManualAudioReady(true);
      setIsFinishing(false);
      setFinishDelayLeft(0);
      setClaiming(true);
      const unlocked = await ensureAudioUnlock();
      if (!unlocked && isSafari) {
        setClaiming(false);
        updateNotice("Enable Audio once on this device for Safari walkie.");
        return false;
      }

      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        updateNotice(TALK_RETRY_MESSAGES[Math.min(attempt - 1, TALK_RETRY_MESSAGES.length - 1)]);
        try {
          const client = await ensureRtmSession();
          const channelName = signalingChannelRef.current;
          await ensureChannelLock(client, WALKIE_SPEAKER_LOCK_NAME);
          const trackPromise = ensureTrack();
          await client.lock.acquireLock(channelName, WALKIE_CHANNEL_TYPE, WALKIE_SPEAKER_LOCK_NAME, {
            retry: false,
          });
          const [rtcClient, track] = await Promise.all([joinRtc(), trackPromise]);
          await rtcClient.setClientRole("host");
          if (typeof track.setMuted === "function") await track.setMuted(false);
          await rtcClient.publish([track]);
          rtcPublishedRef.current = true;

          const participant = participantsRef.current.get(signalingUserIdRef.current) || {
            participantId: selfId,
            role,
            name: defaultDisplayName(role, displayName),
          };
          const transmissionId = `agora:${signalingUserIdRef.current}:${Date.now()}`;
          activeSpeakerRef.current = {
            owner: signalingUserIdRef.current,
            participantId: participant.participantId,
            role: participant.role,
            name: participant.name,
            lockStartedAt: nowIso(),
            expiresAt: new Date(Date.now() + WALKIE_SPEAKER_TTL_SECONDS * 1000).toISOString(),
            transmissionId,
          };
          syncSnapshot();

          await client.publish(
            channelName,
            JSON.stringify({
              type: "walkie-speaker-started",
              participantId: participant.participantId,
              role: participant.role,
              name: participant.name,
              transmissionId,
              message: `${participant.name} is talking.`,
            })
          );

          startCountdown(activeSpeakerRef.current.expiresAt);
          setIsSelfTalking(true);
          updateNotice("");
          setClaiming(false);
          return true;
        } catch (talkError) {
          lastError = talkError;
          await unpublishRtc();
          rtcTokenRef.current = null;
          rtcJoinedRef.current = false;
          rtcJoinPromiseRef.current = null;
          const client = rtcClientRef.current;
          if (client) {
            try {
              await client.leave();
            } catch {
            }
          }
        }
      }

      setClaiming(false);
      setIsSelfTalking(false);
      setError(messageFor(lastError, "Could not start walkie audio."));
      return false;
    },
    [
      displayName,
      enabled,
      ensureAudioUnlock,
      ensureChannelLock,
      ensureParticipantId,
      ensureRtmSession,
      ensureTrack,
      isSafari,
      joinRtc,
      role,
      startCountdown,
      syncSnapshot,
      unpublishRtc,
      updateNotice,
    ]
  );

  const requestEnable = useCallback(async () => {
    const selfId = ensureParticipantId();
    if (!selfId) {
      setError("Walkie is still connecting.");
      return false;
    }
    const client = await ensureRtmSession().catch((requestError) => {
      setError(messageFor(requestError, "Could not request walkie."));
      return null;
    });
    if (!client) return false;

    try {
      setError("");
      setRequestState("pending");
      const participant = participantsRef.current.get(signalingUserIdRef.current) || {
        participantId: selfId,
        role,
        name: defaultDisplayName(role, displayName),
      };
      const request = {
        requestId: `${participant.role}:${participant.participantId}:${Date.now()}`,
        participantId: participant.participantId,
        role: participant.role,
        name: participant.name,
        signalingUserId: signalingUserIdRef.current,
        requestedAt: nowIso(),
        expiresAt: new Date(Date.now() + WALKIE_REQUEST_MAX_AGE_MS).toISOString(),
      };

      await runWithControlMetadata((current) => {
        if (current.enabled) {
          throw new Error("Walkie-talkie is already live.");
        }
        const exists = current.pendingRequests.some(
          (item) => item.participantId === request.participantId
        );
        if (exists) {
          throw new Error("Walkie request already pending.");
        }
        return {
          ...current,
          pendingRequests: upsertAgoraWalkieRequest(current.pendingRequests, request),
        };
      });

      await client.publish(
        signalingChannelRef.current,
        JSON.stringify({
          type: "walkie-request",
          requestId: request.requestId,
          participantId: request.participantId,
          role: request.role,
          name: request.name,
        })
      );
      return true;
    } catch (requestError) {
      const message = messageFor(requestError, "Could not request walkie.");
      setError(message);
      setRequestState("idle");
      return false;
    }
  }, [
    displayName,
    ensureParticipantId,
    ensureRtmSession,
    role,
    runWithControlMetadata,
  ]);

  const toggleEnabled = useCallback(
    async (nextEnabled) => {
      if (!canEnable) return false;
      try {
        setError("");
        const client = await ensureRtmSession();
        const channelName = signalingChannelRef.current;
        await runWithControlMetadata((current) => ({
          enabled: Boolean(nextEnabled),
          pendingRequests: nextEnabled ? current.pendingRequests : [],
        }));

        if (!nextEnabled && activeSpeakerRef.current?.owner) {
          const owner = activeSpeakerRef.current.owner;
          if (owner === signalingUserIdRef.current) {
            await client.lock
              .releaseLock(channelName, WALKIE_CHANNEL_TYPE, WALKIE_SPEAKER_LOCK_NAME)
              .catch(() => {});
          } else {
            await client.lock
              .revokeLock(channelName, WALKIE_CHANNEL_TYPE, WALKIE_SPEAKER_LOCK_NAME, owner)
              .catch(() => {});
          }
        }

        await client.publish(
          channelName,
          JSON.stringify({
            type: "walkie-enabled",
            enabled: Boolean(nextEnabled),
          })
        );

        if (!nextEnabled) {
          if (isSelfTalking || isFinishing) {
            await stopTalking("disabled");
          } else {
            setManualAudioReady(false);
            activeSpeakerRef.current = null;
            syncSnapshot();
            await cleanupTransport();
          }
        }

        updateNotice(nextEnabled ? "Walkie-talkie is live." : "Walkie-talkie is off.");
        return true;
      } catch (toggleError) {
        setError(messageFor(toggleError, "Could not update walkie."));
        return false;
      }
    },
    [
      canEnable,
      cleanupTransport,
      ensureRtmSession,
      isFinishing,
      isSelfTalking,
      runWithControlMetadata,
      stopTalking,
      syncSnapshot,
      updateNotice,
    ]
  );

  const respond = useCallback(
    async (requestId, action) => {
      try {
        setError("");
        const client = await ensureRtmSession();
        const channelName = signalingChannelRef.current;
        let targetRequest = null;
        await runWithControlMetadata((current) => {
          targetRequest = current.pendingRequests.find((item) => item.requestId === requestId) || null;
          if (!targetRequest) {
            throw new Error("Walkie request not found.");
          }
          return {
            enabled: action === "accept" ? true : current.enabled,
            pendingRequests: removeAgoraWalkieRequest(current.pendingRequests, requestId),
          };
        });

        await client.publish(
          channelName,
          JSON.stringify({
            type: action === "accept" ? "walkie-request-accepted" : "walkie-request-dismissed",
            requestId,
            participantId: targetRequest?.participantId || "",
          })
        );
        if (action === "accept") {
          updateNotice("Walkie-talkie is live.");
        }
        return true;
      } catch (respondError) {
        setError(messageFor(respondError, "Could not update walkie request."));
        return false;
      }
    },
    [ensureRtmSession, runWithControlMetadata, updateNotice]
  );

  const acceptRequest = useCallback((requestId) => respond(requestId, "accept"), [respond]);
  const dismissRequest = useCallback((requestId) => respond(requestId, "dismiss"), [respond]);

  const unlockAudio = useCallback(async () => {
    await ensureAudioUnlock();
    try {
      setManualAudioReady(true);
      if (
        snapshotRef.current.enabled &&
        snapshotRef.current.activeSpeakerId &&
        snapshotRef.current.activeSpeakerId !== participantId
      ) {
        await joinRtc();
      }
      return true;
    } catch (unlockError) {
      setError(messageFor(unlockError, "Could not enable walkie audio."));
      return false;
    }
  }, [ensureAudioUnlock, joinRtc, participantId]);

  const deactivateAudio = useCallback(async () => {
    setManualAudioReady(false);
    await stopTalking("deactivated");
    await cleanupTransport();
  }, [cleanupTransport, stopTalking]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (matchId && enabled) setParticipantId(storageParticipantId(matchId, role));
  }, [enabled, matchId, role]);

  useEffect(() => {
    if (!shouldMaintainSignaling) {
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
      noticeRef.current = "";
      setNotice("");
      clearTimer(releaseTimerRef);
      clearTimer(finishTimerRef, window.clearInterval);
      clearTimer(countdownTimerRef, window.clearInterval);
      clearTimer(cooldownTimerRef, window.clearInterval);
      clearTimer(requestResetRef);
      void cleanupTransport();
      void cleanupSignaling();
      return;
    }
    void ensureRtmSession().catch((connectError) => {
      console.error("Walkie signaling setup failed:", connectError);
      if (mountedRef.current) {
        setError("Walkie live connection is unavailable.");
      }
    });
    return () => {
      void cleanupSignaling();
    };
  }, [
    cleanupSignaling,
    cleanupTransport,
    ensureRtmSession,
    matchId,
    shouldMaintainSignaling,
    syncSnapshot,
  ]);

  useEffect(() => {
    if (shouldMaintainAudioTransport) {
      void joinRtc().catch((joinError) =>
        setError(messageFor(joinError, "Could not connect walkie audio."))
      );
      return;
    }
    void cleanupTransport();
  }, [cleanupTransport, joinRtc, shouldMaintainAudioTransport]);

  useEffect(() => {
    if (!snapshot.enabled && (isSelfTalking || isFinishing)) {
      void stopTalking("disabled");
    }
  }, [isFinishing, isSelfTalking, snapshot.enabled, stopTalking]);

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
    setNeedsAudioUnlock(Boolean(isSafari && enabled));
  }, [enabled, isSafari]);

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
    if (!shouldMaintainSignaling) {
      void cleanupTransport();
      void cleanupSignaling();
    }
  }, [cleanupSignaling, cleanupTransport, shouldMaintainSignaling]);

  useEffect(
    () => () => {
      clearTimer(requestResetRef);
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
    isSelfTalking,
    isFinishing,
    isLiveOrFinishing,
    isBusy,
    otherSpeakerBusy,
    canEnable,
    canRequestEnable,
    canTalk,
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
    deactivateAudio,
    acceptRequest,
    dismissRequest,
  };
}
