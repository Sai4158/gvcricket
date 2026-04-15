/**
 * File overview:
 * Purpose: Renders the suspense loading state for the session index route.
 * Main exports: default export.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ./page.jsx
 */

import LiquidLoader from "../components/shared/LiquidLoader";

function SessionLoadingCard() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.06),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.06),transparent_28%),linear-gradient(180deg,rgba(14,14,18,0.98),rgba(8,8,12,0.98))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="h-4 w-28 rounded-full bg-white/10 pending-shimmer" />
            <div className="mt-4 h-7 w-3/4 rounded-full bg-white/14 pending-shimmer" />
            <div className="mt-3 h-5 w-1/2 rounded-full bg-white/10 pending-shimmer" />
            <div className="mt-3 h-4 w-40 rounded-full bg-white/8 pending-shimmer" />
          </div>
          <div className="shrink-0 text-right">
            <div className="h-10 w-18 rounded-full bg-amber-300/10 pending-shimmer" />
            <div className="mt-2 h-4 w-12 rounded-full bg-amber-300/8 pending-shimmer" />
          </div>
        </div>
        <div className="aspect-[16/8.8] rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] pending-shimmer" />
        <div className="h-12 rounded-2xl bg-white/8 pending-shimmer" />
      </div>
    </div>
  );
}

export default function SessionLoading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#06070a_0%,#090b11_42%,#050507_100%)] px-4 py-6 text-zinc-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_30%),linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.98))] px-6 py-8 shadow-[0_28px_80px_rgba(0,0,0,0.4)] sm:px-8 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="h-4 w-24 rounded-full bg-white/10 pending-shimmer" />
              <div className="mt-4 h-10 w-56 max-w-full rounded-full bg-white/14 pending-shimmer" />
              <div className="mt-3 h-5 w-80 max-w-full rounded-full bg-white/8 pending-shimmer" />
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
              <LiquidLoader size="sm" label="Loading sessions" />
              <span>Loading sessions...</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SessionLoadingCard key={`session-loading-card-${index}`} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
