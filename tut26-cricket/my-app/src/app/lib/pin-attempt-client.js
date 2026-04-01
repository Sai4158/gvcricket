"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PIN_BURST_BLOCK_MS,
  PIN_BURST_TRIGGER_ATTEMPTS,
  PIN_BURST_WINDOW_MS,
} from "./pin-attempt-policy";

const PIN_GUARD_STORAGE_PREFIX = "gv-pin-guard:";
const EMPTY_STATE = {
  attempts: [],
  blockedUntil: 0,
};

const pinGuardMemoryStore = globalThis.__gvPinGuardMemoryStore || new Map();

if (!globalThis.__gvPinGuardMemoryStore) {
  globalThis.__gvPinGuardMemoryStore = pinGuardMemoryStore;
}

function normalizeScope(scope) {
  const normalizedScope = String(scope || "").trim();
  return normalizedScope || "global-pin";
}

function getScopeStorageKey(scope) {
  return `${PIN_GUARD_STORAGE_PREFIX}${normalizeScope(scope)}`;
}

function normalizeStoredState(value, now = Date.now()) {
  const attempts = Array.isArray(value?.attempts)
    ? value.attempts
        .map((attemptAt) => Number(attemptAt))
        .filter(
          (attemptAt) =>
            Number.isFinite(attemptAt) && now - attemptAt < PIN_BURST_WINDOW_MS,
        )
    : [];
  const blockedUntil = Math.max(0, Number(value?.blockedUntil || 0));

  return {
    attempts,
    blockedUntil: blockedUntil > now ? blockedUntil : 0,
  };
}

function readStoredState(scope, now = Date.now()) {
  const normalizedScope = normalizeScope(scope);
  const memoryValue = pinGuardMemoryStore.get(normalizedScope);
  if (memoryValue) {
    const normalizedValue = normalizeStoredState(memoryValue, now);
    pinGuardMemoryStore.set(normalizedScope, normalizedValue);
    return normalizedValue;
  }

  if (typeof window === "undefined") {
    return EMPTY_STATE;
  }

  try {
    const rawValue = window.sessionStorage.getItem(getScopeStorageKey(normalizedScope));
    if (!rawValue) {
      return EMPTY_STATE;
    }

    const parsedValue = JSON.parse(rawValue);
    const normalizedValue = normalizeStoredState(parsedValue, now);
    pinGuardMemoryStore.set(normalizedScope, normalizedValue);
    return normalizedValue;
  } catch {
    return EMPTY_STATE;
  }
}

function writeStoredState(scope, nextValue) {
  const normalizedScope = normalizeScope(scope);
  const normalizedValue = normalizeStoredState(nextValue);
  const hasStoredState =
    normalizedValue.attempts.length > 0 || normalizedValue.blockedUntil > 0;

  if (hasStoredState) {
    pinGuardMemoryStore.set(normalizedScope, normalizedValue);
  } else {
    pinGuardMemoryStore.delete(normalizedScope);
  }

  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!hasStoredState) {
      window.sessionStorage.removeItem(getScopeStorageKey(normalizedScope));
      return;
    }

    window.sessionStorage.setItem(
      getScopeStorageKey(normalizedScope),
      JSON.stringify(normalizedValue),
    );
  } catch {
    // Ignore storage failures and rely on in-memory state.
  }
}

export function buildPinRateLimitMessage(retryAfterMs = 0) {
  const remainingSeconds = Math.max(1, Math.ceil(Number(retryAfterMs || 0) / 1000));
  return retryAfterMs > 0
    ? `Too many PIN attempts. Try again in ${remainingSeconds}s.`
    : "Too many PIN attempts. Try again shortly.";
}

export function getClientPinRateLimitState(scope, now = Date.now()) {
  const normalizedValue = normalizeStoredState(readStoredState(scope, now), now);
  writeStoredState(scope, normalizedValue);

  return {
    isBlocked: normalizedValue.blockedUntil > now,
    retryAfterMs: Math.max(0, normalizedValue.blockedUntil - now),
    blockedUntil: normalizedValue.blockedUntil,
    attemptCount: normalizedValue.attempts.length,
  };
}

export function clearClientPinRateLimit(scope) {
  writeStoredState(scope, EMPTY_STATE);
}

export function registerClientPinFailure(
  scope,
  { retryAfterMs = 0, now = Date.now() } = {},
) {
  const normalizedValue = normalizeStoredState(readStoredState(scope, now), now);
  const nextAttempts = [...normalizedValue.attempts, now].filter(
    (attemptAt) => now - attemptAt < PIN_BURST_WINDOW_MS,
  );

  const nextBlockedUntil = Math.max(
    normalizedValue.blockedUntil,
    nextAttempts.length >= PIN_BURST_TRIGGER_ATTEMPTS
      ? now + PIN_BURST_BLOCK_MS
      : 0,
    retryAfterMs > 0 ? now + retryAfterMs : 0,
  );

  writeStoredState(scope, {
    attempts: nextAttempts,
    blockedUntil: nextBlockedUntil,
  });

  return getClientPinRateLimitState(scope, now);
}

export function getPinRequestRetryAfterMs(response, payload) {
  const retryAfterSecondsFromBody = Number(payload?.retryAfterSeconds || 0);
  if (retryAfterSecondsFromBody > 0) {
    return retryAfterSecondsFromBody * 1000;
  }

  const retryAfterHeader = Number(response?.headers?.get?.("Retry-After") || 0);
  if (retryAfterHeader > 0) {
    return retryAfterHeader * 1000;
  }

  return 0;
}

export function buildPinRequestError(
  response,
  payload,
  fallbackMessage = "Incorrect PIN.",
) {
  const retryAfterMs = getPinRequestRetryAfterMs(response, payload);
  const nextMessage =
    response?.status === 429
      ? buildPinRateLimitMessage(retryAfterMs)
      : payload?.message || fallbackMessage;
  const error = new Error(nextMessage);

  error.retryAfterMs = retryAfterMs;
  error.status = Number(response?.status || 0);

  return error;
}

export function useClientPinRateLimit(scope, enabled = true) {
  const readState = useCallback(() => {
    if (!enabled) {
      return {
        isBlocked: false,
        retryAfterMs: 0,
        blockedUntil: 0,
        attemptCount: 0,
      };
    }

    return getClientPinRateLimitState(scope);
  }, [enabled, scope]);

  const [, setRevision] = useState(0);
  const state = readState();

  const sync = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !state.isBlocked) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setRevision((value) => value + 1);
    }, 500);

    return () => window.clearInterval(timer);
  }, [enabled, state.isBlocked]);

  return {
    ...state,
    message: state.isBlocked ? buildPinRateLimitMessage(state.retryAfterMs) : "",
    sync,
  };
}
