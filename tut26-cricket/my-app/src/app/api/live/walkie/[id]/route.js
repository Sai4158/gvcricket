import { cookies } from "next/headers";
import { connectDB } from "../../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { createWalkieParticipantToken } from "../../../../lib/walkie-auth";
import {
  hydrateWalkieEnabled,
  registerWalkieParticipant,
  subscribeToWalkieMatch,
  subscribeToWalkieParticipant,
} from "../../../../lib/walkie-talkie";
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
  const { id } = await params;
  const role = request.nextUrl.searchParams.get("role") || "spectator";
  const participantId = request.nextUrl.searchParams.get("participantId") || "";
  const name = request.nextUrl.searchParams.get("name") || "";

  if (!/^[a-zA-Z0-9._:-]{8,80}$/.test(participantId)) {
    return new Response("Invalid participant id.", { status: 400 });
  }

  if (!["umpire", "spectator"].includes(role)) {
    return new Response("Invalid participant role.", { status: 400 });
  }

  await connectDB();
  const match = await Match.findById(id).select(
    "_id isOngoing result adminAccessVersion walkieTalkieEnabled"
  );

  if (!match) {
    return new Response("Match not found.", { status: 404 });
  }

  if (role === "umpire") {
    const cookieStore = await cookies();
    const token = cookieStore.get(getMatchAccessCookieName(id))?.value;
    const authorized = hasValidMatchAccess(
      id,
      token,
      Number(match.adminAccessVersion || 1)
    );
    if (!authorized) {
      return new Response("Umpire access required.", { status: 403 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let cleanupParticipant = () => {};
      let cleanupMatch = () => {};
      let cleanupPersonal = () => {};
      let heartbeat = null;

      const send = (event, data) => {
        controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };

      try {
        const initialSnapshot = hydrateWalkieEnabled(id, Boolean(match.walkieTalkieEnabled));
        const registration = registerWalkieParticipant(id, {
          id: participantId,
          role,
          name,
        });

        cleanupParticipant = registration.cleanup;
        send("state", {
          snapshot: registration.snapshot || initialSnapshot,
          token: createWalkieParticipantToken(id, participantId, role),
        });

        cleanupMatch = subscribeToWalkieMatch(id, (payload) => {
          send(payload.type === "signal" ? "signal" : "state", payload);
        });

        cleanupPersonal = subscribeToWalkieParticipant(id, participantId, (payload) => {
          send(payload.type === "signal" ? "signal" : "participant", payload);
        });

        heartbeat = setInterval(() => {
          send("ping", { ok: true, ts: Date.now() });
        }, 15000);

        request.signal.addEventListener("abort", () => {
          cleanupPersonal();
          cleanupMatch();
          cleanupParticipant();
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        });
      } catch {
        cleanupPersonal();
        cleanupMatch();
        cleanupParticipant();
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
