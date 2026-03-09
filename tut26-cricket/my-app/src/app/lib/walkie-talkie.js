import { EventEmitter } from "node:events";

const SPEAKER_MAX_MS = 30_000;
const CLEANUP_GRACE_MS = 3_000;

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
    });
  }

  return store.matches.get(key);
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

function buildSnapshot(matchId) {
  const matchState = getMatchState(matchId);
  const spectators = listParticipants(matchState, "spectator");
  const umpires = listParticipants(matchState, "umpire");

  return {
    enabled: Boolean(matchState.enabled),
    spectatorCount: spectators.length,
    umpireCount: umpires.length,
    busy: Boolean(matchState.activeSpeakerId),
    activeSpeakerRole: matchState.activeSpeakerRole || "",
    activeSpeakerId: matchState.activeSpeakerId || "",
    activeSpeakerName: matchState.activeSpeakerName || "",
    lockStartedAt: matchState.lockStartedAt || "",
    expiresAt: matchState.expiresAt || "",
    transmissionId: matchState.transmissionId || "",
    updatedAt: new Date().toISOString(),
  };
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

function disableForNoSpectators(matchId) {
  const matchState = getMatchState(matchId);
  if (!matchState.enabled) {
    return;
  }

  matchState.enabled = false;
  clearActiveLock(matchId, "disabled");
  notifyMatch(matchId, {
    type: "state",
    snapshot: buildSnapshot(matchId),
    notification: {
      type: "walkie_disabled",
      message: "Walkie-talkie turned off. No spectators connected.",
    },
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
    name: participant.name || (participant.role === "umpire" ? "Umpire" : "Spectator"),
    connectedAt: new Date().toISOString(),
  };

  matchState.participants.set(nextParticipant.id, nextParticipant);
  notifyMatch(matchId, {
    type: "state",
    snapshot: buildSnapshot(matchId),
  });

  return {
    snapshot: buildSnapshot(matchId),
    cleanup: () => {
      const latestState = getMatchState(matchId);
      latestState.participants.delete(nextParticipant.id);

      if (latestState.activeSpeakerId === nextParticipant.id) {
        clearActiveLock(matchId, "disconnect");
      }

      notifyMatch(matchId, {
        type: "state",
        snapshot: buildSnapshot(matchId),
      });

      if (listParticipants(latestState, "spectator").length === 0) {
        disableForNoSpectators(matchId);
      }
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
  if (!enabled) {
    matchState.enabled = false;
    clearActiveLock(matchId, "disabled");
  } else {
    matchState.enabled = true;
  }

  const snapshot = buildSnapshot(matchId);
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

export function claimWalkieSpeaker(matchId, { role, participantId }) {
  const matchState = getMatchState(matchId);
  const participant = matchState.participants.get(String(participantId));

  if (!participant || participant.role !== role) {
    return { ok: false, status: 403, message: "Participant is not authorized." };
  }

  if (!matchState.enabled) {
    return { ok: false, status: 409, message: "Walkie-talkie is off." };
  }

  if (role === "spectator" && listParticipants(matchState, "umpire").length === 0) {
    return { ok: false, status: 409, message: "No umpire audio available." };
  }

  if (role === "umpire" && listParticipants(matchState, "spectator").length === 0) {
    return { ok: false, status: 409, message: "No spectators are connected." };
  }

  if (matchState.activeSpeakerId && matchState.activeSpeakerId !== participant.id) {
    return {
      ok: false,
      status: 409,
      message:
        matchState.activeSpeakerRole === "umpire"
          ? "Umpire is replying."
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
      type: participant.role === "spectator" ? "spectator_talking" : "umpire_reply",
      message:
        participant.role === "spectator"
          ? `${participant.name} is talking.`
          : "Umpire is replying.",
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
