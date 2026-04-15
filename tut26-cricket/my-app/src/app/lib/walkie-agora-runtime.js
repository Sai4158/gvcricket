/**
 * File overview:
 * Purpose: Provides shared Walkie Agora Runtime logic for routes, APIs, and feature code.
 * Main exports: filterAgoraWalkieRequests, parseAgoraWalkieMetadata, serializeAgoraWalkieMetadata, upsertAgoraWalkieRequest, removeAgoraWalkieRequest, buildAgoraWalkieSnapshot, WALKIE_CHANNEL_TYPE, WALKIE_CONTROL_LOCK_NAME, WALKIE_SPEAKER_LOCK_NAME, WALKIE_SPEAKER_TTL_SECONDS, WALKIE_CONTROL_TTL_SECONDS, WALKIE_REQUEST_MAX_AGE_MS, WALKIE_METADATA_KEYS.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

export const WALKIE_CHANNEL_TYPE = "MESSAGE";
export const WALKIE_CONTROL_LOCK_NAME = "gv-walkie-control";
export const WALKIE_SPEAKER_LOCK_NAME = "gv-walkie-speaker";
export const WALKIE_SPEAKER_TTL_SECONDS = 35;
export const WALKIE_CONTROL_TTL_SECONDS = 10;
export const WALKIE_REQUEST_MAX_AGE_MS = 120000;
export const WALKIE_METADATA_KEYS = {
  enabled: "walkie_enabled",
  pendingRequests: "walkie_pending_requests",
};

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function filterAgoraWalkieRequests(requests, now = Date.now()) {
  if (!Array.isArray(requests)) {
    return [];
  }

  return requests
    .map((request) => ({
      requestId: String(request?.requestId || ""),
      participantId: String(request?.participantId || ""),
      role: request?.role === "director" ? "director" : request?.role === "spectator" ? "spectator" : "",
      name: String(request?.name || ""),
      signalingUserId: String(request?.signalingUserId || ""),
      requestedAt: String(request?.requestedAt || ""),
      expiresAt: String(request?.expiresAt || ""),
    }))
    .filter((request) => {
      if (!request.requestId || !request.participantId || !request.role) {
        return false;
      }

      const expiresAtMs = Date.parse(request.expiresAt || "");
      if (!Number.isFinite(expiresAtMs)) {
        return true;
      }

      return expiresAtMs > now;
    });
}

export function parseAgoraWalkieMetadata(metadata) {
  const enabledValue = metadata?.[WALKIE_METADATA_KEYS.enabled]?.value || "0";
  const requestsValue = metadata?.[WALKIE_METADATA_KEYS.pendingRequests]?.value || "[]";

  return {
    enabled: enabledValue === "1",
    pendingRequests: filterAgoraWalkieRequests(safeJsonParse(requestsValue, [])),
  };
}

export function serializeAgoraWalkieMetadata({ enabled, pendingRequests }) {
  return [
    {
      key: WALKIE_METADATA_KEYS.enabled,
      value: enabled ? "1" : "0",
    },
    {
      key: WALKIE_METADATA_KEYS.pendingRequests,
      value: JSON.stringify(filterAgoraWalkieRequests(pendingRequests)),
    },
  ];
}

export function upsertAgoraWalkieRequest(requests, nextRequest) {
  const next = filterAgoraWalkieRequests(requests).filter(
    (request) =>
      request.requestId !== nextRequest.requestId &&
      request.participantId !== nextRequest.participantId
  );
  next.push(nextRequest);
  return filterAgoraWalkieRequests(next).sort(
    (left, right) =>
      new Date(left.requestedAt || 0).getTime() - new Date(right.requestedAt || 0).getTime()
  );
}

export function removeAgoraWalkieRequest(requests, requestId) {
  return filterAgoraWalkieRequests(requests).filter(
    (request) => request.requestId !== requestId
  );
}

export function buildAgoraWalkieSnapshot({
  enabled,
  pendingRequests,
  participants,
  activeSpeaker,
}) {
  const safeParticipants = [...(participants?.values?.() || [])];
  const safeRequests = filterAgoraWalkieRequests(pendingRequests);
  const active = enabled ? activeSpeaker || null : null;

  return {
    enabled: Boolean(enabled),
    spectatorCount: safeParticipants.filter((participant) => participant.role === "spectator").length,
    umpireCount: safeParticipants.filter((participant) => participant.role === "umpire").length,
    directorCount: safeParticipants.filter((participant) => participant.role === "director").length,
    busy: Boolean(active?.participantId),
    activeSpeakerRole: active?.role || "",
    activeSpeakerId: active?.participantId || "",
    activeSpeakerName: active?.name || "",
    lockStartedAt: active?.lockStartedAt || "",
    expiresAt: active?.expiresAt || "",
    transmissionId: active?.transmissionId || "",
    pendingRequests: safeRequests.map((request) => ({
      requestId: request.requestId,
      participantId: request.participantId,
      role: request.role,
      name: request.name,
      requestedAt: request.requestedAt,
    })),
    updatedAt: new Date().toISOString(),
    version: 0,
  };
}


