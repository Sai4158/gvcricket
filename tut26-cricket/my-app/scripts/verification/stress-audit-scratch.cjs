/**
 * File overview:
 * Purpose: Runs Stress Audit Scratch verification checks or local audit support tasks.
 * Main exports: module side effects only.
 * Major callers: Verification commands and local audit runs.
 * Side effects: runs local verification tasks and may write reports or logs.
 * Read next: ../README.md
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function cookieHeader(setCookie) {
  if (!setCookie) return "";
  if (Array.isArray(setCookie)) {
    return setCookie.map((cookie) => String(cookie).split(";")[0]).join("; ");
  }
  return String(setCookie)
    .split(/,(?=[^;]+=[^;]+)/)
    .map((cookie) => cookie.split(";")[0].trim())
    .join("; ");
}

async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function jsonHeaders(baseUrl, cookie = "") {
  return {
    "Content-Type": "application/json",
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function waitForSseEvent(url, { cookie = "", timeoutMs = 6000, predicate = null } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    headers: {
      Accept: "text/event-stream",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    signal: controller.signal,
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let splitIndex;
      while ((splitIndex = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);
        const dataLines = chunk
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim());
        if (!dataLines.length) continue;
        let payload;
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch {
          continue;
        }
        if (!predicate || predicate(payload)) {
          return payload;
        }
      }
    }
    return null;
  } catch (error) {
    if (error.name === "AbortError") {
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    try {
      await reader.cancel();
    } catch {}
  }
}

async function main() {
  loadEnv();
  const base = process.env.BASE_URL || "http://127.0.0.1:3032";
  const created = [];
  const summary = {
    baseline: {},
    isolation: {},
    concurrency: {},
    security: {},
  };

  async function createStartedMatch(label, tossDecision = "bat") {
    const createRes = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: jsonHeaders(base),
      body: JSON.stringify({ name: `Stress ${label} ${Date.now()}` }),
    });
    const createBody = await readJson(createRes);
    const sessionId = createBody?._id;
    const draftToken = createBody?.draftToken;
    if (!sessionId || !draftToken) {
      throw new Error(`Failed to create session for ${label}`);
    }
    created.push({ sessionId, matchId: null });

    const setupRes = await fetch(`${base}/api/sessions/${sessionId}/setup-match`, {
      method: "POST",
      headers: jsonHeaders(base),
      body: JSON.stringify({
        teamAName: `${label} Red`,
        teamAPlayers: ["A1", "A2", "A3"],
        teamBName: `${label} Blue`,
        teamBPlayers: ["B1", "B2", "B3"],
        overs: 6,
        draftToken,
      }),
    });
    if (!setupRes.ok) {
      throw new Error(`Setup failed for ${label}: ${setupRes.status}`);
    }

    const startRes = await fetch(`${base}/api/sessions/${sessionId}/start-match`, {
      method: "POST",
      headers: jsonHeaders(base),
      body: JSON.stringify({
        teamAName: `${label} Red`,
        teamAPlayers: ["A1", "A2", "A3"],
        teamBName: `${label} Blue`,
        teamBPlayers: ["B1", "B2", "B3"],
        overs: 6,
        tossWinner: `${label} Red`,
        tossDecision,
        draftToken,
      }),
    });
    const startBody = await readJson(startRes);
    const match = startBody?.match;
    const matchId = match?._id;
    if (!matchId) {
      throw new Error(`Start failed for ${label}: ${JSON.stringify(startBody)}`);
    }
    created[created.length - 1].matchId = matchId;

    const authRes = await fetch(`${base}/api/matches/${matchId}/auth`, {
      method: "POST",
      headers: jsonHeaders(base),
      body: JSON.stringify({ pin: "0000" }),
    });
    const authBody = await readJson(authRes);
    const authCookie = cookieHeader(authRes.headers.get("set-cookie"));
    if (!authRes.ok || !authBody?.authorized || !authCookie) {
      throw new Error(`Auth failed for ${label}`);
    }

    return { sessionId, matchId, authCookie, match };
  }

  try {
    summary.baseline.home = (await fetch(`${base}/`)).status;
    summary.baseline.sessions = (await fetch(`${base}/session`)).status;
    summary.baseline.director = (await fetch(`${base}/director`)).status;

    const matches = await Promise.all([
      createStartedMatch("A", "bat"),
      createStartedMatch("B", "bowl"),
      createStartedMatch("C", "bat"),
      createStartedMatch("D", "bowl"),
      createStartedMatch("E", "bat"),
    ]);

    summary.baseline.startedMatches = matches.length;

    const scorePromises = matches.map((entry, index) =>
      fetch(`${base}/api/matches/${entry.matchId}/actions`, {
        method: "POST",
        headers: jsonHeaders(base, entry.authCookie),
        body: JSON.stringify({
          actionId: `stress-${index}-${crypto.randomUUID()}`,
          type: "score_ball",
          runs: index + 1,
          isOut: false,
          extraType: null,
        }),
      }).then(readJson)
    );

    const scoreResults = await Promise.all(scorePromises);
    summary.concurrency.parallelScores = scoreResults.map((result) => ({
      score: result?.match?.score ?? null,
      balls: result?.match?.innings1?.history?.[0]?.balls?.length ?? 0,
    }));

    const scoreMap = new Map(
      scoreResults.map((result, index) => [matches[index].matchId, result?.match?.score ?? null])
    );
    summary.isolation.parallelScoreIsolation = matches.every(
      (entry, index) => scoreMap.get(entry.matchId) === index + 1
    );

    const liveA = waitForSseEvent(`${base}/api/live/sessions/${matches[0].sessionId}`, {
      predicate: (payload) => payload?.session?.match === matches[0].matchId,
      timeoutMs: 3000,
    });
    const liveBUpdate = waitForSseEvent(`${base}/api/live/sessions/${matches[1].sessionId}`, {
      predicate: (payload) => payload?.session?.score > 0,
      timeoutMs: 2500,
    });

    await fetch(`${base}/api/matches/${matches[0].matchId}/actions`, {
      method: "POST",
      headers: jsonHeaders(base, matches[0].authCookie),
      body: JSON.stringify({
        actionId: `stress-live-${crypto.randomUUID()}`,
        type: "score_ball",
        runs: 4,
        isOut: false,
        extraType: null,
      }),
    });

    const [livePayloadA, leakedPayloadB] = await Promise.all([liveA, liveBUpdate]);
    summary.isolation.liveSseCorrectSession = Boolean(
      livePayloadA?.session?.match === matches[0].matchId && livePayloadA?.session?.score >= 5
    );
    summary.isolation.liveSseLeakToOtherSession = Boolean(leakedPayloadB);

    const walkieA = waitForSseEvent(
      `${base}/api/live/walkie/${matches[0].matchId}?role=umpire&participantId=umpire-a&name=Umpire`,
      {
        predicate: (payload) => payload?.notification?.type === "walkie_requested",
        timeoutMs: 5000,
      }
    );
    const walkieB = waitForSseEvent(
      `${base}/api/live/walkie/${matches[1].matchId}?role=umpire&participantId=umpire-b&name=Umpire`,
      {
        predicate: (payload) => payload?.notification?.type === "walkie_requested",
        timeoutMs: 3000,
      }
    );

    await fetch(`${base}/api/matches/${matches[0].matchId}/walkie/request`, {
      method: "POST",
      headers: jsonHeaders(base),
      body: JSON.stringify({ role: "spectator", participantId: "spectator-a", name: "Spec A" }),
    });

    const [walkieRequestA, walkieLeakB] = await Promise.all([walkieA, walkieB]);
    summary.isolation.walkieRequestScoped = Boolean(
      walkieRequestA?.notification?.matchId === matches[0].matchId
    );
    summary.isolation.walkieLeakToOtherMatch = Boolean(walkieLeakB);

    const duplicateStart = await Promise.all([
      fetch(`${base}/api/sessions/${matches[2].sessionId}/start-match`, {
        method: "POST",
        headers: jsonHeaders(base),
        body: JSON.stringify({
          teamAName: "A Red",
          teamAPlayers: ["A1", "A2", "A3"],
          teamBName: "A Blue",
          teamBPlayers: ["B1", "B2", "B3"],
          overs: 6,
          tossWinner: "A Red",
          tossDecision: "bat",
          draftToken: "bad-token",
        }),
      }).then(async (res) => ({ status: res.status, body: await readJson(res) })),
      fetch(`${base}/api/sessions/${matches[2].sessionId}/start-match`, {
        method: "POST",
        headers: jsonHeaders(base),
        body: JSON.stringify({
          teamAName: "A Red",
          teamAPlayers: ["A1", "A2", "A3"],
          teamBName: "A Blue",
          teamBPlayers: ["B1", "B2", "B3"],
          overs: 6,
          tossWinner: "A Red",
          tossDecision: "bat",
          draftToken: "bad-token",
        }),
      }).then(async (res) => ({ status: res.status, body: await readJson(res) })),
    ]);
    summary.security.badDraftTokenStatuses = duplicateStart.map((item) => item.status);

    const unauthorizedScore = await fetch(`${base}/api/matches/${matches[3].matchId}/actions`, {
      method: "POST",
      headers: jsonHeaders(base),
      body: JSON.stringify({
        actionId: crypto.randomUUID(),
        type: "score_ball",
        runs: 1,
        isOut: false,
        extraType: null,
      }),
    });
    summary.security.unauthorizedScoreStatus = unauthorizedScore.status;

    const spamPinResults = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await fetch(`${base}/api/director/auth`, {
        method: "POST",
        headers: jsonHeaders(base),
        body: JSON.stringify({ pin: "9999" }),
      });
      spamPinResults.push(res.status);
    }
    summary.security.directorPinSpam = spamPinResults;

    const spamWalkieRequests = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await fetch(`${base}/api/matches/${matches[4].matchId}/walkie/request`, {
        method: "POST",
        headers: jsonHeaders(base),
        body: JSON.stringify({ role: "spectator", participantId: "spectator-spam", name: "Spam" }),
      });
      spamWalkieRequests.push(res.status);
    }
    summary.security.walkieSpam = spamWalkieRequests;

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (process.env.MONGODB_URI && created.length) {
      await mongoose.connect(process.env.MONGODB_URI);
      const db = mongoose.connection.db;
      for (const entry of created) {
        if (entry.matchId) {
          await db.collection("matches").deleteOne({
            _id: new mongoose.Types.ObjectId(entry.matchId),
          });
        }
        if (entry.sessionId) {
          await db.collection("sessions").deleteOne({
            _id: new mongoose.Types.ObjectId(entry.sessionId),
          });
        }
      }
      await mongoose.disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


