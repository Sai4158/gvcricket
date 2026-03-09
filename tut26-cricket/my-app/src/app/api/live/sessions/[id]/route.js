import { connectDB } from "../../../../lib/db";
import { ensureLiveUpdates, subscribeToMatch, subscribeToSession } from "../../../../lib/live-updates";
import { serializePublicMatch, serializePublicSession } from "../../../../lib/public-data";
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
      let cleanupSession = () => {};
      let cleanupMatch = () => {};
      let heartbeat = null;
      let currentMatchId = "";

      const send = (event, data) => {
        controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };

      try {
        await connectDB();
        await ensureLiveUpdates();

        const resolveLatestMatch = async (session) => {
          if (!session) {
            return null;
          }

          if (session.match) {
            const linkedMatch = await Match.findById(session.match).lean();
            if (linkedMatch) {
              return linkedMatch;
            }
          }

          return Match.findOne({ sessionId: session._id }).sort({ updatedAt: -1 }).lean();
        };

        const pushSessionPayload = async () => {
          const session = await Session.findById(id).lean();
          const match = await resolveLatestMatch(session);
          const nextMatchId = match?._id ? String(match._id) : "";

          if (nextMatchId !== currentMatchId) {
            cleanupMatch();
            currentMatchId = nextMatchId;

            if (currentMatchId) {
              cleanupMatch = subscribeToMatch(currentMatchId, async () => {
                await pushSessionPayload();
              });
            }
          }

          send("session", {
            session: serializePublicSession(session),
            match: serializePublicMatch(match),
            updatedAt: new Date().toISOString(),
          });
          return { session, match };
        };

        await pushSessionPayload();
        cleanupSession = subscribeToSession(id, async () => {
          await pushSessionPayload();
        });

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
        send("error", { message: "Live updates are temporarily unavailable." });
        if (heartbeat) clearInterval(heartbeat);
        cleanupSession();
        cleanupMatch();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
