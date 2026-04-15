"use client";

/**
 * File overview:
 * Purpose: Provides shared Image Pin Client logic for routes, APIs, and feature code.
 * Main exports: module side effects only.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { getImagePinCheckPayload } from "./image-pin-policy";
import {
  buildPinRequestError,
} from "./pin-attempt-client";

export async function verifyImageActionPin({
  pin = "",
  usesManagePin = false,
}) {
  const response = await fetch("/api/media/pin-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      getImagePinCheckPayload({
        pin,
        usesManagePin,
      })
    ),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw buildPinRequestError(response, payload, "Incorrect PIN.");
  }

  return true;
}


