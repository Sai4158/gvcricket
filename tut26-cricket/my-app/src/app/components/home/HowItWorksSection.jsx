"use client";

import { motion } from "framer-motion";
import {
  FaBroadcastTower,
  FaBullhorn,
  FaCheckCircle,
  FaCoins,
  FaEye,
  FaImage,
  FaListAlt,
  FaPenSquare,
  FaPlusCircle,
  FaMicrophoneAlt,
  FaVolumeUp,
} from "react-icons/fa";
import AnimatedSection from "./AnimatedSection";

const cardMotionProps = {
  initial: { opacity: 0, y: 26, scale: 0.985 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  viewport: { once: true, amount: 0.1, margin: "0px 0px -8% 0px" },
  transition: { duration: 0.42, ease: "easeOut" },
};

const updateCards = [
  {
    icon: FaImage,
    title: "Session cover image",
    copy: "One uploaded image now carries across live, spectator, result, and stats screens.",
    accent: "amber",
  },
  {
    icon: FaVolumeUp,
    title: "Score speech",
    copy: "Live score announcements now read the ball and total clearly with smarter timing.",
    accent: "cyan",
  },
  {
    icon: FaBroadcastTower,
    title: "Walkietalkie",
    copy: "Live talk between spectator, umpire, and now the director console with shared channel control.",
    accent: "emerald",
  },
  {
    icon: FaMicrophoneAlt,
    title: "Speaker mic",
    copy: "Phone-to-speaker commentary mode makes quick announcements and live atmosphere easier.",
    accent: "yellow",
  },
  {
    icon: FaBullhorn,
    title: "Director mode",
    copy: "A new control room page for PA mic, music, effects, and walkie with the umpire.",
    accent: "violet",
  },
];

const coreCards = [
  {
    icon: FaListAlt,
    title: "Session Dashboard",
    copy:
      "See past games, create new ones, or jump back into a saved match with the umpire PIN.",
    accent: "cyan",
  },
  {
    icon: FaPenSquare,
    title: "Live Umpire Scoring",
    copy:
      "Score every ball with simple color-coded controls for runs, wides, dots, and outs.",
    accent: "amber",
  },
  {
    icon: FaEye,
    title: "Spectator View",
    copy:
      "Share the live scoreboard on phones or a big screen, with clear live and completed match states.",
    accent: "emerald",
  },
  {
    icon: FaPlusCircle,
    title: "New Match Setup",
    copy:
      "Start fast with match name, teams, players, and overs in one quick setup flow.",
    accent: "rose",
  },
  {
    icon: FaCoins,
    title: "Animated Coin Toss",
    copy:
      "A clean toss flow decides who bats or bowls first, then moves straight into the match.",
    accent: "yellow",
  },
  {
    icon: FaCheckCircle,
    title: "Final Results",
    copy:
      "See winner, final score, and key stats instantly, with match history saved for later review.",
    accent: "violet",
  },
];

function getAccentClasses(accent) {
  switch (accent) {
    case "amber":
      return "bg-amber-500/12 text-amber-200 shadow-[0_12px_30px_rgba(245,158,11,0.1)]";
    case "emerald":
      return "bg-emerald-500/12 text-emerald-200 shadow-[0_12px_30px_rgba(16,185,129,0.12)]";
    case "rose":
      return "bg-rose-500/12 text-rose-200 shadow-[0_12px_30px_rgba(244,63,94,0.12)]";
    case "yellow":
      return "bg-yellow-500/12 text-yellow-200 shadow-[0_12px_30px_rgba(250,204,21,0.12)]";
    case "violet":
      return "bg-violet-500/12 text-violet-200 shadow-[0_12px_30px_rgba(139,92,246,0.12)]";
    default:
      return "bg-cyan-500/12 text-cyan-200 shadow-[0_12px_30px_rgba(34,211,238,0.12)]";
  }
}

export default function HowItWorksSection() {
  return (
    <AnimatedSection
      id="updates"
      className="mx-auto w-full max-w-6xl scroll-mt-28 overflow-hidden"
    >
      <div className="space-y-8">
        <div className="liquid-glass-soft rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(18,18,24,0.72),rgba(10,10,16,0.58))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.28)] md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="liquid-pill inline-flex rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-50">
              Latest features
            </span>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              Built for faster live scoring
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/78 md:text-lg">
              Match cover images, score speech, walkie-talkie, speaker mic, and director controls in one scoring flow.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {updateCards.map((card) => (
              <motion.div
                key={card.title}
                {...cardMotionProps}
                className="liquid-glass-soft rounded-[26px] p-5"
              >
                <motion.span
                  initial={{ opacity: 0, scale: 0.88, y: 10 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.38, ease: "easeOut", delay: 0.08 }}
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className={`liquid-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${getAccentClasses(
                    card.accent
                  )}`}
                >
                  <card.icon />
                </motion.span>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.34, ease: "easeOut", delay: 0.12 }}
                  className="mt-5 text-lg font-semibold text-white"
                >
                  {card.title}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.34, ease: "easeOut", delay: 0.16 }}
                  className="mt-2 text-sm leading-6 text-white/72"
                >
                  {card.copy}
                </motion.p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="liquid-glass-soft rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(18,18,24,0.72),rgba(10,10,16,0.58))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.28)] md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              From toss to final result
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/78 md:text-lg">
              GV Cricket keeps setup, live scoring, spectator updates, announcer calls, and final stats in one simple cricket scoring app.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coreCards.map((card) => (
              <motion.div
                key={card.title}
                {...cardMotionProps}
                className="liquid-glass-soft rounded-[26px] p-5"
              >
                <motion.span
                  initial={{ opacity: 0, scale: 0.88, y: 10 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.38, ease: "easeOut", delay: 0.08 }}
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className={`liquid-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${getAccentClasses(
                    card.accent
                  )}`}
                >
                  <card.icon />
                </motion.span>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.34, ease: "easeOut", delay: 0.12 }}
                  className="mt-5 text-xl font-semibold text-white"
                >
                  {card.title}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.34, ease: "easeOut", delay: 0.16 }}
                  className="mt-2 text-sm leading-6 text-white/72"
                >
                  {card.copy}
                </motion.p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
