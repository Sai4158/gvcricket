/**
 * File overview:
 * Purpose: Shares end-to-end umpire smoke, perf, and browser profiling helpers.
 * Main exports: createUmpireMatch, scoreBall, undoLast, completeInnings, writeSmokeArtifact.
 * Major callers: umpire smoke and perf scripts.
 * Side effects: performs network requests and optional Mongo cleanup/seeding.
 * Read next: ./README.md
 */

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

import Match from "../../src/models/Match.js";
import Session from "../../src/models/Session.js";
import { applyStoredMatchImages, createStoredMatchImageEntry } from "../../src/app/lib/match-image-gallery.js";
import { buildSessionMirrorUpdate } from "../../src/app/lib/match-engine.js";

const MatchModel = Match?.default || Match;
const SessionModel = Session?.default || Session;

export const DEFAULT_BASE_URL =
  process.env.UMPIRE_STRESS_BASE_URL ||
  process.env.TEST_BASE_URL ||
  "http://127.0.0.1:3031";
export const DEFAULT_OVERS = 15;
export const DEFAULT_PLAYERS = 10;

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9wAAAABJRU5ErkJggg==";

function readEnvFileIfNeeded() {
  if (process.env.MONGODB_URI) {
    return;
  }

  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

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

export class CookieJar {
  store = new Map<string, string>();

  absorb(headers: Headers) {
    for (const raw of readSetCookies(headers)) {
      const [pair] = raw.split(";");
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex > 0) {
        this.store.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
      }
    }
  }

  header() {
    return [...this.store.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  toPlaywrightCookies(baseUrl: string) {
    const target = new URL(baseUrl);
    return [...this.store.entries()].map(([name, value]) => ({
      name,
      value,
      domain: target.hostname,
      path: "/",
      secure: target.protocol === "https:",
      httpOnly: false,
      sameSite: "Lax" as const,
    }));
  }
}

export function buildPlayers(prefix: string, count = DEFAULT_PLAYERS) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
}

export function createActionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function measureStats(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const pick = (ratio: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * ratio)))];

  return {
    count: sorted.length,
    min: sorted[0] || 0,
    p50: pick(0.5) || 0,
    p95: pick(0.95) || 0,
    max: sorted[sorted.length - 1] || 0,
    avg:
      sorted.length > 0
        ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length
        : 0,
  };
}

export async function api(
  baseUrl: string,
  targetPath: string,
  {
    method = "GET",
    body,
    jar,
    headers: extraHeaders = {},
    useJson = true,
  }: {
    method?: string;
    body?: unknown;
    jar?: CookieJar | null;
    headers?: Record<string, string>;
    useJson?: boolean;
  } = {},
) {
  const headers = new Headers(extraHeaders);
  if (method !== "GET") {
    headers.set("Origin", baseUrl);
    headers.set("Referer", `${baseUrl}/`);
  }
  if (jar?.store?.size) {
    headers.set("Cookie", jar.header());
  }
  if (body && useJson) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${targetPath}`, {
    method,
    headers,
    body: body
      ? useJson
        ? JSON.stringify(body)
        : (body as BodyInit)
      : undefined,
    redirect: "manual",
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

export async function openSse(baseUrl: string, targetPath: string, jar?: CookieJar | null) {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}${targetPath}`, {
    headers: {
      Accept: "text/event-stream",
      ...(jar?.store?.size ? { Cookie: jar.header() } : {}),
    },
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE failed for ${targetPath}: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function nextEvent(timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const blocks = buffer.split("\n\n");
      if (blocks.length > 1) {
        const block = blocks.shift()!;
        buffer = blocks.join("\n\n");
        const lines = block.split("\n");
        const event =
          lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
        const dataText = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        return {
          event,
          dataText,
          data: dataText ? JSON.parse(dataText) : null,
          payloadBytes: Buffer.byteLength(dataText, "utf8"),
        };
      }

      const remaining = deadline - Date.now();
      const readPromise = reader.read();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out waiting for SSE on ${targetPath}`)), remaining);
      });
      const { value, done } = await Promise.race([readPromise, timeoutPromise]);
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
    }

    throw new Error(`Timed out waiting for SSE on ${targetPath}`);
  }

  return {
    nextEvent,
    close() {
      controller.abort();
    },
  };
}

export class UmpireSmokeEnvironment {
  baseUrl: string;
  createdSessionIds = new Set<string>();
  createdMatchIds = new Set<string>();

  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async cleanup() {
    readEnvFileIfNeeded();
    if (!process.env.MONGODB_URI) {
      return;
    }
    if (!this.createdSessionIds.size && !this.createdMatchIds.size) {
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    try {
      if (this.createdMatchIds.size) {
        await mongoose.connection.collection("matches").deleteMany({
          _id: {
            $in: [...this.createdMatchIds].map((id) => new mongoose.Types.ObjectId(id)),
          },
        });
      }
      if (this.createdSessionIds.size) {
        await mongoose.connection.collection("sessions").deleteMany({
          _id: {
            $in: [...this.createdSessionIds].map((id) => new mongoose.Types.ObjectId(id)),
          },
        });
      }
      await mongoose.connection.collection("matchundoentries").deleteMany({
        matchId: {
          $in: [...this.createdMatchIds].map((id) => new mongoose.Types.ObjectId(id)),
        },
      });
    } finally {
      await mongoose.disconnect();
    }
  }

  async createUmpireMatch({
    namePrefix = "Umpire Stress",
    overs = DEFAULT_OVERS,
    playersPerTeam = DEFAULT_PLAYERS,
  } = {}) {
    const anonymousJar = new CookieJar();
    const umpireJar = new CookieJar();
    const name = `${namePrefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const teamAName = "Falcons";
    const teamBName = "Titans";
    const teamAPlayers = buildPlayers("A", playersPerTeam);
    const teamBPlayers = buildPlayers("B", playersPerTeam);

    const createResult = await api(this.baseUrl, "/api/sessions", {
      method: "POST",
      body: { name },
      jar: anonymousJar,
    });
    if (createResult.response.status !== 201) {
      throw new Error(`Could not create session: ${createResult.response.status}`);
    }

    const sessionId = String(createResult.json?._id || "");
    const draftToken = String(createResult.json?.draftToken || "");
    if (!sessionId || !draftToken) {
      throw new Error("Session creation payload was incomplete.");
    }
    this.createdSessionIds.add(sessionId);

    const setupResult = await api(this.baseUrl, `/api/sessions/${sessionId}/setup-match`, {
      method: "POST",
      body: {
        teamAName,
        teamBName,
        teamAPlayers,
        teamBPlayers,
        overs,
        draftToken,
      },
      jar: anonymousJar,
    });
    if (setupResult.response.status !== 201) {
      throw new Error(`Could not save draft match: ${setupResult.response.status}`);
    }

    const startResult = await api(this.baseUrl, `/api/sessions/${sessionId}/start-match`, {
      method: "POST",
      body: {
        teamAName,
        teamBName,
        teamAPlayers,
        teamBPlayers,
        overs,
        tossWinner: teamAName,
        tossDecision: "bat",
        draftToken,
      },
      jar: umpireJar,
    });
    if (startResult.response.status !== 201) {
      throw new Error(`Could not start real match: ${startResult.response.status}`);
    }

    const matchId = String(startResult.json?.match?._id || "");
    if (!matchId) {
      throw new Error("Real match id was missing from start-match response.");
    }
    this.createdMatchIds.add(matchId);

    const authResult = await api(this.baseUrl, `/api/matches/${matchId}/auth`, {
      method: "POST",
      body: { pin: "0000" },
      jar: umpireJar,
    });
    if (authResult.response.status !== 200) {
      throw new Error(`Could not authenticate umpire: ${authResult.response.status}`);
    }

    return {
      sessionId,
      matchId,
      teamAName,
      teamBName,
      teamAPlayers,
      teamBPlayers,
      umpireJar,
    };
  }
}

export async function scoreBall(
  baseUrl: string,
  matchId: string,
  jar: CookieJar,
  {
    runs,
    isOut = false,
    extraType = null,
    actionId = createActionId("score"),
  }: {
    runs: number;
    isOut?: boolean;
    extraType?: string | null;
    actionId?: string;
  },
) {
  return api(baseUrl, `/api/matches/${matchId}/score`, {
    method: "POST",
    body: {
      actionId,
      runs,
      isOut,
      extraType,
    },
    jar,
  });
}

export async function undoLast(baseUrl: string, matchId: string, jar: CookieJar) {
  return api(baseUrl, `/api/matches/${matchId}/actions`, {
    method: "POST",
    body: {
      type: "undo_last",
      actionId: createActionId("undo"),
    },
    jar,
  });
}

export async function completeInnings(baseUrl: string, matchId: string, jar: CookieJar) {
  return api(baseUrl, `/api/matches/${matchId}/actions`, {
    method: "POST",
    body: {
      type: "complete_innings",
      actionId: createActionId("complete"),
    },
    jar,
  });
}

export async function readMatch(baseUrl: string, matchId: string, jar?: CookieJar | null) {
  return api(baseUrl, `/api/matches/${matchId}`, {
    method: "GET",
    jar: jar || null,
  });
}

export async function scoreSingles(
  baseUrl: string,
  matchId: string,
  jar: CookieJar,
  count: number,
  {
    runsPerBall = 1,
  }: {
    runsPerBall?: number | ((index: number) => number);
  } = {},
) {
  for (let index = 0; index < count; index += 1) {
    const runs = typeof runsPerBall === "function" ? runsPerBall(index) : runsPerBall;
    const result = await scoreBall(baseUrl, matchId, jar, {
      runs,
      actionId: createActionId(`score-${index}`),
    });
    if (result.response.status !== 200) {
      throw new Error(`Score request ${index} failed with ${result.response.status}`);
    }
  }
}

export async function seedMatchImages(matchId: string, count = 12) {
  readEnvFileIfNeeded();
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to seed match images.");
  }

    await mongoose.connect(process.env.MONGODB_URI);
  try {
    const match = await MatchModel.findById(matchId);
    if (!match) {
      throw new Error(`Match ${matchId} not found while seeding images.`);
    }

    const seededImages = Array.from({ length: count }, (_, index) =>
      createStoredMatchImageEntry({
        matchId,
        sourceUrl: `https://i.ibb.co/y0b8x2w/umpire-stress-${index + 1}.png`,
        publicId: `umpire-stress-${index + 1}`,
        uploadedAt: new Date(Date.now() - index * 60_000),
        uploadedBy: "stress-test",
        id: `stress-image-${index + 1}`,
      })
    );

    applyStoredMatchImages(match, seededImages, { matchId });
    match.mediaUpdatedAt = new Date();
    await Promise.all([
      match.save(),
      SessionModel.findByIdAndUpdate(match.sessionId, {
        $set: buildSessionMirrorUpdate(match),
      }, {
        timestamps: false,
      }),
    ]);
  } finally {
    await mongoose.disconnect();
  }
}

export async function uploadTinyImage(baseUrl: string, matchId: string, jar: CookieJar) {
  const file = new File(
    [Buffer.from(TINY_PNG_BASE64, "base64")],
    `umpire-stress-${Date.now()}.png`,
    { type: "image/png" },
  );
  const formData = new FormData();
  formData.append("image", file);

  return api(baseUrl, `/api/matches/${matchId}/image`, {
    method: "POST",
    body: formData,
    jar,
    useJson: false,
  });
}

export async function writeSmokeArtifact(fileName: string, payload: unknown) {
  const artifactPath = path.resolve(
    process.cwd(),
    "artifacts",
    "reports",
    "smoke",
    fileName,
  );
  await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.promises.writeFile(
    artifactPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  return artifactPath;
}
