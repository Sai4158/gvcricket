import { EventEmitter } from "node:events";

const SPEAKER_MAX_MS = 30_000;
const CLEANUP_GRACE_MS = 3_000;
const REQUEST_COOLDOWN_MS = 30_000;
const DISCONNECT_GRACE_MS = 5_000;
const REQUEST_MAX_AGE_MS = 120_000;

const emitter = globalThis.__gvWalkieEmitter || new EventEmitter();
globalThis.__gvWalkieEmitter = emitter;
emitter.setMaxListeners(1000);

const store = globalThis.__gvWalkieStore || {
  matches: new Map(),
};
globalThis.__gvWalkieStore = store;

function getMatchState(matchId) {
  const key = String(matchId);
  if (!store.matches.has(key)) {
    store.matches.set(key, {
      enabled: false,
      participants: new Map(),
      activeSpeakerRole: "",
      activeSpeakerId: "",
      activeSpeakerName: "",
      lockStartedAt: "",
      expiresAt: "",
      transmissionId: "",
      timeoutId: null,
      lastNotification: "",
      requestCooldowns: new Map(),
      disconnectTimers: new Map(),
      pendingRequests: new Map(),
    });
  }

  const matchState = store.matches.get(key);
  if (!(matchState.requestCooldowns instanceof Map)) {
    matchState.requestCooldowns = new Map();
  }
  if (!(matchState.disconnectTimers instanceof Map)) {
    matchState.disconnectTimers = new Map();
  }
  if (!(matchState.pendingRequests instanceof Map)) {
    matchState.pendingRequests = new Map();
  }

  return matchState;
}

function toParticipantView(participant) {
  return {
    id: participant.id,
    role: participant.role,
    name: participant.name,
    connectedAt: participant.connectedAt,
  };
}

function listParticipants(matchState, role) {
  return [...matchState.participants.values()]
    .filter((participant) => !role || participant.role === role)
    .map(toParticipantView);
}

function notifyMatch(matchId, payload) {
  emitter.emit(`walkie:match:${matchId}`, payload);
}

function notifyParticipant(matchId, participantId, payload) {
  emitter.emit(`walkie:participant:${matchId}:${participantId}`, payload);
}

function prunePendingRequests(matchId, matchState = getMatchState(matchId)) {
  const now = Date.now();
  let changed = false;

  for (const [participantId, request] of matchState.pendingRequests.entries()) {
    const expiresAt = request?.expiresAt ? Date.parse(request.expiresAt) : 0;
    if (expiresAt && expiresAt <= now) {
      matchState.pendingRequests.delete(participantId);
      notifyParticipant(matchId, participantId, {
        type: "request-expired",
        requestId: request.requestId,
      });
      changed = true;
    }
  }

  return changed;
}

function listPendingRequests(matchId, matchState = getMatchState(matchId)) {
  prunePendingRequests(matchId, matchState);
  return [...matchState.pendingRequests.values()]
    .sort((left, right) => {
      return (
        new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime()
      );
    })
    .map((request) => ({
      requestId: request.requestId,
      participantId: request.participantId,
      role: request.role,
      name: request.name,
      requestedAt: request.requestedAt,
    }));
}

function buildSnapshot(matchId) {
  const matchState = getMatchState(matchId);
  const spectators = listParticipants(matchState, "spectator");
  const umpires = listParticipants(matchState, "umpire");
  const directors = listParticipants(matchState, "director");

  return {
    enabled: Boolean(matchState.enabled),
    spectatorCount: spectators.length,
    umpireCount: umpires.length,
    directorCount: directors.length,
    busy: Boolean(matchState.activeSpeakerId),
    activeSpeakerRole: matchState.activeSpeakerRole || "",
    activeSpeakerId: matchState.activeSpeakerId || "",
    activeSpeakerName: matchState.activeSpeakerName || "",
    lockStartedAt: matchState.lockStartedAt || "",
    expiresAt: matchState.expiresAt || "",
    transmissionId: matchState.transmissionId || "",
    pendingRequests: listPendingRequests(matchId, matchState),
    updatedAt: new Date().toISOString(),
  };
}

function getSpeakerNotice(role) {
  if (role === "spectator") {
    return "Spectator is talking.";
  }

  if (role === "director") {
    return "Director is talking.";
  }

  if (role === "umpire") {
    return "Umpire is replying.";
  }

  return "Someone is talking.";
}

function clearActiveLock(matchId, reason = "ended") {
  const matchState = getMatchState(matchId);
  if (matchState.timeoutId) {
    clearTimeout(matchState.timeoutId);
    matchState.timeoutId = null;
  }

  const hadSpeaker = Boolean(matchState.activeSpeakerId);
  const previousSpeakerId = matchState.activeSpeakerId;
  matchState.activeSpeakerRole = "";
  matchState.activeSpeakerId = "";
  matchState.activeSpeakerName = "";
  matchState.lockStartedAt = "";
  matchState.expiresAt = "";
  matchState.transmissionId = "";

  if (hadSpeaker) {
    notifyMatch(matchId, {
      type: "state",
      snapshot: buildSnapshot(matchId),
      notification: {
        type: "transmission_ended",
        message:
          reason === "timeout"
            ? "Walkie-talkie transmission ended."
            : reason === "disabled"
            ? "Walkie-talkie turned off."
            : reason === "disconnect"
            ? "Transmission ended."
            : "Channel is free.",
      },
    });

    if (previousSpeakerId) {
      notifyParticipant(matchId, previousSpeakerId, {
        type: "transmission-ended",
        reason,
      });
    }
  }
}

function disableForNoListeners(matchId) {
  const matchState = getMatchState(matchId);
  if (!matchState.enabled) {
    return;
  }

  const listenerCount =
    listParticipants(matchState, "spectator").length +
    listParticipants(matchState, "director").length;
  if (listenerCount > 0) {
    return;
  }

  matchState.enabled = false;
  clearActiveLock(matchId, "disabled");
  notifyMatch(matchId, {
    type: "state",
    snapshot: buildSnapshot(matchId),
  });
}

function scheduleTransmissionTimeout(matchId, transmissionId) {
  const matchState = getMatchState(matchId);
  if (matchState.timeoutId) {
    clearTimeout(matchState.timeoutId);
  }

  matchState.timeoutId = setTimeout(() => {
    const latestState = getMatchState(matchId);
    if (latestState.transmissionId !== transmissionId) {
      return;
    }

    clearActiveLock(matchId, "timeout");
  }, SPEAKER_MAX_MS + CLEANUP_GRACE_MS);
}

export function subscribeToWalkieMatch(matchId, callback) {
  const eventName = `walkie:match:${matchId}`;
  emitter.on(eventName, callback);
  return () => emitter.off(eventName, callback);
}

export function subscribeToWalkieParticipant(matchId, participantId, callback) {
  const eventName = `walkie:participant:${matchId}:${participantId}`;
  emitter.on(eventName, callback);
  return () => emitter.off(eventName, callback);
}

export function registerWalkieParticipant(matchId, participant) {
  const matchState = getMatchState(matchId);
  const nextParticipant = {
    id: String(participant.id),
    role: participant.role,
    name:
      participant.name ||
      (participant.role === "umpire"
        ? "Umpire"
        : participant.role === "director"
        ? "Director"
        : "Spectator"),
    connectedAt: new Date().toISOString(),
  };

  const existingDisconnectTimer = matchState.disconnectTimers.get(nextParticipant.id);
  if (existingDisconnectTimer) {
    clearTimeout(existingDisconnectTimer);
    matchState.disconnectTimers.delete(nextParticipant.id);
  }

  matchState.participants.set(nextParticipant.id, nextParticipant);
  notifyMatch(matchId, {
    type: "state",
    snapshot: buildSnapshot(matchId),
  });

  if (
    (nextParticipant.role === "umpire" || nextParticipant.role === "director") &&
    matchState.pendingRequests.size > 0
  ) {
    const latestRequest = [...matchState.pendingRequests.values()].at(-1);
    notifyMatch(matchId, {
      type: "state",
      snapshot: buildSnapshot(matchId),
      notification: {
        type: "walkie_requested",
        message: latestRequest?.message || "A spectator requested walkie-talkie.",
      },
    });
  }

  return {
    snapshot: buildSnapshot(matchId),
    cleanup: () => {
      const latestState = getMatchState(matchId);
      const existingTimer = latestState.disconnectTimers.get(nextParticipant.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        const settledState = getMatchState(matchId);
        settledState.disconnectTimers.delete(nextParticipant.id);
        settledState.participants.delete(nextParticipant.id);

        if (settledState.activeSpeakerId === nextParticipant.id) {
          clearActiveLock(matchId, "disconnect");
        }

        notifyMatch(matchId, {
          type: "state",
          snapshot: buildSnapshot(matchId),
        });

        if (
          listParticipants(settledState, "spectator").length === 0 &&
          listParticipants(settledState, "director").length === 0
        ) {
          disableForNoListeners(matchId);
        }
      }, DISCONNECT_GRACE_MS);

      latestState.disconnectTimers.set(nextParticipant.id, timer);
    },
  };
}

export function hydrateWalkieEnabled(matchId, enabled) {
  const matchState = getMatchState(matchId);
  matchState.enabled = Boolean(enabled);
  return buildSnapshot(matchId);
}

export function setWalkieEnabled(matchId, enabled) {
  const matchState = getMatchState(matchId);
  const handledRequests = listPendingRequests(matchId, matchState);
  if (!enabled) {
    matchState.enabled = false;
    clearActiveLock(matchId, "disabled");
  } else {
    matchState.enabled = true;
    matchState.pendingRequests.clear();
  }

  const snapshot = buildSnapshot(matchId);
  if (enabled) {
    handledRequests.forEach((request) => {
      notifyParticipant(matchId, request.participantId, {
        type: "request-accepted",
        requestId: request.requestId,
      });
    });
  }
  notifyMatch(matchId, {
    type: "state",
    snapshot,
    notification: {
      type: enabled ? "walkie_enabled" : "walkie_disabled",
      message: enabled
        ? "Walkie-talkie is live."
        : "Walkie-talkie is off.",
    },
  });

  return snapshot;
}

export function requestWalkieEnable(matchId, { participantId, role }) {
  const matchState = getMatchState(matchId);
  const participant = matchState.participants.get(String(participantId));

  if (
    !participant ||
    participant.role !== role ||
    !["spectator", "director"].includes(participant.role)
  ) {
    return { ok: false, status: 403, message: "Participant is not authorized." };
  }

  if (matchState.enabled) {
    return { ok: false, status: 409, message: "Walkie-talkie is already on." };
  }

  const now = Date.now();
  const existingRequest = matchState.pendingRequests.get(participant.id);
  if (existingRequest) {
    return {
      ok: false,
      status: 409,
      message: "Request already sent. Waiting for the umpire.",
    };
  }

  const cooldownUntil = Number(matchState.requestCooldowns.get(participant.id) || 0);
  if (cooldownUntil > now) {
    return {
      ok: false,
      status: 429,
      message: `Please wait ${Math.ceil((cooldownUntil - now) / 1000)} seconds before requesting again.`,
    };
  }

  matchState.requestCooldowns.set(participant.id, now + REQUEST_COOLDOWN_MS);
  const requestId = `${participant.id}:${now}`;
  const requestMessage =
    participant.role === "director"
      ? `${participant.name} requested walkie-talkie.`
      : `${participant.name} requested walkie-talkie.`;
  matchState.pendingRequests.set(participant.id, {
    requestId,
    participantId: participant.id,
    role: participant.role,
    name: participant.name,
    message: requestMessage,
    requestedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + REQUEST_MAX_AGE_MS).toISOString(),
  });

  notifyMatch(matchId, {
    type: "state",
    snapshot: buildSnapshot(matchId),
    notification: {
      type: "walkie_requested",
      message: requestMessage,
      request: {
        requestId,
        participantId: participant.id,
        role: participant.role,
        name: participant.name,
      },
    },
  });

  notifyParticipant(matchId, participant.id, {
    type: "request-sent",
    requestId,
  });

  return { ok: true, snapshot: buildSnapshot(matchId) };
}

export function respondToWalkieRequest(matchId, { requestId, action }) {
  const matchState = getMatchState(matchId);
  const request = listPendingRequests(matchId, matchState).find(
    (entry) => entry.requestId === requestId
  );

  if (!request) {
    return { ok: false, status: 404, message: "Walkie request not found." };
  }

  if (action === "dismiss") {
    matchState.pendingRequests.delete(request.participantId);
    const snapshot = buildSnapshot(matchId);
    notifyParticipant(matchId, request.participantId, {
      type: "request-dismissed",
      requestId: request.requestId,
    });
    notifyMatch(matchId, {
      type: "state",
      snapshot,
      notification: {
        type: "walkie_request_dismissed",
        message: `${request.name} walkie request was dismissed.`,
        request,
      },
    });
    return { ok: true, snapshot };
  }

  const snapshot = setWalkieEnabled(matchId, true);
  notifyMatch(matchId, {
    type: "state",
    snapshot,
    notification: {
      type: "walkie_request_accepted",
      message: `${request.name} walkie request was accepted.`,
      request,
    },
  });
  return { ok: true, snapshot };
}

export function claimWalkieSpeaker(matchId, { role, participantId }) {
  const matchState = getMatchState(matchId);
  const participant = matchState.participants.get(String(participantId));

  if (!participant || participant.role !== role) {
    return { ok: false, status: 403, message: "Participant is not authorized." };
  }

  if (!matchState.enabled) {
    return { ok: false, status: 409, message: "Walkie-talkie is off." };
  }

  if (
    (role === "spectator" || role === "director") &&
    listParticipants(matchState, "umpire").length === 0
  ) {
    return { ok: false, status: 409, message: "No umpire audio available." };
  }

  if (
    role === "umpire" &&
    listParticipants(matchState, "spectator").length === 0 &&
    listParticipants(matchState, "director").length === 0
  ) {
    return { ok: false, status: 409, message: "No listeners are connected." };
  }

  if (matchState.activeSpeakerId && matchState.activeSpeakerId !== participant.id) {
    return {
      ok: false,
      status: 409,
      message:
        matchState.activeSpeakerRole === "umpire"
          ? "Umpire is replying."
          : matchState.activeSpeakerRole === "director"
          ? "Director is talking."
          : "Another spectator is speaking.",
    };
  }

  const now = Date.now();
  const transmissionId = `${participant.role}:${participant.id}:${now}`;
  matchState.activeSpeakerRole = participant.role;
  matchState.activeSpeakerId = participant.id;
  matchState.activeSpeakerName = participant.name;
  matchState.lockStartedAt = new Date(now).toISOString();
  matchState.expiresAt = new Date(now + SPEAKER_MAX_MS).toISOString();
  matchState.transmissionId = transmissionId;
  scheduleTransmissionTimeout(matchId, transmissionId);

  const snapshot = buildSnapshot(matchId);
  notifyMatch(matchId, {
    type: "state",
    snapshot,
    notification: {
      type:
        participant.role === "spectator"
          ? "spectator_talking"
          : participant.role === "director"
          ? "director_talking"
          : "umpire_reply",
      message: getSpeakerNotice(participant.role),
    },
  });

  return { ok: true, snapshot };
}

export function releaseWalkieSpeaker(matchId, { participantId }) {
  const matchState = getMatchState(matchId);
  if (matchState.activeSpeakerId !== String(participantId)) {
    return { ok: false, status: 409, message: "This participant is not speaking." };
  }

  clearActiveLock(matchId, "released");
  return { ok: true, snapshot: buildSnapshot(matchId) };
}

export function getWalkieSnapshot(matchId) {
  return buildSnapshot(matchId);
}

export function dispatchWalkieSignal(matchId, { fromId, toId, payload }) {
  const matchState = getMatchState(matchId);
  const from = matchState.participants.get(String(fromId));
  const to = matchState.participants.get(String(toId));

  if (!from || !to) {
    return { ok: false, status: 404, message: "Walkie participant not found." };
  }

  if (!matchState.activeSpeakerId || !matchState.transmissionId) {
    return { ok: false, status: 409, message: "No active walkie transmission." };
  }

  const isSpeakerSignal =
    matchState.activeSpeakerId === from.id || matchState.activeSpeakerId === to.id;
  if (!isSpeakerSignal) {
    return { ok: false, status: 403, message: "Signal target is invalid." };
  }

  notifyParticipant(matchId, to.id, {
    type: "signal",
    fromId: from.id,
    fromRole: from.role,
    payload,
  });

  return { ok: true };
}
