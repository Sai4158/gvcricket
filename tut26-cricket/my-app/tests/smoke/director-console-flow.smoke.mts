/**
 * File overview:
 * Purpose: Automated test coverage for Director E2e Smoke behavior and regressions.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import Match from "../../src/models/Match.js";
import Session from "../../src/models/Session.js";

const base =
  process.env.DIRECTOR_E2E_BASE_URL ||
  process.env.TEST_BASE_URL ||
  process.env.STRESS_BASE_URL ||
  "http://127.0.0.1:3024";
const jar = new Map<string, string>();
const created = { sessionId: "", matchId: "" };

function readSetCookies(headers: Headers) {
  // Node fetch exposes getSetCookie in this runtime.
  if (typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function") {
    return (headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function storeCookies(headers: Headers) {
  for (const raw of readSetCookies(headers)) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) {
      jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function overwriteJarFromCookieString(cookieString: string) {
  jar.clear();
  for (const pair of cookieString.split("; ")) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  }
}

async function api(
  path: string,
  {
    method = "GET",
    body,
    useCookies = true,
    headers: extraHeaders = {},
  }: {
    method?: string;
    body?: unknown;
    useCookies?: boolean;
    headers?: Record<string, string>;
  } = {}
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { Origin: base, Referer: `${base}/` } : {}),
      ...(useCookies && jar.size ? { Cookie: cookieHeader() } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  storeCookies(response.headers);
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  return { response, text, json };
}

async function openSse(path: string, cookieString = "") {
  const controller = new AbortController();
  const response = await fetch(`${base}${path}`, {
    headers: {
      Accept: "text/event-stream",
      ...((cookieString || jar.size) ? { Cookie: cookieString || cookieHeader() } : {}),
    },
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE failed for ${path}: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function nextEvent(timeoutMs = 8000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const chunks = buffer.split("\n\n");
      if (chunks.length > 1) {
        const block = chunks.shift()!;
        buffer = chunks.join("\n\n");
        const lines = block.split("\n");
        const event =
          lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
        const dataLine = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        let data: any = null;
        try {
          data = dataLine ? JSON.parse(dataLine) : null;
        } catch {
          data = dataLine;
        }
        return { event, data };
      }

      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
    }

    throw new Error(`Timed out waiting for SSE event on ${path}`);
  }

  return {
    nextEvent,
    async nextMatchingEvent(
      predicate: (message: { event: string; data: any }) => boolean,
      timeoutMs = 8000
    ) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const next = await nextEvent(timeoutMs);
        if (predicate(next)) {
          return next;
        }
      }
      throw new Error(`Timed out waiting for matching SSE event on ${path}`);
    },
    close() {
      controller.abort();
    },
  };
}

async function cleanup() {
  if (!created.matchId && !created.sessionId) return;

  if (!process.env.MONGODB_URI) {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const [key, ...rest] = line.split("=");
        if (!key || key.startsWith("#")) continue;
        if (!(key in process.env)) {
          process.env[key] = rest.join("=");
        }
      }
    }
  }

  await mongoose.connect(process.env.MONGODB_URI!);
  try {
    if (created.matchId) {
      await mongoose.connection
        .collection("matches")
        .deleteOne({ _id: new mongoose.Types.ObjectId(created.matchId) });
    }
    if (created.sessionId) {
      await mongoose.connection
        .collection("sessions")
        .deleteOne({ _id: new mongoose.Types.ObjectId(created.sessionId) });
    }
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const results: string[] = [];
  const directorAuthRunKey = `director-e2e-${Date.now()}`;

  const noAuthSessions = await api("/api/director/sessions", { useCookies: false });
  results.push(`DIRECTOR_SESSIONS_NOAUTH=${noAuthSessions.response.status}`);

  const badPin = await api("/api/director/auth", {
    method: "POST",
    body: { pin: "1111" },
    useCookies: false,
    headers: { "X-Forwarded-For": `${directorAuthRunKey}-bad-1` },
  });
  results.push(`DIRECTOR_BAD_PIN=${badPin.response.status}`);

  const emptyPin = await api("/api/director/auth", {
    method: "POST",
    body: { pin: "" },
    useCookies: false,
    headers: { "X-Forwarded-For": `${directorAuthRunKey}-bad-2` },
  });
  results.push(`DIRECTOR_EMPTY_PIN=${emptyPin.response.status}`);

  const invalidPin = await api("/api/director/auth", {
    method: "POST",
    body: { pin: "00a0" },
    useCookies: false,
    headers: { "X-Forwarded-For": `${directorAuthRunKey}-bad-3` },
  });
  results.push(`DIRECTOR_INVALID_PIN=${invalidPin.response.status}`);

  const sessionCreate = await api("/api/sessions", {
    method: "POST",
    body: { name: "Director E2E" },
    useCookies: false,
  });
  created.sessionId = sessionCreate.json?._id || "";
  const draftToken = sessionCreate.json?.draftToken || "";
  results.push(`SESSION_CREATE=${sessionCreate.response.status}`);

  const setup = await api(`/api/sessions/${created.sessionId}/setup-match`, {
    method: "POST",
    body: {
      teamAName: "Alpha",
      teamAPlayers: ["A1", "A2", "A3"],
      teamBName: "Beta",
      teamBPlayers: ["B1", "B2", "B3"],
      overs: 2,
      draftToken,
    },
    useCookies: false,
  });
  results.push(`MATCH_SETUP=${setup.response.status}`);

  const start = await api(`/api/sessions/${created.sessionId}/start-match`, {
    method: "POST",
    body: {
      teamAName: "Alpha",
      teamAPlayers: ["A1", "A2", "A3"],
      teamBName: "Beta",
      teamBPlayers: ["B1", "B2", "B3"],
      overs: 2,
      tossWinner: "Alpha",
      tossDecision: "bat",
      draftToken,
    },
    useCookies: false,
  });
  created.matchId = start.json?.match?._id || "";
  results.push(`MATCH_START=${start.response.status}`);
  const umpireCookie = cookieHeader();

  const directorOk = await api("/api/director/auth", {
    method: "POST",
    body: { pin: " 0000 " },
    useCookies: false,
    headers: { "X-Forwarded-For": `${directorAuthRunKey}-good` },
  });
  results.push(`DIRECTOR_GOOD_PIN=${directorOk.response.status}`);
  const directorCookie = cookieHeader();

  const directorSessions = await api("/api/director/sessions");
  results.push(`DIRECTOR_SESSIONS_AUTH=${directorSessions.response.status}`);
  results.push(
    `DIRECTOR_LIVE_FOUND=${Boolean(
      directorSessions.json?.sessions?.find((item: any) => item.session?._id === created.sessionId)
    )}`
  );
  const directorStatus = await api("/api/director/auth");
  results.push(`DIRECTOR_STATUS_AUTH=${directorStatus.json?.authorized}`);

  const directorPage = await api("/director");
  results.push(`DIRECTOR_PAGE=${directorPage.response.status}`);
  results.push(
    `DIRECTOR_PAGE_HAS_CONSOLE=${directorPage.text.includes("PA Mic") || directorPage.text.includes("Director E2E")}`
  );

  overwriteJarFromCookieString(directorCookie);
  const directorSse = await openSse(
    `/api/live/walkie/${created.matchId}?role=director&participantId=director:test&name=Director%20Booth`
  );
  const directorInitial = await directorSse.nextEvent();
  const directorToken = directorInitial.data?.token;
  results.push(`DIRECTOR_SSE_STATE=${directorInitial.event}`);

  overwriteJarFromCookieString(umpireCookie);
  const umpireSse = await openSse(
    `/api/live/walkie/${created.matchId}?role=umpire&participantId=umpire:test&name=Lead%20Umpire`
  );
  const umpireInitial = await umpireSse.nextEvent();
  results.push(`UMPIRE_SSE_STATE=${umpireInitial.event}`);

  const spectatorSse = await openSse(
    `/api/live/walkie/${created.matchId}?role=spectator&participantId=spectator:test&name=North%20End`
  );
  const spectatorInitial = await spectatorSse.nextEvent();
  const spectatorToken = spectatorInitial.data?.token;
  results.push(`SPECTATOR_SSE_STATE=${spectatorInitial.event}`);

  const noAuthRespond = await api(`/api/matches/${created.matchId}/walkie/respond`, {
    method: "POST",
    body: { requestId: "fake-request", action: "accept" },
    useCookies: false,
  });
  results.push(`WALKIE_RESPOND_NOAUTH=${noAuthRespond.response.status}`);

  const badRequest = await api(`/api/matches/${created.matchId}/walkie/request`, {
    method: "POST",
    body: { participantId: "director:test", role: "director", token: "x".repeat(40) },
    useCookies: false,
  });
  results.push(`WALKIE_REQUEST_BAD_TOKEN=${badRequest.response.status}`);

  const directorRequest = await api(`/api/matches/${created.matchId}/walkie/request`, {
    method: "POST",
    body: { participantId: "director:test", role: "director", token: directorToken },
    useCookies: false,
  });
  results.push(`DIRECTOR_REQUEST=${directorRequest.response.status}`);
  const umpireRequested = await umpireSse.nextMatchingEvent(
    (message) => message.data?.notification?.type === "walkie_requested"
  );
  results.push(`UMPIRE_REQUEST_EVENT=${umpireRequested.data?.notification?.type}`);
  const requestId = umpireRequested.data?.snapshot?.pendingRequests?.[0]?.requestId || "";

  overwriteJarFromCookieString(umpireCookie);
  const accept = await api(`/api/matches/${created.matchId}/walkie/respond`, {
    method: "POST",
    body: { requestId, action: "accept" },
  });
  results.push(`UMPIRE_ACCEPT=${accept.response.status}`);
  results.push(`WALKIE_ENABLED=${Boolean(accept.json?.walkie?.enabled)}`);

  const directorAccepted = await directorSse.nextMatchingEvent(
    (message) =>
      message.data?.type === "request-accepted" ||
      message.data?.notification?.type === "walkie_enabled" ||
      message.data?.snapshot?.enabled === true
  );
  results.push(
    `DIRECTOR_ACCEPT_EVENT=${directorAccepted.event}:${directorAccepted.data?.type || directorAccepted.data?.notification?.type || "none"}`
  );

  overwriteJarFromCookieString(directorCookie);
  const directorClaim = await api(`/api/matches/${created.matchId}/walkie/claim`, {
    method: "POST",
    body: { participantId: "director:test", role: "director", token: directorToken },
  });
  results.push(`DIRECTOR_CLAIM=${directorClaim.response.status}`);

  const spectatorClaimBlocked = await api(`/api/matches/${created.matchId}/walkie/claim`, {
    method: "POST",
    body: { participantId: "spectator:test", role: "spectator", token: spectatorToken },
    useCookies: false,
  });
  results.push(`SPECTATOR_CLAIM_WHILE_DIRECTOR=${spectatorClaimBlocked.response.status}`);

  overwriteJarFromCookieString(directorCookie);
  const directorRelease = await api(`/api/matches/${created.matchId}/walkie/release`, {
    method: "POST",
    body: { participantId: "director:test", role: "director", token: directorToken },
  });
  results.push(`DIRECTOR_RELEASE=${directorRelease.response.status}`);

  const spectatorClaim = await api(`/api/matches/${created.matchId}/walkie/claim`, {
    method: "POST",
    body: { participantId: "spectator:test", role: "spectator", token: spectatorToken },
    useCookies: false,
  });
  results.push(`SPECTATOR_CLAIM=${spectatorClaim.response.status}`);

  const spectatorRelease = await api(`/api/matches/${created.matchId}/walkie/release`, {
    method: "POST",
    body: { participantId: "spectator:test", role: "spectator", token: spectatorToken },
    useCookies: false,
  });
  results.push(`SPECTATOR_RELEASE=${spectatorRelease.response.status}`);

  overwriteJarFromCookieString(umpireCookie);
  const disable = await api(`/api/matches/${created.matchId}/walkie`, {
    method: "POST",
    body: { enabled: false },
  });
  results.push(`UMPIRE_DISABLE=${disable.response.status}`);
  results.push(`WALKIE_DISABLED=${Boolean(disable.json?.walkie?.enabled === false)}`);

  directorSse.close();
  umpireSse.close();
  spectatorSse.close();

  for (const result of results) {
    console.log(result);
  }
}

try {
  await main();
} finally {
  await cleanup().catch((error) => {
    console.error(`CLEANUP_ERROR=${error.message}`);
  });
}
