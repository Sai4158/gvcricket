/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: runtime, dynamic, maxDuration, preferredRegion.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: none.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { connectDB } from "../../../../lib/db";
import { ensureLiveUpdates, subscribeToMatch } from "../../../../lib/live-updates";
import { serializePublicMatch, serializeUmpireBootstrap } from "../../../../lib/public-data";
import { finalizePendingResultIfExpired } from "../../../../lib/pending-match-result";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = ["iad1"];

const STREAM_HEARTBEAT_INTERVAL_MS = 15_000;
const LIVE_MATCH_SNAPSHOT_CACHE_TTL_MS = 1_000;
const STREAM_BOOTSTRAP_PAD = "0".repeat(64);
const LIVE_MATCH_FIELDS =
  "_id teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result pendingResult pendingResultAt resultAutoFinalizeAt innings1 innings2 balls activeOverBalls activeOverNumber legalBallCount firstInningsLegalBallCount secondInningsLegalBallCount matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy announcer announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled walkieTalkieEnabled mediaUpdatedAt lastLiveEvent lastEventType lastEventText recentActionIds undoCount createdAt updatedAt actionHistory processedActionIds";
const READ_ONLY_LIVE_MATCH_FIELDS =
  "_id teamA teamB teamAName teamBName overs sessionId tossWinner tossDecision score outs isOngoing innings result pendingResult pendingResultAt resultAutoFinalizeAt innings1 innings2 balls activeOverBalls activeOverNumber legalBallCount firstInningsLegalBallCount secondInningsLegalBallCount matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy announcer announcerEnabled announcerMode announcerScoreSoundEffectsEnabled announcerBroadcastScoreSoundEffectsEnabled walkieTalkieEnabled mediaUpdatedAt lastLiveEvent lastEventType lastEventText recentActionIds undoCount createdAt updatedAt";
const FALLBACK_SESSION_FIELDS =
  "tossWinner tossDecision teamAName teamBName teamA teamB matchImages matchImageUrl matchImagePublicId matchImageStorageUrlEnc matchImageStorageUrlHash matchImageUploadedAt matchImageUploadedBy updatedAt";
const globalMatchSnapshotCache =
  globalThis.__gvLiveMatchSnapshotCache || new Map();

if (!globalThis.__gvLiveMatchSnapshotCache) {
  globalThis.__gvLiveMatchSnapshotCache = globalMatchSnapshotCache;
}

function pruneMatchSnapshotCache(now = Date.now()) {
  if (globalMatchSnapshotCache.size < 100) {
    return;
  }

  for (const [key, entry] of globalMatchSnapshotCache.entries()) {
    if (!entry?.pending && Number(entry?.expiresAt || 0) <= now) {
      globalMatchSnapshotCache.delete(key);
    }
  }
}

function getMatchSnapshotCacheEntry(matchId, includeActionHistory) {
  pruneMatchSnapshotCache();
  const key = `${String(matchId || "")}:${includeActionHistory ? "full" : "readonly"}`;
  if (!globalMatchSnapshotCache.has(key)) {
    globalMatchSnapshotCache.set(key, {
      value: null,
      expiresAt: 0,
      pending: null,
    });
  }

  return globalMatchSnapshotCache.get(key);
}

async function readLiveMatchSnapshot(matchId, { includeActionHistory = true } = {}) {
  const match = await Match.findById(matchId)
    .select(includeActionHistory ? LIVE_MATCH_FIELDS : READ_ONLY_LIVE_MATCH_FIELDS);
  const finalizedMatch = await finalizePendingResultIfExpired(match);
  const fallbackSession =
    finalizedMatch?.sessionId
      ? await Session.findById(finalizedMatch.sessionId)
          .select(FALLBACK_SESSION_FIELDS)
          .lean()
      : null;
  const publicMatch = includeActionHistory
    ? serializePublicMatch(finalizedMatch, fallbackSession, {
        includeActionHistory,
      })
    : serializeUmpireBootstrap(finalizedMatch, fallbackSession);

  return {
    publicMatch,
    serialized: JSON.stringify(publicMatch),
    updatedAt: getMatchIsoTimestamp(publicMatch),
  };
}

async function getCachedLiveMatchSnapshot(
  matchId,
  { force = false, includeActionHistory = true } = {}
) {
  const cacheEntry = getMatchSnapshotCacheEntry(matchId, includeActionHistory);
  const now = Date.now();

  if (!force && cacheEntry.value && cacheEntry.expiresAt > now) {
    return cacheEntry.value;
  }

  if (cacheEntry.pending) {
    return cacheEntry.pending;
  }

  cacheEntry.pending = readLiveMatchSnapshot(matchId, { includeActionHistory })
    .then((value) => {
      cacheEntry.value = value;
      cacheEntry.expiresAt = Date.now() + LIVE_MATCH_SNAPSHOT_CACHE_TTL_MS;
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

function getMatchIsoTimestamp(match) {
  return new Date(match?.updatedAt || Date.now()).toISOString();
}

export async function GET(request, { params }) {
  const { id } = await params;
  const includeActionHistory =
    request.nextUrl.searchParams.get("history") === "1";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let cleanup = () => {};
      let heartbeat = null;
      let closed = false;
      let didCleanup = false;
      let lastSerializedMatch = "";
      let heartbeatLoop = async () => {};
      let pushLoop = async () => {};
      let pushPending = false;
      let pushPendingForce = false;
      let pushLoopPromise = null;

      const finalize = () => {
        if (didCleanup) {
          return;
        }
        didCleanup = true;
        cleanup();
        cleanup = () => {};
        if (heartbeat) {
          clearTimeout(heartbeat);
          heartbeat = null;
        }
      };

      const send = (event, data) => {
        if (closed) {
          return false;
        }

        try {
          controller.enqueue(encoder.encode(encodeEvent(event, data)));
          return true;
        } catch (error) {
          closed = true;
          finalize();
          if (error?.code !== "ERR_INVALID_STATE") {
            console.error("Match SSE enqueue failed:", error);
          }
          return false;
        }
      };

      const stopStream = () => {
        if (closed) {
          return;
        }
        closed = true;
        finalize();
        try {
          controller.close();
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

      try {
        await connectDB();

        const pushMatch = async ({ force = false } = {}) => {
          if (closed) {
            return;
          }
          const {
            publicMatch: nextPublicMatch,
            serialized: nextSerializedMatch,
            updatedAt: nextUpdatedAt,
          } = await getCachedLiveMatchSnapshot(id, {
            force,
            includeActionHistory,
          });
          if (closed) {
            return;
          }
          if (nextSerializedMatch === lastSerializedMatch) {
            return;
          }

          lastSerializedMatch = nextSerializedMatch;
          send("match", {
            match: nextPublicMatch,
            updatedAt: nextUpdatedAt,
          });
        };

        pushLoop = async ({ force = false } = {}) => {
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
              await pushMatch({ force: nextForce });
            }
          })().finally(() => {
            pushLoopPromise = null;
          });

          return pushLoopPromise;
        };

        heartbeatLoop = async () => {
          if (closed) {
            return;
          }

          try {
            if (!send("ping", { ok: true, ts: Date.now() })) {
              return;
            }
          } catch (error) {
            console.error("Match SSE heartbeat failed:", error);
            stopStream();
            return;
          }

          scheduleHeartbeat();
        };

        cleanup = subscribeToMatch(id, async () => {
          try {
            await pushLoop({ force: true });
          } catch (error) {
            console.error("Match SSE push failed:", error);
          }
        });

        await pushLoop();
        send("ping", {
          ok: true,
          ts: Date.now(),
          init: true,
          pad: STREAM_BOOTSTRAP_PAD,
        });

        scheduleHeartbeat();
        void ensureLiveUpdates().catch((error) => {
          console.error("Match change streams unavailable.", error);
        });

        request.signal.addEventListener("abort", () => {
          stopStream();
        });
      } catch (error) {
        send("error", { message: "Live updates are temporarily unavailable." });
        stopStream();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}


