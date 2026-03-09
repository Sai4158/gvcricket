import { connectDB } from "../../../../lib/db";
import { ensureLiveUpdates, subscribeToMatch } from "../../../../lib/live-updates";
import Match from "../../../../../models/Match";

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
      let cleanup = () => {};
      let heartbeat = null;

      const send = (event, data) => {
        controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };

      try {
        await connectDB();
        await ensureLiveUpdates();

        const pushMatch = async () => {
          const match = await Match.findById(params.id).lean();
          send("match", {
            match,
            updatedAt: new Date().toISOString(),
          });
        };

        await pushMatch();

        cleanup = subscribeToMatch(params.id, async () => {
          await pushMatch();
        });

        heartbeat = setInterval(() => {
          send("ping", { ok: true, ts: Date.now() });
        }, 15000);

        request.signal.addEventListener("abort", () => {
          cleanup();
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        });
      } catch (error) {
        send("error", { message: error.message });
        if (heartbeat) clearInterval(heartbeat);
        cleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
