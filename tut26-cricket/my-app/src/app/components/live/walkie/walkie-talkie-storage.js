/**
 * File overview:
 * Purpose: Session-storage helpers used by the walkie hook for participant and token persistence.
 * Main exports: storageParticipantId and token/session persistence helpers.
 * Major callers: useWalkieTalkie.
 * Side effects: reads and writes sessionStorage when available.
 * Read next: ./walkie-talkie-state.js
 */

const participantIdCache = new Map();
const walkieSessionCache = new Map();

export function storageParticipantId(matchId, role, logger = null) {
  if (typeof window === "undefined" || !matchId) return "";
  const key = `gv-walkie:${matchId}:${role}:participant`;
  const existing = (() => {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      logger?.("warn", "Session storage unavailable", {
        stage: "participant-id-read",
        message: error?.message || "Session storage unavailable.",
      });
      return participantIdCache.get(key) || "";
    }
  })();
  if (existing) return existing;
  const next = (crypto?.randomUUID?.() || `walkie${Math.random().toString(36).slice(2, 18)}`)
    .replace(/-/g, "")
    .slice(0, 24);
  try {
    window.sessionStorage.setItem(key, next);
  } catch (error) {
    logger?.("warn", "Session storage unavailable", {
      stage: "participant-id-write",
      message: error?.message || "Session storage unavailable.",
    });
    participantIdCache.set(key, next);
  }
  return next;
}

export function readSessionValue(key) {
  if (typeof window === "undefined" || !key) return "";
  try {
    return window.sessionStorage.getItem(key) || "";
  } catch {
    return walkieSessionCache.get(key) || "";
  }
}

export function writeSessionValue(key, value) {
  if (typeof window === "undefined" || !key) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    walkieSessionCache.set(key, value);
  }
}

export function removeSessionValue(key) {
  if (typeof window === "undefined" || !key) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    walkieSessionCache.delete(key);
  }
}

export function walkieTokenStorageKey(kind, matchId, role, participantId) {
  if (!kind || !matchId || !role || !participantId) return "";
  return `gv-walkie:${matchId}:${role}:${participantId}:${kind}-token`;
}

export function readStoredWalkieToken(kind, matchId, role, participantId, parseJson) {
  const key = walkieTokenStorageKey(kind, matchId, role, participantId);
  const payload = parseJson(readSessionValue(key));
  if (!payload || typeof payload !== "object") {
    if (key) removeSessionValue(key);
    return null;
  }
  return payload;
}

export function writeStoredWalkieToken(kind, matchId, role, participantId, payload) {
  const key = walkieTokenStorageKey(kind, matchId, role, participantId);
  if (!key || !payload) return;
  writeSessionValue(key, JSON.stringify(payload));
}

export function clearStoredWalkieToken(kind, matchId, role, participantId) {
  const key = walkieTokenStorageKey(kind, matchId, role, participantId);
  if (!key) return;
  removeSessionValue(key);
}
