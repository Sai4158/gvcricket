/**
 * File overview:
 * Purpose: Provides shared Api Response logic for routes, APIs, and feature code.
 * Main exports: jsonError, jsonRateLimit.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { NextResponse } from "next/server";

export function jsonError(message, status, extras = {}) {
  return NextResponse.json({ message, ...extras }, { status });
}

export function jsonRateLimit(message, retryAfterMs) {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return NextResponse.json(
    { message, retryAfterSeconds: seconds },
    {
      status: 429,
      headers: {
        "Retry-After": String(seconds),
      },
    }
  );
}


