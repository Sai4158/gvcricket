import { motion } from "framer-motion";
import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";
import SafeMatchImage from "../shared/SafeMatchImage";

export default function LiveNowBanner({ liveMatch }) {
  if (!liveMatch) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -28, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 24,
        mass: 0.8,
        delay: 0.08,
      }}
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-start px-4 pr-20 pt-5 md:justify-center md:px-6 md:pr-6 md:pt-7"
    >
      <Link
        href={`/session/${liveMatch.sessionId}/view`}
        prefetch={false}
        className="liquid-glass pointer-events-auto flex w-full max-w-[calc(100vw-5rem)] items-center justify-between gap-3 rounded-[26px] px-3.5 py-2.5 text-white shadow-[0_18px_34px_rgba(0,0,0,0.2)] transition hover:border-white/28 md:max-w-md md:gap-4 md:px-4 md:py-3"
      >
        <div className="absolute inset-0 rounded-[26px] bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.1),transparent_40%)]" />
        <div className="relative z-10 flex min-w-0 items-center gap-2.5 md:gap-3">
          <div className="relative h-[3.35rem] w-[3.35rem] shrink-0 overflow-hidden rounded-[18px] md:h-[4rem] md:w-[4rem]">
            <SafeMatchImage
              src={liveMatch.matchImageUrl || ""}
              alt={`${liveMatch.teamAName} vs ${liveMatch.teamBName}`}
              fill
              sizes="64px"
              className="object-cover"
              fallbackClassName="object-contain p-0 opacity-100 scale-[1.38] md:scale-[1.46]"
            />
          </div>
          <div className="min-w-0 text-left">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300 md:text-[11px] md:tracking-[0.34em]">
              Live Now
            </div>
            <div className="truncate text-[14px] font-semibold leading-tight text-white md:text-[15px]">
              {liveMatch.teamAName} vs {liveMatch.teamBName}
            </div>
            <div className="text-[11px] text-white/74 md:text-xs">
              {liveMatch.score}/{liveMatch.outs} - View score now
            </div>
          </div>
        </div>
        <div className="liquid-pill relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-white md:h-12 md:w-12">
          <FaArrowRight className="h-4 w-4" />
        </div>
      </Link>
    </motion.div>
  );
}
