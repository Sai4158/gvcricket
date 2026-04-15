/**
 * File overview:
 * Purpose: Renders the suspense loading state for the public session spectator route.
 * Main exports: default export.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ./page.jsx
 */

import LiquidLoader from "../../../components/shared/LiquidLoader";

function ScoreShell() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,14,0.96))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className="h-4 w-24 rounded-full bg-white/10 pending-shimmer" />
      <div className="mt-4 h-10 w-28 rounded-full bg-white/14 pending-shimmer" />
      <div className="mt-3 h-4 w-20 rounded-full bg-white/8 pending-shimmer" />
      <div className="mt-6 h-24 rounded-[22px] bg-white/[0.04] pending-shimmer" />
    </div>
  );
}

function LauncherShell() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)]">
      <div className="h-4 w-24 rounded-full bg-white/10 pending-shimmer" />
      <div className="mt-4 h-10 w-full rounded-2xl bg-white/12 pending-shimmer" />
      <div className="mt-3 h-4 w-2/3 rounded-full bg-white/8 pending-shimmer" />
    </div>
  );
}

export default function SessionViewLoading() {
  return (
    <main
      id="top"
      className="min-h-screen bg-zinc-950 p-4 pb-10 text-white font-sans flex flex-col items-center"
    >
      <div className="w-full max-w-4xl space-y-5">
        <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_30%),linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.36)]">
          <div className="flex items-center justify-between gap-4">
            <div className="h-10 w-32 rounded-full bg-white/[0.05] pending-shimmer" />
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
              <LiquidLoader size="sm" label="Loading live score" />
              <span>Loading live score...</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="h-4 w-28 rounded-full bg-white/10 pending-shimmer" />
            <div className="mt-4 h-10 w-64 max-w-full rounded-full bg-white/14 pending-shimmer" />
            <div className="mt-3 h-4 w-40 rounded-full bg-white/8 pending-shimmer" />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ScoreShell />
            <ScoreShell />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <LauncherShell />
          <LauncherShell />
          <LauncherShell />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,14,0.96))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="h-5 w-32 rounded-full bg-white/12 pending-shimmer" />
            <div className="mt-5 h-72 rounded-[24px] bg-white/[0.04] pending-shimmer" />
          </div>
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,14,0.96))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="h-5 w-32 rounded-full bg-white/12 pending-shimmer" />
            <div className="mt-5 h-72 rounded-[24px] bg-white/[0.04] pending-shimmer" />
          </div>
        </div>
      </div>
    </main>
  );
}
