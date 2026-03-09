import { connectDB } from "../../../../lib/db";
import { ensureLiveUpdates, subscribeToMatch } from "../../../../lib/live-updates";
import { serializePublicMatch } from "../../../../lib/public-data";
import Match from "../../../../../models/Match";

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

      const send = (event, data) => {
        controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };

      try {
        await connectDB();
        await ensureLiveUpdates();

        const pushMatch = async () => {
          const match = await Match.findById(id).lean();
          send("match", {
            match: serializePublicMatch(match),
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
          cleanup();
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        });
      } catch (error) {
        send("error", { message: "Live updates are temporarily unavailable." });
        if (heartbeat) clearInterval(heartbeat);
        cleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
