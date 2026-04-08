/**
 * File overview:
 * Purpose: Shared helper module for Session Draft logic.
 * Main exports: createDraftToken, createDraftTokenHash, hasValidDraftToken.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: README.md
 */
import crypto from "crypto";

function hashDraftToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function createDraftToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function createDraftTokenHash(token) {
  return hashDraftToken(token);
}

export function hasValidDraftToken(session, token) {
  const storedHash = String(session?.draftTokenHash || "");
  if (!storedHash || !token) {
    return false;
  }

  const suppliedHash = hashDraftToken(token);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(storedHash, "hex"),
      Buffer.from(suppliedHash, "hex")
    );
  } catch {
    return false;
  }
}
