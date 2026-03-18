"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  FaArrowRight,
  FaBroadcastTower,
  FaChartLine,
  FaClipboardList,
} from "react-icons/fa";

const sectionVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.06,
      staggerChildren: 0.12,
    },
  },
};

const cardVariants = {
  hidden: (index) => ({
    opacity: 0,
    scale: 0.94,
    x: index % 2 === 0 ? -72 : 72,
    y: 28,
    rotate: index % 2 === 0 ? -1.8 : 1.8,
    filter: "blur(10px)",
  }),
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotate: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.82,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export default function PrimaryActionsSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="quick-start"
      className="mx-auto flex w-full max-w-4xl scroll-mt-24 flex-col items-center gap-10 text-center"
    >
      <motion.div
        initial={
          prefersReducedMotion
            ? false
            : { opacity: 0, y: 34, scale: 0.985, filter: "blur(10px)" }
        }
        whileInView={
          prefersReducedMotion
            ? undefined
            : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
        }
        viewport={{ once: true, amount: 0.22, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-2xl space-y-4"
      >
        <div className="mx-auto inline-flex items-center rounded-full border border-amber-300/16 bg-amber-300/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-100">
          Free cricket scoring
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          Live score, umpire mode, and match control in one app.
        </h2>
        <p className="text-base leading-7 text-zinc-300 sm:text-lg">
          Score every match from toss to result with spectator view, score announcer, walkie-talkie, and clean mobile controls.
        </p>
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, amount: 0.16, margin: "0px 0px -10% 0px" }}
        variants={sectionVariants}
        className="grid w-full max-w-3xl gap-4 sm:grid-cols-2"
      >
        <Link href="/session/new" className="block">
          <motion.div
            custom={0}
            variants={cardVariants}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
            className="liquid-glass group rounded-[30px] p-5 text-left transition duration-300 hover:border-white/28"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)] opacity-90" />
            <div className="pointer-events-none absolute right-5 top-5 text-amber-100/15 transition duration-300 group-hover:scale-105 group-hover:text-amber-50/20">
              <FaClipboardList className="text-[64px]" />
            </div>
            <div className="relative z-10 flex h-full min-h-[152px] flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="liquid-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl text-amber-50 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:-rotate-3">
                  <FaClipboardList />
                </div>
                <h3 className="max-w-[14rem] text-[28px] font-semibold leading-[1.02] tracking-tight text-white">
                  Start a game
                </h3>
                <p className="max-w-[16rem] text-sm leading-6 text-white/78">
                  Open umpire mode, score every ball, and keep the live scoreboard ready for spectators.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <span className="text-sm font-medium text-white/88">Start now</span>
                <span className="liquid-pill inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition duration-300 group-hover:border-white/30">
                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </motion.div>
        </Link>

        <Link href="/session" className="block">
          <motion.div
            custom={1}
            variants={cardVariants}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
            className="liquid-glass group rounded-[30px] p-5 text-left transition duration-300 hover:border-white/28"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)] opacity-90" />
            <div className="pointer-events-none absolute right-5 top-5 text-sky-100/15 transition duration-300 group-hover:scale-105 group-hover:text-sky-50/20">
              <FaChartLine className="text-[60px]" />
            </div>
            <div className="relative z-10 flex h-full min-h-[152px] flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="liquid-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl text-sky-50 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3">
                  <FaChartLine />
                </div>
                <h3 className="max-w-[14rem] text-[28px] font-semibold leading-[1.02] tracking-tight text-white">
                  View sessions
                </h3>
                <p className="max-w-[16rem] text-sm leading-6 text-white/78">
                  Browse live matches, finished scorecards, final results, and saved cricket sessions.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <span className="text-sm font-medium text-white/88">Browse all</span>
                <span className="liquid-pill inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition duration-300 group-hover:border-white/30">
                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </motion.div>
        </Link>
      </motion.div>

      <Link href="/director" className="block w-full max-w-3xl">
        <motion.div
          initial={
            prefersReducedMotion
              ? false
              : { opacity: 0, x: -84, y: 20, scale: 0.955, filter: "blur(10px)" }
          }
          whileInView={
            prefersReducedMotion
              ? undefined
              : { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }
          }
          viewport={{ once: true, amount: 0.2, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.84, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
          whileTap={{ scale: 0.99 }}
          className="liquid-glass group flex w-full items-center gap-4 rounded-[28px] px-6 py-5 text-left transition duration-300 hover:border-white/28 sm:gap-5"
        >
          <span className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
            <span className="liquid-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg text-emerald-50 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.04]">
              <FaBroadcastTower />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.15rem] font-semibold tracking-tight text-white">
                Director mode
              </span>
              <span className="mt-1 block max-w-[30rem] text-sm leading-6 text-white/76">
                Control mic, music, sound effects, and walkie from one simple phone console.
              </span>
            </span>
          </span>
          <span className="liquid-pill inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-emerald-50 transition-transform duration-300 group-hover:translate-x-1">
            <FaArrowRight />
          </span>
        </motion.div>
      </Link>
    </section>
  );
}
