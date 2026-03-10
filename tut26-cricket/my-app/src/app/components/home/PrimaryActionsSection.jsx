"use client";

import Link from "next/link";
import { FaArrowRight, FaBroadcastTower } from "react-icons/fa";

export default function PrimaryActionsSection() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 text-center">
      <div className="max-w-2xl space-y-4">
        <div className="mx-auto inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-200">
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
          className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(26,26,30,0.96),rgba(10,10,12,0.96))] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-amber-300/30"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_42%)] opacity-90" />
          <div className="relative z-10 flex h-full min-h-[156px] flex-col justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-[28px] font-semibold tracking-tight text-white">
                Open umpire view
              </h3>
              <p className="max-w-xs text-sm leading-6 text-zinc-300">
                Start a session, score every ball, and run the match live.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 text-sm font-medium text-amber-200">
              <span>Start now</span>
              <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>

        <Link
          href="/session"
          className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(26,26,30,0.96),rgba(10,10,12,0.96))] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-sky-300/30"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_44%)] opacity-90" />
          <div className="relative z-10 flex h-full min-h-[156px] flex-col justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-[28px] font-semibold tracking-tight text-white">
                View sessions
              </h3>
              <p className="max-w-xs text-sm leading-6 text-zinc-300">
                Jump into live games or open finished results and match history.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 text-sm font-medium text-sky-200">
              <span>Browse all</span>
              <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
      </div>

      <Link
        href="/director"
        className="group inline-flex w-full max-w-3xl items-center justify-between rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(20,20,24,0.96),rgba(9,9,12,0.96))] px-5 py-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/25"
      >
        <span className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/14 text-lg text-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.14)]">
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
