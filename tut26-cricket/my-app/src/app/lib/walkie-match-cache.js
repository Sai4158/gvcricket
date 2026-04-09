/**
 * File overview:
 * Purpose: Provides shared Walkie Match Cache logic for routes, APIs, and feature code.
 * Main exports: clearCachedWalkieMatch.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { connectDB } from "./db";
import Match from "../../models/Match";

const WALKIE_MATCH_CACHE_TTL_MS = 2500;

function getCacheStore() {
  if (!globalThis.__gvWalkieMatchCache) {
    globalThis.__gvWalkieMatchCache = new Map();
  }

  return globalThis.__gvWalkieMatchCache;
}

export async function getCachedWalkieMatch(matchId) {
  const normalizedMatchId = String(matchId || "").trim();
  if (!normalizedMatchId) {
    return null;
  }

  const cache = getCacheStore();
  const now = Date.now();
  const cachedEntry = cache.get(normalizedMatchId);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.value;
  }

  await connectDB();
  const match = await Match.findById(normalizedMatchId)
    .select("_id isOngoing result adminAccessVersion")
    .lean();

  cache.set(normalizedMatchId, {
    expiresAt: now + WALKIE_MATCH_CACHE_TTL_MS,
    value: match || null,
  });

  return match || null;
}

export function clearCachedWalkieMatch(matchId) {
  const normalizedMatchId = String(matchId || "").trim();
  if (!normalizedMatchId) {
    return;
  }

  getCacheStore().delete(normalizedMatchId);
}


