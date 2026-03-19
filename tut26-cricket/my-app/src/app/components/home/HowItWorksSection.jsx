"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  FaArrowRight,
  FaBroadcastTower,
  FaBullhorn,
  FaCheckCircle,
  FaEye,
  FaImage,
  FaLock,
  FaMicrophoneAlt,
  FaMusic,
  FaShareAlt,
  FaVolumeUp,
} from "react-icons/fa";
import StepFlow from "../shared/StepFlow";
import AnimatedSection from "./AnimatedSection";
import LiquidSportText from "./LiquidSportText";

const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: (index) => ({
    opacity: 0,
    scale: 0.955,
    x: index % 2 === 0 ? -72 : 72,
    y: 26,
    rotate: index % 2 === 0 ? -2.4 : 2.4,
  }),
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 210,
      damping: 24,
      mass: 0.7,
    },
  },
};

const previewStaggerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.06,
      staggerChildren: 0.06,
    },
  },
};

const previewItemVariants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.94,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 24,
      mass: 0.7,
    },
  },
};

const previewTitleVariants = {
  hidden: {
    opacity: 0,
    y: 16,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const featureCards = [
  {
    title: "Walkie-Talkie",
    copy: "Multi-user walkie keeps the umpire, spectators, and director on one live channel for fast listen-and-respond audio.",
    accent: "emerald",
    previewType: "walkie",
  },
  {
    title: "Loudspeaker",
    copy: "Use one phone as a clean hold-to-talk PA mic for score calls, ground updates, and fast in-match announcements.",
    accent: "amber",
    previewType: "loudspeaker",
  },
  {
    title: "Score Announcer",
    copy: "Trigger cleaner score calls with tighter phrasing, better timing, and clearer delivery between balls.",
    accent: "violet",
    previewType: "announcer",
  },
  {
    title: "Director Console",
    copy: "Run sound effects, music, walkie, loudspeaker, and score audio from one sharper live control deck.",
    accent: "cyan",
    previewType: "director",
  },
  {
    title: "Share The Match",
    copy: "Share the live match in seconds so spectators can open the scoreboard on any phone, tablet, or big screen.",
    accent: "orange",
    previewType: "share",
  },
  {
    title: "Match Images",
    copy: "Upload match images once and carry them across the live scoreboard, spectator page, and final result screen.",
    accent: "rose",
    previewType: "cover",
  },
  {
    title: "Result Insights",
    copy: "Finish with cleaner result screens, sharper winner context, and a better summary of how the match closed out.",
    accent: "yellow",
    previewType: "insights",
  },
];

const journeyCards = [
  {
    title: "Teams And Session",
    copy: "Start the match with the session name, teams, and the first setup step ready in one place.",
    accent: "rose",
    previewType: "teams",
  },
  {
    title: "Toss",
    copy: "Run the toss cleanly, choose the side, and move straight into the innings decision.",
    accent: "amber",
    previewType: "toss",
  },
  {
    title: "Umpire Scoring",
    copy: "Score every ball quickly with a focused live panel for runs, extras, wickets, and the over.",
    accent: "orange",
    previewType: "umpire",
  },
  {
    title: "Spectator View",
    copy: "Keep phones and shared screens in sync with the live score, target, over, and match situation.",
    accent: "emerald",
    previewType: "spectator",
  },
  {
    title: "Match Status",
    copy: "See the match state clearly from live play to innings complete and final result.",
    accent: "cyan",
    previewType: "status",
  },
  {
    title: "Secure Match Access",
    copy: "Keep umpire and director controls protected behind the right PIN without slowing the flow.",
    accent: "violet",
    previewType: "access",
  },
];

function getAccentRail(accent) {
  switch (accent) {
    case "amber":
      return "from-rose-500 via-orange-400 to-amber-300";
    case "emerald":
      return "from-emerald-400 via-teal-300 to-cyan-400";
    case "rose":
      return "from-rose-500 via-pink-400 to-orange-400";
    case "violet":
      return "from-violet-400 via-fuchsia-400 to-indigo-400";
    case "yellow":
      return "from-amber-300 via-yellow-200 to-orange-400";
    case "orange":
      return "from-orange-400 via-amber-300 to-sky-400";
    default:
      return "from-sky-400 via-cyan-300 to-blue-500";
  }
}

function MiniBall({ label, tone = "green" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-300/18 bg-[linear-gradient(180deg,rgba(249,115,22,0.95),rgba(245,158,11,0.96))] text-black"
      : tone === "violet"
      ? "border-violet-300/18 bg-[linear-gradient(180deg,rgba(168,85,247,0.96),rgba(124,58,237,0.96))] text-white"
      : tone === "rose"
      ? "border-rose-300/18 bg-[linear-gradient(180deg,rgba(244,63,94,0.96),rgba(225,29,72,0.96))] text-white"
      : tone === "slate"
      ? "border-white/10 bg-[linear-gradient(180deg,rgba(63,63,70,0.96),rgba(39,39,42,0.96))] text-zinc-200"
      : "border-emerald-300/18 bg-[linear-gradient(180deg,rgba(34,197,94,0.96),rgba(22,163,74,0.96))] text-white";

  return (
    <motion.span
      variants={previewItemVariants}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${toneClass}`}
    >
      {label}
    </motion.span>
  );
}

function PreviewSurface({ accent, heading, children }) {
  return (
    <motion.div
      variants={previewStaggerVariants}
      className="relative overflow-hidden rounded-[26px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(12,14,20,0.96),rgba(7,8,12,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <motion.div
        variants={previewItemVariants}
        className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${getAccentRail(
          accent
        )}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_18%)]" />
      <div className="relative z-10">
        <motion.p
          variants={previewItemVariants}
          className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400 drop-shadow-[0_4px_12px_rgba(255,255,255,0.06)]"
        >
          {heading}
        </motion.p>
        <motion.div variants={previewStaggerVariants} className="mt-4">
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
}

function MiniStepFlowPreview() {
  return (
    <motion.div
      variants={previewItemVariants}
      className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-3 py-3"
    >
      <div className="w-[21rem] origin-top-left scale-[0.72]">
        <StepFlow currentStep={1} />
      </div>
    </motion.div>
  );
}

function renderJourneyPreview(card) {
  switch (card.previewType) {
    case "teams":
      return (
        <PreviewSurface accent={card.accent} heading="Step 1">
          <div className="space-y-3">
            <MiniStepFlowPreview />
            <motion.div
              variants={previewItemVariants}
              className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
                Session name
              </p>
              <div className="mt-2 rounded-[14px] border border-amber-300/16 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                Friday Night Finals
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Team A
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">GV Lions</p>
                </div>
                <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Team B
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">GV Tigers</p>
                </div>
              </div>
            </motion.div>
          </div>
        </PreviewSurface>
      );
    case "toss":
      return (
        <PreviewSurface accent={card.accent} heading="Toss">
          <div className="space-y-3">
            <motion.div variants={previewStaggerVariants} className="grid grid-cols-2 gap-3">
              <motion.div variants={previewItemVariants} className="btn-ui btn-ui-glass-dark justify-center rounded-[18px] px-3 py-4 text-[12px]">
                Heads
              </motion.div>
              <motion.div variants={previewItemVariants} className="btn-ui btn-ui-glass-dark-alt justify-center rounded-[18px] px-3 py-4 text-[12px]">
                Tails
              </motion.div>
            </motion.div>
            <motion.div
              variants={previewItemVariants}
              className="rounded-[20px] border border-amber-300/14 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.1),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
                Result
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold tracking-tight text-white">Heads</p>
                  <p className="mt-2 text-[12px] text-zinc-400">Team A chooses to bat first.</p>
                </div>
                <motion.span variants={previewItemVariants}>
                  <FaCheckCircle className="text-2xl text-emerald-300" />
                </motion.span>
              </div>
            </motion.div>
          </div>
        </PreviewSurface>
      );
    case "umpire":
      return (
        <PreviewSurface accent={card.accent} heading="Umpire Mode">
          <div className="space-y-3">
            <motion.div
              variants={previewItemVariants}
              className="flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-lg font-semibold text-white">52/3</p>
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Over 8.2</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">This over</p>
                <div className="mt-2 flex gap-1.5">
                  <MiniBall label="1" />
                  <MiniBall label="4" tone="amber" />
                  <MiniBall label="Wd" tone="amber" />
                  <MiniBall label="W" tone="rose" />
                </div>
              </div>
            </motion.div>
            <motion.div variants={previewStaggerVariants} className="grid grid-cols-4 gap-2">
              {[
                { label: "Dot", className: "bg-zinc-800 hover:bg-zinc-700 text-white" },
                { label: "1", className: "bg-zinc-800 hover:bg-zinc-700 text-white" },
                { label: "4", className: "bg-zinc-800 hover:bg-zinc-700 text-amber-300" },
                { label: "OUT", className: "bg-rose-700 hover:bg-rose-600 text-white" },
              ].map((action) => (
                <motion.div
                  key={action.label}
                  variants={previewItemVariants}
                  className={`flex min-h-[4.1rem] items-center justify-center rounded-[16px] border border-white/10 px-2 py-3 text-center text-[13px] font-bold uppercase tracking-[0.08em] shadow-[0_14px_26px_rgba(0,0,0,0.18)] ${action.className}`}
                >
                  {action.label}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </PreviewSurface>
      );
    case "spectator":
      return (
        <PreviewSurface accent={card.accent} heading="Spectator">
          <motion.div
            variants={previewItemVariants}
            className="rounded-[22px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,15,20,0.96),rgba(8,10,16,0.98))] p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.14),0_18px_44px_rgba(6,78,59,0.18)]"
          >
            <motion.div variants={previewItemVariants} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-semibold uppercase tracking-tight text-white">Team B</p>
                <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
                  Target 45
                </p>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
                  Need 43
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black leading-none text-amber-300">2</p>
                <p className="mt-1 text-[13px] font-black uppercase tracking-tight text-amber-300">
                  Runs
                </p>
              </div>
            </motion.div>
            <motion.div
              variants={previewItemVariants}
              className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Over 1
              </p>
              <motion.div variants={previewStaggerVariants} className="mt-3 flex gap-2">
                <MiniBall label="1" />
                <MiniBall label="1" />
              </motion.div>
            </motion.div>
          </motion.div>
        </PreviewSurface>
      );
    case "status":
      return (
        <PreviewSurface accent={card.accent} heading="Match Status">
          <div className="space-y-3">
            {[
              ["Live", "Scoring in progress"],
              ["Innings Complete", "Target locked in"],
              ["Final Result", "Winner available"],
            ].map(([title, meta], index) => (
              <motion.div
                key={title}
                variants={previewItemVariants}
                className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{meta}</p>
                </div>
                <motion.span
                  variants={previewItemVariants}
                  className={`h-2.5 w-2.5 rounded-full ${
                    index === 0 ? "bg-emerald-400" : index === 1 ? "bg-amber-300" : "bg-sky-300"
                  }`}
                />
              </motion.div>
            ))}
          </div>
        </PreviewSurface>
      );
    case "access":
      return (
        <PreviewSurface accent={card.accent} heading="PIN Entry">
          <div className="space-y-3">
            <motion.div variants={previewItemVariants} className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white">
                Home
              </span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/18 bg-emerald-400/10 text-emerald-200">
                <FaBroadcastTower className="text-sm" />
              </span>
            </motion.div>
            <motion.div
              variants={previewItemVariants}
              className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                Director PIN
              </p>
              <div className="mt-3 rounded-[16px] border border-emerald-300/18 bg-black/20 px-4 py-4 text-center text-xl font-semibold tracking-[0.5em] text-white">
                0000
              </div>
            </motion.div>
            <motion.div
              variants={previewItemVariants}
              className="btn-ui btn-ui-glass-dark inline-flex w-full justify-center rounded-[18px] px-4 py-3 text-[12px]"
            >
              <FaLock />
              Enter Console
            </motion.div>
          </div>
        </PreviewSurface>
      );
    default:
      return null;
  }
}

function renderFeaturePreview(card) {
  switch (card.previewType) {
    case "walkie":
      return (
        <PreviewSurface accent={card.accent} heading="Live Audio">
          <div className="space-y-3">
            <motion.div
              variants={previewItemVariants}
              className="rounded-[20px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,28,22,0.94),rgba(8,12,16,0.96))] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Walkie-Talkie</p>
                  <p className="mt-1 text-[12px] text-zinc-400">Tap and hold to talk.</p>
                </div>
                <motion.div
                  variants={previewItemVariants}
                  className="inline-flex h-6 w-11 rounded-full border border-emerald-300/30 bg-emerald-400/18"
                >
                  <motion.span
                    variants={previewItemVariants}
                    className="mt-0.5 inline-flex h-5 w-5 translate-x-5 rounded-full bg-white"
                  />
                </motion.div>
              </div>
              <motion.div variants={previewItemVariants} className="mt-4 flex items-center justify-between gap-3">
                <motion.div variants={previewStaggerVariants} className="flex flex-wrap gap-2">
                  {["Umpire", "Director", "Spectators"].map((label) => (
                    <motion.span
                      key={label}
                      variants={previewItemVariants}
                      className="rounded-full border border-emerald-300/16 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/90"
                    >
                      {label}
                    </motion.span>
                  ))}
                </motion.div>
                <motion.span
                  variants={previewItemVariants}
                  className="inline-flex h-18 w-18 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl text-white"
                >
                  <FaBroadcastTower />
                </motion.span>
              </motion.div>
            </motion.div>
          </div>
        </PreviewSurface>
      );
    case "loudspeaker":
      return (
        <PreviewSurface accent={card.accent} heading="PA Mic">
          <div className="space-y-3">
            <motion.div
              variants={previewItemVariants}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">Loudspeaker</p>
                <p className="mt-1 text-[11px] text-zinc-500">Armed for hold to talk.</p>
              </div>
              <motion.div
                variants={previewItemVariants}
                className="inline-flex h-6 w-11 rounded-full border border-emerald-300/30 bg-emerald-400/18"
              >
                <motion.span
                  variants={previewItemVariants}
                  className="mt-0.5 inline-flex h-5 w-5 translate-x-5 rounded-full bg-white"
                />
              </motion.div>
            </motion.div>
            <motion.div
              variants={previewItemVariants}
              className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-center"
            >
              <motion.span
                variants={previewItemVariants}
                className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/18 bg-[linear-gradient(180deg,rgba(249,115,22,0.94),rgba(245,158,11,0.94))] text-2xl text-black"
              >
                <FaMicrophoneAlt />
              </motion.span>
              <motion.p variants={previewItemVariants} className="mt-3 text-sm font-semibold text-white">
                Hold to talk live
              </motion.p>
            </motion.div>
          </div>
        </PreviewSurface>
      );
    case "director":
      return (
        <PreviewSurface accent={card.accent} heading="Director">
          <div className="space-y-3">
            <motion.div
              variants={previewItemVariants}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(8,24,36,0.96),rgba(9,12,18,0.98))] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">Live control rack</p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Audio, crowd effects, and talkback in one place.
                </p>
              </div>
              <span className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100/90">
                Armed
              </span>
            </motion.div>
            <motion.div variants={previewStaggerVariants} className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {[
                ["Walkie", FaBroadcastTower, "Live"],
                ["PA Mic", FaBullhorn, "Ready"],
                ["Music", FaMusic, "Deck A"],
                ["Effects", FaVolumeUp, "6 pads"],
                ["Announcer", FaMicrophoneAlt, "Queued"],
                ["Crowd", FaVolumeUp, "Hot"],
              ].map(([label, Icon, meta], index) => (
                <motion.div
                  key={label}
                  variants={previewItemVariants}
                  className={`rounded-[18px] border px-3 py-3 ${
                    index === 0 || index === 1
                      ? "border-cyan-300/16 bg-[linear-gradient(180deg,rgba(37,99,235,0.16),rgba(17,24,39,0.92))]"
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]"
                  }`}
                >
                  <Icon className="text-sm text-white" />
                  <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{meta}</p>
                </motion.div>
              ))}
            </motion.div>
            <motion.div
              variants={previewStaggerVariants}
              className="grid gap-2 rounded-[20px] border border-white/10 bg-white/[0.03] p-3"
            >
              {[
                ["Mic", "84%"],
                ["Music", "62%"],
                ["FX", "71%"],
              ].map(([label, value]) => (
                <motion.div
                  key={label}
                  variants={previewItemVariants}
                  className="flex items-center gap-3"
                >
                  <span className="w-11 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    {label}
                  </span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(59,130,246,0.95),rgba(251,191,36,0.9))]"
                      style={{ width: value }}
                    />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    {value}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </PreviewSurface>
      );
    case "share":
      return (
        <PreviewSurface accent={card.accent} heading="Share">
          <div className="space-y-3">
            <motion.div
              variants={previewItemVariants}
              className="rounded-[20px] border border-orange-300/16 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_30%),linear-gradient(180deg,rgba(30,20,14,0.96),rgba(10,10,14,0.98))] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Live match link</p>
                  <p className="mt-1 text-[12px] text-zinc-400">Share instantly with players and spectators.</p>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-orange-300/16 bg-orange-400/10 text-orange-200">
                  <FaShareAlt />
                </span>
              </div>
              <div className="mt-4 rounded-[16px] border border-white/10 bg-black/20 px-3 py-3 text-[12px] text-zinc-300">
                gvcricket.live/session/friday-finals
              </div>
            </motion.div>
            <motion.div variants={previewStaggerVariants} className="grid grid-cols-3 gap-2">
              {["Phone", "Tablet", "Big Screen"].map((label) => (
                <motion.div
                  key={label}
                  variants={previewItemVariants}
                  className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300"
                >
                  {label}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </PreviewSurface>
      );
    case "announcer":
      return (
        <PreviewSurface accent={card.accent} heading="Voice">
          <div className="space-y-3">
            <motion.div
              variants={previewItemVariants}
              className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
            >
              <p className="text-sm font-semibold text-white">Current score</p>
              <p className="mt-2 text-[12px] text-zinc-400">Team B 52 for 3 after 8.2 overs.</p>
            </motion.div>
            <motion.div
              variants={previewItemVariants}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-violet-300/16 bg-[linear-gradient(180deg,rgba(124,58,237,0.16),rgba(20,14,32,0.94))] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">Announcer ready</p>
                <p className="mt-1 text-[11px] text-zinc-300">Next ball update is queued.</p>
              </div>
              <motion.span variants={previewItemVariants}>
                <FaVolumeUp className="text-lg text-violet-200" />
              </motion.span>
            </motion.div>
          </div>
        </PreviewSurface>
      );
    case "cover":
      return (
        <PreviewSurface accent={card.accent} heading="Cover Image">
          <div className="space-y-3">
            <motion.div
              variants={previewItemVariants}
              className="rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_32%),linear-gradient(180deg,rgba(30,24,26,0.96),rgba(12,10,14,0.98))] p-3"
            >
              <div className="rounded-[18px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 text-center">
                <FaImage className="mx-auto text-2xl text-white/80" />
                <p className="mt-3 text-sm font-semibold text-white">Upload match image</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  Live, spectator, result
                </p>
              </div>
            </motion.div>
            <motion.p variants={previewItemVariants} className="text-[12px] leading-6 text-zinc-400">
              Upload once and reuse the same match image everywhere the session appears.
            </motion.p>
          </div>
        </PreviewSurface>
      );
    case "insights":
      return (
        <PreviewSurface accent={card.accent} heading="Result">
          <div className="space-y-3">
            <motion.div
              variants={previewItemVariants}
              className="rounded-[22px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(217,119,6,0.12))] p-4"
            >
              <p className="text-xl font-black tracking-[-0.04em] text-white">Team A won</p>
              <p className="mt-2 text-sm text-zinc-100/82">Won by 7 wickets</p>
            </motion.div>
            <motion.div variants={previewStaggerVariants} className="grid grid-cols-3 gap-2">
              {[
                ["44/4", "Score"],
                ["4.0", "Overs"],
                ["11.00", "RR"],
              ].map(([value, label]) => (
                <motion.div
                  key={label}
                  variants={previewItemVariants}
                  className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-3 py-3"
                >
                  <p className="text-sm font-semibold text-white">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                    {label}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </PreviewSurface>
      );
    default:
      return null;
  }
}

function useCardScrollMotion(prefersReducedMotion, accent, index) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.94", "end 0.08"],
  });
  const direction = index % 2 === 0 ? -1 : 1;
  const springConfig = { stiffness: 180, damping: 30, mass: 0.32 };

  const cardY = useSpring(useTransform(scrollYProgress, [0, 0.5, 1], [18, 0, -8]), springConfig);
  const cardX = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [direction * 30, 0, direction * -12]),
    springConfig
  );
  const cardRotateZ = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [direction * 2.1, 0, direction * -0.8]),
    springConfig
  );
  const cardRotateY = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [direction * 7, 0, direction * -2.5]),
    springConfig
  );
  const cardRotateX = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [4.5, 0, -1.4]),
    springConfig
  );
  const cardScale = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [0.972, 1, 0.992]),
    springConfig
  );
  const glowOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.32, 0.7, 1], [0.36, 0.78, 0.9, 0.52]),
    springConfig
  );
  const previewY = useSpring(useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -4]), springConfig);
  const previewX = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [direction * 20, 0, direction * -6]),
    springConfig
  );
  const previewRotateY = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [direction * -6, 0, direction * 2]),
    springConfig
  );
  const previewRotateX = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [-3, 0, 1.2]),
    springConfig
  );
  const previewScale = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [0.965, 1, 0.995]),
    springConfig
  );
  const contentY = useSpring(useTransform(scrollYProgress, [0, 0.5, 1], [8, 0, -4]), springConfig);
  const contentX = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [direction * -12, 0, direction * 4]),
    springConfig
  );
  const contentRotateZ = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [direction * -0.7, 0, direction * 0.25]),
    springConfig
  );
  const accentSweepOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.35, 0.75, 1], [0.07, 0.16, 0.22, 0.1]),
    springConfig
  );
  const accentSweepX = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [direction * -14, 0, direction * 10]),
    springConfig
  );

  if (prefersReducedMotion) {
    return {
      ref,
      cardStyle: undefined,
      glowStyle: undefined,
      previewStyle: undefined,
      contentStyle: undefined,
      accentSweepStyle: undefined,
    };
  }

  return {
    ref,
    cardStyle: {
      x: cardX,
      y: cardY,
      rotateZ: cardRotateZ,
      rotateX: cardRotateX,
      rotateY: cardRotateY,
      scale: cardScale,
      transformPerspective: 1100,
    },
    glowStyle: { opacity: glowOpacity },
    previewStyle: {
      x: previewX,
      y: previewY,
      rotateY: previewRotateY,
      rotateX: previewRotateX,
      scale: previewScale,
      transformPerspective: 1000,
    },
    contentStyle: {
      x: contentX,
      y: contentY,
      rotateZ: contentRotateZ,
      transformPerspective: 900,
    },
    accentSweepStyle: { opacity: accentSweepOpacity, x: accentSweepX },
  };
}

function FeatureCard({ card, index, prefersReducedMotion }) {
  const { ref, cardStyle, glowStyle, previewStyle, contentStyle, accentSweepStyle } = useCardScrollMotion(
    prefersReducedMotion,
    card.accent,
    index
  );

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      whileHover={
        prefersReducedMotion
          ? undefined
          : {
              y: -6,
              scale: 1.012,
              rotateX: -1.5,
              rotateY: index % 2 === 0 ? -2.2 : 2.2,
              transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
            }
      }
      style={cardStyle}
      className={`liquid-glass-soft group relative h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6 ${
        card.previewType === "director" ? "md:col-span-2 xl:col-span-2" : ""
      } will-change-transform [transform-style:preserve-3d]`}
    >
      <motion.div
        style={glowStyle}
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-90`}
      />
      <motion.div
        style={accentSweepStyle}
        className={`pointer-events-none absolute inset-y-6 ${index % 2 === 0 ? "-left-8" : "-right-8"} w-28 rounded-full bg-gradient-to-b ${getAccentRail(
          card.accent
        )} blur-3xl`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-80" />
      <div className="relative z-10 flex h-full flex-col">
        <motion.div
          style={previewStyle}
          className="transform-gpu will-change-transform [backface-visibility:hidden] [transform-style:preserve-3d]"
        >
          {renderFeaturePreview(card)}
        </motion.div>
        <motion.div
          variants={previewStaggerVariants}
          style={contentStyle}
          className="mt-5 flex-1 will-change-transform"
        >
          <motion.h3
            variants={previewTitleVariants}
            className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem]"
          >
            {card.title}
          </motion.h3>
          <motion.p
            variants={previewItemVariants}
            className="mt-3 text-[15px] leading-7 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
          >
            {card.copy}
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}

function JourneyCard({ card, index, prefersReducedMotion }) {
  const { ref, cardStyle, glowStyle, previewStyle, contentStyle, accentSweepStyle } = useCardScrollMotion(
    prefersReducedMotion,
    card.accent,
    index
  );

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      whileHover={
        prefersReducedMotion
          ? undefined
          : {
              y: -6,
              scale: 1.012,
              rotateX: -1.5,
              rotateY: index % 2 === 0 ? -2.2 : 2.2,
              transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
            }
      }
      style={cardStyle}
      className="liquid-glass-soft group relative h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] will-change-transform [transform-style:preserve-3d] sm:p-6"
    >
      <motion.div
        style={glowStyle}
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-90`}
      />
      <motion.div
        style={accentSweepStyle}
        className={`pointer-events-none absolute inset-y-6 ${index % 2 === 0 ? "-left-8" : "-right-8"} w-28 rounded-full bg-gradient-to-b ${getAccentRail(
          card.accent
        )} blur-3xl`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-80" />
      <div className="relative z-10 flex h-full flex-col">
        <motion.div
          style={previewStyle}
          className="transform-gpu will-change-transform [backface-visibility:hidden] [transform-style:preserve-3d]"
        >
          {renderJourneyPreview(card)}
        </motion.div>
        <motion.div
          variants={previewStaggerVariants}
          style={contentStyle}
          className="mt-5 flex-1 will-change-transform"
        >
          <motion.h3
            variants={previewTitleVariants}
            className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem]"
          >
            {card.title}
          </motion.h3>
          <motion.p
            variants={previewItemVariants}
            className="mt-3 text-[15px] leading-7 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
          >
            {card.copy}
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function HowItWorksSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatedSection
      id="updates"
      direction="left"
      className="mx-auto w-full max-w-7xl scroll-mt-28 overflow-hidden 2xl:max-w-[96rem]"
    >
      <div className="space-y-8">
        <motion.div
          initial={
            prefersReducedMotion
              ? false
              : { opacity: 0, x: -34, y: 18, scale: 0.992, filter: "blur(6px)" }
          }
          whileInView={
            prefersReducedMotion
              ? undefined
              : { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }
          }
          viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
          transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
          className="liquid-glass-soft rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(8,8,14,0.62))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10"
        >
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-amber-200/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.2),rgba(120,53,15,0.16))] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_rgba(245,158,11,0.18)]">
              Latest Features
            </span>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.34em] text-white/48">
              GV Cricket 2.0
            </p>
            <div className="mt-3">
              <LiquidSportText
                text={["Explore all the", "latest features"]}
                characterTyping
                characterStagger={0.02}
                characterLineDelay={0.14}
                className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                lineClassName="leading-[0.98]"
              />
            </div>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
            variants={gridVariants}
            className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
          >
            {featureCards.map((card, index) => (
              <FeatureCard
                key={card.title}
                card={card}
                index={index}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={
            prefersReducedMotion
              ? false
              : { opacity: 0, x: 34, y: 18, scale: 0.992, filter: "blur(6px)" }
          }
          whileInView={
            prefersReducedMotion
              ? undefined
              : { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }
          }
          viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
          transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1], delay: 0.03 }}
          className="liquid-glass-soft rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(8,8,14,0.62))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10"
        >
          <div className="mx-auto max-w-3xl text-center">
            <LiquidSportText
              text={["From toss to final", "result"]}
              characterTyping
              characterStagger={0.02}
              characterLineDelay={0.14}
              className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
              lineClassName="leading-[0.98]"
            />
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/72 md:text-base">
              A fresh live match flow with instant scoring, premium spectator view, smarter match status, and secure access from start to finish.
            </p>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
            variants={gridVariants}
            className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {journeyCards.map((card, index) => (
              <JourneyCard
                key={card.title}
                card={card}
                index={index}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}
