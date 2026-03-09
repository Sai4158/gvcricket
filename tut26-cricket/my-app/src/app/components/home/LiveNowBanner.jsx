import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";

export default function LiveNowBanner({ liveMatch }) {
  if (!liveMatch) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-start px-4 pr-24 pt-6 md:justify-center md:px-6 md:pr-6 md:pt-8">
      <Link
        href={`/session/${liveMatch.sessionId}/view`}
        className="pointer-events-auto relative flex w-full max-w-[calc(100vw-7rem)] items-center justify-between gap-4 overflow-hidden rounded-[28px] border border-white/14 bg-[linear-gradient(145deg,rgba(10,14,18,0.58),rgba(16,20,26,0.38))] px-4 py-3.5 text-white shadow-[0_16px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl transition hover:border-emerald-300/30 hover:bg-[linear-gradient(145deg,rgba(10,14,18,0.66),rgba(16,20,26,0.46))] md:max-w-md"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_40%)]" />
        <div className="relative z-10 flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 shadow-[0_10px_28px_rgba(16,185,129,0.12)]">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/55" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
          </div>
          <div className="min-w-0 text-left">
            <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-emerald-300">
              Live Now
            </div>
            <div className="truncate text-[15px] font-semibold leading-tight text-white">
              {liveMatch.teamAName} vs {liveMatch.teamBName}
            </div>
            <div className="text-xs text-zinc-200/90">
              {liveMatch.score}/{liveMatch.outs} · View score now
            </div>
          </div>
        </div>
        <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <FaArrowRight className="h-4 w-4" />
        </div>
      </Link>
    </div>
  );
}
