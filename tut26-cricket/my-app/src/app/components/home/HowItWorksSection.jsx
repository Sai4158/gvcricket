"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  FaBroadcastTower,
  FaBullhorn,
  FaCheckCircle,
  FaCoins,
  FaDatabase,
  FaDrum,
  FaEye,
  FaImage,
  FaListAlt,
  FaLock,
  FaMusic,
  FaPenSquare,
  FaPlusCircle,
  FaShareAlt,
  FaSlidersH,
  FaMicrophoneAlt,
  FaVolumeUp,
  FaWaveSquare,
} from "react-icons/fa";
import AnimatedSection from "./AnimatedSection";

const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.945 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

function splitCardsForLargeGrid(cards, columns = 5) {
  const remainder = cards.length % columns;
  if (remainder <= 0 || remainder === columns) {
    return {
      regularCards: cards,
      tailCards: [],
    };
  }

  return {
    regularCards: cards.slice(0, cards.length - remainder),
    tailCards: cards.slice(cards.length - remainder),
  };
}

const updateCards = [
  {
    icon: FaBroadcastTower,
    title: "Walkie-Talkie",
    copy: "Live talk between spectators, the umpire, and the director console on one shared channel.",
    accent: "emerald",
  },
  {
    icon: FaMicrophoneAlt,
    title: "Loudspeaker",
    copy: "Use your phone as a loudspeaker for quick commentary and live atmosphere.",
    accent: "yellow",
  },
  {
    icon: FaBullhorn,
    title: "Director mode",
    copy: "A control room view for the PA mic, music, sound effects, and walkie-talkie with the umpire.",
    accent: "violet",
  },
  {
    icon: FaDrum,
    title: "Sound effects",
    copy: "Trigger horns, crowd cheers, wicket hits, six bursts, and other match-day sounds from one panel.",
    accent: "rose",
  },
  {
    icon: FaWaveSquare,
    title: "Audio Library",
    copy: "Drop audio files into the app folder and play them on demand from the director audio grid.",
    accent: "emerald",
  },
  {
    icon: FaMusic,
    title: "Music Deck",
    copy: "Load tracks from your phone or local files and play them without leaving the director screen.",
    accent: "violet",
  },
  {
    icon: FaVolumeUp,
    title: "Score Announcer",
    copy: "Live score announcements now speak each ball and score more clearly with smarter timing.",
    accent: "cyan",
  },
  {
    icon: FaImage,
    title: "Session Cover Image",
    copy: "One uploaded image now carries across live, spectator, result, and stats screens.",
    accent: "amber",
  },
  {
    icon: FaPenSquare,
    title: "Live Result Insights",
    copy: "Final results now include richer match insights, over summaries, and cleaner stats.",
    accent: "rose",
  },
  {
    icon: FaCoins,
    title: "Step-by-Step Setup",
    copy: "Session setup, teams, toss, and match start now follow one cleaner 4-step flow.",
    accent: "yellow",
  },
  {
    icon: FaShareAlt,
    title: "Quick Sharing",
    copy: "Share live score links, result pages, and spectator views faster with cleaner mobile actions.",
    accent: "cyan",
  },
  {
    icon: FaSlidersH,
    title: "Live Over Tracker",
    copy: "Current over cards now stay synced between umpire and spectator screens during live scoring.",
    accent: "amber",
  },
];

const coreCards = [
  {
    icon: FaListAlt,
    title: "Session Dashboard",
    copy:
      "See past matches, create new ones, or jump back into a saved match with the umpire PIN.",
    accent: "cyan",
  },
  {
    icon: FaPenSquare,
    title: "Live Umpire Scoring",
    copy:
      "Score every ball with simple color-coded controls for runs, wides, dot balls, and outs.",
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
      "Start quickly with a match name, teams, players, and overs in one simple setup flow.",
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
      "See the winner, final score, and key stats instantly, with match history saved for later review.",
    accent: "violet",
  },
  {
    icon: FaSlidersH,
    title: "Flexible Match Control",
    copy:
      "Adjust teams, players, overs, and live match details without breaking the scoring flow.",
    accent: "amber",
  },
  {
    icon: FaLock,
    title: "Protected Match Access",
    copy:
      "Keep umpire, media, and director controls behind server-verified access without slowing down the live flow.",
    accent: "cyan",
  },
  {
    icon: FaDatabase,
    title: "Saved Match History",
    copy:
      "Store completed sessions, reopen results later, and keep scorecards ready for review and sharing.",
    accent: "yellow",
  },
];

function getAccentClasses(accent) {
  switch (accent) {
    case "amber":
      return "bg-amber-500/12 shadow-[0_12px_30px_rgba(245,158,11,0.1)]";
    case "emerald":
      return "bg-emerald-500/12 shadow-[0_12px_30px_rgba(16,185,129,0.12)]";
    case "rose":
      return "bg-rose-500/12 shadow-[0_12px_30px_rgba(244,63,94,0.12)]";
    case "yellow":
      return "bg-yellow-500/12 shadow-[0_12px_30px_rgba(250,204,21,0.12)]";
    case "violet":
      return "bg-violet-500/12 shadow-[0_12px_30px_rgba(139,92,246,0.12)]";
    default:
      return "bg-cyan-500/12 shadow-[0_12px_30px_rgba(34,211,238,0.12)]";
  }
}

function getAccentLineClasses(accent) {
  switch (accent) {
    case "amber":
      return "from-transparent via-amber-300/60 to-transparent";
    case "emerald":
      return "from-transparent via-emerald-300/60 to-transparent";
    case "rose":
      return "from-transparent via-rose-300/60 to-transparent";
    case "yellow":
      return "from-transparent via-yellow-300/60 to-transparent";
    case "violet":
      return "from-transparent via-violet-300/60 to-transparent";
    default:
      return "from-transparent via-cyan-300/60 to-transparent";
  }
}

export default function HowItWorksSection() {
  const prefersReducedMotion = useReducedMotion();
  const modernCardClass =
    "liquid-glass-soft group relative overflow-hidden rounded-[28px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_38%),linear-gradient(180deg,rgba(20,20,26,0.82),rgba(9,9,14,0.72))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]";
  const updateGrid = splitCardsForLargeGrid(updateCards);
  const coreGrid = splitCardsForLargeGrid(coreCards);

  const renderCard = (card, index, hoverRotateClass = "") => (
    <motion.div
      key={card.title}
      variants={cardVariants}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
      className={modernCardClass}
    >
      <div
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentLineClasses(
          card.accent
        )} opacity-80`}
      />
      <div className="pointer-events-none absolute -right-12 top-2 h-28 w-28 rounded-full bg-white/[0.05] blur-2xl transition duration-500 group-hover:bg-white/[0.08]" />
      <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-80" />
      <span
        className={`liquid-icon inline-flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 text-2xl !text-white transition-transform duration-300 group-hover:-translate-y-0.5 ${hoverRotateClass} ${getAccentClasses(
          card.accent
        )}`}
      >
        <card.icon />
      </span>
      <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
        {card.title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-white/72">{card.copy}</p>
    </motion.div>
  );

  return (
    <AnimatedSection
      id="updates"
      className="mx-auto w-full max-w-7xl scroll-mt-28 overflow-hidden 2xl:max-w-[96rem]"
    >
      <div className="space-y-8">
        <div className="liquid-glass-soft rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.82),rgba(8,8,14,0.72))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="liquid-pill inline-flex rounded-full bg-[linear-gradient(180deg,rgba(255,244,214,0.18),rgba(120,74,16,0.12))] px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] shadow-[inset_0_1px_0_rgba(255,248,224,0.28)]">
              <span className="bg-[linear-gradient(180deg,#fff6cf_0%,#f6d365_38%,#e3a72f_68%,#fff1b3_100%)] text-transparent [background-clip:text] [-webkit-background-clip:text] drop-shadow-[0_0_10px_rgba(245,193,64,0.18)]">
                Latest features
              </span>
            </span>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              Built for faster live scoring
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/78 md:text-lg">
              Walkie-talkie, loudspeaker, director controls, score announcements, session cover images, and cleaner result insights in one scoring flow.
            </p>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.12, margin: "0px 0px -8% 0px" }}
            variants={gridVariants}
            className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
          >
            {updateGrid.regularCards.map((card, index) =>
              renderCard(card, index, "group-hover:-rotate-3")
            )}
            {updateGrid.tailCards.length ? (
              <div className="md:col-span-2 xl:col-span-4 2xl:col-span-5">
                <div className="grid gap-4 md:grid-cols-2 2xl:mx-auto 2xl:max-w-[41rem]">
                  {updateGrid.tailCards.map((card, index) =>
                    renderCard(
                      card,
                      updateGrid.regularCards.length + index,
                      "group-hover:-rotate-3"
                    )
                  )}
                </div>
              </div>
            ) : null}
          </motion.div>
        </div>

        <div className="liquid-glass-soft rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.82),rgba(8,8,14,0.72))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              From toss to final result
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/78 md:text-lg">
              GV Cricket keeps setup, live scoring, spectator updates, score announcements, and final stats in one simple cricket scoring app.
            </p>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.12, margin: "0px 0px -8% 0px" }}
            variants={gridVariants}
            className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
          >
            {coreGrid.regularCards.map((card, index) =>
              renderCard(card, index, "group-hover:rotate-3")
            )}
            {coreGrid.tailCards.length ? (
              <div className="md:col-span-2 xl:col-span-4 2xl:col-span-5">
                <div className="grid gap-4 md:grid-cols-2 2xl:mx-auto 2xl:max-w-[41rem]">
                  {coreGrid.tailCards.map((card, index) =>
                    renderCard(
                      card,
                      coreGrid.regularCards.length + index,
                      "group-hover:rotate-3"
                    )
                  )}
                </div>
              </div>
            ) : null}
          </motion.div>
        </div>
      </div>
    </AnimatedSection>
  );
}
