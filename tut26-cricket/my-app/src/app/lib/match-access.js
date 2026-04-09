/**
 * File overview:
 * Purpose: Provides shared Match Access logic for routes, APIs, and feature code.
 * Main exports: getConfiguredUmpirePin, getConfiguredManagePin, isValidUmpirePin, isValidManagePin, getMatchAccessCookieName, createMatchAccessToken, hasValidMatchAccess, getMatchAccessCookie, getClearedMatchAccessCookie.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

import crypto from "node:crypto";

const COOKIE_PREFIX = "gv_match_access_";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const ADMIN_ROLE = "admin";

function getConfiguredPinValue() {
  return (
    process.env.UMPIRE_ADMIN_PIN ||
    process.env.MATCH_MEDIA_PIN ||
    process.env.UMPIRE_PIN ||
    ""
  );
}

function getConfiguredManagePinValue() {
  return (
    process.env.SESSION_MANAGE_PIN ||
    process.env.MATCH_MEDIA_PIN ||
    process.env.UMPIRE_PIN ||
    ""
  );
}

function getConfiguredManagePinHashValue() {
  return process.env.SESSION_MANAGE_PIN_HASH || "";
}

function getConfiguredPinHashValue() {
  return (
    process.env.UMPIRE_ADMIN_PIN_HASH ||
    process.env.MATCH_MEDIA_PIN_HASH ||
    ""
  );
}

function getAccessSecret() {
  return (
    process.env.MATCH_ACCESS_SECRET ||
    process.env.UMPIRE_ADMIN_PIN_HASH ||
    process.env.UMPIRE_ADMIN_PIN ||
    process.env.MATCH_MEDIA_PIN_HASH ||
    process.env.MATCH_MEDIA_PIN ||
    process.env.UMPIRE_PIN ||
    "gv-cricket-local-secret"
  );
}

function getManageSecret() {
  return (
    process.env.SESSION_MANAGE_ACCESS_SECRET ||
    process.env.SESSION_MANAGE_PIN ||
    process.env.MATCH_ACCESS_SECRET ||
    getAccessSecret()
  );
}

function hashPin(pin) {
  return crypto.scryptSync(String(pin || ""), getAccessSecret(), 64);
}

function hashManagePin(pin) {
  return crypto.scryptSync(String(pin || "").trim(), getManageSecret(), 64);
}

export function getConfiguredUmpirePin() {
  return getConfiguredPinValue();
}

export function getConfiguredManagePin() {
  return getConfiguredManagePinValue();
}

export function isValidUmpirePin(pin) {
  const configuredHash = getConfiguredPinHashValue();

  if (configuredHash) {
    const incomingHash = hashPin(pin);
    const expectedBuffer = Buffer.from(configuredHash, "hex");
    if (incomingHash.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(incomingHash, expectedBuffer);
  }

  const configuredPin = getConfiguredUmpirePin();
  if (!configuredPin) return false;

  const incomingHash = hashPin(pin);
  const expectedHash = hashPin(configuredPin);
  return crypto.timingSafeEqual(incomingHash, expectedHash);
}

export function isValidManagePin(pin) {
  const configuredHash = getConfiguredManagePinHashValue();

  if (configuredHash) {
    const incomingHash = hashManagePin(pin);
    const expectedBuffer = Buffer.from(configuredHash, "hex");
    if (incomingHash.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(incomingHash, expectedBuffer);
  }

  const configuredPin = getConfiguredManagePin();
  if (!configuredPin) return false;

  const incomingHash = hashManagePin(pin);
  const expectedHash = hashManagePin(configuredPin);
  return crypto.timingSafeEqual(incomingHash, expectedHash);
}

export function getMatchAccessCookieName(matchId) {
  return `${COOKIE_PREFIX}${matchId}`;
}

function signTokenPayload(payload) {
  return crypto
    .createHmac("sha256", getAccessSecret())
    .update(payload)
    .digest("base64url");
}

export function createMatchAccessToken(matchId, accessVersion = 1) {
  const payload = JSON.stringify({
    matchId: String(matchId),
    role: ADMIN_ROLE,
    version: accessVersion,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseMatchAccessToken(token) {
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

export function hasValidMatchAccess(matchId, token, accessVersion = 1) {
  const parsed = parseMatchAccessToken(token);
  if (!parsed) return false;

  return (
    parsed.role === ADMIN_ROLE &&
    parsed.matchId === String(matchId) &&
    Number(parsed.version) === Number(accessVersion) &&
    Number(parsed.exp) > Math.floor(Date.now() / 1000)
  );
}

export function getMatchAccessCookie(matchId, accessVersion = 1) {
  return {
    name: getMatchAccessCookieName(matchId),
    value: createMatchAccessToken(matchId, accessVersion),
    options: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    },
  };
}

export function getClearedMatchAccessCookie(matchId) {
  return {
    name: getMatchAccessCookieName(matchId),
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


