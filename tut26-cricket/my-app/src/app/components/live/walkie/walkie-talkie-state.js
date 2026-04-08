/**
 * File overview:
 * Purpose: Shared walkie snapshot, token, and identity helpers for the walkie hook.
 * Main exports: EMPTY_WALKIE_SNAPSHOT, mergeWalkieSnapshots, token validation helpers.
 * Major callers: useWalkieTalkie and walkie-focused tests.
 * Side effects: none.
 * Read next: ../README.md
 */

import { filterAgoraWalkieRequests } from "../../../lib/walkie-agora-runtime";

const AGORA_CHANNEL_NAME_MAX = 64;
const AGORA_USER_ID_MAX = 64;

export const EMPTY_WALKIE_SNAPSHOT = {
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

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeAuthoritativeWalkieSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  const activeSpeakerId = String(snapshot.activeSpeakerId || "");
  const activeSpeakerRole =
    snapshot.activeSpeakerRole === "umpire"
      ? "umpire"
      : snapshot.activeSpeakerRole === "director"
        ? "director"
        : snapshot.activeSpeakerRole === "spectator"
          ? "spectator"
          : "";

  return {
    enabled: Boolean(snapshot.enabled),
    spectatorCount: Math.max(0, Number(snapshot.spectatorCount || 0)),
    umpireCount: Math.max(0, Number(snapshot.umpireCount || 0)),
    directorCount: Math.max(0, Number(snapshot.directorCount || 0)),
    busy: Boolean(activeSpeakerId || snapshot.busy),
    activeSpeakerRole,
    activeSpeakerId,
    activeSpeakerName: String(snapshot.activeSpeakerName || ""),
    lockStartedAt: String(snapshot.lockStartedAt || ""),
    expiresAt: String(snapshot.expiresAt || ""),
    transmissionId: String(snapshot.transmissionId || ""),
    pendingRequests: filterAgoraWalkieRequests(snapshot.pendingRequests).map((request) => ({
      requestId: request.requestId,
      participantId: request.participantId,
      role: request.role,
      name: request.name,
      requestedAt: request.requestedAt,
      expiresAt: request.expiresAt,
    })),
    updatedAt: String(snapshot.updatedAt || nowIso()),
    version: Number.isFinite(Number(snapshot.version)) ? Number(snapshot.version) : 0,
  };
}

export function mergeWalkieSnapshots({
  authoritativeSnapshot = null,
  runtimeSnapshot = EMPTY_WALKIE_SNAPSHOT,
  runtimeSubscribed = false,
  runtimePresenceAvailable = false,
  activeSpeakerSource = "authoritative",
} = {}) {
  const authoritative = normalizeAuthoritativeWalkieSnapshot(authoritativeSnapshot);
  if (!authoritative) {
    return runtimeSnapshot || EMPTY_WALKIE_SNAPSHOT;
  }

  const runtime = runtimeSnapshot || EMPTY_WALKIE_SNAPSHOT;
  const useRuntimeMetadata = Boolean(runtimeSubscribed);
  const useRuntimePresence = Boolean(runtimeSubscribed && runtimePresenceAvailable);
  const useRuntimeSpeaker = Boolean(runtimeSubscribed && activeSpeakerSource === "runtime");

  return {
    ...authoritative,
    enabled: useRuntimeMetadata ? Boolean(runtime.enabled) : authoritative.enabled,
    pendingRequests: useRuntimeMetadata
      ? filterAgoraWalkieRequests(runtime.pendingRequests)
      : authoritative.pendingRequests,
    spectatorCount: useRuntimePresence
      ? Math.max(0, Number(runtime.spectatorCount || 0))
      : authoritative.spectatorCount,
    umpireCount: useRuntimePresence
      ? Math.max(0, Number(runtime.umpireCount || 0))
      : authoritative.umpireCount,
    directorCount: useRuntimePresence
      ? Math.max(0, Number(runtime.directorCount || 0))
      : authoritative.directorCount,
    busy: useRuntimeSpeaker ? Boolean(runtime.busy) : authoritative.busy,
    activeSpeakerRole: useRuntimeSpeaker
      ? String(runtime.activeSpeakerRole || "")
      : authoritative.activeSpeakerRole,
    activeSpeakerId: useRuntimeSpeaker
      ? String(runtime.activeSpeakerId || "")
      : authoritative.activeSpeakerId,
    activeSpeakerName: useRuntimeSpeaker
      ? String(runtime.activeSpeakerName || "")
      : authoritative.activeSpeakerName,
    lockStartedAt: useRuntimeSpeaker
      ? String(runtime.lockStartedAt || "")
      : authoritative.lockStartedAt,
    expiresAt: useRuntimeSpeaker
      ? String(runtime.expiresAt || "")
      : authoritative.expiresAt,
    transmissionId: useRuntimeSpeaker
      ? String(runtime.transmissionId || "")
      : authoritative.transmissionId,
  };
}

export function buildLocalSpeakerFromSnapshot(snapshot) {
  if (!snapshot?.activeSpeakerId) {
    return null;
  }

  return {
    owner: `participant:${snapshot.activeSpeakerId}`,
    participantId: snapshot.activeSpeakerId,
    role: snapshot.activeSpeakerRole || "",
    name: snapshot.activeSpeakerName || "",
    lockStartedAt: snapshot.lockStartedAt || "",
    expiresAt: snapshot.expiresAt || "",
    transmissionId: snapshot.transmissionId || "",
  };
}

export function withTokenExpiry(payload) {
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

export function isTokenFresh(payload, refreshBufferMs) {
  if (!payload?.token) return false;
  if (!payload.expiresAt) return true;
  return payload.expiresAt - Date.now() > refreshBufferMs;
}

export function validateWalkieTokenPayload(payload, type) {
  const appId = String(payload?.appId || "");
  const token = String(payload?.token || "");
  const userId = String(payload?.userId || "");
  const channelName = String(payload?.channelName || "");

  if (!appId || !token || !userId || !channelName) {
    throw new Error(`Invalid ${type} token payload.`);
  }
  if (channelName.length > AGORA_CHANNEL_NAME_MAX) {
    throw new Error(`${type} channel name is too long.`);
  }
  if (userId.length > AGORA_USER_ID_MAX) {
    throw new Error(`${type} user id is too long.`);
  }

  return {
    ...payload,
    appId,
    token,
    userId,
    channelName,
  };
}

export function defaultDisplayName(role, name = "") {
  if (name) return name;
  if (role === "umpire") return "Umpire";
  if (role === "director") return "Director";
  return "Spectator";
}
