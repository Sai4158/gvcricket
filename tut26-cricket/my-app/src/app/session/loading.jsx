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
    <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,9,12,0.98),rgba(3,3,5,1))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.36)]">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="h-4 w-28 rounded-full bg-white/8 pending-shimmer" />
            <div className="mt-4 h-7 w-3/4 rounded-full bg-white/12 pending-shimmer" />
            <div className="mt-3 h-5 w-1/2 rounded-full bg-white/10 pending-shimmer" />
            <div className="mt-3 h-4 w-40 rounded-full bg-white/6 pending-shimmer" />
          </div>
          <div className="shrink-0 text-right">
            <div className="h-10 w-18 rounded-full bg-white/8 pending-shimmer" />
            <div className="mt-2 h-4 w-12 rounded-full bg-white/6 pending-shimmer" />
          </div>
        </div>
        <div className="aspect-[16/8.8] rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,22,1),rgba(7,7,10,1))] pending-shimmer" />
        <div className="h-12 rounded-2xl bg-white/6 pending-shimmer" />
      </div>
    </div>
  );
}

export default function SessionLoading() {
  return (
    <main className="min-h-screen bg-black px-4 pb-10 pt-6 text-zinc-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1680px]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="h-11 w-24 rounded-full border border-white/10 bg-white/[0.04] pending-shimmer" />
          <div className="h-11 w-36 rounded-full border border-white/10 bg-white/[0.04] pending-shimmer" />
        </div>

        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,14,20,0.98),rgba(3,3,5,1))] px-5 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="h-12 w-80 max-w-[72vw] rounded-full bg-white/12 pending-shimmer" />
              <div className="mt-4 h-5 w-36 rounded-full bg-white/7 pending-shimmer" />
            </div>
            <div className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.04] pending-shimmer" />
          </div>

          <div className="mt-6 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,16,20,0.9),rgba(6,6,8,1))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-3">
              <div className="h-12 flex-1 rounded-2xl border border-white/8 bg-white/[0.04] pending-shimmer" />
              <div className="h-12 w-12 rounded-2xl border border-white/8 bg-white/[0.04] pending-shimmer" />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <div className="h-9 w-14 rounded-full border border-white/8 bg-white/[0.05] pending-shimmer" />
                <div className="h-9 w-14 rounded-full border border-white/8 bg-white/[0.05] pending-shimmer" />
                <div className="h-9 w-24 rounded-full border border-white/8 bg-white/[0.05] pending-shimmer" />
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                <LiquidLoader size="sm" label="Loading sessions" />
                <span>Loading sessions...</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
              <SessionLoadingCard key={`session-loading-card-${index}`} />
          ))}
        </div>
      </div>
    </main>
  );
}
