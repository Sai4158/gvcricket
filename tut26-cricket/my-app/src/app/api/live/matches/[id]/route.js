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
      let closed = false;
      let didCleanup = false;

      const finalize = () => {
        if (didCleanup) {
          return;
        }
        didCleanup = true;
        cleanup();
        cleanup = () => {};
        if (heartbeat) {
          clearInterval(heartbeat);
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

      try {
        await connectDB();
        await ensureLiveUpdates();

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

          send("match", {
            match: serializePublicMatch(match, fallbackSession),
            updatedAt: new Date().toISOString(),
          });
        };

        await pushMatch();

        cleanup = subscribeToMatch(id, async () => {
          await pushMatch();
        });

        heartbeat = setInterval(() => {
          send("ping", { ok: true, ts: Date.now() });
        }, 15000);

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
