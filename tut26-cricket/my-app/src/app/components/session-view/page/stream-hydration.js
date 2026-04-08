/**
 * File overview:
 * Purpose: Stream-hydration helpers for spectator session payload updates.
 * Main exports: applySessionStreamPayload.
 * Major callers: SessionViewScreen.
 * Side effects: updates React state through provided setters.
 * Read next: README.md
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
