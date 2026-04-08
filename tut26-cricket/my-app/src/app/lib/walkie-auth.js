/**
 * File overview:
 * Purpose: Shared helper module for Walkie Auth logic.
 * Main exports: createWalkieParticipantToken, hasValidWalkieParticipantToken.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: README.md
 */
import crypto from "node:crypto";

const WALKIE_TOKEN_TTL_SECONDS = 60 * 60 * 2;

function getWalkieSecret() {
  return (
    process.env.MATCH_ACCESS_SECRET ||
    process.env.UMPIRE_ADMIN_PIN ||
    process.env.MONGODB_URI ||
    "gv-cricket-walkie-secret"
  );
}

function signValue(value) {
  return crypto
    .createHmac("sha256", getWalkieSecret())
    .update(value)
    .digest("base64url");
}

export function createWalkieParticipantToken(matchId, participantId, role) {
  const payload = Buffer.from(
    JSON.stringify({
      matchId: String(matchId),
      participantId: String(participantId),
      role: String(role),
      exp: Math.floor(Date.now() / 1000) + WALKIE_TOKEN_TTL_SECONDS,
    })
  ).toString("base64url");

  return `${payload}.${signValue(payload)}`;
}

export function hasValidWalkieParticipantToken(
  token,
  matchId,
  participantId,
  role
) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) {
    return false;
  }

  const expected = signValue(payload);
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length) {
    return false;
  }
  if (!crypto.timingSafeEqual(givenBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (
      decoded.matchId === String(matchId) &&
      decoded.participantId === String(participantId) &&
      decoded.role === String(role) &&
      Number(decoded.exp) > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
