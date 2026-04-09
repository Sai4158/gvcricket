"use client";

/**
 * File overview:
 * Purpose: Renders Live UI for the app's screens and flows.
 * Main exports: LiveMicModal.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import {
  FaBluetoothB,
  FaMicrophone,
  FaMobileAlt,
  FaVolumeUp,
} from "react-icons/fa";
import { useCallback, useRef, useState } from "react";
import { ModalBase } from "../match/MatchBaseModals";
import ModalGradientTitle from "../shared/ModalGradientTitle";
import useLocalMicMonitor from "./useLocalMicMonitor";

export default function LiveMicModal({
  title = "Live Mic",
  onClose,
  monitor,
}) {
  const fallbackMonitor = useLocalMicMonitor();
  const {
    isActive,
    isPaused,
    isStarting,
    error,
    start,
    stop,
    pause = async () => true,
    resume = async () => true,
    prepare = async () => true,
  } = monitor ?? fallbackMonitor;
  const holdRequestedRef = useRef(false);
  const [holdPressed, setHoldPressed] = useState(false);
  const isLive = isActive && !isPaused;
  const isReady = isActive && isPaused;
  const statusLabel = isStarting
    ? "STARTING"
    : isLive
      ? "LIVE"
      : "TAP TO HOLD";
  const helperText = isStarting
    ? "Starting microphone. Please wait a moment."
    : isLive
      ? "Release to stop commentary."
      : isReady
        ? "Mic is ready. Press and hold the loudspeaker icon to talk."
        : "Press and hold the loudspeaker icon to talk live.";

  const handleClose = useCallback(async () => {
    holdRequestedRef.current = false;
    setHoldPressed(false);

    if (isActive || isPaused || isStarting) {
      await stop({ resumeMedia: true });
    }

    onClose?.();
  }, [isActive, isPaused, isStarting, onClose, stop]);

  const beginHold = useCallback(async () => {
    if (isStarting) {
      return;
    }

    holdRequestedRef.current = true;
    setHoldPressed(true);

    if (isPaused) {
      const resumed = await resume({ pauseMedia: true });
      if (resumed && !holdRequestedRef.current) {
        await pause({ resumeMedia: true });
      }
      return;
    }

    if (isActive) {
      return;
    }

    const prepared = await prepare({ requestPermission: true });
    if (!prepared || !holdRequestedRef.current) {
      holdRequestedRef.current = false;
      setHoldPressed(false);
      return;
    }

    const started = await start({
      pauseMedia: true,
      startPaused: false,
      playStartCue: false,
    });

    if (started && !holdRequestedRef.current) {
      await pause({ resumeMedia: true });
    }
  }, [isActive, isPaused, isStarting, pause, prepare, resume, start]);

  const endHold = useCallback(async () => {
    holdRequestedRef.current = false;
    setHoldPressed(false);

    if (!isActive || isPaused) {
      return;
    }

    await pause({ resumeMedia: true });
  }, [isActive, isPaused, pause]);

  return (
    <ModalBase title="" onExit={handleClose} hideHeader>
      <div className="space-y-4 text-left">
        <div className="flex items-center justify-between gap-4">
          <ModalGradientTitle
            as="h2"
            text={title}
            className="text-[1.7rem]"
          />
          <button
            type="button"
            onClick={() => {
              void handleClose();
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300/35"
            aria-label="Close live commentary"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,16,22,0.98),rgba(7,7,11,0.98))] px-5 py-6 text-center shadow-[0_22px_70px_rgba(0,0,0,0.4)]">
          <button
            type="button"
            disabled={isStarting}
            onPointerDown={() => {
              void beginHold();
            }}
            onPointerUp={() => {
              void endHold();
            }}
            onPointerLeave={() => {
              void endHold();
            }}
            onPointerCancel={() => {
              void endHold();
            }}
            onKeyDown={(event) => {
              if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                event.preventDefault();
                void beginHold();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                void endHold();
              }
            }}
            className="mx-auto flex w-full flex-col items-center gap-4 focus:outline-none"
            aria-label={isLive ? "Release to stop commentary" : "Press and hold the loudspeaker icon to talk"}
          >
            <div className="relative flex justify-center">
              <span
                className={`absolute inset-[-14px] rounded-full blur-2xl transition-opacity ${
                  isLive || holdPressed
                    ? "bg-amber-300/20 opacity-100"
                    : "bg-amber-300/10 opacity-60"
                }`}
              />
              <span
                className={`absolute inset-[-6px] rounded-full border transition-opacity ${
                  isLive || holdPressed
                    ? "border-amber-200/25 opacity-100"
                    : "border-transparent opacity-0"
                }`}
              />
              <span
                className={`relative inline-flex h-28 w-28 items-center justify-center rounded-full text-4xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all ${
                  isLive || holdPressed
                    ? "bg-[linear-gradient(135deg,#34d399,#14b8a6)] text-black"
                    : "bg-[linear-gradient(180deg,#facc15,#eab308)] text-black"
                }`}
              >
                {isLive || holdPressed ? <FaMicrophone /> : <FaVolumeUp />}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-2xl font-black tracking-[-0.03em] text-white">
                Loudspeaker
              </p>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-300">
                {statusLabel}
              </span>
              <p className="text-sm text-zinc-400">{helperText}</p>
            </div>
          </button>
        </section>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center justify-center gap-3 text-zinc-300">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-base">
              <FaMobileAlt />
            </span>
            <span className="text-zinc-500">
              <FaBluetoothB />
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-base">
              <FaVolumeUp />
            </span>
          </div>
          <p className="mt-2 text-center text-sm text-zinc-400">
            Connect phone to Bluetooth speaker to use phone as a mic.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

      </div>
    </ModalBase>
  );
}


