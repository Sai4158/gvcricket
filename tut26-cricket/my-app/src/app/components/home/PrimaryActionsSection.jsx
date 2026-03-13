"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FaArrowRight,
  FaBroadcastTower,
  FaChartLine,
  FaClipboardList,
} from "react-icons/fa";

const cardMotionProps = {
  initial: { opacity: 0, y: 24, scale: 0.985 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  viewport: { once: true, amount: 0.08, margin: "0px 0px -12% 0px" },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  whileTap: { scale: 0.99 },
};

export default function PrimaryActionsSection() {
  return (
    <section
      id="quick-start"
      className="mx-auto flex w-full max-w-4xl scroll-mt-24 flex-col items-center gap-10 text-center"
    >
      <div className="max-w-2xl space-y-4">
        <div className="mx-auto inline-flex items-center rounded-full border border-amber-300/16 bg-amber-300/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-100">
          Free cricket scoring
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          Live score, umpire mode, and match control in one app.
        </h2>
        <p className="text-base leading-7 text-zinc-300 sm:text-lg">
          Score every match from toss to result with spectator view, score announcer, walkie-talkie, and clean mobile controls.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <Link href="/session/new" className="block">
          <motion.div
            {...cardMotionProps}
            className="liquid-glass group rounded-[30px] p-5 text-left transition duration-300 hover:border-white/28"
          >
            <motion.div
              initial={{ opacity: 0.72, scale: 0.98 }}
              whileInView={{ opacity: 0.92, scale: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)] opacity-90"
            />
            <div className="pointer-events-none absolute right-5 top-5 text-amber-100/15 transition duration-300 group-hover:scale-105 group-hover:text-amber-50/20">
              <FaClipboardList className="text-[64px]" />
            </div>
            <div className="relative z-10 flex h-full min-h-[152px] flex-col justify-between gap-6">
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.32, ease: "easeOut", delay: 0.08 }}
                  whileHover={{ y: -2, rotate: -3 }}
                  whileTap={{ scale: 0.98 }}
                  className="liquid-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl text-amber-50"
                >
                  <FaClipboardList />
                </motion.div>
                <h3 className="max-w-[14rem] text-[28px] font-semibold leading-[1.02] tracking-tight text-white">
                  Start a game
                </h3>
                <p className="max-w-[16rem] text-sm leading-6 text-white/78">
                  Open umpire mode, score every ball, and keep the live scoreboard ready for spectators.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <span className="text-sm font-medium text-white/88">Start now</span>
                <motion.span
                  whileTap={{ scale: 0.96 }}
                  className="liquid-pill inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition duration-300 group-hover:border-white/30"
                >
                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </motion.span>
              </div>
            </div>
          </motion.div>
        </Link>

        <Link href="/session" className="block">
          <motion.div
            {...cardMotionProps}
            transition={{ ...cardMotionProps.transition, delay: 0.06 }}
            className="liquid-glass group rounded-[30px] p-5 text-left transition duration-300 hover:border-white/28"
          >
            <motion.div
              initial={{ opacity: 0.72, scale: 0.98 }}
              whileInView={{ opacity: 0.92, scale: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)] opacity-90"
            />
            <div className="pointer-events-none absolute right-5 top-5 text-sky-100/15 transition duration-300 group-hover:scale-105 group-hover:text-sky-50/20">
              <FaChartLine className="text-[60px]" />
            </div>
            <div className="relative z-10 flex h-full min-h-[152px] flex-col justify-between gap-6">
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.32, ease: "easeOut", delay: 0.08 }}
                  whileHover={{ y: -2, rotate: 3 }}
                  whileTap={{ scale: 0.98 }}
                  className="liquid-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl text-sky-50"
                >
                  <FaChartLine />
                </motion.div>
                <h3 className="max-w-[14rem] text-[28px] font-semibold leading-[1.02] tracking-tight text-white">
                  View sessions
                </h3>
                <p className="max-w-[16rem] text-sm leading-6 text-white/78">
                  Browse live matches, finished scorecards, final results, and saved cricket sessions.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <span className="text-sm font-medium text-white/88">Browse all</span>
                <motion.span
                  whileTap={{ scale: 0.96 }}
                  className="liquid-pill inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition duration-300 group-hover:border-white/30"
                >
                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </motion.span>
              </div>
            </div>
          </motion.div>
        </Link>
      </div>

      <Link href="/director" className="block w-full max-w-3xl">
        <motion.div
          {...cardMotionProps}
          transition={{ ...cardMotionProps.transition, delay: 0.1 }}
          className="liquid-glass group flex w-full items-center gap-4 rounded-[28px] px-6 py-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-white/28 sm:gap-5"
        >
          <span className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
            <motion.span
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.32, ease: "easeOut", delay: 0.08 }}
              whileHover={{ y: -2, scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              className="liquid-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg text-emerald-50"
            >
              <FaBroadcastTower />
            </motion.span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.15rem] font-semibold tracking-tight text-white">
                Director mode
              </span>
              <span className="mt-1 block max-w-[30rem] text-sm leading-6 text-white/76">
                Control mic, music, sound effects, and walkie from one simple phone console.
              </span>
            </span>
          </span>
          <motion.span
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.96 }}
            className="liquid-pill inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-emerald-50 transition-transform duration-300 group-hover:translate-x-1"
          >
            <FaArrowRight />
          </motion.span>
        </motion.div>
      </Link>
    </section>
  );
}
