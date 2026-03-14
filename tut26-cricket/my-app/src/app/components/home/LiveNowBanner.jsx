import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";
import SafeMatchImage from "../shared/SafeMatchImage";

export default function LiveNowBanner({ liveMatch }) {
  if (!liveMatch) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-start px-4 pr-24 pt-6 md:justify-center md:px-6 md:pr-6 md:pt-8">
      <Link
        href={`/session/${liveMatch.sessionId}/view`}
        prefetch={false}
        className="liquid-glass pointer-events-auto flex w-full max-w-[calc(100vw-7rem)] items-center justify-between gap-4 rounded-[28px] px-4 py-3.5 text-white transition hover:border-white/28 md:max-w-md"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_40%)]" />
        <div className="relative z-10 flex min-w-0 items-center gap-3">
          <div className="liquid-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/14 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
              <SafeMatchImage
                src={liveMatch.matchImageUrl || ""}
                alt={`${liveMatch.teamAName} vs ${liveMatch.teamBName}`}
                fill
                sizes="40px"
                className="object-cover"
                fallbackClassName="object-contain p-1.5 opacity-[0.95]"
              />
            </div>
          </div>
          <div className="min-w-0 text-left">
            <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-emerald-300">
              Live Now
            </div>
            <div className="truncate text-[15px] font-semibold leading-tight text-white">
              {liveMatch.teamAName} vs {liveMatch.teamBName}
            </div>
            <div className="text-xs text-white/74">
              {liveMatch.score}/{liveMatch.outs} · View score now
            </div>
          </div>
        </div>
        <div className="liquid-pill relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white">
          <FaArrowRight className="h-4 w-4" />
        </div>
      </Link>
    </div>
  );
}
