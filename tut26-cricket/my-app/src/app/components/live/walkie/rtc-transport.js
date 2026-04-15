/**
 * File overview:
 * Purpose: Renders Live UI for the app's screens and flows.
 * Main exports: createWalkieRtcTransportApi.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { clearStoredWalkieToken } from "./walkie-talkie-storage";
import {
  clearTimer,
  isExpectedWalkieTransportError,
  isRtcUidConflictError,
  loadRtc,
  messageFor,
  wait,
  waitForRtcConnected,
  walkieConsole,
} from "./walkie-talkie-support";
import { shouldPlayWalkieRemoteAudio } from "./walkie-talkie-gates";

export function createWalkieRtcTransportApi({
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
} = {}) {
  const stopRemoteAudioPlayback = (uid = "") => {
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
      // Ignore best-effort shutdown issues.
    }
    remoteAudioPlayingRef.current.delete(safeUid);
  };

  const stopAllRemoteAudioPlayback = () => {
    for (const uid of remoteAudioPlayingRef.current) {
      stopRemoteAudioPlayback(uid);
    }
    remoteAudioPlayingRef.current.clear();
  };

  const playRemoteAudioTrack = (uid = "") => {
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
      // Volume control is optional on some track implementations.
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
  };

  const syncRemoteAudioPlayback = () => {
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
  };

  const subscribeRemoteAudioUser = async (client, user) => {
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
          // Best-effort volume sync.
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
  };

  const syncExistingRemoteAudioUsers = async (
    client = rtcClientRef.current,
  ) => {
    if (!client) {
      return;
    }

    const remoteUsers = Array.isArray(client.remoteUsers) ? client.remoteUsers : [];
    const audioUsers = remoteUsers.filter(
      (user) => Boolean(user?.hasAudio || user?.audioTrack),
    );

    if (!audioUsers.length) {
      syncRemoteAudioPlayback();
      return;
    }

    await Promise.allSettled(
      audioUsers.map((user) => subscribeRemoteAudioUser(client, user)),
    );
    syncRemoteAudioPlayback();
  };

  const ensureRtcClient = async () => {
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
  };

  const joinRtc = async () => {
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
            participantIdRef.current || ensureParticipantId(),
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
                // Ignore leave failures during recovery.
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
  };

  const ensureTrack = async () => {
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
  };

  const muteRtcTrack = async () => {
    const track = rtcTrackRef.current;
    if (track && typeof track.setMuted === "function") {
      try {
        await track.setMuted(true);
      } catch {
        // Ignore best-effort mute failures.
      }
    }
  };

  const resetRtcRuntimeState = async (client = null) => {
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
        // Ignore best-effort leave failures.
      }
    }
  };

  const ensurePublishedTrack = async () => {
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
  };

  const unpublishRtc = async () => {
    const client = rtcClientRef.current;
    const track = rtcTrackRef.current;
    if (client && rtcPublishedRef.current && track) {
      try {
        await client.unpublish([track]);
      } catch {
        // Ignore best-effort unpublish failures.
      }
    }
    await muteRtcTrack();
    if (client && rtcJoinedRef.current) {
      try {
        await client.setClientRole("audience");
      } catch {
        // Ignore role downgrade failures while disconnecting.
      }
    }
    rtcPublishedRef.current = false;
  };

  const cleanupLocalTrack = async () => {
    await unpublishRtc();
    const track = rtcTrackRef.current;
    rtcTrackRef.current = null;
    if (track) {
      try {
        track.stop();
        track.close();
      } catch {
        // Ignore best-effort track cleanup failures.
      }
    }
    trackPromiseRef.current = null;
    publishPromiseRef.current = null;
  };

  const cleanupTransport = async () => {
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
        // Ignore best-effort leave failures.
      }
    }
    rtcJoinedRef.current = false;
    rtcPublishedRef.current = false;
    rtcTokenRef.current = null;
    rtcJoinPromiseRef.current = null;
    rtcTokenPromiseRef.current = null;
  };

  return {
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
  };
}


