/**
 * File overview:
 * Purpose: Renders Live UI for the app's screens and flows.
 * Main exports: createWalkieRtmSignalingApi.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import {
  buildAgoraSignalingChannelName,
  buildAgoraUserId,
} from "../../../lib/agora-channels";
import {
  removeAgoraWalkieRequest,
  upsertAgoraWalkieRequest,
  WALKIE_CHANNEL_TYPE,
  WALKIE_REQUEST_MAX_AGE_MS,
  WALKIE_SPEAKER_TTL_SECONDS,
} from "../../../lib/walkie-agora-runtime";
import { defaultDisplayName, nowIso } from "./walkie-talkie-state";
import { clearStoredWalkieToken } from "./walkie-talkie-storage";
import {
  clearTimer,
  loadRtm,
  messageFor,
  parseJson,
  playWalkieCue,
  walkieConsole,
} from "./walkie-talkie-support";

export function createWalkieRtmSignalingApi({
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
  resetRtcSessionForReload,
  role,
  rtmCleanupPromiseRef,
  rtmClientRef,
  rtmListenersRef,
  rtmLoggedInRef,
  rtmReadyPromiseRef,
  rtmSubscribedRef,
  requestResetRef,
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
} = {}) {
  const ensureRtmSession = async () => {
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
      const channelName =
        token?.channelName || buildAgoraSignalingChannelName(matchId);
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
          // Ignore partial cleanup failures before re-creating the client.
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
              })),
            );
            return;
          }
          schedulePresenceRefresh(client);
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
                      new Date(Date.now() + WALKIE_REQUEST_MAX_AGE_MS).toISOString(),
                  ),
                },
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
                String(payload.requestId || ""),
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
                String(payload.requestId || ""),
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
            updateNotice(
              payload.enabled ? "Walkie-talkie is live." : "Walkie-talkie is off.",
            );
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
                  new Date(
                    Date.now() + WALKIE_SPEAKER_TTL_SECONDS * 1000,
                  ).toISOString(),
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
                activeSpeakerRef.current.participantId !== participantIdRef.current,
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
            clearStoredWalkieToken(
              "signal",
              matchId,
              role,
              participantIdRef.current || id,
            );
            signalTokenRef.current = null;
            const next = await fetchSignalingToken();
            await client.renewToken(next.token);
          } catch (renewError) {
            walkieConsole("error", "Signaling token renew failed", {
              stage: "rtm-renew",
              message: messageFor(
                renewError,
                "Could not renew signaling token.",
              ),
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
              "Walkie persistent state could not be loaded.",
            ),
          });
        }
      }
      const now = Date.now();
      const shouldRequestSync =
        now - lastSyncRequestAtRef.current >= 15000;
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
              "Walkie sync request could not be sent.",
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
  };

  ensureRtmSessionHandlerRef.current = ensureRtmSession;

  const cleanupSignaling = async () => {
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
              // Ignore best-effort presence cleanup failures.
            }
            await client.unsubscribe(channelName).catch(() => {});
          }
        } catch {
          // Ignore unsubscribe cleanup failures.
        }
        if (listeners) {
          client.removeEventListener("status", listeners.onStatus);
          client.removeEventListener("presence", listeners.onPresence);
          client.removeEventListener("message", listeners.onMessage);
          client.removeEventListener(
            "tokenPrivilegeWillExpire",
            listeners.onTokenWillExpire,
          );
        }
        try {
          if (rtmLoggedInRef.current) {
            await client.logout();
          }
        } catch {
          // Ignore logout failures during cleanup.
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
  };

  cleanupSignalingHandlerRef.current = cleanupSignaling;

  const refreshSignal = async ({ propagate = false, source = "local" } = {}) => {
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
              "Walkie refresh broadcast could not be sent.",
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

      await stopTalkingHandlerRef.current?.(
        source === "remote" ? "remote-refresh" : "refreshing",
      );
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
  };

  refreshSignalHandlerRef.current = refreshSignal;

  return {
    cleanupSignaling,
    ensureRtmSession,
    refreshSignal,
  };
}


