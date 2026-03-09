import { connectDB } from "../../../../lib/db";
import { ensureLiveUpdates, subscribeToMatch, subscribeToSession } from "../../../../lib/live-updates";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let cleanupSession = () => {};
      let cleanupMatch = () => {};
      let heartbeat = null;

      const send = (event, data) => {
        controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };

      try {
        await connectDB();
        await ensureLiveUpdates();

        const pushSessionPayload = async () => {
          const session = await Session.findById(params.id).lean();
          const match = session?.match ? await Match.findById(session.match).lean() : null;
          send("session", {
            session,
            match,
            updatedAt: new Date().toISOString(),
          });
          return { session, match };
        };

        const initial = await pushSessionPayload();
        cleanupSession = subscribeToSession(params.id, async () => {
          await pushSessionPayload();
        });

        if (initial.match?._id) {
          cleanupMatch = subscribeToMatch(String(initial.match._id), async () => {
            await pushSessionPayload();
          });
        }

        heartbeat = setInterval(() => {
          send("ping", { ok: true, ts: Date.now() });
        }, 15000);

        request.signal.addEventListener("abort", () => {
          cleanupSession();
          cleanupMatch();
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        });
      } catch (error) {
        send("error", { message: error.message });
        if (heartbeat) clearInterval(heartbeat);
        cleanupSession();
        cleanupMatch();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
