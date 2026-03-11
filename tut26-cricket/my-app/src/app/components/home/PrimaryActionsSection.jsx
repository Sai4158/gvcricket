"use client";

import Link from "next/link";
import {
  FaArrowRight,
  FaBroadcastTower,
  FaChartLine,
  FaClipboardList,
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
          className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,20,26,0.98),rgba(8,8,12,0.98))] p-5 text-left shadow-[0_20px_48px_rgba(0,0,0,0.32)] transition duration-300 hover:-translate-y-1 hover:border-amber-200/16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.1),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.06),transparent_30%)] opacity-90" />
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" />
          <div className="pointer-events-none absolute -right-3 bottom-0 text-amber-200/[0.06] transition duration-300 group-hover:scale-105 group-hover:text-amber-200/[0.1]">
            <FaClipboardList className="text-[86px]" />
          </div>
          <div className="relative z-10 flex h-full min-h-[144px] flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/14 bg-amber-300/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100/90">
                Quick start
              </div>
              <h3 className="max-w-[14rem] text-[27px] font-semibold leading-[1.05] tracking-tight text-white">
                Open umpire view
              </h3>
              <p className="max-w-[16rem] text-sm leading-6 text-zinc-300/90">
                Start a session and score the match live.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                Umpire flow
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
                <span>Start now</span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] transition duration-300 group-hover:border-amber-200/20 group-hover:bg-white/[0.08]">
                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </span>
            </div>
          </div>
        </Link>

        <Link
          href="/session"
          className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,20,26,0.98),rgba(8,8,12,0.98))] p-5 text-left shadow-[0_20px_48px_rgba(0,0,0,0.32)] transition duration-300 hover:-translate-y-1 hover:border-sky-200/16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.1),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.05),transparent_30%)] opacity-90" />
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/35 to-transparent" />
          <div className="pointer-events-none absolute -right-2 bottom-1 text-sky-200/[0.07] transition duration-300 group-hover:scale-105 group-hover:text-sky-200/[0.11]">
            <FaChartLine className="text-[76px]" />
          </div>
          <div className="relative z-10 flex h-full min-h-[144px] flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/14 bg-sky-300/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-100/90">
                Browse
              </div>
              <h3 className="max-w-[14rem] text-[27px] font-semibold leading-[1.05] tracking-tight text-white">
                View sessions
              </h3>
              <p className="max-w-[16rem] text-sm leading-6 text-zinc-300/90">
                Open live games, finished results, and match history.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                Sessions
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
                <span>Browse all</span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] transition duration-300 group-hover:border-sky-200/20 group-hover:bg-white/[0.08]">
                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </span>
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
