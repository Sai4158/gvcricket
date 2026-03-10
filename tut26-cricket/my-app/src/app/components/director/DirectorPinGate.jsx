"use client";

import { FaBroadcastTower, FaLock } from "react-icons/fa";
import PinPad from "../shared/PinPad";

export default function DirectorPinGate({
  pin,
  onPinChange,
  onSubmit,
  isSubmitting = false,
  error = "",
}) {
  return (
    <section className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(8,8,12,0.98))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-center justify-between">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/12 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <FaBroadcastTower className="text-xl" />
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-300">
            <FaLock className="text-[11px]" />
            Secure
          </span>
        </div>

        <div className="space-y-3 text-white">
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">
            Director Console
          </h1>
          <p className="text-sm leading-6 text-zinc-400">
            Enter the director PIN to manage live audio, music, effects, and walkie control.
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <PinPad
            value={pin}
            onChange={onPinChange}
            onSubmit={onSubmit}
            submitLabel="Enter Director Mode"
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </section>
  );
}
