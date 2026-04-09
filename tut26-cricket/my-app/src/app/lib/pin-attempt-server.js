/**
 * File overview:
 * Purpose: Provides shared Pin Attempt Server logic for routes, APIs, and feature code.
 * Main exports: enforceSmartPinRateLimit.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

import {
  PIN_BURST_BLOCK_MS,
  PIN_BURST_TRIGGER_ATTEMPTS,
  PIN_BURST_WINDOW_MS,
} from "./pin-attempt-policy";
import { enforceRateLimit } from "./rate-limit";

export function enforceSmartPinRateLimit({
  key,
  longLimit,
  longWindowMs,
  longBlockMs,
  now = Date.now(),
}) {
  const burstLimit = enforceRateLimit({
    key: `${String(key || "")}:burst`,
    limit: Math.max(1, PIN_BURST_TRIGGER_ATTEMPTS - 1),
    windowMs: PIN_BURST_WINDOW_MS,
    blockMs: PIN_BURST_BLOCK_MS,
    now,
  });

  if (!burstLimit.allowed) {
    return burstLimit;
  }

  return enforceRateLimit({
    key: `${String(key || "")}:steady`,
    limit: longLimit,
    windowMs: longWindowMs,
    blockMs: longBlockMs,
    now,
  });
}


