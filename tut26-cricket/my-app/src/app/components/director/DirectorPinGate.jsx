"use client";

import Link from "next/link";
import { useState } from "react";
import { FaArrowLeft, FaBroadcastTower, FaInfoCircle } from "react-icons/fa";

export default function DirectorPinGate({
  pin,
  onPinChange,
  onSubmit,
  isSubmitting = false,
  error = "",
}) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <section className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(8,8,12,0.98))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 transition hover:bg-white/[0.1]"
              aria-label="Back to home"
            >
              <FaArrowLeft />
            </Link>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/12 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <FaBroadcastTower className="text-xl" />
            </span>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setShowHelp((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 transition hover:bg-white/[0.1]"
              aria-label="How director mode works"
            >
              <FaInfoCircle />
            </button>
          </div>
        </div>

        <div className="space-y-3 text-white">
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">
            Director Console
          </h1>
          <p className="text-sm leading-6 text-zinc-400">
            Enter the 4-digit PIN to manage this session.
          </p>
        </div>

        {showHelp ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-zinc-300">
            Enter the 4-digit PIN to open the console. Then choose a live session, use the PA mic, play music and sound effects, and request walkie-talkie with the umpire.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="director-pin-input"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
            >
              Director PIN
            </label>
            <input
              id="director-pin-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={pin}
              onChange={(event) =>
                onPinChange?.(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmit?.();
                }
              }}
              placeholder="0000"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-emerald-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(16,185,129,0.08)]"
            />
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || pin.length !== 4}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#22c55e_58%,#34d399_100%)] px-5 py-3.5 font-bold text-black shadow-[0_16px_36px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Checking..." : "Enter Director Mode"}
          </button>
        </div>
      </div>
    </section>
  );
}
