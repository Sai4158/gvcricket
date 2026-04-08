/**
 * File overview:
 * Purpose: Automated test coverage for Stress Isolation behavior and regressions.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const base = process.env.STRESS_BASE_URL || "http://127.0.0.1:3038";
const created = {
  sessionIds: [] as string[],
  matchIds: [] as string[],
};

function readEnvFileIfNeeded() {
  if (process.env.MONGODB_URI) return;
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const [key, ...rest] = line.split("=");
    if (!key || key.startsWith("#")) continue;
    if (!(key in process.env)) {
      process.env[key] = rest.join("=");
    }
  }
}

function readSetCookies(headers: Headers) {
  if (typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function") {
    return (headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

class CookieJar {
  store = new Map<string, string>();

  clone() {
    const next = new CookieJar();
    for (const [key, value] of this.store.entries()) {
      next.store.set(key, value);
    }
    return next;
  }

  absorb(headers: Headers) {
    for (const raw of readSetCookies(headers)) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) {
        this.store.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    }
  }

  header() {
    return [...this.store.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

async function api(
  route: string,
  {
    method = "GET",
    body,
    jar,
    origin = true,
    headers: extraHeaders = {},
  }: {
    method?: string;
    body?: unknown;
    jar?: CookieJar | null;
    origin?: boolean;
    headers?: Record<string, string>;
  } = {}
) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(origin && method !== "GET" ? { Origin: base, Referer: `${base}/` } : {}),
      ...(jar?.store?.size ? { Cookie: jar.header() } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  jar?.absorb(response.headers);
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, text, json };
}

async function openSse(route: string, jar?: CookieJar | null) {
  const controller = new AbortController();
  const response = await fetch(`${base}${route}`, {
    headers: {
      Accept: "text/event-stream",
      ...(jar?.store?.size ? { Cookie: jar.header() } : {}),
    },
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE failed for ${route}: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function nextEvent(timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const chunks = buffer.split("\n\n");
      if (chunks.length > 1) {
        const block = chunks.shift()!;
        buffer = chunks.join("\n\n");
        const lines = block.split("\n");
        const event =
          lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
        const dataText = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        let data: any = null;
        try {
          data = dataText ? JSON.parse(dataText) : null;
        } catch {
          data = dataText;
        }
        return { event, data };
      }

      const remaining = deadline - Date.now();
      const readPromise = reader.read();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out waiting for SSE event on ${route}`)), remaining);
      });
      const { value, done } = await Promise.race([readPromise, timeoutPromise]);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }

    throw new Error(`Timed out waiting for SSE event on ${route}`);
  }

  async function nextMatchingEvent(
    predicate: (message: { event: string; data: any }) => boolean,
    timeoutMs = 8000
  ) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const next = await nextEvent(deadline - Date.now());
      if (predicate(next)) {
        return next;
      }
    }
    throw new Error(`Timed out waiting for matching SSE event on ${route}`);
  }

  return {
    nextEvent,
    nextMatchingEvent,
    close() {
      controller.abort();
    },
  };
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createLiveSession(index: number) {
  const clientIp = `10.0.0.${index + 10}`;
  const create = await api("/api/sessions", {
    method: "POST",
    body: { name: `Stress Match ${index}` },
    headers: { "x-forwarded-for": clientIp },
  });
  assert(create.response.status === 201, `Session create failed for ${index}: ${create.response.status}`);
  const sessionId = create.json?._id;
  const draftToken = create.json?.draftToken;
  assert(sessionId && draftToken, `Draft session payload invalid for ${index}`);
  created.sessionIds.push(sessionId);

  const teamAName = `Red ${index}`;
  const teamBName = `Blue ${index}`;
  const setup = await api(`/api/sessions/${sessionId}/setup-match`, {
    method: "POST",
    body: {
      teamAName,
      teamBName,
      teamAPlayers: ["A1", "A2", "A3"],
      teamBPlayers: ["B1", "B2", "B3"],
      overs: 2,
      draftToken,
    },
    headers: { "x-forwarded-for": clientIp },
  });
  assert(setup.response.status === 201, `Setup failed for ${index}: ${setup.response.status}`);

  const tossWinner = index % 2 === 0 ? teamAName : teamBName;
  const tossDecision = index % 2 === 0 ? "bat" : "bowl";
  const start = await api(`/api/sessions/${sessionId}/start-match`, {
    method: "POST",
    body: {
      teamAName,
      teamBName,
      teamAPlayers: ["A1", "A2", "A3"],
      teamBPlayers: ["B1", "B2", "B3"],
      overs: 2,
      tossWinner,
      tossDecision,
      draftToken,
    },
    headers: { "x-forwarded-for": clientIp },
  });
  assert(start.response.status === 201, `Start failed for ${index}: ${start.response.status}`);
  const matchId = start.json?.match?._id;
  assert(matchId, `No match id returned for ${index}`);
  created.matchIds.push(matchId);

  const authJar = new CookieJar();
  const auth = await api(`/api/matches/${matchId}/auth`, {
    method: "POST",
    body: { pin: "0000" },
    jar: authJar,
    headers: { "x-forwarded-for": clientIp },
  });
  assert(auth.response.status === 200, `Umpire auth failed for ${matchId}: ${auth.response.status}`);

  return {
    sessionId,
    matchId,
    teamAName,
    teamBName,
    umpireJar: authJar,
  };
}

async function scoreBall(matchId: string, umpireJar: CookieJar, actionId: string, runs: number) {
  return api(`/api/matches/${matchId}/actions`, {
    method: "POST",
    jar: umpireJar,
    body: {
      type: "score_ball",
      actionId,
      runs,
      isOut: false,
      extraType: null,
    },
  });
}

async function cleanup() {
  readEnvFileIfNeeded();
  if (!process.env.MONGODB_URI) return;
  if (!created.matchIds.length && !created.sessionIds.length) return;

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    if (created.matchIds.length) {
      await mongoose.connection
        .collection("matches")
        .deleteMany({ _id: { $in: created.matchIds.map((id) => new mongoose.Types.ObjectId(id)) } });
    }
    if (created.sessionIds.length) {
      await mongoose.connection
        .collection("sessions")
        .deleteMany({ _id: { $in: created.sessionIds.map((id) => new mongoose.Types.ObjectId(id)) } });
    }
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const results: string[] = [];

  const liveMatches = await Promise.all([1, 2, 3, 4, 5].map((index) => createLiveSession(index)));
  results.push(`LIVE_MATCHES_CREATED=${liveMatches.length}`);

  const mainMatch = liveMatches[0];
  const spectatorStreams = await Promise.all(
    Array.from({ length: 25 }, async (_, index) => {
      const sse = await openSse(`/api/live/sessions/${mainMatch.sessionId}`);
      await sse.nextMatchingEvent((message) => message.event === "session");
      return { index, sse };
    })
  );

  const firstScore = await scoreBall(
    mainMatch.matchId,
    mainMatch.umpireJar,
    `stress-main-${Date.now()}`,
    1
  );
  assert(firstScore.response.status === 200, `Main match score failed: ${firstScore.response.status}`);

  const broadcastResults = await Promise.all(
    spectatorStreams.map(async ({ sse }) => {
      const update = await sse.nextMatchingEvent(
        (message) => message.event === "session" && Number(message.data?.match?.score) === 1,
        6000
      );
      return Number(update.data?.match?.score || 0);
    })
  );
  assert(broadcastResults.every((score) => score === 1), "Not all spectators received the same score update");
  results.push(`SAME_MATCH_SPECTATORS_OK=${broadcastResults.length}`);

  const isolatedStreams = await Promise.all(
    liveMatches.slice(1).map(async (entry) => {
      const sse = await openSse(`/api/live/sessions/${entry.sessionId}`);
      await sse.nextMatchingEvent((message) => message.event === "session");
      return { entry, sse };
    })
  );

  const concurrentScores = await Promise.all(
    isolatedStreams.map(({ entry }, index) =>
      scoreBall(entry.matchId, entry.umpireJar, `isolated-${index}-${Date.now()}`, index + 2)
    )
  );
  concurrentScores.forEach((result, index) => {
    assert(result.response.status === 200, `Concurrent score ${index} failed: ${result.response.status}`);
  });

  const isolatedUpdates = await Promise.all(
    isolatedStreams.map(async ({ entry, sse }, index) => {
      const expectedScore = index + 2;
      const update = await sse.nextMatchingEvent(
        (message) =>
          message.event === "session" &&
          String(message.data?.session?._id || "") === entry.sessionId &&
          Number(message.data?.match?.score || 0) === expectedScore,
        6000
      );
      return {
        matchId: String(update.data?.match?._id || ""),
        score: Number(update.data?.match?.score || 0),
      };
    })
  );
  assert(
    isolatedUpdates.every((update, index) => update.matchId === isolatedStreams[index].entry.matchId),
    "Cross-session score leakage detected in live session SSE"
  );
  results.push(`MULTI_MATCH_ISOLATION_OK=${isolatedUpdates.length}`);

  const duplicateActionId = `duplicate-${Date.now()}`;
  const duplicateSubmitResults = await Promise.all([
    scoreBall(mainMatch.matchId, mainMatch.umpireJar, duplicateActionId, 4),
    scoreBall(mainMatch.matchId, mainMatch.umpireJar, duplicateActionId, 4),
  ]);
  const duplicateStatuses = duplicateSubmitResults.map((result) => result.response.status);
  assert(duplicateStatuses.every((status) => status === 200), `Duplicate submit status mismatch: ${duplicateStatuses.join(",")}`);
  const duplicateScores = duplicateSubmitResults.map((result) => Number(result.json?.match?.score || 0));
  assert(
    duplicateScores.every((score) => score === duplicateScores[0]),
    "Duplicate action id produced divergent match state"
  );
  results.push(`DUPLICATE_SUBMIT_SAFE=${duplicateScores[0]}`);

  for (const { sse } of spectatorStreams) sse.close();
  for (const { sse } of isolatedStreams) sse.close();

  const unauthorizedScore = await api(`/api/matches/${mainMatch.matchId}/actions`, {
    method: "POST",
    body: {
      type: "score_ball",
      actionId: `unauth-${Date.now()}`,
      runs: 1,
      isOut: false,
      extraType: null,
    },
  });
  assert(unauthorizedScore.response.status === 403, `Unauthorized scoring should be 403, got ${unauthorizedScore.response.status}`);
  results.push(`UNAUTHORIZED_SCORING=${unauthorizedScore.response.status}`);

  const walkieMatchA = liveMatches[1];
  const walkieMatchB = liveMatches[2];

  const directorJar = new CookieJar();
  const directorAuth = await api("/api/director/auth", {
    method: "POST",
    body: { pin: "0000" },
    jar: directorJar,
  });
  assert(directorAuth.response.status === 200, `Director auth failed: ${directorAuth.response.status}`);

  const walkieA = {
    umpire: await openSse(
      `/api/live/walkie/${walkieMatchA.matchId}?role=umpire&participantId=umpire:A&name=Umpire%20A`,
      walkieMatchA.umpireJar
    ),
    director: await openSse(
      `/api/live/walkie/${walkieMatchA.matchId}?role=director&participantId=director:A&name=Director%20A`,
      directorJar
    ),
    spectator: await openSse(
      `/api/live/walkie/${walkieMatchA.matchId}?role=spectator&participantId=spectator:A&name=Spectator%20A`
    ),
  };
  const walkieB = {
    spectator: await openSse(
      `/api/live/walkie/${walkieMatchB.matchId}?role=spectator&participantId=spectator:B&name=Spectator%20B`
    ),
  };

  const walkieAUmpireInitial = await walkieA.umpire.nextMatchingEvent((message) => message.event === "state", 15000);
  const walkieADirectorInitial = await walkieA.director.nextMatchingEvent((message) => message.event === "state", 15000);
  const walkieASpectatorInitial = await walkieA.spectator.nextMatchingEvent((message) => message.event === "state", 15000);
  const walkieBSpectatorInitial = await walkieB.spectator.nextMatchingEvent((message) => message.event === "state", 15000);
  const walkieAToken = walkieASpectatorInitial.data?.token;
  const walkieBToken = walkieBSpectatorInitial.data?.token;
  const walkieADirectorToken = walkieADirectorInitial.data?.token;
  assert(
    walkieAToken && walkieBToken && walkieAUmpireInitial.data?.token && walkieADirectorToken,
    "Missing walkie participant tokens"
  );

  const walkieRequest = await api(`/api/matches/${walkieMatchA.matchId}/walkie/request`, {
    method: "POST",
    body: { participantId: "spectator:A", role: "spectator", token: walkieAToken },
  });
  assert(walkieRequest.response.status === 200, `Walkie request failed: ${walkieRequest.response.status}`);

  const umpireRequested = await walkieA.umpire.nextMatchingEvent(
    (message) => message.data?.notification?.type === "walkie_requested",
    6000
  );
  const requestId = umpireRequested.data?.snapshot?.pendingRequests?.[0]?.requestId;
  assert(requestId, "No pending walkie request id available");

  const walkieAccept = await api(`/api/matches/${walkieMatchA.matchId}/walkie/respond`, {
    method: "POST",
    body: { requestId, action: "accept" },
    jar: walkieMatchA.umpireJar,
  });
  assert(walkieAccept.response.status === 200, `Walkie accept failed: ${walkieAccept.response.status}`);

  const walkieAEnabled = await walkieA.spectator.nextMatchingEvent(
    (message) => message.data?.snapshot?.enabled === true,
    6000
  );
  assert(walkieAEnabled.data?.snapshot?.enabled === true, "Walkie did not enable on the correct match");

  const walkieBNoLeak = await Promise.race([
    walkieB.spectator.nextMatchingEvent(
      (message) => message.data?.snapshot?.enabled === true,
      1500
    ).then(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1700)),
  ]);
  assert(walkieBNoLeak, "Walkie state leaked into another match");
  results.push("WALKIE_ISOLATION_OK=true");

  const claimRace = await Promise.all([
    api(`/api/matches/${walkieMatchA.matchId}/walkie/claim`, {
      method: "POST",
      body: { participantId: "spectator:A", role: "spectator", token: walkieAToken },
    }),
    api(`/api/matches/${walkieMatchA.matchId}/walkie/claim`, {
      method: "POST",
      body: { participantId: "director:A", role: "director", token: walkieADirectorToken },
      jar: directorJar,
    }),
  ]);
  const claimStatuses = claimRace.map((entry) => entry.response.status).sort();
  assert(
    claimStatuses[0] === 200 && claimStatuses[1] === 409,
    `Expected one walkie claim success and one conflict, got ${claimStatuses.join("/")}`
  );
  results.push(`WALKIE_CLAIM_STATUSES=${claimStatuses.join("/")}`);

  const directorRateLimitResults = [];
  for (let index = 0; index < 6; index += 1) {
    const response = await api("/api/director/auth", {
      method: "POST",
      body: { pin: "1111" },
      jar: null,
    });
    directorRateLimitResults.push(response.response.status);
  }
  assert(
    directorRateLimitResults.at(-1) === 429,
    `Expected final director auth spam request to 429, got ${directorRateLimitResults.join(",")}`
  );
  results.push(`DIRECTOR_RATE_LIMIT=${directorRateLimitResults.join("/")}`);

  walkieA.umpire.close();
  walkieA.director.close();
  walkieA.spectator.close();
  walkieB.spectator.close();

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
