"use client";

import { useRef, useState } from "react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { ModalBase } from "../match/MatchBaseModals";
import useLocalMicMonitor from "./useLocalMicMonitor";

export default function LiveMicModal({
  title = "Live Mic",
  onClose,
  monitor,
}) {
  const fallbackMonitor = useLocalMicMonitor();
  const {
    isActive,
    isStarting,
    error,
    start,
    stop,
  } = monitor ?? fallbackMonitor;
  const [isHolding, setIsHolding] = useState(false);
  const holdStartedRef = useRef(false);

  const statusLabel = isActive ? (isPaused ? "Paused" : "Live") : "Off";
  const handleToggle = () => {
    if (isStarting) {
      return;
    }

    if (isActive) {
      void stop({ resumeMedia: true });
      return;
    }

    void start({ pauseMedia: false });
  };

  const handleHoldStart = async () => {
    if (isStarting || isActive) {
      return;
    }

    holdStartedRef.current = true;
    setIsHolding(true);
    await start({ pauseMedia: true });
  };

  const handleHoldEnd = async () => {
    if (!holdStartedRef.current) {
      return;
    }

    holdStartedRef.current = false;
    setIsHolding(false);
    await stop({ resumeMedia: true });
  };

  return (
    <ModalBase title={title} onExit={onClose}>
      <div className="space-y-5 text-left">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isStarting}
          className={`w-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,16,0.98),rgba(6,6,10,0.98))] px-5 py-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.32)] transition-all ${
            isStarting ? "cursor-wait opacity-75" : "hover:border-white/20 hover:bg-[linear-gradient(180deg,rgba(14,14,20,0.98),rgba(8,8,12,0.98))]"
          }`}
          aria-label={isActive ? "Turn mic off" : "Turn mic on"}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className={`inline-flex h-24 w-24 items-center justify-center rounded-full text-3xl shadow-lg ${
                isActive
                  ? "bg-emerald-500 text-black shadow-[0_16px_40px_rgba(16,185,129,0.35)]"
                  : "bg-[linear-gradient(180deg,#facc15,#eab308)] text-black shadow-[0_16px_40px_rgba(250,204,21,0.28)]"
              }`}
            >
              {isActive ? <FaMicrophone /> : <FaMicrophoneSlash />}
            </div>
            <div className="space-y-1">
              <p className="text-[1.7rem] font-black leading-tight text-white">
                Phone mic to speaker
              </p>
              <p className="mx-auto max-w-xs text-sm leading-6 text-zinc-400">
                Tap on or hold to talk.
              </p>
            </div>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.32em] text-zinc-300">
              {isHolding ? "Holding" : isStarting ? "Starting" : statusLabel}
            </div>
          </div>
        </button>

        <div className="grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-4 text-sm text-zinc-300">
          <p>Connect speaker. Tap mic card to stay live.</p>
          <p>Hold below to talk over music.</p>
          <p className="text-amber-300">Keep some distance to avoid echo.</p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,12,0.96))] px-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onPointerDown={() => {
                void handleHoldStart();
              }}
              onPointerUp={() => {
                void handleHoldEnd();
              }}
              onPointerLeave={() => {
                void handleHoldEnd();
              }}
              onPointerCancel={() => {
                void handleHoldEnd();
              }}
              className={`inline-flex min-w-[220px] items-center justify-center gap-3 rounded-full px-6 py-3 text-sm font-semibold transition-all ${
                isHolding
                  ? "bg-emerald-500 text-black shadow-[0_14px_32px_rgba(16,185,129,0.25)]"
                  : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
              }`}
            >
              <FaMicrophone />
              {isHolding ? "Release to Stop" : "Hold to Talk"}
            </button>
            <p className="text-center text-xs text-zinc-500">
              Works best for audio playing in this browser tab.
            </p>
            <button
              onClick={onClose}
              className="text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
