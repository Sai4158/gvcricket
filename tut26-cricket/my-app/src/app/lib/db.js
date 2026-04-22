/**
 * File overview:
 * Purpose: Provides shared Db logic for routes, APIs, and feature code.
 * Main exports: module side effects only.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: ./README.md
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined.");
}

mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const DEFAULT_MAX_POOL_SIZE = 12;
const DEFAULT_MAX_IDLE_MS = 20_000;
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 5_000;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || DEFAULT_MAX_POOL_SIZE),
      minPoolSize: 0,
      maxIdleTimeMS: Number(
        process.env.MONGODB_MAX_IDLE_TIME_MS || DEFAULT_MAX_IDLE_MS
      ),
      serverSelectionTimeoutMS: Number(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ||
          DEFAULT_SERVER_SELECTION_TIMEOUT_MS
      ),
      socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45_000),
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
}


