"use client";

/**
 * File overview:
 * Purpose: Renders Home UI for the app's screens and flows.
 * Main exports: LearnCricketCard.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  FaArrowUpRightFromSquare,
  FaGripLinesVertical,
} from "react-icons/fa6";
import { FaCircleDot } from "react-icons/fa6";
import { GiCricketBat } from "react-icons/gi";
import LiquidSportText from "./LiquidSportText";
import useHomeDesktopLiteMotion from "./useHomeDesktopLiteMotion";
import useHomeDesktopReveal from "./useHomeDesktopReveal";

function LearnStepCard({ title, copy, index, useDesktopLiteMotion, shouldReduceMotion }) {
  const stepReveal = useHomeDesktopReveal(!useDesktopLiteMotion && !shouldReduceMotion, {
    threshold: 0.08,
    rootMargin: "0px 0px -6% 0px",
  });

  if (useDesktopLiteMotion) {
    return (
      <div
        className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-4 lg:min-h-[168px] home-desktop-lite-subpanel"
        style={{ "--home-reveal-delay": `${index * 95}ms` }}
      >
        <span className="block text-sm font-semibold text-white">{title}</span>
        <p className="mt-2 text-[12px] leading-5 text-zinc-300/86">{copy}</p>
      </div>
    );
  }

  return (
    <motion.div
      ref={!useDesktopLiteMotion && !shouldReduceMotion ? stepReveal.ref : undefined}
      initial={
        shouldReduceMotion
          ? false
          : { opacity: 0, y: 22, scale: 0.985, filter: "blur(5px)" }
      }
      whileInView={
        shouldReduceMotion
          ? undefined
          : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
      }
      viewport={{ once: true, amount: 0.42, margin: "0px 0px -6% 0px" }}
      transition={{
        duration: 0.48,
        delay: shouldReduceMotion ? 0 : index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-4 lg:min-h-[168px] ${
        useDesktopLiteMotion
          ? "home-desktop-lite-subpanel"
          : stepReveal.isVisible
          ? "home-desktop-reveal home-desktop-reveal-sm is-visible"
          : "home-desktop-reveal home-desktop-reveal-sm"
      }`}
    >
      <span className="block text-sm font-semibold text-white">{title}</span>
      <p className="mt-2 text-[12px] leading-5 text-zinc-300/86">{copy}</p>
    </motion.div>
  );
}

function LearnGuideCard({ index, useDesktopLiteMotion, shouldReduceMotion }) {
  const guideReveal = useHomeDesktopReveal(!useDesktopLiteMotion && !shouldReduceMotion, {
    threshold: 0.08,
    rootMargin: "0px 0px -6% 0px",
  });

  if (useDesktopLiteMotion) {
    return (
      <div
        className="hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-4 lg:flex lg:min-h-[168px] lg:items-center lg:justify-center home-desktop-lite-subpanel"
        style={{ "--home-reveal-delay": `${index * 95}ms` }}
      >
        <div className="inline-flex items-center gap-2 text-center text-sm font-semibold text-white">
          <span>Open guide</span>
          <FaArrowUpRightFromSquare className="text-sm text-white/90" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={!useDesktopLiteMotion && !shouldReduceMotion ? guideReveal.ref : undefined}
      initial={
        shouldReduceMotion
          ? false
          : { opacity: 0, y: 22, scale: 0.985, filter: "blur(5px)" }
      }
      whileInView={
        shouldReduceMotion
          ? undefined
          : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
      }
      viewport={{ once: true, amount: 0.42, margin: "0px 0px -6% 0px" }}
      transition={{
        duration: 0.56,
        delay: shouldReduceMotion ? 0 : index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-4 lg:flex lg:min-h-[168px] lg:items-center lg:justify-center ${
        useDesktopLiteMotion
          ? "home-desktop-lite-subpanel"
          : guideReveal.isVisible
          ? "home-desktop-reveal home-desktop-reveal-sm is-visible"
          : "home-desktop-reveal home-desktop-reveal-sm"
      }`}
    >
      <div className="inline-flex items-center gap-2 text-center text-sm font-semibold text-white">
        <span>Open guide</span>
        <FaArrowUpRightFromSquare className="text-sm text-white/90" />
      </div>
    </motion.div>
  );
}

export default function LearnCricketCard() {
  const prefersReducedMotion = useReducedMotion();
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const shouldReduceMotion = prefersReducedMotion || useDesktopLiteMotion;
  const sectionReveal = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: 0.08,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });
  const learnSteps = [
    {
      title: "1. Two teams play",
      copy: "One team bats to score runs while the other team bowls and fields.",
    },
    {
      title: "2. Each ball is a chance",
      copy: "The batter tries to hit the ball and run. More runs means a better total.",
    },
    {
      title: "3. Bowlers fight back",
      copy: "The bowler tries to get the batter out or stop runs with accurate balls.",
    },
    {
      title: "4. Overs keep the game moving",
      copy: "Six legal balls make one over. The score tracks runs, wickets, and overs.",
    },
    {
      title: "5. Highest score wins",
      copy: "After both teams bat, the team with more runs wins the match.",
    },
  ];

  const SectionTag = useDesktopLiteMotion ? "section" : motion.section;
  const LinkTag = useDesktopLiteMotion ? "a" : motion.a;
  const LeftMediaTag = useDesktopLiteMotion ? "div" : motion.div;
  const RightContentTag = useDesktopLiteMotion ? "div" : motion.div;
  const MobileMediaTag = useDesktopLiteMotion ? "div" : motion.div;

  return (
    <SectionTag
      id="learn-cricket"
      ref={useDesktopLiteMotion ? sectionReveal.ref : undefined}
      {...(!useDesktopLiteMotion
        ? {
            initial: shouldReduceMotion
              ? false
              : { opacity: 0, y: 22, scale: 0.992, filter: "blur(6px)" },
            whileInView: shouldReduceMotion
              ? undefined
              : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
            viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
            transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] },
          }
        : {})}
      className={`mx-auto w-full max-w-6xl scroll-mt-28 2xl:max-w-[108rem] ${
        useDesktopLiteMotion
          ? `home-desktop-reveal home-desktop-reveal-panel ${
              sectionReveal.isVisible ? "is-visible" : ""
            }`
          : ""
      }`}
      style={useDesktopLiteMotion ? { "--home-reveal-delay": "80ms" } : undefined}
    >
      <LinkTag
        href="https://usacricket.org/what-is-cricket/"
        target="_blank"
        rel="noopener noreferrer"
        {...(!useDesktopLiteMotion
          ? {
              whileHover: shouldReduceMotion
                ? undefined
                : { y: -6, scale: 1.008, transition: { duration: 0.26 } },
            }
          : {})}
        className={`group relative block overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,14,0.94))] px-6 py-6 shadow-[0_28px_70px_rgba(0,0,0,0.42)] transition-transform duration-300 hover:-translate-y-1 md:px-8 md:py-8 lg:px-9 lg:py-9 ${
          useDesktopLiteMotion ? "home-desktop-lite-panel" : ""
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_80%_100%,rgba(245,158,11,0.08),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <GiCricketBat className="absolute -right-2 top-5 text-[5.5rem] text-amber-200/8 blur-[1px] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105" />
          <FaGripLinesVertical className="absolute -left-1 bottom-10 text-[4.6rem] text-cyan-100/8 blur-[1px] transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
          <FaCircleDot className="absolute right-24 bottom-6 text-[2.8rem] text-rose-100/10 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
        </div>

        <div className={`relative z-10 grid items-start gap-7 lg:grid-cols-[minmax(320px,0.84fr)_minmax(0,1.16fr)] lg:gap-9 xl:grid-cols-[minmax(360px,0.88fr)_minmax(0,1.12fr)] ${
          useDesktopLiteMotion ? "home-desktop-panel-sequence" : ""
        }`}>
          <LeftMediaTag
            {...(!useDesktopLiteMotion
              ? {
                  initial: shouldReduceMotion
                    ? false
                    : { opacity: 0, x: -34, y: 16, rotate: -0.4, filter: "blur(6px)" },
                  whileInView: shouldReduceMotion
                    ? undefined
                    : { opacity: 1, x: 0, y: 0, rotate: 0, filter: "blur(0px)" },
                  viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
                  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.04 },
                }
              : {})}
            className="relative hidden lg:block"
          >
            <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,28,0.9),rgba(10,10,16,0.94))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_42px_rgba(0,0,0,0.24)] lg:sticky lg:top-24">
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
              <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,rgba(22,22,30,0.94),rgba(8,8,12,0.96))] xl:aspect-[16/10]">
                <FaCircleDot className="absolute right-6 top-6 text-[4.2rem] text-rose-200/16 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-105" />
                <GiCricketBat className="absolute left-6 bottom-5 text-[4.2rem] text-amber-200/14 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src="/gvLogo.png"
                    alt="GV Cricket logo"
                    width={220}
                    height={220}
                    sizes="220px"
                    unoptimized
                    className="h-auto w-[190px] object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.42)] transition-transform duration-500 group-hover:scale-[1.04] xl:w-[210px]"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/6" />
              </div>
            </div>
          </LeftMediaTag>

          <RightContentTag
            {...(!useDesktopLiteMotion
              ? {
                  initial: shouldReduceMotion
                    ? false
                    : { opacity: 0, x: -30, y: 14, filter: "blur(5px)" },
                  whileInView: shouldReduceMotion
                    ? undefined
                    : { opacity: 1, x: 0, y: 0, filter: "blur(0px)" },
                  viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
                  transition: { duration: 0.64, ease: [0.22, 1, 0.36, 1] },
                }
              : {})}
            className={`space-y-5 text-left ${useDesktopLiteMotion ? "home-desktop-card-sequence" : ""}`}
          >
            <span className="liquid-pill inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-100/90">
              Learn Cricket
            </span>
            <div className="space-y-3">
              <LiquidSportText
                as="div"
                text={["Want to learn more", "about cricket?"]}
                characterTyping
                characterStagger={0.02}
                characterLineDelay={0.12}
                characterDuration={0.34}
                simplifyMotion={shouldReduceMotion}
                lightweightCharacterReveal={useDesktopLiteMotion}
                delay={0.03}
                className="max-w-xl text-3xl font-semibold tracking-tight md:text-4xl lg:max-w-2xl"
                lineClassName="leading-[1.02]"
              />
            </div>

            <MobileMediaTag
              {...(!useDesktopLiteMotion
                ? {
                    initial: shouldReduceMotion
                      ? false
                      : { opacity: 0, x: 34, y: 16, rotate: 0.5, filter: "blur(6px)" },
                    whileInView: shouldReduceMotion
                      ? undefined
                      : { opacity: 1, x: 0, y: 0, rotate: 0, filter: "blur(0px)" },
                    viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
                    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.04 },
                  }
                : {})}
              className="relative lg:hidden"
            >
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
                      unoptimized
                      className="h-auto w-[210px] object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.42)] transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/6" />
                </div>
              </div>
            </MobileMediaTag>

            <div className={`grid gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-3 ${
              useDesktopLiteMotion ? "home-desktop-grid-sequence" : ""
            }`}>
              {learnSteps.map(({ title, copy }, index) => (
                <LearnStepCard
                  key={title}
                  title={title}
                  copy={copy}
                  index={index}
                  useDesktopLiteMotion={useDesktopLiteMotion}
                  shouldReduceMotion={shouldReduceMotion}
                />
              ))}
              <LearnGuideCard
                index={learnSteps.length}
                useDesktopLiteMotion={useDesktopLiteMotion}
                shouldReduceMotion={shouldReduceMotion}
              />
            </div>

            <div className="flex items-center gap-3 pt-1 lg:hidden lg:pt-2">
              <span className="liquid-pill inline-flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-white">
                Open guide
                <FaArrowUpRightFromSquare className="text-sm text-white/90" />
              </span>
            </div>
          </RightContentTag>

        </div>
      </LinkTag>
    </SectionTag>
  );
}


