"use client";

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

const updateCards = [
  {
    icon: FaImage,
    title: "Session cover image",
    copy: "One uploaded image now carries across live, spectator, result, and stats screens.",
  },
  {
    icon: FaVolumeUp,
    title: "Score speech",
    copy: "Live score announcements now read the ball and total clearly with smarter timing.",
  },
  {
    icon: FaBroadcastTower,
    title: "Walkietalkie",
    copy: "Live talk between spectator, umpire, and now the director console with shared channel control.",
  },
  {
    icon: FaMicrophoneAlt,
    title: "Speaker mic",
    copy: "Phone-to-speaker commentary mode makes quick announcements and live atmosphere easier.",
  },
  {
    icon: FaBullhorn,
    title: "Director mode",
    copy: "A new control room page for PA mic, music, effects, and walkie with the umpire.",
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
        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(32,7,7,0.94),rgba(8,8,12,0.98))] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.45)] ring-1 ring-amber-300/10 md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
              Latest update
            </span>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              New live audio and session tools
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
              Cleaner scoring. Better voice. Stronger session identity.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {updateCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-2xl text-amber-200 shadow-[0_12px_30px_rgba(245,158,11,0.1)]">
                  <card.icon />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {card.copy}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,18,0.98),rgba(8,8,12,0.98))] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.4)] ring-1 ring-white/8 md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
              How this app works
            </span>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              Built for fast, simple scoring
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
              Say goodbye to memorizing. GV Cricket keeps match control, live scoring,
              spectator updates, toss, and results in one smooth flow.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coreCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <span
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${getAccentClasses(
                    card.accent
                  )}`}
                >
                  <card.icon />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{card.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
