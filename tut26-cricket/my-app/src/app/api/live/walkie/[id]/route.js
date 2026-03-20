import { cookies } from "next/headers";
import { connectDB } from "../../../../lib/db";
import {
  getDirectorAccessCookieName,
  hasValidDirectorAccess,
} from "../../../../lib/director-access";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { createWalkieParticipantToken } from "../../../../lib/walkie-auth";
import {
  ensureWalkieLiveUpdates,
  subscribeToWalkieMessages,
  subscribeToWalkieState,
} from "../../../../lib/walkie-live-updates";
import {
  clearPersistentWalkieMessages,
  getPersistentWalkieSnapshot,
  registerPersistentWalkieParticipant,
  heartbeatPersistentWalkieParticipant,
  takePersistentWalkieMessages,
} from "../../../../lib/walkie-store";
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
    "X-Accel-Buffering": "no",
    "Content-Encoding": "none",
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

  if (!["umpire", "spectator", "director"].includes(role)) {
    return new Response("Invalid participant role.", { status: 400 });
  }

  await connectDB();
  const match = await Match.findById(id).select(
    "_id isOngoing result adminAccessVersion"
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

  if (role === "director") {
    const cookieStore = await cookies();
    const token = cookieStore.get(getDirectorAccessCookieName())?.value;
    const authorized = hasValidDirectorAccess(token);
    if (!authorized) {
      return new Response("Director access required.", { status: 403 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let heartbeat = null;
      let pollTimer = null;
      let closed = false;
      let lastVersion = -1;
      let lastNotificationId = "";
      let cleanupState = () => {};
      let cleanupMessages = () => {};
      let hasChangeStreamUpdates = false;
      let didCleanup = false;
      let pendingStateReplays = 0;

      const finalize = () => {
        if (didCleanup) {
          return;
        }
        didCleanup = true;
        cleanupState();
        cleanupMessages();
        cleanupState = () => {};
        cleanupMessages = () => {};
        void clearPersistentWalkieMessages(id, participantId).catch(() => {});
        if (heartbeat) {
          clearTimeout(heartbeat);
          heartbeat = null;
        }
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
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
            console.error("Walkie SSE enqueue failed:", error);
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
          // Ignore double-close races.
        }
      };

      const scheduleHeartbeat = (delay) => {
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

      const schedulePoll = (delay = 800) => {
        if (closed || hasChangeStreamUpdates) {
          return;
        }
        if (pollTimer) {
          clearTimeout(pollTimer);
        }
        pollTimer = setTimeout(() => {
          void pollLoop();
        }, delay);
      };

      const pushState = async (force = false) => {
        if (closed) {
          return;
        }

        const current = await getPersistentWalkieSnapshot(id);
        if (closed) {
          return;
        }
        const version = Number(current.snapshot?.version || 0);
        const notificationId = current.notification?.id || "";
        if (force || version !== lastVersion || notificationId !== lastNotificationId) {
          const sent = send("state", {
            snapshot: current.snapshot,
            ...(current.notification ? { notification: current.notification } : {}),
          });
          if (!sent) {
            return;
          }
          lastVersion = version;
          lastNotificationId = notificationId;
        }
      };

      const drainMessages = async () => {
        if (closed) {
          return;
        }

        const messages = await takePersistentWalkieMessages(id, participantId);
        if (closed) {
          return;
        }
        for (const message of messages) {
          const sent = send(
            message.eventType === "signal" ? "signal" : "participant",
            message.payload
          );
          if (!sent) {
            return;
          }
        }
      };

      const heartbeatLoop = async () => {
        if (closed) {
          return;
        }

        try {
          const current = await heartbeatPersistentWalkieParticipant(id, participantId, role, name);
          if (closed) {
            return;
          }
          if (!hasChangeStreamUpdates) {
            await drainMessages();
            await pushState();
            if (closed) {
              return;
            }
          }
          if (pendingStateReplays > 0) {
            const sentState = send("state", {
              snapshot: current.snapshot,
              ...(current.notification ? { notification: current.notification } : {}),
            });
            if (!sentState) {
              return;
            }
            pendingStateReplays -= 1;
            lastVersion = Number(current.snapshot?.version || 0);
            lastNotificationId = current.notification?.id || "";
          }
          if (!send("ping", { ok: true, ts: Date.now() })) {
            return;
          }
        } catch (error) {
          console.error("Walkie SSE heartbeat failed:", error);
          stopStream();
          return;
        }

        heartbeat = setTimeout(() => {
          void heartbeatLoop();
        }, 5000);
      };

      const pollLoop = async () => {
        if (closed || hasChangeStreamUpdates) {
          return;
        }

        try {
          await drainMessages();
          await pushState();
        } catch (error) {
          console.error("Walkie SSE fallback poll failed:", error);
        }

        schedulePoll();
      };

      try {
        await connectDB();
        const registration = await registerPersistentWalkieParticipant(id, {
          id: participantId,
          role,
          name,
        });
        if (
          !send("state", {
          snapshot: registration.snapshot,
          ...(registration.notification ? { notification: registration.notification } : {}),
          token: createWalkieParticipantToken(id, participantId, role),
          })
        ) {
          return;
        }
        send("ping", {
          ok: true,
          ts: Date.now(),
          init: true,
          pad: "0".repeat(2048),
        });
        lastVersion = Number(registration.snapshot?.version || 0);
        lastNotificationId = registration.notification?.id || "";
        pendingStateReplays = 2;

        void drainMessages().catch((error) => {
          console.error("Walkie initial message drain failed:", error);
          stopStream();
        });

        void (async () => {
          try {
            await ensureWalkieLiveUpdates();
            if (closed) {
              return;
            }
            hasChangeStreamUpdates = true;
            cleanupState = subscribeToWalkieState(id, () => {
              void pushState().catch((error) => {
                console.error("Walkie state push failed:", error);
                stopStream();
              });
            });
            cleanupMessages = subscribeToWalkieMessages(id, participantId, () => {
              void drainMessages().catch((error) => {
                console.error("Walkie message drain failed:", error);
                stopStream();
              });
            });
            scheduleHeartbeat(3000);
          } catch (error) {
            console.error("Walkie change streams unavailable.", error);
            hasChangeStreamUpdates = false;
            schedulePoll(500);
          }
        })();

        scheduleHeartbeat(3000);

        request.signal.addEventListener("abort", () => {
          stopStream();
        });
      } catch (error) {
        console.error("Walkie SSE setup failed:", error);
        stopStream();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
