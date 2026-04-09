/**
 * File overview:
 * Purpose: Provides shared Match Start logic for routes, APIs, and feature code.
 * Main exports: isValidMatchId, getStartedMatchFromPayload, getStartedMatchId.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

export function isValidMatchId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || ""));
}

export function getStartedMatchFromPayload(payload) {
  if (payload?.match && typeof payload.match === "object") {
    return payload.match;
  }

  if (payload && typeof payload === "object" && payload._id) {
    return payload;
  }

  return null;
}

export function getStartedMatchId(payload) {
  const match = getStartedMatchFromPayload(payload);
  const id = match?._id;

  return isValidMatchId(id) ? String(id) : "";
}


