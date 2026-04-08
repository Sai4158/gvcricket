"use client";


/**
 * File overview:
 * Purpose: React hook for Match behavior and browser state.
 * Main exports: useMatchAccess.
 * Major callers: Feature routes and sibling components.
 * Side effects: reads or writes browser storage.
 * Read next: README.md
 */
import { useEffect, useState } from "react";
import {
  buildPinRateLimitMessage,
  buildPinRequestError,
  clearClientPinRateLimit,
  getClientPinRateLimitState,
} from "../../lib/pin-attempt-client";

const MATCH_AUTH_CACHE_TTL_MS = 30 * 1000;
let matchAuthStatusMemoryCache = new Map();

function getRememberKey(matchId) {
  return `gv-match-access-remember-${matchId}`;
}

function getAuthCacheKey(matchId) {
  return `gv-match-access-status-${matchId}`;
}

function readRememberedGrant(matchId) {
  if (typeof window === "undefined" || !matchId) {
    return false;
  }

  try {
    return window.localStorage.getItem(getRememberKey(matchId)) === "granted";
  } catch {
    return false;
  }
}

function writeRememberedGrant(matchId) {
  if (typeof window === "undefined" || !matchId) {
    return;
  }

  try {
    window.localStorage.setItem(getRememberKey(matchId), "granted");
  } catch {
    // Ignore local storage failures and rely on other caches.
  }
}

function clearRememberedGrant(matchId) {
  if (typeof window === "undefined" || !matchId) {
    return;
  }

  try {
    window.localStorage.removeItem(getRememberKey(matchId));
  } catch {
    // Ignore local storage failures and rely on other caches.
  }
}

function readCachedAuthStatus(matchId) {
  if (!matchId) return null;

  const memoryValue = matchAuthStatusMemoryCache.get(matchId);
  if (
    memoryValue &&
    Date.now() - memoryValue.timestamp <= MATCH_AUTH_CACHE_TTL_MS
  ) {
    return memoryValue.status;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(getAuthCacheKey(matchId));
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue);
    if (
      !parsed ||
      typeof parsed.status !== "string" ||
      typeof parsed.timestamp !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.timestamp > MATCH_AUTH_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(getAuthCacheKey(matchId));
      return null;
    }
    matchAuthStatusMemoryCache.set(matchId, parsed);
    return parsed.status;
  } catch {
    return null;
  }
}

function writeCachedAuthStatus(matchId, status) {
  if (!matchId) return;

  const payload = {
    status,
    timestamp: Date.now(),
  };

  matchAuthStatusMemoryCache.set(matchId, payload);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(getAuthCacheKey(matchId), JSON.stringify(payload));
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

function clearCachedAuthStatus(matchId) {
  if (!matchId) return;

  matchAuthStatusMemoryCache.delete(matchId);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(getAuthCacheKey(matchId));
  } catch {
    // Ignore storage failures.
  }
}

export default function useMatchAccess(matchId, initialAuthStatus = "checking") {
  const [authStatus, setAuthStatus] = useState(initialAuthStatus);
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !matchId) {
      return;
    }

    if (authStatus === "granted") {
      writeRememberedGrant(matchId);
      writeCachedAuthStatus(matchId, "granted");
      return;
    }

    if (authStatus === "locked") {
      clearRememberedGrant(matchId);
      clearCachedAuthStatus(matchId);
    }
  }, [authStatus, matchId]);

  useEffect(() => {
    if (!matchId) return;

    if (initialAuthStatus === "granted") {
      setAuthStatus("granted");
      writeCachedAuthStatus(matchId, "granted");
      return;
    }

    if (initialAuthStatus === "locked") {
      setAuthStatus("locked");
      clearCachedAuthStatus(matchId);
      return;
    }

    const remembered = readRememberedGrant(matchId);
    const cachedStatus = remembered ? readCachedAuthStatus(matchId) : null;

    if (cachedStatus === "granted") {
      setAuthStatus("granted");
      return;
    }

    const shouldCheck = initialAuthStatus === "checking";

    if (!shouldCheck) return;

    const controller = new AbortController();

    fetch(`/api/matches/${matchId}/auth`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        if (data.authorized) {
          writeRememberedGrant(matchId);
          writeCachedAuthStatus(matchId, "granted");
          setAuthStatus("granted");
          return;
        }

        clearRememberedGrant(matchId);
        clearCachedAuthStatus(matchId);
        setAuthStatus("locked");
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }
        setAuthStatus("locked");
      });

    return () => controller.abort();
  }, [initialAuthStatus, matchId]);

  const submitPin = async (pin) => {
    const rateLimitScope = matchId ? `match-auth:${matchId}` : "match-auth";
    const pinRateLimit = getClientPinRateLimitState(rateLimitScope);
    if (pinRateLimit.isBlocked) {
      setAuthError(buildPinRateLimitMessage(pinRateLimit.retryAfterMs));
      return;
    }

    setAuthSubmitting(true);
    setAuthError("");

    try {
      const response = await fetch(`/api/matches/${matchId}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Incorrect PIN." }));
        throw buildPinRequestError(response, body, "Incorrect PIN.");
      }

      if (typeof window !== "undefined" && matchId) {
        writeRememberedGrant(matchId);
      }
      clearClientPinRateLimit(rateLimitScope);
      writeCachedAuthStatus(matchId, "granted");
      setAuthStatus("granted");
    } catch (caughtError) {
      if (typeof window !== "undefined" && matchId) {
        clearRememberedGrant(matchId);
      }
      clearCachedAuthStatus(matchId);
      setAuthError(caughtError?.message || "Incorrect PIN.");
      throw caughtError;
    } finally {
      setAuthSubmitting(false);
    }
  };

  return {
    authStatus,
    authError,
    authSubmitting,
    submitPin,
  };
}
