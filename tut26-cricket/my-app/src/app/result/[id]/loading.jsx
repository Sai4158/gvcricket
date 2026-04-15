/**
 * File overview:
 * Purpose: Renders the suspense loading state for the result route.
 * Main exports: default export.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ./page.jsx
 */

import LiquidLoader from "../../components/shared/LiquidLoader";

function StatShell() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
      <div className="mx-auto h-3 w-20 rounded-full bg-white/10 pending-shimmer" />
      <div className="mx-auto mt-3 h-10 w-24 rounded-full bg-white/14 pending-shimmer" />
    </div>
  );
}

function SectionShell({ tall = false }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.98))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="h-6 w-40 rounded-full bg-white/12 pending-shimmer" />
      <div className={`mt-5 rounded-[22px] bg-white/[0.04] pending-shimmer ${tall ? "h-80" : "h-52"}`} />
    </section>
  );
}

export default function ResultLoading() {
  return (
    <main id="top" className="min-h-screen bg-zinc-950 p-4 text-zinc-300 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-12 py-10">
        <div className="h-11 w-40 rounded-full border border-white/10 bg-white/[0.04] pending-shimmer" />

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.98))] shadow-[0_28px_80px_rgba(0,0,0,0.4)]">
          <div className="px-5 py-7 sm:px-8 sm:py-8">
            <div className="flex justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
                <LiquidLoader size="sm" label="Loading result" />
                <span>Loading result...</span>
              </div>
            </div>

            <header className="mt-6 text-center space-y-4">
              <div className="mx-auto h-3 w-28 rounded-full bg-amber-300/12 pending-shimmer" />
              <div className="mx-auto h-12 w-64 max-w-full rounded-full bg-white/14 pending-shimmer" />
              <div className="mx-auto h-4 w-48 rounded-full bg-white/8 pending-shimmer" />
            </header>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div className="rounded-[28px] border border-white/10 bg-black/30 p-6">
                <div className="h-7 w-2/3 rounded-full bg-white/12 pending-shimmer" />
                <div className="mt-4 h-5 w-1/2 rounded-full bg-white/8 pending-shimmer" />
                <div className="mt-6 h-40 rounded-[22px] bg-white/[0.04] pending-shimmer" />
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/35 p-5 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.32)]">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <StatShell />
                  <StatShell />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="mx-auto h-4 w-40 rounded-full bg-white/10 pending-shimmer" />
                  <div className="mx-auto h-4 w-32 rounded-full bg-white/8 pending-shimmer" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionShell />
        <SectionShell tall />
        <SectionShell tall />
        <SectionShell />
      </div>
    </main>
  );
}
