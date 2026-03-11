import Image from "next/image";
import { FaArrowUpRightFromSquare, FaGripLinesVertical } from "react-icons/fa6";
import { GiCricket, GiCricketBat } from "react-icons/gi";

export default function LearnCricketCard() {
  return (
    <section className="w-full max-w-5xl mx-auto">
      <a
        href="https://usacricket.org/what-is-cricket/"
        target="_blank"
        rel="noopener noreferrer"
        className="liquid-glass group relative block overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(20,20,26,0.82),rgba(10,10,16,0.74))] px-6 py-6 shadow-[0_28px_70px_rgba(0,0,0,0.34)] transition-transform duration-300 hover:-translate-y-1 md:px-8 md:py-8"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <GiCricketBat className="absolute -right-2 top-5 text-[5.5rem] text-amber-200/10 blur-[1px] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105" />
          <FaGripLinesVertical className="absolute -left-1 bottom-10 text-[4.6rem] text-cyan-100/10 blur-[1px] transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
          <GiCricket className="absolute right-24 bottom-5 text-[3.3rem] text-rose-100/10 blur-[1px] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
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
            <div className="liquid-glass-soft relative overflow-hidden rounded-[28px] p-3">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[22px]">
                <Image
                  src="/Thumb1.png"
                  alt="Cricket player batting in a match"
                  fill
                  sizes="(max-width: 768px) 100vw, 420px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-white/10" />
              </div>
            </div>
          </div>
        </div>
      </a>
    </section>
  );
}
