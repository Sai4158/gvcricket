"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  FaAngleDown,
  FaArrowRight,
  FaBroadcastTower,
  FaChartLine,
  FaClipboardList,
} from "react-icons/fa";
import LiquidSportText from "./LiquidSportText";
import PendingLink from "../shared/PendingLink";

const sectionVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.09,
    },
  },
};

const cardVariants = {
  hidden: () => ({
    opacity: 0,
  }),
  visible: {
    opacity: 1,
    transition: {
      duration: 0.68,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const cardContentVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.07,
    },
  },
};

const cardItemVariants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function PrimaryActionsSection() {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = prefersReducedMotion;
  const handleScrollToUpdates = (event) => {
    event.preventDefault();
    const target = document.getElementById("updates");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section
      id="quick-start"
      className="mx-auto flex w-full max-w-4xl scroll-mt-24 flex-col items-center gap-10 text-center xl:max-w-6xl xl:gap-12 2xl:max-w-7xl"
    >
      <motion.div
        initial={
          shouldReduceMotion
            ? false
            : { opacity: 0, y: 24, scale: 0.992, filter: "blur(6px)" }
        }
        whileInView={
          shouldReduceMotion
            ? undefined
            : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
        }
        viewport={{ once: true, amount: 0.18, margin: "0px 0px -6% 0px" }}
        transition={{ duration: 0.64, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-2xl space-y-4 xl:max-w-3xl"
      >
        <div className="mx-auto inline-flex items-center rounded-full border border-amber-300/16 bg-amber-300/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-100">
          GV Cricket 2.0
        </div>
        <LiquidSportText
          text={["Live score, umpire mode,", "and match control in one app."]}
          characterTyping
          characterStagger={0.02}
          characterLineDelay={0.14}
          simplifyMotion={shouldReduceMotion}
          className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl"
          lineClassName="leading-[1.02]"
        />
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.7 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
        >
          <Link
            href="/#updates"
            onClick={handleScrollToUpdates}
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-100/88 transition hover:text-white"
          >
            <span>Find out more</span>
            <FaAngleDown className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        initial={shouldReduceMotion ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, amount: 0.16, margin: "0px 0px -6% 0px" }}
        variants={sectionVariants}
        className="grid w-full max-w-3xl gap-4 sm:grid-cols-2 xl:max-w-6xl xl:gap-5 2xl:max-w-7xl"
      >
        <PendingLink
          href="/session/new"
          pendingLabel="Opening new session..."
          pendingClassName="pending-shimmer"
          className="block"
        >
          <motion.div
            custom={0}
            variants={cardVariants}
            whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
            className="liquid-glass group rounded-[30px] p-5 text-left transition duration-300 hover:border-white/28"
          >
            <motion.div
              animate={
                shouldReduceMotion
                  ? undefined
                  : { opacity: [0.84, 0.94, 0.88], x: [0, 4, 0] }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : { duration: 8.4, repeat: Infinity, ease: "easeInOut" }
              }
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)] opacity-90"
            />
            <motion.div
              animate={
                shouldReduceMotion
                  ? undefined
                  : { y: [0, -2, 0], opacity: [0.12, 0.18, 0.12] }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : { duration: 8.6, repeat: Infinity, ease: "easeInOut" }
              }
              className="pointer-events-none absolute right-5 top-5 z-1 text-white/44 drop-shadow-[0_4px_12px_rgba(255,255,255,0.08)] transition duration-300 group-hover:text-white/56"
            >
              <FaClipboardList className="text-[64px]" />
            </motion.div>
            <motion.div
              initial={shouldReduceMotion ? false : "hidden"}
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              variants={cardContentVariants}
              className="relative z-10 flex h-full min-h-38 flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <motion.div
                  variants={cardItemVariants}
                  className="liquid-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:-rotate-3"
                >
                  <FaClipboardList />
                </motion.div>
                <motion.h3
                  variants={cardItemVariants}
                  className="max-w-56 text-[24px] font-semibold leading-[1.04] tracking-tight text-white"
                >
                  Start a game
                </motion.h3>
                <motion.p
                  variants={cardItemVariants}
                  className="max-w-[16rem] text-sm leading-6 text-white/78"
                >
                  Create teams, run the toss, open umpire mode, and start scoring live in one flow.
                </motion.p>
              </div>
              <motion.div
                variants={cardItemVariants}
                className="flex items-center justify-end gap-3 border-t border-white/10 pt-4"
              >
                <span className="text-sm font-medium text-white/88">Start now</span>
                <motion.span
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { x: [0, 2, 0], opacity: [0.92, 1, 0.92] }
                  }
                  transition={
                    shouldReduceMotion
                      ? undefined
                      : { duration: 7.6, repeat: Infinity, ease: "easeInOut" }
                  }
                  className="liquid-pill inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition duration-300 group-hover:border-white/30"
                >
                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </motion.span>
              </motion.div>
            </motion.div>
          </motion.div>
        </PendingLink>

        <PendingLink
          href="/session"
          pendingLabel="Opening sessions..."
          pendingClassName="pending-shimmer"
          primeAudioOnClick
          className="block"
        >
          <motion.div
            custom={1}
            variants={cardVariants}
            whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
            className="liquid-glass group rounded-[30px] p-5 text-left transition duration-300 hover:border-white/28"
          >
            <motion.div
              animate={
                shouldReduceMotion
                  ? undefined
                  : { opacity: [0.84, 0.94, 0.88], x: [0, 4, 0] }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : { duration: 8.8, repeat: Infinity, ease: "easeInOut" }
              }
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)] opacity-90"
            />
            <motion.div
              animate={
                shouldReduceMotion
                  ? undefined
                  : { y: [0, -2, 0], opacity: [0.12, 0.18, 0.12] }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : { duration: 8.6, repeat: Infinity, ease: "easeInOut" }
              }
              className="pointer-events-none absolute right-5 top-5 z-1 text-white/44 drop-shadow-[0_4px_12px_rgba(255,255,255,0.08)] transition duration-300 group-hover:text-white/56"
            >
              <FaChartLine className="text-[60px]" />
            </motion.div>
            <motion.div
              initial={shouldReduceMotion ? false : "hidden"}
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              variants={cardContentVariants}
              className="relative z-10 flex h-full min-h-38 flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <motion.div
                  variants={cardItemVariants}
                  className="liquid-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3"
                >
                  <FaChartLine />
                </motion.div>
                <motion.h3
                  variants={cardItemVariants}
                  className="max-w-56 text-[24px] font-semibold leading-[1.04] tracking-tight text-white"
                >
                  View sessions
                </motion.h3>
                <motion.p
                  variants={cardItemVariants}
                  className="max-w-[16rem] text-sm leading-6 text-white/78"
                >
                  View live matches, past scorecards, final results, and saved sessions in one place.
                </motion.p>
              </div>
              <motion.div
                variants={cardItemVariants}
                className="flex items-center justify-end gap-3 border-t border-white/10 pt-4"
              >
                <span className="text-sm font-medium text-white/88">Browse all</span>
                <motion.span
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { x: [0, 2, 0], opacity: [0.92, 1, 0.92] }
                  }
                  transition={
                    shouldReduceMotion
                      ? undefined
                      : { duration: 7.8, repeat: Infinity, ease: "easeInOut" }
                  }
                  className="liquid-pill inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition duration-300 group-hover:border-white/30"
                >
                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </motion.span>
              </motion.div>
            </motion.div>
          </motion.div>
        </PendingLink>
      </motion.div>

      <PendingLink
        href="/director"
        pendingLabel="Opening director..."
        pendingClassName="pending-shimmer"
        className="block w-full max-w-3xl xl:max-w-6xl 2xl:max-w-7xl"
      >
        <motion.div
        initial={
          shouldReduceMotion
              ? false
              : { opacity: 0 }
        }
        whileInView={
          shouldReduceMotion
              ? undefined
              : { opacity: 1 }
        }
          viewport={{ once: true, amount: 0.16, margin: "0px 0px -6% 0px" }}
          transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.012 }}
          whileTap={{ scale: 0.99 }}
          className="liquid-glass group flex w-full items-center gap-4 rounded-[28px] px-6 py-5 text-left transition duration-300 hover:border-white/28 sm:gap-5"
        >
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : { opacity: [0.84, 0.94, 0.88], x: [0, 4, 0] }
            }
            transition={
              shouldReduceMotion
                ? undefined
                : { duration: 8.4, repeat: Infinity, ease: "easeInOut" }
            }
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_28%)]"
          />
          <motion.div
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.45 }}
            variants={cardContentVariants}
            className="relative z-10 flex min-w-0 flex-1 items-center gap-4 sm:gap-5"
          >
            <motion.span
              variants={cardItemVariants}
              className="liquid-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg text-emerald-50 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.04]"
            >
              <FaBroadcastTower />
            </motion.span>
            <span className="min-w-0 flex-1">
              <motion.span
                variants={cardItemVariants}
                className="block text-[1.15rem] font-semibold tracking-tight text-white"
              >
                Director mode
              </motion.span>
              <motion.span
                variants={cardItemVariants}
                className="mt-1 block max-w-120 text-sm leading-6 text-white/76"
              >
                Control mic, music, sound effects, and walkie from one simple phone console.
              </motion.span>
            </span>
          </motion.div>
          <motion.span
            animate={
              shouldReduceMotion
                ? undefined
                : { x: [0, 2, 0], opacity: [0.92, 1, 0.92] }
            }
            transition={
              shouldReduceMotion
                ? undefined
                : { duration: 7.8, repeat: Infinity, ease: "easeInOut" }
            }
            className="relative z-10 liquid-pill inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-emerald-50 transition-transform duration-300 group-hover:translate-x-1"
          >
            <FaArrowRight />
          </motion.span>
        </motion.div>
      </PendingLink>
    </section>
  );
}
