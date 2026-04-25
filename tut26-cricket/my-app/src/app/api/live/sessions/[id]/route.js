/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: runtime, dynamic, maxDuration, preferredRegion.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: none.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { connectDB } from "../../../../lib/db";
import {
  ensureLiveUpdates,
  subscribeToMatch,
  subscribeToSession,
} from "../../../../lib/live-updates";
import {
  serializeSessionViewBootstrap,
  serializeSessionViewSession,
} from "../../../../lib/public-data";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = ["iad1"];

const STREAM_HEARTBEAT_INTERVAL_MS = 15_000;
const LIVE_SESSION_SNAPSHOT_CACHE_TTL_MS = 1_000;
const STREAM_BOOTSTRAP_PAD = "0".repeat(64);
const LIVE_SESSION_FIELDS =
  "_id name match teamAName teamBName updatedAt";
const LIVE_MATCH_FIELDS =
  "_id teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result pendingResult pendingResultAt resultAutoFinalizeAt innings1.team innings1.score innings2.team innings2.score balls matchImageUrl liveStream announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled walkieTalkieEnabled mediaUpdatedAt lastLiveEvent lastEventText lastEventType updatedAt";
const globalSessionSnapshotCache =
  globalThis.__gvLiveSessionSnapshotCache || new Map();

if (!globalThis.__gvLiveSessionSnapshotCache) {
  globalThis.__gvLiveSessionSnapshotCache = globalSessionSnapshotCache;
}

function pruneSessionSnapshotCache(now = Date.now()) {
  if (globalSessionSnapshotCache.size < 100) {
    return;
  }

  for (const [key, entry] of globalSessionSnapshotCache.entries()) {
    if (!entry?.pending && Number(entry?.expiresAt || 0) <= now) {
      globalSessionSnapshotCache.delete(key);
    }
  }
}

function getSessionSnapshotCacheEntry(sessionId) {
  pruneSessionSnapshotCache();
  const key = String(sessionId || "");
  if (!globalSessionSnapshotCache.has(key)) {
    globalSessionSnapshotCache.set(key, {
      value: null,
      expiresAt: 0,
      pending: null,
    });
  }

  return globalSessionSnapshotCache.get(key);
}

async function resolveLatestMatch(session) {
  if (!session) {
    return null;
  }

  if (session.match) {
    const linkedMatch = await Match.findById(session.match)
      .select(LIVE_MATCH_FIELDS)
      .lean();
    if (linkedMatch) {
      return linkedMatch;
    }
  }

  return Match.findOne({ sessionId: session._id })
    .select(LIVE_MATCH_FIELDS)
    .sort({ updatedAt: -1 })
    .lean();
}

async function readLiveSessionSnapshot(sessionId) {
  const session = await Session.findById(sessionId)
    .select(LIVE_SESSION_FIELDS)
    .lean();
  const match = await resolveLatestMatch(session);
  const payload = {
    session: serializeSessionViewSession(session),
    match: serializeSessionViewBootstrap(match, session),
  };

  return {
    payload,
    serialized: JSON.stringify(payload),
    matchId: match?._id ? String(match._id) : "",
    updatedAt: getLatestIsoTimestamp(match?.updatedAt, session?.updatedAt),
  };
}

async function getCachedLiveSessionSnapshot(sessionId, { force = false } = {}) {
  const cacheEntry = getSessionSnapshotCacheEntry(sessionId);
  const now = Date.now();

  if (!force && cacheEntry.value && cacheEntry.expiresAt > now) {
    return cacheEntry.value;
  }

  if (cacheEntry.pending) {
    return cacheEntry.pending;
  }

  cacheEntry.pending = readLiveSessionSnapshot(sessionId)
    .then((value) => {
      cacheEntry.value = value;
      cacheEntry.expiresAt = Date.now() + LIVE_SESSION_SNAPSHOT_CACHE_TTL_MS;
      return value;
    })
    .finally(() => {
      cacheEntry.pending = null;
    });

  return cacheEntry.pending;
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Content-Encoding": "none",
  };
}

function encodeEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getLatestIsoTimestamp(...values) {
  let latest = 0;

  for (const value of values) {
    const timestamp =
      value instanceof Date
        ? value.getTime()
        : typeof value === "number"
          ? value
          : Date.parse(String(value || ""));
    if (Number.isFinite(timestamp) && timestamp > latest) {
      latest = timestamp;
    }
  }

  return new Date(latest || Date.now()).toISOString();
}

export async function GET(request, { params }) {
  const { id } = await params;
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  let cleanupSession = () => {};
  let cleanupMatch = () => {};
  let heartbeat = null;
  let currentMatchId = "";
  let closed = false;
  let didCleanup = false;
  let lastSerializedPayload = "";
  let pushPending = false;
  let pushPendingForce = false;
  let pushLoopPromise = null;

  const finalize = () => {
    if (didCleanup) {
      return;
    }
    didCleanup = true;
    cleanupSession();
    cleanupMatch();
    cleanupSession = () => {};
    cleanupMatch = () => {};
    if (heartbeat) {
      clearTimeout(heartbeat);
      heartbeat = null;
    }
  };

  const send = async (event, data) => {
    if (closed) {
      return false;
    }

    try {
      await writer.ready;
      await writer.write(encoder.encode(encodeEvent(event, data)));
      return true;
    } catch (error) {
      closed = true;
      finalize();
      if (error?.code !== "ERR_INVALID_STATE") {
        console.error("Session SSE enqueue failed:", error);
      }
      return false;
    }
  };

  const stopStream = async () => {
    if (closed) {
      return;
    }
    closed = true;
    finalize();
    try {
      await writer.close();
    } catch {
      // Ignore close races.
    }
  };

  const scheduleHeartbeat = (delay = STREAM_HEARTBEAT_INTERVAL_MS) => {
    if (closed) {
      return;
    }
    if (heartbeat) {
      clearTimeout(heartbeat);
    }
    heartbeat = setTimeout(() => {
      void heartbeatLoop();
    }, delay);
  };

  const pushSessionPayload = async ({ force = false } = {}) => {
    if (closed) {
      return null;
    }
    const {
      payload,
      serialized: nextSerializedPayload,
      matchId: nextMatchId,
      updatedAt: nextUpdatedAt,
    } = await getCachedLiveSessionSnapshot(id, { force });
    if (closed) {
      return null;
    }

    if (nextMatchId !== currentMatchId) {
      cleanupMatch();
      currentMatchId = nextMatchId;

      if (currentMatchId) {
        cleanupMatch = subscribeToMatch(currentMatchId, async () => {
          try {
            await requestSessionPush({ force: true });
          } catch (error) {
            console.error("Session SSE match push failed:", error);
          }
        });
      }
    }

    if (nextSerializedPayload === lastSerializedPayload) {
      return payload;
    }

    lastSerializedPayload = nextSerializedPayload;

    if (
      !(await send("session", {
        ...payload,
        updatedAt: nextUpdatedAt,
      }))
    ) {
      return null;
    }

    return payload;
  };

  const requestSessionPush = async ({ force = false } = {}) => {
    pushPending = true;
    pushPendingForce = pushPendingForce || force;

    if (pushLoopPromise) {
      return pushLoopPromise;
    }

    pushLoopPromise = (async () => {
      while (!closed && pushPending) {
        const nextForce = pushPendingForce;
        pushPending = false;
        pushPendingForce = false;
        await pushSessionPayload({ force: nextForce });
      }
    })().finally(() => {
      pushLoopPromise = null;
    });

    return pushLoopPromise;
  };

  const heartbeatLoop = async () => {
    if (closed) {
      return;
    }

    try {
      if (!(await send("ping", { ok: true, ts: Date.now() }))) {
        return;
      }
    } catch (error) {
      console.error("Session SSE heartbeat failed:", error);
      await stopStream();
      return;
    }

    scheduleHeartbeat();
  };

  void (async () => {
    try {
      await connectDB();

      cleanupSession = subscribeToSession(id, async () => {
        try {
          await requestSessionPush({ force: true });
        } catch (error) {
          console.error("Session SSE session push failed:", error);
        }
      });

      await requestSessionPush();
      await send("ping", {
        ok: true,
        ts: Date.now(),
        init: true,
        pad: STREAM_BOOTSTRAP_PAD,
      });

      scheduleHeartbeat();
      void ensureLiveUpdates().catch((error) => {
        console.error("Session change streams unavailable.", error);
      });
    } catch (error) {
      await send("error", { message: "Live updates are temporarily unavailable." });
      await stopStream();
    }
  })();

  request.signal.addEventListener("abort", () => {
    void stopStream();
  });

  return new Response(readable, { headers: sseHeaders() });
}


