/**
 * File overview:
 * Purpose: Provides shared Walkie Live Updates logic for routes, APIs, and feature code.
 * Main exports: publishWalkieStateUpdate, publishWalkieMessage, subscribeToWalkieState, subscribeToWalkieMessages.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: ./README.md
 */

import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import { connectDB } from "./db";
import WalkieMessage from "../../models/WalkieMessage";
import WalkieState from "../../models/WalkieState";

const emitter = globalThis.__gvWalkieLiveEmitter || new EventEmitter();
globalThis.__gvWalkieLiveEmitter = emitter;
emitter.setMaxListeners(1000);
const WATCHER_IDLE_SHUTDOWN_MS = 60_000;

const state = globalThis.__gvWalkieLiveState || {
  initialized: false,
  initializing: null,
  stateWatcher: null,
  messageWatcher: null,
  stateSubscribers: new Map(),
  messageSubscribers: new Map(),
  idleShutdownTimer: null,
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

function clearIdleShutdownTimer() {
  if (state.idleShutdownTimer) {
    clearTimeout(state.idleShutdownTimer);
    state.idleShutdownTimer = null;
  }
}

function getTotalSubscriberCount() {
  let total = 0;

  for (const count of state.stateSubscribers.values()) {
    total += Number(count || 0);
  }

  for (const count of state.messageSubscribers.values()) {
    total += Number(count || 0);
  }

  return total;
}

async function closeWatchers() {
  clearIdleShutdownTimer();

  const stateWatcher = state.stateWatcher;
  const messageWatcher = state.messageWatcher;
  state.stateWatcher = null;
  state.messageWatcher = null;
  state.initialized = false;

  await Promise.allSettled([
    stateWatcher?.close?.(),
    messageWatcher?.close?.(),
  ]);
}

function scheduleIdleShutdown() {
  if (getTotalSubscriberCount() > 0) {
    clearIdleShutdownTimer();
    return;
  }

  if (state.idleShutdownTimer) {
    return;
  }

  state.idleShutdownTimer = setTimeout(() => {
    state.idleShutdownTimer = null;

    if (getTotalSubscriberCount() > 0) {
      return;
    }

    void closeWatchers();
  }, WATCHER_IDLE_SHUTDOWN_MS);
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
  clearIdleShutdownTimer();

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
  clearIdleShutdownTimer();
  const eventName = `walkie-state:${String(matchId)}`;
  const currentCount = Number(state.stateSubscribers.get(eventName) || 0);
  state.stateSubscribers.set(eventName, currentCount + 1);
  emitter.on(eventName, callback);
  return () => {
    emitter.off(eventName, callback);
    const nextCount = Number(state.stateSubscribers.get(eventName) || 0) - 1;
    if (nextCount <= 0) {
      state.stateSubscribers.delete(eventName);
    } else {
      state.stateSubscribers.set(eventName, nextCount);
    }
    scheduleIdleShutdown();
  };
}

export function subscribeToWalkieMessages(matchId, participantId, callback) {
  clearIdleShutdownTimer();
  const eventName = `walkie-message:${String(matchId)}:${String(participantId)}`;
  const currentCount = Number(state.messageSubscribers.get(eventName) || 0);
  state.messageSubscribers.set(eventName, currentCount + 1);
  emitter.on(eventName, callback);
  return () => {
    emitter.off(eventName, callback);
    const nextCount = Number(state.messageSubscribers.get(eventName) || 0) - 1;
    if (nextCount <= 0) {
      state.messageSubscribers.delete(eventName);
    } else {
      state.messageSubscribers.set(eventName, nextCount);
    }
    scheduleIdleShutdown();
  };
}


