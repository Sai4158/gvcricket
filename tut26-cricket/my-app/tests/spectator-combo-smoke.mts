/**
 * File overview:
 * Purpose: Automated test coverage for Spectator Combo Smoke behavior and regressions.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import mongoose from "mongoose";

const base =
  process.env.SPECTATOR_COMBO_BASE_URL ||
  process.env.TEST_BASE_URL ||
  "http://127.0.0.1:3042";

const jar = new Map<string, string>();
const created = { sessionId: "", matchId: "" };

function readSetCookies(headers: Headers) {
  if (
    typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie ===
    "function"
  ) {
    return (
      headers as Headers & {
        getSetCookie: () => string[];
      }
    ).getSetCookie();
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
  return [...jar.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
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
  targetPath: string,
  {
    method = "GET",
    body,
    useCookies = true,
  }: { method?: string; body?: unknown; useCookies?: boolean } = {}
) {
  const response = await fetch(`${base}${targetPath}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { Origin: base, Referer: `${base}/` } : {}),
      ...(useCookies && jar.size ? { Cookie: cookieHeader() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  storeCookies(response.headers);
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, text, json };
}

async function openSse(targetPath: string, cookieString = "") {
  const controller = new AbortController();
  const response = await fetch(`${base}${targetPath}`, {
    headers: {
      Accept: "text/event-stream",
      ...((cookieString || jar.size) ? { Cookie: cookieString || cookieHeader() } : {}),
    },
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE failed for ${targetPath}: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function readWithTimeout(timeoutMs: number) {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timed out waiting for SSE chunk on ${targetPath}`));
        }, timeoutMs);
      }),
    ]);
  }

  async function nextEvent(timeoutMs = 10_000) {
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

      const remainingMs = Math.max(250, timeoutMs - (Date.now() - started));
      const { value, done } = await readWithTimeout(remainingMs);
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
    }

    throw new Error(`Timed out waiting for SSE event on ${targetPath}`);
  }

  return {
    nextEvent,
    async nextMatchingEvent(
      predicate: (message: { event: string; data: any }) => boolean,
      timeoutMs = 10_000
    ) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const next = await nextEvent(timeoutMs);
        if (predicate(next)) {
          return next;
        }
      }
      throw new Error(`Timed out waiting for matching SSE event on ${targetPath}`);
    },
    close() {
      controller.abort();
    },
  };
}

function actionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  const create = await api("/api/sessions", {
    method: "POST",
    body: { name: `Spectator Combo ${Date.now()}` },
    useCookies: false,
  });
  assert.equal(create.response.status, 201, "session creation should work");
  created.sessionId = create.json?._id || "";
  const draftToken = create.json?.draftToken || "";

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
  assert.equal(setup.response.status, 201, "match setup should work");

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
  assert.equal(start.response.status, 201, "match start should work");
  created.matchId = start.json?.match?._id || "";
  const umpireCookie = cookieHeader();

  overwriteJarFromCookieString(umpireCookie);
  const auth = await api(`/api/matches/${created.matchId}/auth`, {
    method: "POST",
    body: { pin: "0000" },
  });
  assert.equal(auth.response.status, 200, "umpire auth should work");
  const authedUmpireCookie = cookieHeader();

  const sessionSse = await openSse(`/api/live/sessions/${created.sessionId}`);
  const initialSession = await sessionSse.nextMatchingEvent(
    (message) => message.event === "session" && message.data?.match?._id === created.matchId
  );
  assert.equal(initialSession.data.match.score, 0);

  overwriteJarFromCookieString(authedUmpireCookie);
  const firstScore = await api(`/api/matches/${created.matchId}/actions`, {
    method: "POST",
    body: {
      type: "score_ball",
      runs: 1,
      isOut: false,
      extraType: null,
      actionId: actionId("score-1"),
    },
  });
  assert.equal(firstScore.response.status, 200, "score action should work");

  const firstScoreEvent = await sessionSse.nextMatchingEvent(
    (message) =>
      message.event === "session" &&
      message.data?.match?.score === 1 &&
      message.data?.match?.lastEventType === "score"
  );
  assert.equal(firstScoreEvent.data.match.outs, 0);

  const wideScore = await api(`/api/matches/${created.matchId}/actions`, {
    method: "POST",
    body: {
      type: "score_ball",
      runs: 1,
      isOut: false,
      extraType: "wide",
      actionId: actionId("wide"),
    },
  });
  assert.equal(wideScore.response.status, 200, "wide should work");

  const wideEvent = await sessionSse.nextMatchingEvent(
    (message) =>
      message.event === "session" &&
      message.data?.match?.score === 2 &&
      message.data?.match?.balls?.at(-1)?.extraType === "wide"
  );
  assert.equal(wideEvent.data.match.score, 2);

  const undo = await api(`/api/matches/${created.matchId}/actions`, {
    method: "POST",
    body: {
      type: "undo_last",
      actionId: actionId("undo"),
    },
  });
  assert.equal(undo.response.status, 200, "undo should work");

  const undoEvent = await sessionSse.nextMatchingEvent(
    (message) =>
      message.event === "session" &&
      message.data?.match?.score === 1 &&
      message.data?.match?.lastEventType === "undo"
  );
  assert.equal(undoEvent.data.match.score, 1);

  const rename = await api(`/api/matches/${created.matchId}`, {
    method: "PATCH",
    body: {
      teamAName: "Alpha Prime",
      teamBName: "Beta Prime",
      teamA: ["A1 Prime", "A2 Prime", "A3 Prime"],
      teamB: ["B1 Prime", "B2 Prime", "B3 Prime"],
    },
  });
  assert.equal(rename.response.status, 200, "mid-match rename should work");

  const renameEvent = await sessionSse.nextMatchingEvent(
    (message) =>
      message.event === "session" &&
      message.data?.match?.teamAName === "Alpha Prime" &&
      message.data?.match?.teamBName === "Beta Prime"
  );
  assert.equal(renameEvent.data.match.teamA[0], "A1 Prime");

  overwriteJarFromCookieString(authedUmpireCookie);
  const umpireWalkieSse = await openSse(
    `/api/live/walkie/${created.matchId}?role=umpire&participantId=umpire:combo&name=Lead%20Umpire`,
    authedUmpireCookie
  );
  const umpireWalkieState = await umpireWalkieSse.nextMatchingEvent(
    (message) => message.event === "state" && Boolean(message.data?.token)
  );
  assert.ok(umpireWalkieState.data.token, "umpire walkie token should exist");

  const spectatorWalkieSse = await openSse(
    `/api/live/walkie/${created.matchId}?role=spectator&participantId=spectator:combo&name=North%20End`
  );
  const spectatorWalkieState = await spectatorWalkieSse.nextMatchingEvent(
    (message) => message.event === "state" && Boolean(message.data?.token)
  );
  const spectatorWalkieToken = spectatorWalkieState.data.token;
  assert.ok(spectatorWalkieToken, "spectator walkie token should exist");

  const requestWalkie = await api(`/api/matches/${created.matchId}/walkie/request`, {
    method: "POST",
    body: {
      participantId: "spectator:combo",
      role: "spectator",
      token: spectatorWalkieToken,
    },
    useCookies: false,
  });
  assert.equal(requestWalkie.response.status, 200, "walkie request should work");

  const requestEvent = await umpireWalkieSse.nextMatchingEvent(
    (message) => message.data?.notification?.type === "walkie_requested"
  );
  const requestId = requestEvent.data?.snapshot?.pendingRequests?.[0]?.requestId || "";
  assert.ok(requestId, "walkie request id should be present");

  overwriteJarFromCookieString(authedUmpireCookie);
  const acceptWalkie = await api(`/api/matches/${created.matchId}/walkie/respond`, {
    method: "POST",
    body: { requestId, action: "accept" },
  });
  assert.equal(acceptWalkie.response.status, 200, "walkie accept should work");

  await spectatorWalkieSse.nextMatchingEvent(
    (message) =>
      message.data?.type === "request-accepted" ||
      message.data?.snapshot?.enabled === true
  );

  const postWalkieScore = await api(`/api/matches/${created.matchId}/actions`, {
    method: "POST",
    body: {
      type: "score_ball",
      runs: 4,
      isOut: false,
      extraType: null,
      actionId: actionId("score-after-walkie"),
    },
  });
  assert.equal(postWalkieScore.response.status, 200, "score after walkie should work");

  const finalScoreEvent = await sessionSse.nextMatchingEvent(
    (message) =>
      message.event === "session" &&
      message.data?.match?.score === 5 &&
      message.data?.match?.teamAName === "Alpha Prime"
  );
  assert.equal(finalScoreEvent.data.match.score, 5);
  assert.equal(finalScoreEvent.data.match.teamBName, "Beta Prime");

  spectatorWalkieSse.close();
  umpireWalkieSse.close();
  sessionSse.close();

  console.log(
    JSON.stringify(
      {
        sessionId: created.sessionId,
        matchId: created.matchId,
        score: finalScoreEvent.data.match.score,
        teams: `${finalScoreEvent.data.match.teamAName} vs ${finalScoreEvent.data.match.teamBName}`,
      },
      null,
      2
    )
  );
}

try {
  await main();
} finally {
  await cleanup().catch((error) => {
    console.error(`CLEANUP_ERROR=${error.message}`);
  });
}
