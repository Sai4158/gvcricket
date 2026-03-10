import crypto from "node:crypto";

const DIRECTOR_COOKIE = "gv_director_access";
const DIRECTOR_TOKEN_TTL_SECONDS = 60 * 60 * 12;

function getConfiguredDirectorPin() {
  return (
    process.env.DIRECTOR_CONSOLE_PIN ||
    process.env.UMPIRE_ADMIN_PIN ||
    process.env.MATCH_MEDIA_PIN ||
    ""
  );
}

function getConfiguredDirectorPinHash() {
  return process.env.DIRECTOR_CONSOLE_PIN_HASH || "";
}

function getDirectorSecret() {
  return (
    process.env.DIRECTOR_ACCESS_SECRET ||
    process.env.MATCH_ACCESS_SECRET ||
    process.env.DIRECTOR_CONSOLE_PIN_HASH ||
    process.env.DIRECTOR_CONSOLE_PIN ||
    process.env.UMPIRE_ADMIN_PIN_HASH ||
    process.env.UMPIRE_ADMIN_PIN ||
    process.env.MONGODB_URI ||
    "gv-cricket-director-secret"
  );
}

function hashPin(pin) {
  return crypto.scryptSync(String(pin || "").trim(), getDirectorSecret(), 64);
}

function signTokenPayload(payload) {
  return crypto
    .createHmac("sha256", getDirectorSecret())
    .update(payload)
    .digest("base64url");
}

export function isValidDirectorPin(pin) {
  const configuredHash = getConfiguredDirectorPinHash();

  if (configuredHash) {
    const incomingHash = hashPin(pin);
    const expectedBuffer = Buffer.from(configuredHash, "hex");
    if (incomingHash.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(incomingHash, expectedBuffer);
  }

  const configuredPin = getConfiguredDirectorPin();
  if (!configuredPin) return false;

  const incomingHash = hashPin(pin);
  const expectedHash = hashPin(configuredPin);
  return crypto.timingSafeEqual(incomingHash, expectedHash);
}

export function getDirectorAccessCookieName() {
  return DIRECTOR_COOKIE;
}

export function createDirectorAccessToken() {
  const payload = JSON.stringify({
    role: "director",
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + DIRECTOR_TOKEN_TTL_SECONDS,
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseDirectorAccessToken(token) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signTokenPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function hasValidDirectorAccess(token) {
  const parsed = parseDirectorAccessToken(token);
  if (!parsed) {
    return false;
  }

  return (
    parsed.role === "director" &&
    Number(parsed.exp) > Math.floor(Date.now() / 1000)
  );
}

export function getDirectorAccessCookie() {
  return {
    name: getDirectorAccessCookieName(),
    value: createDirectorAccessToken(),
    options: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DIRECTOR_TOKEN_TTL_SECONDS,
    },
  };
}

export function getClearedDirectorAccessCookie() {
  return {
    name: getDirectorAccessCookieName(),
    value: "",
    options: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    },
  };
}
