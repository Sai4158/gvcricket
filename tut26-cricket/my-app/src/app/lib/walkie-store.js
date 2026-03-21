import WalkieMessage from "../../models/WalkieMessage";
import WalkieState from "../../models/WalkieState";
import {
  publishWalkieMessage,
  publishWalkieStateUpdate,
} from "./walkie-live-updates";

const SPEAKER_MAX_MS = 30_000;
const REQUEST_COOLDOWN_MS = 30_000;
const PARTICIPANT_STALE_MS = 20_000;
const REQUEST_MAX_AGE_MS = 120_000;
const MESSAGE_TTL_MS = 20_000;
const STATE_IDLE_TTL_MS = 5 * 60_000;
const MAX_QUEUED_MESSAGES_PER_PARTICIPANT = 24;
const WALKIE_STATE_RETRY_LIMIT = 4;

function nowDate() {
  return new Date();
}

function newNotification(type, message, request = null) {
  return {
    id: `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    request,
    createdAt: nowDate(),
  };
}

function isRetryableWalkieStateError(error) {
  return error?.name === "VersionError";
}

function touchIdleExpiry(doc) {
  doc.idleExpiresAt = new Date(Date.now() + STATE_IDLE_TTL_MS);
}

function displayNameForRole(role, name = "") {
  if (name) return name;
  if (role === "umpire") return "Umpire";
  if (role === "director") return "Director";
  return "Spectator";
}

function participantView(participant) {
  return {
    id: participant.id,
    role: participant.role,
    name: participant.name,
    connectedAt: participant.connectedAt instanceof Date
      ? participant.connectedAt.toISOString()
      : new Date(participant.connectedAt).toISOString(),
  };
}

function buildSnapshot(doc) {
  const participants = Array.isArray(doc.participants) ? doc.participants : [];
  const pendingRequests = Array.isArray(doc.pendingRequests) ? doc.pendingRequests : [];
  const spectators = participants.filter((item) => item.role === "spectator");
  const umpires = participants.filter((item) => item.role === "umpire");
  const directors = participants.filter((item) => item.role === "director");

  return {
    enabled: Boolean(doc.enabled),
    spectatorCount: spectators.length,
    umpireCount: umpires.length,
    directorCount: directors.length,
    busy: Boolean(doc.activeSpeakerId),
    activeSpeakerRole: doc.activeSpeakerRole || "",
    activeSpeakerId: doc.activeSpeakerId || "",
    activeSpeakerName: doc.activeSpeakerName || "",
    lockStartedAt: doc.lockStartedAt ? new Date(doc.lockStartedAt).toISOString() : "",
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : "",
    transmissionId: doc.transmissionId || "",
    pendingRequests: pendingRequests
      .slice()
      .sort((left, right) => new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime())
      .map((request) => ({
        requestId: request.requestId,
        participantId: request.participantId,
        role: request.role,
        name: request.name,
        requestedAt: new Date(request.requestedAt).toISOString(),
      })),
    updatedAt: new Date(doc.updatedAt || Date.now()).toISOString(),
    version: Number(doc.version || 0),
  };
}

async function touchAndCleanState(matchId, attempt = 0) {
  const now = nowDate();
  const staleBefore = new Date(now.getTime() - PARTICIPANT_STALE_MS);
  const doc = await WalkieState.findOneAndUpdate(
    { matchId },
    {
      $setOnInsert: {
        matchId,
        idleExpiresAt: new Date(Date.now() + STATE_IDLE_TTL_MS),
      },
      $pull: {
        participants: { lastSeenAt: { $lt: staleBefore } },
        pendingRequests: { expiresAt: { $lte: now } },
        requestCooldowns: { until: { $lte: now } },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (doc.activeSpeakerId) {
    const activeParticipant = doc.participants.find((item) => item.id === doc.activeSpeakerId);
    const expired = doc.expiresAt && new Date(doc.expiresAt).getTime() <= now.getTime();
    if (!activeParticipant || expired) {
      doc.activeSpeakerRole = "";
      doc.activeSpeakerId = "";
      doc.activeSpeakerName = "";
      doc.lockStartedAt = null;
      doc.expiresAt = null;
      doc.transmissionId = "";
      doc.version += 1;
      doc.lastNotification = newNotification(
        expired ? "transmission_ended" : "transmission_ended",
        expired ? "Walkie-talkie transmission ended." : "Transmission ended."
      );
      touchIdleExpiry(doc);
      try {
        await doc.save();
      } catch (error) {
        if (
          isRetryableWalkieStateError(error) &&
          attempt < WALKIE_STATE_RETRY_LIMIT - 1
        ) {
          return touchAndCleanState(matchId, attempt + 1);
        }
        throw error;
      }
      publishWalkieStateUpdate(matchId);
      return touchAndCleanState(matchId, attempt + 1);
    }
  }

  if (doc.enabled) {
    const listenerCount = doc.participants.filter(
      (item) => item.role === "spectator" || item.role === "director"
    ).length;
    if (listenerCount === 0) {
      doc.enabled = false;
      doc.version += 1;
      doc.lastNotification = newNotification("walkie_disabled", "Walkie-talkie is off.");
      touchIdleExpiry(doc);
      try {
        await doc.save();
      } catch (error) {
        if (
          isRetryableWalkieStateError(error) &&
          attempt < WALKIE_STATE_RETRY_LIMIT - 1
        ) {
          return touchAndCleanState(matchId, attempt + 1);
        }
        throw error;
      }
      publishWalkieStateUpdate(matchId);
      return touchAndCleanState(matchId, attempt + 1);
    }
  }

  return doc;
}

async function queueParticipantMessage(matchId, toParticipantId, eventType, payload) {
  await WalkieMessage.create({
    matchId,
    toParticipantId: String(toParticipantId),
    eventType,
    payload,
    expiresAt: new Date(Date.now() + MESSAGE_TTL_MS),
  });

  const staleMessages = await WalkieMessage.find({
    matchId,
    toParticipantId: String(toParticipantId),
  })
    .sort({ createdAt: -1 })
    .skip(MAX_QUEUED_MESSAGES_PER_PARTICIPANT)
    .select("_id")
    .lean();

  if (staleMessages.length > 0) {
    await WalkieMessage.collection.deleteMany({
      _id: { $in: staleMessages.map((item) => item._id) },
    });
  }

  publishWalkieMessage(matchId, toParticipantId);
}

export async function getPersistentWalkieSnapshot(matchId) {
  const doc = await touchAndCleanState(matchId);
  return {
    snapshot: buildSnapshot(doc),
    notification: doc.lastNotification?.id ? doc.lastNotification : null,
  };
}

export async function registerPersistentWalkieParticipant(
  matchId,
  participant,
  attempt = 0
) {
  const doc = await touchAndCleanState(matchId, attempt);
  const participantId = String(participant.id);
  const existing = doc.participants.find((item) => item.id === participantId);
  const nextNow = nowDate();

  if (existing) {
    existing.role = participant.role;
    existing.name = displayNameForRole(participant.role, participant.name);
    existing.lastSeenAt = nextNow;
  } else {
    doc.participants.push({
      id: participantId,
      role: participant.role,
      name: displayNameForRole(participant.role, participant.name),
      connectedAt: nextNow,
      lastSeenAt: nextNow,
    });
  }

  doc.version += 1;
  touchIdleExpiry(doc);
  try {
    await doc.save();
  } catch (error) {
    if (
      isRetryableWalkieStateError(error) &&
      attempt < WALKIE_STATE_RETRY_LIMIT - 1
    ) {
      return registerPersistentWalkieParticipant(matchId, participant, attempt + 1);
    }
    throw error;
  }
  publishWalkieStateUpdate(matchId);
  return {
    snapshot: buildSnapshot(doc),
    notification: doc.lastNotification?.id ? doc.lastNotification : null,
  };
}

export async function heartbeatPersistentWalkieParticipant(
  matchId,
  participantId,
  role,
  name = "",
  attempt = 0
) {
  const doc = await touchAndCleanState(matchId, attempt);
  const participant = doc.participants.find((item) => item.id === String(participantId));
  if (!participant) {
    return registerPersistentWalkieParticipant(matchId, {
      id: participantId,
      role,
      name,
    }, attempt);
  }
  participant.lastSeenAt = nowDate();
  touchIdleExpiry(doc);
  try {
    await doc.save();
  } catch (error) {
    if (
      isRetryableWalkieStateError(error) &&
      attempt < WALKIE_STATE_RETRY_LIMIT - 1
    ) {
      return heartbeatPersistentWalkieParticipant(
        matchId,
        participantId,
        role,
        name,
        attempt + 1
      );
    }
    throw error;
  }
  return {
    snapshot: buildSnapshot(doc),
    notification: doc.lastNotification?.id ? doc.lastNotification : null,
  };
}

export async function setPersistentWalkieEnabled(matchId, enabled, attempt = 0) {
  const doc = await touchAndCleanState(matchId, attempt);
  const participantMessages = [];
  doc.enabled = Boolean(enabled);
  if (!enabled) {
    const previousSpeakerId = doc.activeSpeakerId || "";
    doc.activeSpeakerRole = "";
    doc.activeSpeakerId = "";
    doc.activeSpeakerName = "";
    doc.lockStartedAt = null;
    doc.expiresAt = null;
    doc.transmissionId = "";
    if (previousSpeakerId) {
      participantMessages.push({
        toParticipantId: previousSpeakerId,
        eventType: "participant",
        payload: {
        type: "transmission-ended",
        reason: "disabled",
        },
      });
    }
  } else {
    for (const request of doc.pendingRequests) {
      participantMessages.push({
        toParticipantId: request.participantId,
        eventType: "participant",
        payload: {
          type: "request-accepted",
          requestId: request.requestId,
        },
      });
    }
    doc.pendingRequests = [];
  }

  doc.version += 1;
  doc.lastNotification = newNotification(
    enabled ? "walkie_enabled" : "walkie_disabled",
    enabled ? "Walkie-talkie is live." : "Walkie-talkie is off."
  );
  touchIdleExpiry(doc);
  try {
    await doc.save();
  } catch (error) {
    if (
      isRetryableWalkieStateError(error) &&
      attempt < WALKIE_STATE_RETRY_LIMIT - 1
    ) {
      return setPersistentWalkieEnabled(matchId, enabled, attempt + 1);
    }
    throw error;
  }
  publishWalkieStateUpdate(matchId);
  for (const message of participantMessages) {
    await queueParticipantMessage(
      matchId,
      message.toParticipantId,
      message.eventType,
      message.payload
    );
  }
  return buildSnapshot(doc);
}

export async function requestPersistentWalkieEnable(
  matchId,
  { participantId, role },
  attempt = 0
) {
  const doc = await touchAndCleanState(matchId, attempt);
  const participant = doc.participants.find((item) => item.id === String(participantId));

  if (!participant || participant.role !== role || !["spectator", "director"].includes(role)) {
    return { ok: false, status: 403, message: "Participant is not authorized." };
  }
  if (doc.enabled) {
    return { ok: false, status: 409, message: "Walkie-talkie is already on." };
  }
  if (doc.pendingRequests.some((item) => item.participantId === participant.id)) {
    return { ok: false, status: 409, message: "Request already sent. Waiting for the umpire." };
  }

  const now = Date.now();
  const cooldown = doc.requestCooldowns.find((item) => item.participantId === participant.id);
  if (cooldown?.until && new Date(cooldown.until).getTime() > now) {
    return {
      ok: false,
      status: 429,
      message: `Please wait ${Math.ceil((new Date(cooldown.until).getTime() - now) / 1000)} seconds before requesting again.`,
    };
  }

  doc.requestCooldowns = doc.requestCooldowns.filter((item) => item.participantId !== participant.id);
  doc.requestCooldowns.push({
    participantId: participant.id,
    until: new Date(now + REQUEST_COOLDOWN_MS),
  });

  const requestId = `${participant.id}:${now}`;
  const request = {
    requestId,
    participantId: participant.id,
    role: participant.role,
    name: participant.name,
    message: `${participant.name} requested walkie-talkie.`,
    requestedAt: new Date(now),
    expiresAt: new Date(now + REQUEST_MAX_AGE_MS),
  };

  doc.pendingRequests.push(request);
  doc.version += 1;
  doc.lastNotification = newNotification("walkie_requested", request.message, {
    requestId,
    participantId: participant.id,
    role: participant.role,
    name: participant.name,
  });
  touchIdleExpiry(doc);
  try {
    await doc.save();
  } catch (error) {
    if (
      isRetryableWalkieStateError(error) &&
      attempt < WALKIE_STATE_RETRY_LIMIT - 1
    ) {
      return requestPersistentWalkieEnable(
        matchId,
        { participantId, role },
        attempt + 1
      );
    }
    throw error;
  }
  publishWalkieStateUpdate(matchId);

  await queueParticipantMessage(matchId, participant.id, "participant", {
    type: "request-sent",
    requestId,
  });

  return { ok: true, snapshot: buildSnapshot(doc) };
}

export async function respondToPersistentWalkieRequest(
  matchId,
  { requestId, action },
  attempt = 0
) {
  const doc = await touchAndCleanState(matchId, attempt);
  const request = doc.pendingRequests.find((item) => item.requestId === requestId);

  if (!request) {
    return { ok: false, status: 404, message: "Walkie request not found." };
  }

  if (action === "dismiss") {
    doc.pendingRequests = doc.pendingRequests.filter((item) => item.requestId !== requestId);
    doc.version += 1;
    doc.lastNotification = newNotification(
      "walkie_request_dismissed",
      `${request.name} walkie request was dismissed.`,
      {
        requestId: request.requestId,
        participantId: request.participantId,
        role: request.role,
        name: request.name,
      }
    );
    touchIdleExpiry(doc);
    try {
      await doc.save();
    } catch (error) {
      if (
        isRetryableWalkieStateError(error) &&
        attempt < WALKIE_STATE_RETRY_LIMIT - 1
      ) {
        return respondToPersistentWalkieRequest(
          matchId,
          { requestId, action },
          attempt + 1
        );
      }
      throw error;
    }
    publishWalkieStateUpdate(matchId);
    await queueParticipantMessage(matchId, request.participantId, "participant", {
      type: "request-dismissed",
      requestId: request.requestId,
    });
    return { ok: true, snapshot: buildSnapshot(doc) };
  }

  doc.enabled = true;
  doc.pendingRequests = [];
  doc.version += 1;
  doc.lastNotification = newNotification(
    "walkie_request_accepted",
    `${request.name} walkie request was accepted.`,
    {
      requestId: request.requestId,
      participantId: request.participantId,
      role: request.role,
      name: request.name,
    }
  );
  touchIdleExpiry(doc);
  try {
    await doc.save();
  } catch (error) {
    if (
      isRetryableWalkieStateError(error) &&
      attempt < WALKIE_STATE_RETRY_LIMIT - 1
    ) {
      return respondToPersistentWalkieRequest(
        matchId,
        { requestId, action },
        attempt + 1
      );
    }
    throw error;
  }
  publishWalkieStateUpdate(matchId);

  await queueParticipantMessage(matchId, request.participantId, "participant", {
    type: "request-accepted",
    requestId: request.requestId,
  });

  return { ok: true, snapshot: buildSnapshot(doc) };
}

export async function claimPersistentWalkieSpeaker(
  matchId,
  { role, participantId },
  attempt = 0
) {
  const doc = await touchAndCleanState(matchId, attempt);
  const participant = doc.participants.find((item) => item.id === String(participantId));

  if (!participant || participant.role !== role) {
    return { ok: false, status: 403, message: "Participant is not authorized." };
  }
  if (!doc.enabled) {
    return { ok: false, status: 409, message: "Walkie-talkie is off." };
  }

  const umpireCount = doc.participants.filter((item) => item.role === "umpire").length;
  const listenerCount = doc.participants.filter(
    (item) => item.role === "spectator" || item.role === "director"
  ).length;

  if ((role === "spectator" || role === "director") && umpireCount === 0) {
    return { ok: false, status: 409, message: "No umpire audio available." };
  }
  if (role === "umpire" && listenerCount === 0) {
    return { ok: false, status: 409, message: "No listeners are connected." };
  }
  if (doc.activeSpeakerId && doc.activeSpeakerId !== participant.id) {
    return {
      ok: false,
      status: 409,
      message:
        doc.activeSpeakerRole === "umpire"
          ? "Umpire is replying."
          : doc.activeSpeakerRole === "director"
          ? "Director is talking."
          : "Another spectator is speaking.",
    };
  }

  const now = Date.now();
  doc.activeSpeakerRole = participant.role;
  doc.activeSpeakerId = participant.id;
  doc.activeSpeakerName = participant.name;
  doc.lockStartedAt = new Date(now);
  doc.expiresAt = new Date(now + SPEAKER_MAX_MS);
  doc.transmissionId = `${participant.role}:${participant.id}:${now}`;
  doc.version += 1;
  doc.lastNotification = newNotification(
    participant.role === "spectator"
      ? "spectator_talking"
      : participant.role === "director"
      ? "director_talking"
      : "umpire_reply",
    participant.role === "spectator"
      ? "Spectator is talking."
      : participant.role === "director"
      ? "Director is talking."
      : "Umpire is replying."
  );
  touchIdleExpiry(doc);
  try {
    await doc.save();
  } catch (error) {
    if (
      isRetryableWalkieStateError(error) &&
      attempt < WALKIE_STATE_RETRY_LIMIT - 1
    ) {
      return claimPersistentWalkieSpeaker(
        matchId,
        { role, participantId },
        attempt + 1
      );
    }
    throw error;
  }
  publishWalkieStateUpdate(matchId);

  return { ok: true, snapshot: buildSnapshot(doc) };
}

export async function releasePersistentWalkieSpeaker(
  matchId,
  { participantId },
  attempt = 0
) {
  const doc = await touchAndCleanState(matchId, attempt);
  if (doc.activeSpeakerId !== String(participantId)) {
    return { ok: false, status: 409, message: "This participant is not speaking." };
  }

  const previousSpeakerId = doc.activeSpeakerId;
  doc.activeSpeakerRole = "";
  doc.activeSpeakerId = "";
  doc.activeSpeakerName = "";
  doc.lockStartedAt = null;
  doc.expiresAt = null;
  doc.transmissionId = "";
  doc.version += 1;
  doc.lastNotification = newNotification("transmission_ended", "Channel is free.");
  touchIdleExpiry(doc);
  try {
    await doc.save();
  } catch (error) {
    if (
      isRetryableWalkieStateError(error) &&
      attempt < WALKIE_STATE_RETRY_LIMIT - 1
    ) {
      return releasePersistentWalkieSpeaker(
        matchId,
        { participantId },
        attempt + 1
      );
    }
    throw error;
  }
  publishWalkieStateUpdate(matchId);

  await queueParticipantMessage(matchId, previousSpeakerId, "participant", {
    type: "transmission-ended",
    reason: "released",
  });

  return { ok: true, snapshot: buildSnapshot(doc) };
}

export async function dispatchPersistentWalkieSignal(matchId, { fromId, toId, payload }) {
  const doc = await touchAndCleanState(matchId);
  const from = doc.participants.find((item) => item.id === String(fromId));
  const to = doc.participants.find((item) => item.id === String(toId));

  if (!from || !to) {
    return { ok: false, status: 404, message: "Walkie participant not found." };
  }
  if (!doc.activeSpeakerId || !doc.transmissionId) {
    return { ok: false, status: 409, message: "No active walkie transmission." };
  }

  const isSpeakerSignal =
    doc.activeSpeakerId === from.id || doc.activeSpeakerId === to.id;
  if (!isSpeakerSignal) {
    return { ok: false, status: 403, message: "Signal target is invalid." };
  }

  await queueParticipantMessage(matchId, to.id, "signal", {
    type: "signal",
    fromId: from.id,
    fromRole: from.role,
    payload,
  });
  return { ok: true };
}

export async function takePersistentWalkieMessages(matchId, participantId) {
  const messages = await WalkieMessage.find({
    matchId,
    toParticipantId: String(participantId),
  })
    .sort({ createdAt: 1 })
    .lean();

  if (messages.length > 0) {
    const ids = messages.map((item) => item?._id).filter(Boolean);
    if (ids.length > 0) {
      await WalkieMessage.collection.deleteMany({
        _id: { $in: ids },
      });
    }
  }

  return messages.map((item) => ({
    eventType: item.eventType,
    payload: item.payload,
  }));
}

export async function clearPersistentWalkieMessages(matchId, participantId) {
  await WalkieMessage.collection.deleteMany({
    matchId,
    toParticipantId: String(participantId),
  });
}
