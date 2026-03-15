import { connectDB } from "../../../../lib/db";
import {
  ensureLiveUpdates,
  subscribeToMatch,
  subscribeToSession,
} from "../../../../lib/live-updates";
import {
  serializePublicMatch,
  serializePublicSession,
} from "../../../../lib/public-data";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = ["iad1"];

const SESSION_PAD = "0".repeat(4096);
const PING_PAD = "0".repeat(4096);

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
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  let cleanupSession = () => {};
  let cleanupMatch = () => {};
  let heartbeat = null;
  let catchup = null;
  let currentMatchId = "";
  let closed = false;
  let didCleanup = false;
  let lastSerializedPayload = "";
  let catchupDone = false;

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
    if (catchup) {
      clearTimeout(catchup);
      catchup = null;
    }
  };

  const send = async (event, data) => {
    if (closed) {
      return false;
    }

    try {
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

  const scheduleCatchup = (delay = 1200) => {
    if (closed || catchupDone) {
      return;
    }
    if (catchup) {
      clearTimeout(catchup);
    }
    catchup = setTimeout(() => {
      void catchupLoop();
    }, delay);
  };

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
    if (closed) {
      return null;
    }
    const session = await Session.findById(id).lean();
    const match = await resolveLatestMatch(session);
    if (closed) {
      return null;
    }
    const nextMatchId = match?._id ? String(match._id) : "";

    if (nextMatchId !== currentMatchId) {
      cleanupMatch();
      currentMatchId = nextMatchId;

      if (currentMatchId) {
        cleanupMatch = subscribeToMatch(currentMatchId, async () => {
          try {
            await pushSessionPayload();
          } catch (error) {
            console.error("Session SSE match push failed:", error);
          }
        });
      }
    }

    const payload = {
      session: serializePublicSession(session),
      match: serializePublicMatch(match, session),
    };
    const nextSerializedPayload = JSON.stringify(payload);

    if (nextSerializedPayload === lastSerializedPayload) {
      return { session, match };
    }

    lastSerializedPayload = nextSerializedPayload;

    if (
      !(await send("session", {
        ...payload,
        updatedAt: new Date().toISOString(),
        pad: SESSION_PAD,
      }))
    ) {
      return null;
    }

    return { session, match };
  };

  const heartbeatLoop = async () => {
    if (closed) {
      return;
    }

    try {
      if (!(await send("ping", { ok: true, ts: Date.now(), pad: PING_PAD }))) {
        return;
      }
    } catch (error) {
      console.error("Session SSE heartbeat failed:", error);
      await stopStream();
      return;
    }

    scheduleHeartbeat();
  };

  const catchupLoop = async () => {
    if (closed || catchupDone) {
      return;
    }

    try {
      await pushSessionPayload();
    } catch (error) {
      console.error("Session SSE catchup failed:", error);
    }
    catchupDone = true;
  };

  void (async () => {
    try {
      await connectDB();
      await pushSessionPayload();
      await send("ping", {
        ok: true,
        ts: Date.now(),
        init: true,
        pad: PING_PAD,
      });

      try {
        await ensureLiveUpdates();
        if (!closed) {
          cleanupSession = subscribeToSession(id, async () => {
            try {
              await pushSessionPayload();
            } catch (error) {
              console.error("Session SSE session push failed:", error);
            }
          });
        }
      } catch (error) {
        console.error("Session change streams unavailable.", error);
      }

      scheduleHeartbeat();
      scheduleCatchup();
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
