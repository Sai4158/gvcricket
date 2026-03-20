import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import { connectDB } from "./db";
import WalkieMessage from "../../models/WalkieMessage";
import WalkieState from "../../models/WalkieState";

const emitter = globalThis.__gvWalkieLiveEmitter || new EventEmitter();
globalThis.__gvWalkieLiveEmitter = emitter;
emitter.setMaxListeners(1000);

const state = globalThis.__gvWalkieLiveState || {
  initialized: false,
  initializing: null,
  stateWatcher: null,
  messageWatcher: null,
};
globalThis.__gvWalkieLiveState = state;

function isReplicaSetAvailable() {
  const topology = mongoose.connection?.client?.topology?.description;
  return Boolean(topology);
}

function emitWalkieState(matchId) {
  if (!matchId) return;
  emitter.emit(`walkie-state:${String(matchId)}`, { matchId: String(matchId) });
}

function emitWalkieMessage(matchId, participantId) {
  if (!matchId || !participantId) return;
  emitter.emit(`walkie-message:${String(matchId)}:${String(participantId)}`, {
    matchId: String(matchId),
    participantId: String(participantId),
  });
}

export function publishWalkieStateUpdate(matchId) {
  emitWalkieState(matchId);
}

export function publishWalkieMessage(matchId, participantId) {
  emitWalkieMessage(matchId, participantId);
}

async function startWatchers() {
  await connectDB();

  if (!isReplicaSetAvailable()) {
    throw new Error("MongoDB change streams require a replica set.");
  }

  if (!state.stateWatcher) {
    state.stateWatcher = WalkieState.watch([], { fullDocument: "updateLookup" });
    state.stateWatcher.on("change", (change) => {
      const matchId = change.fullDocument?.matchId || change.documentKey?._id || null;
      emitWalkieState(matchId);
    });
    state.stateWatcher.on("error", (error) => {
      console.error("Walkie state change stream error:", error);
      state.stateWatcher = null;
      state.initialized = false;
    });
  }

  if (!state.messageWatcher) {
    state.messageWatcher = WalkieMessage.watch(
      [{ $match: { operationType: "insert" } }],
      { fullDocument: "updateLookup" }
    );
    state.messageWatcher.on("change", (change) => {
      const matchId = change.fullDocument?.matchId || null;
      const participantId = change.fullDocument?.toParticipantId || "";
      emitWalkieMessage(matchId, participantId);
    });
    state.messageWatcher.on("error", (error) => {
      console.error("Walkie message change stream error:", error);
      state.messageWatcher = null;
      state.initialized = false;
    });
  }
}

export async function ensureWalkieLiveUpdates() {
  if (state.initialized) return;
  if (state.initializing) {
    await state.initializing;
    return;
  }

  state.initializing = startWatchers()
    .then(() => {
      state.initialized = true;
    })
    .finally(() => {
      state.initializing = null;
    });

  await state.initializing;
}

export function subscribeToWalkieState(matchId, callback) {
  const eventName = `walkie-state:${String(matchId)}`;
  emitter.on(eventName, callback);
  return () => emitter.off(eventName, callback);
}

export function subscribeToWalkieMessages(matchId, participantId, callback) {
  const eventName = `walkie-message:${String(matchId)}:${String(participantId)}`;
  emitter.on(eventName, callback);
  return () => emitter.off(eventName, callback);
}
