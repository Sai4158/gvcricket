import crypto from "node:crypto";

const COOKIE_PREFIX = "gv_match_access_";

function getAccessSecret() {
  return (
    process.env.MATCH_ACCESS_SECRET ||
    process.env.UMPIRE_PIN ||
    process.env.MONGODB_URI ||
    "gv-cricket-local-secret"
  );
}

export function getConfiguredUmpirePin() {
  return process.env.UMPIRE_PIN || "0000";
}

export function isValidUmpirePin(pin) {
  return String(pin || "").trim() === getConfiguredUmpirePin();
}

export function getMatchAccessCookieName(matchId) {
  return `${COOKIE_PREFIX}${matchId}`;
}

export function createMatchAccessToken(matchId) {
  return crypto
    .createHmac("sha256", getAccessSecret())
    .update(String(matchId))
    .digest("hex");
}

export function hasValidMatchAccess(matchId, token) {
  if (!token) return false;

  const expected = createMatchAccessToken(matchId);
  const tokenBuffer = Buffer.from(String(token));
  const expectedBuffer = Buffer.from(expected);

  if (tokenBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

export function getMatchAccessCookie(matchId) {
  return {
    name: getMatchAccessCookieName(matchId),
    value: createMatchAccessToken(matchId),
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  };
}
