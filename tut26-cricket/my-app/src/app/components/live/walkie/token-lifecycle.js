/**
 * File overview:
 * Purpose: Token, participant identity, and countdown helpers for the walkie runtime.
 * Main exports: createWalkieTokenLifecycleApi.
 * Major callers: useWalkieTalkieRuntime.
 * Side effects: reads and writes session or storage tokens.
 * Read next: ./rtc-transport.js
 */

import { primeUiAudio } from "../../../lib/page-audio";
import {
  buildAgoraSignalingChannelName,
  buildAgoraUserId,
} from "../../../lib/agora-channels";
import {
  isTokenFresh,
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
  clearTimer,
  parseJson,
  requestJson,
  walkieConsole,
} from "./walkie-talkie-support";

export function createWalkieTokenLifecycleApi({
  countdownTimerRef,
  ensureRtcTokenFreshBufferMs,
  ensureSignalTokenFreshBufferMs,
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
} = {}) {
  const ensureParticipantId = () => {
    if (participantId) return participantId;
    const next = storageParticipantId(matchId, role, walkieConsole);
    if (next) setParticipantId(next);
    return next;
  };

  const ensureRtcSessionId = () => {
    const participant = ensureParticipantId();
    if (!matchId || !role || !participant) return "";
    if (rtcSessionIdRef.current) return rtcSessionIdRef.current;
    const key = `gv-walkie:${matchId}:${role}:${participant}:rtc-session`;
    const existing = readSessionValue(key);
    if (existing) {
      rtcSessionIdRef.current = existing;
      return existing;
    }
    const next = (
      crypto?.randomUUID?.() || `rtc${Math.random().toString(36).slice(2, 14)}`
    )
      .replace(/-/g, "")
      .slice(0, 16);
    writeSessionValue(key, next);
    rtcSessionIdRef.current = next;
    return next;
  };

  const rotateRtcSessionId = () => {
    const participant = ensureParticipantId();
    if (!matchId || !role || !participant) return "";
    const key = `gv-walkie:${matchId}:${role}:${participant}:rtc-session`;
    const next = (
      crypto?.randomUUID?.() || `rtc${Math.random().toString(36).slice(2, 14)}`
    )
      .replace(/-/g, "")
      .slice(0, 16);
    writeSessionValue(key, next);
    rtcSessionIdRef.current = next;
    return next;
  };

  const resetRtcSessionForReload = () => {
    const participant = participantIdRef.current || ensureParticipantId();
    if (!matchId || !role || !participant) {
      return;
    }

    clearStoredWalkieToken("rtc", matchId, role, participant);
    rtcTokenRef.current = null;
    rtcTokenPromiseRef.current = null;
    rotateRtcSessionId();
  };

  const ensureAudioUnlock = async () => {
    if (!isSafari) return true;
    const primed = await primeUiAudio();
    setNeedsAudioUnlock(!primed);
    return primed;
  };

  const fetchRtcToken = async () => {
    if (isTokenFresh(rtcTokenRef.current, ensureRtcTokenFreshBufferMs)) {
      return rtcTokenRef.current;
    }
    if (rtcTokenPromiseRef.current) {
      return rtcTokenPromiseRef.current;
    }
    const id = ensureParticipantId();
    const rtcSessionId = ensureRtcSessionId();
    if (!matchId || !id) throw new Error("Walkie is not ready yet.");
    const cached = readStoredWalkieToken("rtc", matchId, role, id, parseJson);
    if (isTokenFresh(cached, ensureRtcTokenFreshBufferMs)) {
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
  };

  const fetchSignalingToken = async () => {
    if (
      isTokenFresh(signalTokenRef.current, ensureSignalTokenFreshBufferMs) &&
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
      isTokenFresh(cached, ensureSignalTokenFreshBufferMs) &&
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
        const next = withTokenExpiry(
          validateWalkieTokenPayload(payload, "Signaling"),
        );
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
  };

  const ensureParticipantToken = async () => {
    if (participantTokenRef.current) {
      return participantTokenRef.current;
    }

    if (signalTokenRef.current?.participantToken) {
      participantTokenRef.current = String(
        signalTokenRef.current.participantToken || "",
      );
      return participantTokenRef.current;
    }

    const payload = await fetchSignalingToken();
    participantTokenRef.current = String(payload?.participantToken || "");
    return participantTokenRef.current;
  };

  const startCountdown = (expiresAt) => {
    clearTimer(countdownTimerRef, window.clearInterval);
    const left = () =>
      Math.max(
        0,
        Math.ceil((new Date(expiresAt || Date.now()).getTime() - Date.now()) / 1000),
      );
    setCountdown(left());
    countdownTimerRef.current = window.setInterval(() => {
      const next = left();
      setCountdown(next);
      if (!next) clearTimer(countdownTimerRef, window.clearInterval);
    }, 250);
  };

  return {
    ensureAudioUnlock,
    ensureParticipantId,
    ensureParticipantToken,
    ensureRtcSessionId,
    fetchRtcToken,
    fetchSignalingToken,
    resetRtcSessionForReload,
    rotateRtcSessionId,
    startCountdown,
  };
}
