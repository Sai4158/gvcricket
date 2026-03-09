"use client";

import {
  FaBluetoothB,
  FaMicrophone,
  FaMicrophoneSlash,
  FaMobileAlt,
  FaVolumeUp,
} from "react-icons/fa";
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

  const statusLabel = isStarting ? "READY" : isActive ? "LIVE" : "OFF";
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

  return (
    <ModalBase title="" onExit={onClose} hideHeader>
      <div className="space-y-4 text-left">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[1.7rem] font-black tracking-[-0.03em] text-white">
            Live Commentary
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300/35"
            aria-label="Close live commentary"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,16,22,0.98),rgba(7,7,11,0.98))] px-5 py-6 text-center shadow-[0_22px_70px_rgba(0,0,0,0.4)]">
          <button
            type="button"
            onClick={handleToggle}
            disabled={isStarting}
            className="mx-auto flex w-full flex-col items-center gap-4 focus:outline-none"
            aria-label={isActive ? "Turn live commentary off" : "Turn live commentary on"}
          >
            <div className="relative flex justify-center">
              <span
                className={`absolute inset-[-14px] rounded-full blur-2xl transition-opacity ${
                  isActive
                    ? "bg-amber-300/20 opacity-100"
                    : "bg-amber-300/10 opacity-60"
                }`}
              />
              <span
                className={`absolute inset-[-6px] rounded-full border transition-opacity ${
                  isActive
                    ? "border-amber-200/25 opacity-100"
                    : "border-transparent opacity-0"
                }`}
              />
              <span
                className={`relative inline-flex h-28 w-28 items-center justify-center rounded-full text-4xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all ${
                  isActive
                    ? "bg-[linear-gradient(135deg,#34d399,#14b8a6)] text-black"
                    : "bg-[linear-gradient(180deg,#facc15,#eab308)] text-black"
                }`}
              >
                {isActive ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-2xl font-black tracking-[-0.03em] text-white">
                Tap to Talk
              </p>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-300">
                {statusLabel}
              </span>
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
            Phone to Bluetooth speaker.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Mode
            </span>
            <select
              className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none transition focus:border-amber-300/30 focus:ring-2 focus:ring-amber-300/20"
              aria-label="Live commentary mode"
              defaultValue="default"
            >
              <option value="default">Live Voice</option>
            </select>
          </label>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Status
            </span>
            <div className="flex h-[50px] items-center rounded-2xl border border-white/8 bg-white/[0.04] px-4 text-sm text-zinc-300">
              {isHolding ? "Speaking" : isActive ? "Ready" : "Off"}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.98))] px-4 pb-4 pt-5">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleToggle}
              className={`inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-base font-black transition-all focus:outline-none focus:ring-2 focus:ring-amber-300/35 ${
                isActive
                  ? "bg-[linear-gradient(135deg,#34d399,#14b8a6)] text-black shadow-[0_18px_40px_rgba(20,184,166,0.25)]"
                  : "bg-[linear-gradient(135deg,#fde047,#f59e0b)] text-black shadow-[0_18px_40px_rgba(245,158,11,0.22)] hover:-translate-y-0.5"
              }`}
              aria-label={isActive ? "Stop live commentary" : "Start live commentary"}
            >
              <FaMicrophone />
              {isActive ? "Talk off" : "Tap to Talk"}
            </button>

            <button
              type="button"
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
