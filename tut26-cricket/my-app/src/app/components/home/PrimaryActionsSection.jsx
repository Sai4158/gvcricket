"use client";

import Link from "next/link";
import {
  FaArrowRight,
  FaBroadcastTower,
  FaChartLine,
} from "react-icons/fa";

export default function PrimaryActionsSection() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 text-center">
      <div className="max-w-2xl space-y-4">
        <div className="mx-auto inline-flex items-center rounded-full border border-amber-300/16 bg-amber-300/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-100">
          Match control
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          Start faster. Score cleaner.
        </h2>
        <p className="text-base leading-7 text-zinc-300 sm:text-lg">
          Run live cricket scoring, spectator updates, and result tracking from one simple flow.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <Link
          href="/session/new"
          className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(19,19,24,0.98),rgba(10,10,14,0.98))] p-5 text-left shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-white/16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.06),transparent_38%)] opacity-90" />
          <div className="relative z-10 flex h-full min-h-[132px] flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <h3 className="text-[25px] font-semibold tracking-tight text-white">
                Open umpire view
              </h3>
              <p className="max-w-[15rem] text-sm leading-5 text-zinc-300">
                Start a session and score the match live.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 text-sm font-medium text-zinc-100">
              <span>Start now</span>
              <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>

        <Link
          href="/session"
          className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(19,19,24,0.98),rgba(10,10,14,0.98))] p-5 text-left shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-white/16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_42%)] opacity-90" />
          <div className="pointer-events-none absolute right-4 top-5 text-white/[0.05]">
            <FaChartLine className="text-[58px]" />
          </div>
          <div className="relative z-10 flex h-full min-h-[132px] flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <h3 className="text-[25px] font-semibold tracking-tight text-white">
                View sessions
              </h3>
              <p className="max-w-[15rem] text-sm leading-5 text-zinc-300">
                Open live games, finished results, and match history.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 text-sm font-medium text-zinc-100">
              <span>Browse all</span>
              <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
      </div>

      <Link
        href="/director"
        className="group inline-flex w-full max-w-3xl items-center justify-between rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(20,20,24,0.96),rgba(9,9,12,0.96))] px-5 py-4 text-left shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-white/16"
      >
        <span className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-lg text-emerald-200 shadow-[0_10px_24px_rgba(16,185,129,0.12)]">
            <FaBroadcastTower />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">
              Director mode
            </span>
            <span className="mt-1 block text-sm text-zinc-400">
              Manage PA mic, music, effects, and umpire walkie from your phone.
            </span>
          </span>
        </span>
        <span className="text-emerald-200 transition-transform duration-300 group-hover:translate-x-1">
          <FaArrowRight />
        </span>
      </Link>
    </section>
  );
}
