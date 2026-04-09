/**
 * File overview:
 * Purpose: Renders Session View UI for the app's screens and flows.
 * Main exports: applySessionStreamPayload.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

export function applySessionStreamPayload({
  payload,
  lastSignatureRef,
  setData,
  setStreamError,
  getSignature,
}) {
  const nextPayloadSignature = getSignature(payload);
  if (nextPayloadSignature === lastSignatureRef.current) {
    return false;
  }

  lastSignatureRef.current = nextPayloadSignature;
  setData(payload);
  setStreamError("");
  return true;
}


