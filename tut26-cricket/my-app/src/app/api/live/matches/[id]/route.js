import { connectDB } from "../../../../lib/db";
import { ensureLiveUpdates, subscribeToMatch } from "../../../../lib/live-updates";
import { buildSessionMirrorUpdate } from "../../../../lib/match-engine";
import { hydrateLegacyTossState } from "../../../../lib/match-toss";
import { serializePublicMatch } from "../../../../lib/public-data";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = ["iad1"];

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

export async function GET(request, { params }) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let cleanup = () => {};
      let heartbeat = null;
      let bootstrapCatchup = null;
      let closed = false;
      let didCleanup = false;
      let lastSerializedMatch = "";
      let bootstrapCatchupDone = false;
      let heartbeatLoop = async () => {};
      let bootstrapCatchupLoop = async () => {};

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
        if (bootstrapCatchup) {
          clearTimeout(bootstrapCatchup);
          bootstrapCatchup = null;
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

      const scheduleHeartbeat = (delay = 4000) => {
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

      const scheduleBootstrapCatchup = (delay = 1200) => {
        if (closed || bootstrapCatchupDone) {
          return;
        }
        if (bootstrapCatchup) {
          clearTimeout(bootstrapCatchup);
        }
        bootstrapCatchup = setTimeout(() => {
          void bootstrapCatchupLoop();
        }, delay);
      };

      try {
        await connectDB();

        const pushMatch = async () => {
          if (closed) {
            return;
          }
          const match = await Match.findById(id);
          const fallbackSession =
            match && match.sessionId
              ? await Session.findById(match.sessionId).select(
                  "tossWinner tossDecision teamAName teamBName teamA teamB"
                )
              : null;
          if (closed) {
            return;
          }

          if (match && hydrateLegacyTossState(match, fallbackSession)) {
            await match.save();
            await Session.findByIdAndUpdate(match.sessionId, {
              $set: buildSessionMirrorUpdate(match),
            });
          }

          const nextMatch = serializePublicMatch(match, fallbackSession);
          const nextPublicMatch = serializePublicMatch(match, fallbackSession, {
            includeActionHistory: true,
          });
          const nextSerializedMatch = JSON.stringify(nextPublicMatch);
          if (nextSerializedMatch === lastSerializedMatch) {
            return;
          }

          lastSerializedMatch = nextSerializedMatch;
          send("match", {
            match: nextPublicMatch,
            updatedAt: new Date().toISOString(),
            pad: "0".repeat(1024),
          });
        };

        heartbeatLoop = async () => {
          if (closed) {
            return;
          }

          try {
            if (!send("ping", { ok: true, ts: Date.now(), pad: "0".repeat(2048) })) {
              return;
            }
          } catch (error) {
            console.error("Match SSE heartbeat failed:", error);
            stopStream();
            return;
          }

          scheduleHeartbeat();
        };

      bootstrapCatchupLoop = async () => {
        if (closed || bootstrapCatchupDone) {
          return;
        }

        try {
          await pushMatch();
        } catch (error) {
          console.error("Match SSE bootstrap catchup failed:", error);
        }
        bootstrapCatchupDone = true;
      };

        await pushMatch();
        send("ping", {
          ok: true,
          ts: Date.now(),
          init: true,
          pad: "0".repeat(2048),
        });

        try {
          await ensureLiveUpdates();
          if (!closed) {
            cleanup = subscribeToMatch(id, async () => {
              try {
                await pushMatch();
              } catch (error) {
                console.error("Match SSE push failed:", error);
              }
            });
          }
        } catch (error) {
          console.error("Match change streams unavailable.", error);
        }

        scheduleHeartbeat();
        scheduleBootstrapCatchup();

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
