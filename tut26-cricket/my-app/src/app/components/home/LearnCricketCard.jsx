import Image from "next/image";
import { FaArrowUpRightFromSquare, FaCircleDot, FaGripLinesVertical } from "react-icons/fa6";
import { GiCricketBat } from "react-icons/gi";

export default function LearnCricketCard() {
  return (
    <section className="w-full max-w-5xl mx-auto">
      <a
        href="https://usacricket.org/what-is-cricket/"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,14,0.94))] px-6 py-6 shadow-[0_28px_70px_rgba(0,0,0,0.42)] transition-transform duration-300 hover:-translate-y-1 md:px-8 md:py-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_80%_100%,rgba(245,158,11,0.08),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <GiCricketBat className="absolute -right-2 top-5 text-[5.5rem] text-amber-200/8 blur-[1px] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105" />
          <FaGripLinesVertical className="absolute -left-1 bottom-10 text-[4.6rem] text-cyan-100/8 blur-[1px] transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
          <FaCircleDot className="absolute right-24 bottom-6 text-[2.8rem] text-rose-100/10 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
        </div>

        <div className="relative z-10 grid items-center gap-6 md:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-4 text-left">
            <span className="liquid-pill inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-100/90">
              Learn Cricket
            </span>
            <div className="space-y-3">
              <h3 className="max-w-xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Want to learn more about cricket?
              </h3>
              <p className="max-w-xl text-sm leading-7 text-zinc-200/86 md:text-base">
                Learn the basics of batting, bowling, wickets, overs, and scoring
                from the official USA Cricket guide.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="liquid-pill inline-flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-white">
                Open guide
                <span className="liquid-icon flex h-9 w-9 items-center justify-center rounded-full text-sm text-white">
                  <FaArrowUpRightFromSquare />
                </span>
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,28,0.86),rgba(10,10,16,0.92))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,rgba(22,22,30,0.94),rgba(8,8,12,0.96))]">
                <FaCircleDot className="absolute right-6 top-6 text-[4.2rem] text-rose-200/16 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-105" />
                <GiCricketBat className="absolute left-6 bottom-5 text-[4.2rem] text-amber-200/14 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src="/gvLogo.png"
                    alt="GV Cricket logo"
                    width={220}
                    height={220}
                    sizes="220px"
                    className="h-auto w-[210px] object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.42)] transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/6" />
              </div>
            </div>
          </div>
        </div>
      </a>
    </section>
  );
}
