/**
 * File overview:
 * Purpose: Shared helper module for Live Updates logic.
 * Main exports: publishMatchUpdate, publishSessionUpdate, subscribeToMatch, subscribeToSession, getMatchSubscriberCount, getSessionSubscriberCount.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: README.md
 */
import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import { connectDB } from "./db";
import Match from "../../models/Match";
import Session from "../../models/Session";

const emitter = globalThis.__gvLiveEmitter || new EventEmitter();
globalThis.__gvLiveEmitter = emitter;
emitter.setMaxListeners(500);
const WATCHER_IDLE_SHUTDOWN_MS = 60_000;

const state = globalThis.__gvLiveState || {
  initialized: false,
  initializing: null,
  matchWatcher: null,
  sessionWatcher: null,
  matchSubscribers: new Map(),
  sessionSubscribers: new Map(),
  idleShutdownTimer: null,
};
globalThis.__gvLiveState = state;

function isReplicaSetAvailable() {
  const topology = mongoose.connection?.client?.topology?.description;
  return Boolean(topology);
}

async function emitMatchChange(documentId) {
  if (!documentId) return;
  emitter.emit(`match:${documentId}`, { documentId: String(documentId) });
}

async function emitSessionChange(documentId) {
  if (!documentId) return;
  emitter.emit(`session:${documentId}`, { documentId: String(documentId) });
}

export function publishMatchUpdate(documentId) {
  void emitMatchChange(documentId);
}

export function publishSessionUpdate(documentId) {
  void emitSessionChange(documentId);
}

function clearIdleShutdownTimer() {
  if (state.idleShutdownTimer) {
    clearTimeout(state.idleShutdownTimer);
    state.idleShutdownTimer = null;
  }
}

function getTotalSubscriberCount() {
  let total = 0;

  for (const count of state.matchSubscribers.values()) {
    total += Number(count || 0);
  }

  for (const count of state.sessionSubscribers.values()) {
    total += Number(count || 0);
  }

  return total;
}

async function closeWatchers() {
  clearIdleShutdownTimer();

  const matchWatcher = state.matchWatcher;
  const sessionWatcher = state.sessionWatcher;
  state.matchWatcher = null;
  state.sessionWatcher = null;
  state.initialized = false;

  await Promise.allSettled([
    matchWatcher?.close?.(),
    sessionWatcher?.close?.(),
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

  if (!state.matchWatcher) {
    state.matchWatcher = Match.watch([], { fullDocument: "updateLookup" });
    state.matchWatcher.on("change", async (change) => {
      const documentId =
        change.fullDocument?._id || change.documentKey?._id || null;
      const sessionId = change.fullDocument?.sessionId || null;
      await emitMatchChange(documentId);
      if (sessionId) {
        await emitSessionChange(sessionId);
      }
    });
    state.matchWatcher.on("error", (error) => {
      console.error("Match change stream error:", error);
      state.matchWatcher = null;
      state.initialized = false;
    });
  }

  if (!state.sessionWatcher) {
    state.sessionWatcher = Session.watch([], { fullDocument: "updateLookup" });
    state.sessionWatcher.on("change", async (change) => {
      const documentId =
        change.fullDocument?._id || change.documentKey?._id || null;
      await emitSessionChange(documentId);
    });
    state.sessionWatcher.on("error", (error) => {
      console.error("Session change stream error:", error);
      state.sessionWatcher = null;
      state.initialized = false;
    });
  }
}

export async function ensureLiveUpdates() {
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

export function subscribeToMatch(matchId, callback) {
  clearIdleShutdownTimer();
  const eventName = `match:${matchId}`;
  const nextCount =
    Number(state.matchSubscribers.get(String(matchId)) || 0) + 1;
  state.matchSubscribers.set(String(matchId), nextCount);
  emitter.on(eventName, callback);
  return () => {
    emitter.off(eventName, callback);
    const currentCount = Number(state.matchSubscribers.get(String(matchId)) || 0);
    if (currentCount <= 1) {
      state.matchSubscribers.delete(String(matchId));
      scheduleIdleShutdown();
      return;
    }
    state.matchSubscribers.set(String(matchId), currentCount - 1);
    scheduleIdleShutdown();
  };
}

export function subscribeToSession(sessionId, callback) {
  clearIdleShutdownTimer();
  const eventName = `session:${sessionId}`;
  const nextCount =
    Number(state.sessionSubscribers.get(String(sessionId)) || 0) + 1;
  state.sessionSubscribers.set(String(sessionId), nextCount);
  emitter.on(eventName, callback);
  return () => {
    emitter.off(eventName, callback);
    const currentCount = Number(state.sessionSubscribers.get(String(sessionId)) || 0);
    if (currentCount <= 1) {
      state.sessionSubscribers.delete(String(sessionId));
      scheduleIdleShutdown();
      return;
    }
    state.sessionSubscribers.set(String(sessionId), currentCount - 1);
    scheduleIdleShutdown();
  };
}

export function getMatchSubscriberCount(matchId) {
  return Number(state.matchSubscribers.get(String(matchId)) || 0);
}

export function getSessionSubscriberCount(sessionId) {
  return Number(state.sessionSubscribers.get(String(sessionId)) || 0);
}
