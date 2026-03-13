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

function IosSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-8 w-[54px] items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-amber-300/35 ${
        checked
          ? "border-amber-300/35 bg-emerald-500 shadow-[0_10px_24px_rgba(16,185,129,0.22)]"
          : "border-white/10 bg-white/[0.08]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-[26px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export default function LiveMicModal({
  title = "Live Mic",
  onClose,
  monitor,
}) {
  const fallbackMonitor = useLocalMicMonitor();
  const { isActive, isStarting, error, start, stop } = monitor ?? fallbackMonitor;

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
          <div className="flex items-center gap-3">
            <IosSwitch
              checked={isActive}
              disabled={isStarting}
              onChange={() => handleToggle()}
              label={isActive ? "Turn loudspeaker off" : "Turn loudspeaker on"}
            />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300/35"
              aria-label="Close live commentary"
            >
              <span className="text-xl leading-none">&times;</span>
            </button>
          </div>
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
                Loudspeaker
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
