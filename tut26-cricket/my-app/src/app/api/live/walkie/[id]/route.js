import { cookies } from "next/headers";
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
import { getCachedWalkieMatch } from "../../../../lib/walkie-match-cache";
import { sanitizePlainText } from "../../../../lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = ["iad1"];

const WALKIE_HEARTBEAT_INTERVAL_MS = 8000;
const WALKIE_HEARTBEAT_START_DELAY_MS = 4000;
const WALKIE_BOOT_PAD = ".".repeat(8192);
const WALKIE_PING_PAD = ".".repeat(1024);

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

function readCookieValue(request, name) {
  const rawCookie = String(request.headers.get("cookie") || "");
  if (!rawCookie || !name) {
    return "";
  }

  for (const part of rawCookie.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (String(rawKey || "").trim() !== name) {
      continue;
    }
    return rest.join("=").trim();
  }

  return "";
}

export async function GET(request, { params }) {
  const { id } = await params;
  const role = request.nextUrl.searchParams.get("role") || "spectator";
  const participantId = request.nextUrl.searchParams.get("participantId") || "";
  const name = sanitizePlainText(request.nextUrl.searchParams.get("name") || "").slice(0, 48);
  const participantToken = createWalkieParticipantToken(id, participantId, role);

  if (!/^[a-zA-Z0-9._:-]{8,80}$/.test(participantId)) {
    return new Response("Invalid participant id.", { status: 400 });
  }

  if (!["umpire", "spectator", "director"].includes(role)) {
    return new Response("Invalid participant role.", { status: 400 });
  }

  const match = await getCachedWalkieMatch(id);

  if (!match) {
    return new Response("Match not found.", { status: 404 });
  }

  if (role === "umpire") {
    const cookieName = getMatchAccessCookieName(id);
    const rawToken = readCookieValue(request, cookieName);
    const cookieStore = await cookies();
    const token = rawToken || cookieStore.get(cookieName)?.value;
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
    const cookieName = getDirectorAccessCookieName();
    const rawToken = readCookieValue(request, cookieName);
    const cookieStore = await cookies();
    const token = rawToken || cookieStore.get(cookieName)?.value;
    const authorized = hasValidDirectorAccess(token);
    if (!authorized) {
      return new Response("Director access required.", { status: 403 });
    }
  }

  const encoder = new TextEncoder();
  const bootstrapSnapshot = {
    enabled: false,
    spectatorCount: 0,
    umpireCount: 0,
    directorCount: 0,
    busy: false,
    activeSpeakerRole: "",
    activeSpeakerId: "",
    activeSpeakerName: "",
    lockStartedAt: "",
    expiresAt: "",
    transmissionId: "",
    pendingRequests: [],
    updatedAt: new Date().toISOString(),
    version: 0,
  };
  let stopStream = () => {};
  const stream = new ReadableStream({
    async start(controller) {
    let heartbeat = null;
    let closed = false;
    let lastVersion = -1;
    let lastNotificationId = "";
    let cleanupState = () => {};
    let cleanupMessages = () => {};
    let didCleanup = false;
    let pendingStateReplays = 0;
    let startupReplayTimers = [];

    const buildStatePayload = (snapshot, notification, extra = {}) => ({
      snapshot,
      ...(notification ? { notification } : {}),
      ...extra,
    });

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
      if (startupReplayTimers.length) {
        for (const timerId of startupReplayTimers) {
          clearTimeout(timerId);
        }
        startupReplayTimers = [];
      }
    };

    const send = async (event, data) => {
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

    stopStream = () => {
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
        const sent = await send(
          "state",
          buildStatePayload(current.snapshot, current.notification, {
            token: participantToken,
          })
        );
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
        const sent = await send(
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
        await drainMessages();
        const heartbeatStatePayload = buildStatePayload(
          current.snapshot,
          current.notification,
          {
            token: participantToken,
          }
        );
        if (!(await send("state", heartbeatStatePayload))) {
          return;
        }
        lastVersion = Number(current.snapshot?.version || 0);
        lastNotificationId = current.notification?.id || "";
        if (pendingStateReplays > 0) {
          const sentState = await send("state", heartbeatStatePayload);
          if (!sentState) {
            return;
          }
          pendingStateReplays -= 1;
        }
        if (!(await send("ping", { ok: true, ts: Date.now() }))) {
          return;
        }
      } catch (error) {
        console.error("Walkie SSE heartbeat failed:", error);
        stopStream();
        return;
      }

      heartbeat = setTimeout(() => {
        void heartbeatLoop();
      }, WALKIE_HEARTBEAT_INTERVAL_MS);
    };

    const scheduleStartupReplay = (delay, payload) => {
      const timerId = setTimeout(() => {
        if (closed) {
          return;
        }
        void (async () => {
          if (!(await send("state", payload))) {
            return;
          }
          await send("ping", {
            ok: true,
            ts: Date.now(),
            replay: true,
            pad: WALKIE_PING_PAD,
          });
        })();
      }, delay);
      startupReplayTimers.push(timerId);
    };

    try {
      const bootstrapStatePayload = buildStatePayload(bootstrapSnapshot, null, {
        token: participantToken,
        bootstrap: true,
      });
      if (!(await send("state", bootstrapStatePayload))) {
        return;
      }
      await send("ping", {
        ok: true,
        ts: Date.now(),
        bootstrap: true,
        pad: WALKIE_BOOT_PAD,
      });

      const registration = await registerPersistentWalkieParticipant(id, {
        id: participantId,
        role,
        name,
      });
      const initialStatePayload = buildStatePayload(
        registration.snapshot,
        registration.notification,
        {
          token: participantToken,
        }
      );
      if (!(await send("state", initialStatePayload))) {
        return;
      }
      await send("ping", {
        ok: true,
        ts: Date.now(),
        init: true,
        pad: WALKIE_PING_PAD,
      });
      lastVersion = Number(registration.snapshot?.version || 0);
      lastNotificationId = registration.notification?.id || "";
      pendingStateReplays = 2;
      scheduleStartupReplay(400, initialStatePayload);
      scheduleStartupReplay(1400, initialStatePayload);

      void drainMessages().catch((error) => {
        console.error("Walkie initial message drain failed:", error);
        void stopStream();
      });

      cleanupState = subscribeToWalkieState(id, () => {
        void pushState().catch((error) => {
          console.error("Walkie state push failed:", error);
          void stopStream();
        });
      });
      cleanupMessages = subscribeToWalkieMessages(id, participantId, () => {
        void drainMessages().catch((error) => {
          console.error("Walkie message drain failed:", error);
          void stopStream();
        });
      });

      void (async () => {
        try {
          await ensureWalkieLiveUpdates();
          if (closed) {
            return;
          }
          await drainMessages();
          await pushState();
          if (closed) {
            return;
          }
          scheduleHeartbeat(WALKIE_HEARTBEAT_START_DELAY_MS);
        } catch (error) {
          console.error("Walkie change streams unavailable.", error);
        }
      })();

      scheduleHeartbeat(WALKIE_HEARTBEAT_START_DELAY_MS);
    } catch (error) {
      console.error("Walkie SSE setup failed:", error);
      stopStream();
    }
    },
  });

  request.signal.addEventListener(
    "abort",
    () => {
      stopStream();
    },
    { once: true }
  );
  return new Response(stream, { headers: sseHeaders() });
}
