/**
 * File overview:
 * Purpose: Presence, authoritative snapshot, and RTM metadata sync helpers for the walkie runtime.
 * Main exports: createWalkiePresenceSnapshotApi.
 * Major callers: useWalkieTalkieRuntime.
 * Side effects: fetches authoritative walkie state and publishes RTM updates.
 * Read next: ./rtm-signaling.js
 */

import {
  buildAgoraWalkieSnapshot,
  filterAgoraWalkieRequests,
  WALKIE_CHANNEL_TYPE,
  WALKIE_SPEAKER_TTL_SECONDS,
} from "../../../lib/walkie-agora-runtime";
import {
  buildLocalSpeakerFromSnapshot,
  defaultDisplayName,
  EMPTY_WALKIE_SNAPSHOT,
  mergeWalkieSnapshots,
  normalizeAuthoritativeWalkieSnapshot,
  nowIso,
} from "./walkie-talkie-state";
import {
  isRtmPublishDisconnectedError,
  messageFor,
  requestWalkieState,
  walkieConsole,
} from "./walkie-talkie-support";

export function createWalkiePresenceSnapshotApi({
  activeSpeakerRef,
  activeSpeakerSourceRef,
  applyStateDelayMs,
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
} = {}) {
  const syncSnapshot = () => {
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
  };

  const applyAuthoritativeSnapshot = (nextSnapshot) => {
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
  };

  const resolveActiveSpeaker = (
    owner,
    ttlSeconds = WALKIE_SPEAKER_TTL_SECONDS,
  ) => {
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
      expiresAt: new Date(
        now + Number(ttlSeconds || WALKIE_SPEAKER_TTL_SECONDS) * 1000,
      ).toISOString(),
      transmissionId:
        activeSpeakerRef.current?.owner === owner &&
        activeSpeakerRef.current?.transmissionId
          ? activeSpeakerRef.current.transmissionId
          : `agora:${owner}:${now}`,
    };
    syncSnapshot();
  };

  const reconcileActiveSpeaker = (participants = participantsRef.current) => {
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
  };

  const applyPresenceSnapshot = (occupants) => {
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
  };

  const applyMetadataState = (nextState) => {
    metadataStateRef.current = {
      enabled: Boolean(nextState?.enabled),
      pendingRequests: filterAgoraWalkieRequests(nextState?.pendingRequests),
    };
    syncSnapshot();
  };

  const publishWalkieMessage = async (
    payload,
    { client = rtmClientRef.current, bestEffort = false } = {},
  ) => {
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
  };

  const broadcastMetadataState = async (
    client = rtmClientRef.current,
    nextState = metadataStateRef.current,
  ) => {
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
  };

  const refreshPresenceSnapshot = async (client = rtmClientRef.current) => {
    if (!client || !signalingChannelRef.current) return;
    const response = await client.presence.getOnlineUsers(
      signalingChannelRef.current,
      WALKIE_CHANNEL_TYPE,
      {
        includedUserId: true,
        includedState: true,
      },
    );
    applyPresenceSnapshot(response?.occupants || []);
  };

  const schedulePresenceRefresh = (
    client = rtmClientRef.current,
    delayMs = applyStateDelayMs,
  ) => {
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
  };

  const refreshRuntimeState = async (client = rtmClientRef.current) => {
    try {
      await refreshPresenceSnapshot(client);
    } catch (presenceError) {
      walkieConsole("error", "Walkie presence refresh failed", {
        stage: "presence-refresh",
        message: messageFor(presenceError, "Walkie presence refresh failed."),
      });
    }
  };

  const syncMetadataState = async (
    nextState,
    client = rtmClientRef.current,
  ) => {
    const normalized = {
      enabled: Boolean(nextState?.enabled),
      pendingRequests: filterAgoraWalkieRequests(nextState?.pendingRequests),
    };
    applyMetadataState(normalized);
    await broadcastMetadataState(client, normalized);
    return normalized;
  };

  const syncPersistentWalkieState = async () => {
    if (!matchId) {
      return null;
    }

    const payload = await requestWalkieState(`/api/matches/${matchId}/walkie`);
    return applyAuthoritativeSnapshot(payload?.walkie);
  };

  const getStartGateSnapshot = async () => {
    const authoritative =
      (await syncPersistentWalkieState().catch(() => null)) ||
      authoritativeSnapshotRef.current ||
      normalizeAuthoritativeWalkieSnapshot(snapshotRef.current);

    return authoritative || EMPTY_WALKIE_SNAPSHOT;
  };

  return {
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
  };
}
