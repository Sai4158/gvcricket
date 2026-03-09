import crypto from "node:crypto";

const COOKIE_PREFIX = "gv_match_access_";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 30;

function getConfiguredPinValue() {
  return (
    process.env.UMPIRE_ADMIN_PIN ||
    process.env.MATCH_MEDIA_PIN ||
    process.env.UMPIRE_PIN ||
    ""
  );
}

function getAccessSecret() {
  return (
    process.env.MATCH_ACCESS_SECRET ||
    process.env.UMPIRE_ADMIN_PIN ||
    process.env.MATCH_MEDIA_PIN ||
    process.env.UMPIRE_PIN ||
    process.env.MONGODB_URI ||
    "gv-cricket-local-secret"
  );
}

export function getConfiguredUmpirePin() {
  return getConfiguredPinValue();
}

export function isValidUmpirePin(pin) {
  const configuredPin = getConfiguredUmpirePin();
  if (!configuredPin) return false;

  const providedPin = String(pin || "").trim();
  const providedBuffer = Buffer.from(providedPin);
  const configuredBuffer = Buffer.from(configuredPin);

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, configuredBuffer);
}

export function getMatchAccessCookieName(matchId) {
  return `${COOKIE_PREFIX}${matchId}`;
}

export function createMatchAccessToken(matchId) {
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const payload = `${matchId}:${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", getAccessSecret())
    .update(payload)
    .digest("hex");

  return `${expiresAt}.${signature}`;
}

function parseMatchAccessToken(token) {
  const [expiresAtRaw, signature] = String(token || "").split(".");
  const expiresAt = Number(expiresAtRaw);

  if (!Number.isInteger(expiresAt) || !signature) {
    return null;
  }

  return { expiresAt, signature };
}

function createExpectedSignature(matchId, expiresAt) {
  return crypto
    .createHmac("sha256", getAccessSecret())
    .update(`${matchId}:${expiresAt}`)
    .digest("hex");
}

export function hasValidMatchAccess(matchId, token) {
  if (!token) return false;

  const parsed = parseMatchAccessToken(token);
  if (!parsed || parsed.expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = createExpectedSignature(matchId, parsed.expiresAt);
  const tokenBuffer = Buffer.from(String(parsed.signature));
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
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    },
  };
}
