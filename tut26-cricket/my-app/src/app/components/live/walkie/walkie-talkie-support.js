/**
 * File overview:
 * Purpose: Renders Live UI for the app's screens and flows.
 * Main exports: readPageVisibility, safariBrowser, parseJson, messageFor, isWalkieNetworkError, isRtmPublishDisconnectedError, walkieMessageFor, parseWalkieCooldownSeconds, isExpectedWalkieTransportError, classifyWalkieSignalingSetupError, isRtcUidConflictError, walkieConsole, shouldRetryWalkieStartError, clearTimer, playWalkieCue.
 * Major callers: Feature routes and sibling components.
 * Side effects: performs network requests.
 * Read next: ./README.md
 */

import { playUiTone } from "../../../lib/page-audio";

export function readPageVisibility() {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState !== "hidden";
}

export function safariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/i.test(ua);
}

export function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function messageFor(error, fallback) {
  return error?.message || fallback;
}

export function isWalkieNetworkError(error) {
  if (!error) {
    return false;
  }

  const name = String(error?.name || "");
  const message = String(error?.message || "");
  return (
    name === "TypeError" &&
    (
      /Failed to fetch/i.test(message) ||
      /NetworkError/i.test(message) ||
      /Load failed/i.test(message)
    )
  );
}

export function isRtmPublishDisconnectedError(error) {
  const rawCode = String(error?.code || "");
  const rawName = String(error?.name || "");
  const rawMessage = String(error?.message || "");
  const haystack = `${rawCode} ${rawName} ${rawMessage}`.toUpperCase();

  return (
    haystack.includes("-10025") ||
    haystack.includes("RTM SERVICE IS NOT CONNECTED") ||
    haystack.includes("NOT CONNECTED") ||
    haystack.includes("CONNECTION CLOSED") ||
    haystack.includes("CONNECTION LOST") ||
    haystack.includes("DISCONNECTED")
  );
}

function isAgoraConfigurationError(error) {
  const rawCode = String(error?.code || "");
  const rawName = String(error?.name || "");
  const rawMessage = String(error?.message || "");
  const haystack = `${rawCode} ${rawName} ${rawMessage}`.toUpperCase();

  return (
    haystack.includes("INVALID APP ID") ||
    haystack.includes("APP_ID_NO_ACTIVATED") ||
    haystack.includes("THE VENDOR IS NOT ACTIVATED") ||
    haystack.includes("AGORA CREDENTIALS ARE INVALID") ||
    haystack.includes("AGORA CREDENTIALS ARE NOT CONFIGURED") ||
    haystack.includes("WALKIE-TALKIE SIGNALING IS NOT CONFIGURED ON THE SERVER") ||
    haystack.includes("WALKIE-TALKIE AUDIO IS NOT CONFIGURED ON THE SERVER")
  );
}

export function walkieMessageFor(error, fallback) {
  if (isWalkieNetworkError(error)) {
    return "Could not reach live walkie. Check the connection and try again.";
  }
  if (isAgoraConfigurationError(error)) {
    return "Walkie-talkie is not configured correctly on the server.";
  }
  if (isRtmPublishDisconnectedError(error)) {
    return "Walkie is reconnecting. Try again.";
  }
  return messageFor(error, fallback);
}

export function parseWalkieCooldownSeconds(message) {
  const match = String(message || "").match(/please wait (\d+) seconds/i);
  if (!match) {
    return 0;
  }
  return Math.max(0, Number.parseInt(match[1], 10) || 0);
}

export function isExpectedWalkieTransportError(error) {
  const rawCode = String(error?.code || "");
  const rawName = String(error?.name || "");
  const rawMessage = String(error?.message || "");
  const haystack = `${rawCode} ${rawName} ${rawMessage}`.toUpperCase();

  return (
    haystack.includes("WS_ABORT") ||
    haystack.includes("OPERATION_ABORTED") ||
    haystack.includes("CAN_NOT_GET_GATEWAY_SERVER") ||
    haystack.includes("WEBSOCKET") ||
    haystack.includes("STILL CONNECTING") ||
    haystack.includes("SIGNALING CHANGED BEFORE SETUP COMPLETED") ||
    haystack.includes("WALKIE IS NOT AVAILABLE")
  );
}

export function classifyWalkieSignalingSetupError(error) {
  const rawCode = String(error?.code || "");
  const rawName = String(error?.name || "");
  const rawMessage = String(error?.message || "");
  const haystack = `${rawCode} ${rawName} ${rawMessage}`.toUpperCase().trim();

  if (
    rawMessage === "Walkie signaling changed before setup completed." ||
    rawMessage === "Walkie is not available."
  ) {
    return "ignore";
  }

  if (
    haystack.includes("SIGNALING CHANGED BEFORE SETUP COMPLETED") ||
    haystack.includes("WALKIE IS NOT AVAILABLE") ||
    haystack.includes("ABORTERR")
  ) {
    return "ignore";
  }

  if (
    haystack.includes("SIGNALING TOKEN MISSING") ||
    haystack.includes("SIGNALING APP ID MISSING") ||
    haystack.includes("INVALID SIGNALING TOKEN PAYLOAD") ||
    haystack.includes("AGORA SIGNALING IS UNAVAILABLE") ||
    haystack.includes("INVALID APP ID") ||
    haystack.includes("APP_ID_NO_ACTIVATED") ||
    haystack.includes("THE VENDOR IS NOT ACTIVATED") ||
    haystack.includes("AGORA CREDENTIALS ARE INVALID") ||
    haystack.includes("WALKIE-TALKIE SIGNALING IS NOT CONFIGURED ON THE SERVER")
  ) {
    return "fatal";
  }

  if (!haystack) {
    return "recoverable";
  }

  if (
    isExpectedWalkieTransportError(error) ||
    haystack.includes("CONNECTION CLOSED") ||
    haystack.includes("CONNECTION LOST") ||
    haystack.includes("NETWORK") ||
    haystack.includes("TIMEOUT") ||
    haystack.includes("SOCKET") ||
    haystack.includes("DISCONNECTED") ||
    haystack.includes("UNEXPECTED RESPONSE")
  ) {
    return "recoverable";
  }

  return "fatal";
}

export function isRtcUidConflictError(error) {
  const rawCode = String(error?.code || "");
  const rawName = String(error?.name || "");
  const rawMessage = String(error?.message || "");
  const haystack = `${rawCode} ${rawName} ${rawMessage}`.toUpperCase();
  return haystack.includes("UID_CONFLICT");
}

export function walkieConsole(level, event, details = {}) {
  const effectiveLevel =
    level === "error" &&
    typeof window !== "undefined" &&
    process.env.NODE_ENV !== "production"
      ? "warn"
      : level;
  const logger =
    effectiveLevel === "error"
      ? console.error
      : effectiveLevel === "warn"
        ? console.warn
        : console.info;
  logger(`[GV Walkie] ${event}`, details);
}

export async function requestJson(url, body) {
  let lastError = null;
  const delays = [0, 180, 520];

  for (const delayMs of delays) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload?.message || "Request failed.");
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (!isWalkieNetworkError(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    lastError.network = true;
    throw lastError;
  }

  throw new Error("Request failed.");
}

export async function requestWalkieState(url) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || "Request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function shouldRetryWalkieStartError(error) {
  const status = Number(error?.status || 0);
  if ([400, 403, 404, 409, 429].includes(status)) {
    return false;
  }
  if (status >= 500) {
    return true;
  }
  return isExpectedWalkieTransportError(error);
}

export async function loadRtc() {
  const mod = await import("agora-rtc-sdk-ng");
  const rtc = mod.default || mod;
  rtc.disableLogUpload?.();
  rtc.setLogLevel?.(4);
  return rtc;
}

export async function loadRtm() {
  const mod = await import("agora-rtm-sdk");
  return mod.default || mod;
}

export function clearTimer(ref, clearFn = window.clearTimeout) {
  if (ref.current) {
    clearFn(ref.current);
    ref.current = null;
  }
}

export async function wait(ms) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForRtcConnected(client, timeoutMs = 1200) {
  const deadline = Date.now() + timeoutMs;
  while (client && client.connectionState !== "CONNECTED" && Date.now() < deadline) {
    await wait(40);
  }
}

export function playWalkieCue(type) {
  if (type === "start") {
    playUiTone({ frequency: 980, durationMs: 240, type: "sine", volume: 0.11 });
    window.setTimeout(() => {
      playUiTone({ frequency: 1180, durationMs: 220, type: "sine", volume: 0.095 });
    }, 130);
    return;
  }

  playUiTone({ frequency: 640, durationMs: 220, type: "triangle", volume: 0.085 });
  window.setTimeout(() => {
    playUiTone({ frequency: 520, durationMs: 180, type: "triangle", volume: 0.07 });
  }, 140);
}


