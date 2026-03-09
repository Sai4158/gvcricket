import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import { connectDB } from "./db";
import Match from "../../models/Match";
import Session from "../../models/Session";

const emitter = globalThis.__gvLiveEmitter || new EventEmitter();
globalThis.__gvLiveEmitter = emitter;
emitter.setMaxListeners(500);

const state = globalThis.__gvLiveState || {
  initialized: false,
  initializing: null,
  matchWatcher: null,
  sessionWatcher: null,
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
  const eventName = `match:${matchId}`;
  emitter.on(eventName, callback);
  return () => emitter.off(eventName, callback);
}

export function subscribeToSession(sessionId, callback) {
  const eventName = `session:${sessionId}`;
  emitter.on(eventName, callback);
  return () => emitter.off(eventName, callback);
}
