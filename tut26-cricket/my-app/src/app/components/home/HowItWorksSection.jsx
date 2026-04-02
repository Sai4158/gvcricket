"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  FaArrowRight,
  FaBars,
  FaBroadcastTower,
  FaBullhorn,
  FaBullseye,
  FaCheckCircle,
  FaEye,
  FaImage,
  FaLock,
  FaMicrophoneAlt,
  FaMusic,
  FaShareAlt,
  FaTrophy,
  FaVolumeUp,
  FaYoutube,
} from "react-icons/fa";
import StepFlow from "../shared/StepFlow";
import SafeMatchImage from "../shared/SafeMatchImage";
import { SpinningCoin } from "../toss/CoinArt";
import AnimatedSection from "./AnimatedSection";
import LiquidSportText from "./LiquidSportText";
import useHomeDesktopLiteMotion from "./useHomeDesktopLiteMotion";
import useHomeDesktopReveal from "./useHomeDesktopReveal";

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
  hidden: () => ({
    opacity: 0,
    scale: 0.986,
    y: 18,
  }),
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.62,
      ease: [0.22, 1, 0.36, 1],
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
    y: 12,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.48,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const previewTitleVariants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function DesktopLiteHeadline({
  text,
  isVisible,
  className = "",
  lineClassName = "",
  delay = 0,
}) {
  const lines = Array.isArray(text) ? text : [text];

  return (
    <div className={className}>
      {lines.map((line, lineIndex) => {
        const parts = line.split(/(\s+)/);
        let wordIndex = 0;

        return (
          <span key={`${line}-${lineIndex}`} className={`block whitespace-pre ${lineClassName}`}>
            {parts.map((part, partIndex) => {
              if (!part) {
                return null;
              }

              if (/^\s+$/.test(part)) {
                return <span key={`${lineIndex}-space-${partIndex}`}>{part}</span>;
              }

              const wordDelayMs = Math.round(
                (delay + lineIndex * 0.16 + wordIndex * 0.08) * 1000
              );
              wordIndex += 1;

              return (
                <span
                  key={`${lineIndex}-word-${partIndex}`}
                  className={`inline-block text-white [text-rendering:geometricPrecision] drop-shadow-[0_10px_26px_rgba(0,0,0,0.42)] home-heading-word-reveal ${
                    isVisible ? "is-visible" : ""
                  }`}
                  style={{
                    "--home-word-delay": `${wordDelayMs}ms`,
                    "--home-word-duration": "0.78s",
                  }}
                >
                  {part}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

const featureCards = [
  {
    title: "Walkie-Talkie",
    copy: "One live talk channel for the umpire, director, and spectators. It keeps quick calls and responses on the same line.",
    accent: "emerald",
    previewType: "walkie",
  },
  {
    title: "Loudspeaker",
    copy: "Turn one phone into a quick PA mic for score calls and ground updates. It works well for small grounds, local tournaments, and indoor screens.",
    accent: "amber",
    previewType: "loudspeaker",
  },
  {
    title: "Score Announcer",
    copy: "Read the score out loud with cleaner timing and clearer voice updates. That helps players and viewers hear the match state without looking down.",
    accent: "violet",
    previewType: "announcer",
  },
  {
    title: "Share The Match",
    copy: "Share one live link so anyone can follow the match on any screen. Phones, tablets, and TVs can all open the same live scoreboard fast.",
    accent: "orange",
    previewType: "share",
  },
  {
    title: "Match Images",
    copy: "Use one match image across the live, spectator, and result screens. It keeps every match page looking consistent from start to finish.",
    accent: "rose",
    previewType: "cover",
  },
  {
    title: "Result Insights",
    copy: "Finish with a clear result screen and a better winner summary. The last screen feels complete instead of looking like a raw scoreboard dump.",
    accent: "yellow",
    previewType: "insights",
  },
  {
    title: "Director Console",
    copy: "Control music, effects, walkie, and live audio from one screen. It gives one operator a cleaner way to run the full match sound desk.",
    accent: "cyan",
    previewType: "director",
  },
  {
    title: "Live Match Banner",
    copy: "Bring the newest live match to the home page for one-tap viewing. Anyone opening the site can jump straight into the live game.",
    accent: "emerald",
    previewType: "livebanner",
  },
];

const journeyCards = [
  {
    title: "Create Teams And Session",
    copy: "Create the match, add two teams, and start from one clean setup screen. The setup stays simple even for someone running a local game quickly.",
    accent: "rose",
    previewType: "teams",
  },
  {
    title: "Run The Toss",
    copy: "Choose who starts with the bat or ball, then go live. The toss flow is quick and clear before the first ball is scored.",
    accent: "amber",
    previewType: "toss",
  },
  {
    title: "Control The Match In Umpire Mode",
    copy: "One live screen lets you update the score, mark wickets and extras, read the score aloud, use walkie-talkie, and play sound effects. It is designed so one person can run the whole live match from one phone.",
    accent: "orange",
    previewType: "umpire",
  },
  {
    title: "Track Ball History",
    copy: "See recent balls in order so everyone knows what just happened. That makes it easier to understand the latest over without asking again.",
    accent: "cyan",
    previewType: "history",
  },
  {
    title: "Share The Spectator View",
    copy: "Share one simple link so anyone can follow the match on any screen. Spectators do not need umpire access or match controls to keep up.",
    accent: "emerald",
    previewType: "spectator",
  },
  {
    title: "Read Match Status Fast",
    copy: "Show the score, target, overs left, and whether the game is live or finished. It also makes innings changes and final results easy to spot.",
    accent: "cyan",
    previewType: "status",
  },
  {
    title: "Talk With In-Match Walkie",
    copy: "Let the umpire and director talk live when something needs attention. That keeps decisions and coordination inside the match instead of outside apps.",
    accent: "emerald",
    previewType: "match-walkie",
  },
  {
    title: "Use Loudspeaker And Announcer",
    copy: "Play spoken updates, PA calls, and effects without leaving the match. Audio stays part of the live scoring flow instead of a separate setup.",
    accent: "violet",
    previewType: "match-audio",
  },
  {
    title: "Keep Match Access Secure",
    copy: "Protect control screens with a PIN while keeping the viewer side easy to open. The right people get match control without slowing down the flow.",
    accent: "violet",
    previewType: "access",
  },
];

const miniCelebrationConfetti = [
  { left: "8%", delay: "0.1s", duration: "4.3s", rotate: "12deg", color: "#facc15" },
  { left: "18%", delay: "0.5s", duration: "4.9s", rotate: "-16deg", color: "#fde68a" },
  { left: "31%", delay: "0.2s", duration: "4.5s", rotate: "18deg", color: "#ffffff" },
  { left: "46%", delay: "0.7s", duration: "5.1s", rotate: "-10deg", color: "#f59e0b" },
  { left: "61%", delay: "0.35s", duration: "4.6s", rotate: "15deg", color: "#facc15" },
  { left: "75%", delay: "0.8s", duration: "5.3s", rotate: "-14deg", color: "#fde68a" },
  { left: "88%", delay: "0.45s", duration: "4.8s", rotate: "11deg", color: "#ffffff" },
];

const animatedUmpireFrames = [
  { target: "39", score: "20/0", overs: "2.1", oversLeft: "(23)", activeAction: "Dot" },
  { target: "39", score: "21/0", overs: "2.2", oversLeft: "(22)", activeAction: "1" },
  { target: "39", score: "23/0", overs: "2.3", oversLeft: "(21)", activeAction: "2" },
  { target: "39", score: "26/0", overs: "2.4", oversLeft: "(20)", activeAction: "3" },
  { target: "39", score: "30/0", overs: "2.5", oversLeft: "(19)", activeAction: "4" },
  { target: "39", score: "31/0", overs: "2.5", oversLeft: "(19)", activeAction: "Wide" },
  { target: "39", score: "37/0", overs: "2.6", oversLeft: "(18)", activeAction: "6" },
  { target: "39", score: "37/1", overs: "3.0", oversLeft: "(18)", activeAction: "OUT" },
];

const animatedHistoryFrames = [
  {
    scoreLine: "Team A 49/3",
    balls: [{ label: "1" }],
    note: "Ball 1 added",
  },
  {
    scoreLine: "Team A 53/3",
    balls: [{ label: "1" }, { label: "4", tone: "amber" }],
    note: "Ball 2 added",
  },
  {
    scoreLine: "Team A 54/3",
    balls: [{ label: "1" }, { label: "4", tone: "amber" }, { label: "Wd", tone: "amber" }],
    note: "Ball 3 added",
  },
  {
    scoreLine: "Team A 54/4",
    balls: [
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "Wd", tone: "amber" },
      { label: "W", tone: "rose" },
    ],
    note: "Ball 4 added",
  },
  {
    scoreLine: "Team A 56/4",
    balls: [
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "Wd", tone: "amber" },
      { label: "W", tone: "rose" },
      { label: "2" },
    ],
    note: "Ball 5 added",
  },
  {
    scoreLine: "Team A 57/4",
    balls: [
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "Wd", tone: "amber" },
      { label: "W", tone: "rose" },
      { label: "2" },
      { label: "1" },
    ],
    note: "Over complete",
  },
];

const animatedSpectatorFrames = [
  { target: "45", need: "44", runs: "1", balls: [{ label: "1" }] },
  { target: "45", need: "43", runs: "2", balls: [{ label: "1" }, { label: "1" }] },
  { target: "45", need: "42", runs: "3", balls: [{ label: "1" }, { label: "1" }, { label: "1" }] },
  {
    target: "45",
    need: "38",
    runs: "7",
    balls: [{ label: "1" }, { label: "1" }, { label: "1" }, { label: "4", tone: "amber" }],
  },
  {
    target: "45",
    need: "37",
    runs: "8",
    balls: [
      { label: "1" },
      { label: "1" },
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "1" },
    ],
  },
];

const animatedTeamsFrames = [
  {
    step: 1,
    heading: "Session setup",
    type: "session",
    sessionName: "Friday Night Finals",
    sessionNote: "Give the match a clear name first.",
    note: "Start with the match name.",
    badge: "Setup",
  },
  {
    step: 2,
    heading: "Teams ready",
    type: "teams",
    sessionName: "Friday Night Finals",
    teamA: "Team Blue",
    teamB: "Team Red",
    note: "Add both teams before the toss.",
    badge: "Teams",
  },
  {
    step: 3,
    heading: "Run the toss",
    type: "toss",
    sessionName: "Friday Night Finals",
    caller: "Team Blue calls Heads",
    selectedSide: "Heads",
    result: "Heads lands. Team Blue wins the toss.",
    note: "Now choose whether to bat or bowl first.",
    badge: "Toss",
  },
  {
    step: 4,
    heading: "Start the match",
    type: "decision",
    sessionName: "Friday Night Finals",
    tossWinner: "Team Blue",
    decision: "Bat first",
    support: "Team Red starts with the ball.",
    note: "Toss is done and umpire mode is ready.",
    badge: "Ready",
  },
];

const animatedLoudspeakerFrames = [
  { status: "Armed for hold to talk.", footer: "Ready for next call", live: false },
  { status: "Score call is live.", footer: "PA mic active", live: true },
  { status: "Ground update in progress.", footer: "Voice is reaching speakers", live: true },
  { status: "Mic is back on standby.", footer: "Ready for the next call", live: false },
];

const animatedWalkieFeatureFrames = [
  { speaker: "Umpire live", note: "Director listening", badges: ["Umpire", "Director", "Spectators"] },
  { speaker: "Director live", note: "Umpire ready to reply", badges: ["Director", "Umpire", "Spectators"] },
  { speaker: "Spectator request", note: "Umpire can answer fast", badges: ["Spectators", "Umpire", "Director"] },
];

const animatedAnnouncerFrames = [
  { score: "Team B 52 for 3 after 8.2 overs.", queue: "Next update is queued." },
  { score: "Team B 56 for 3 after 8.4 overs.", queue: "Boundary call ready." },
  { score: "Target 45. Team B needs 37.", queue: "Chase update queued." },
];

const animatedShareFrames = [
  { url: "gvcricket.live/session/friday-finals", activeDevice: "Phone", note: "Share opens fast" },
  { url: "gvcricket.live/session/friday-finals", activeDevice: "Tablet", note: "Works on larger screens" },
  { url: "gvcricket.live/session/friday-finals", activeDevice: "Big Screen", note: "Good for score display" },
];

const animatedCoverFrames = [
  { label: "Live", tone: "rose", note: "Shown on the live match page." },
  { label: "Spectator", tone: "cyan", note: "Carries into the viewer page." },
  { label: "Result", tone: "amber", note: "Still looks right on the final card." },
];

const animatedInsightsFrames = [
  { winner: "Team A won", detail: "Won by 7 wickets", score: "44/4", overs: "4.0", rr: "11.00" },
  { winner: "Team B won", detail: "Won by 12 runs", score: "61/5", overs: "6.0", rr: "10.16" },
  { winner: "Team A won", detail: "Won by 2 wickets", score: "39/4", overs: "5.4", rr: "6.88" },
];

const animatedDirectorFrames = [
  {
    activeLabels: ["Walkie", "PA Mic"],
    meters: { mic: "84%", music: "62%", fx: "71%" },
  },
  {
    activeLabels: ["Announcer", "Effects"],
    meters: { mic: "68%", music: "54%", fx: "82%" },
  },
  {
    activeLabels: ["YouTube", "Crowd"],
    meters: { mic: "39%", music: "78%", fx: "66%" },
  },
];

const animatedLiveBannerFrames = [
  { teams: "TEAM A vs TEAM B", score: "1/0 - View score now" },
  { teams: "TEAM BLUE vs TEAM RED", score: "23/0 - Live in over 3" },
  { teams: "RED ROCKETS vs BLUE BLAZERS", score: "Final over live now" },
];

const animatedJourneyWalkieFrames = [
  { title: "Walkie live", note: "Umpire speaking now.", counts: [["Umpire", "live"], ["Director", "ready"], ["Spectators", "2 joined"]] },
  { title: "Director reply", note: "Director speaking back.", counts: [["Umpire", "ready"], ["Director", "live"], ["Spectators", "2 joined"]] },
  { title: "Walkie live", note: "Spectators can still listen.", counts: [["Umpire", "ready"], ["Director", "ready"], ["Spectators", "3 joined"]] },
];

const animatedJourneyAudioFrames = [
  { call: "Team A 52 for 3 after 8.2 overs.", sub: "Score call queued." },
  { call: "Four runs. Team A moves to 56 for 3.", sub: "Boundary update ready." },
  { call: "Target 45. Team B needs 37.", sub: "Chase update ready." },
];

const animatedAccessFrames = [
  { pin: "• - - -", status: "Start secure entry" },
  { pin: "• • - -", status: "PIN checking" },
  { pin: "• • • •", status: "Access granted" },
];

function getJourneyStepLabel(index) {
  return `Step ${String(index + 1).padStart(2, "0")}`;
}

function getCompactCardCopy(copy) {
  const text = String(copy || "").trim();

  if (!text) {
    return "";
  }

  const sentences =
    text
      .match(/[^.!?]+[.!?]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) || [];

  if (!sentences.length) {
    return text;
  }

  const firstSentence = sentences[0];
  const words = firstSentence.split(/\s+/).filter(Boolean);

  if (firstSentence.length <= 96 && words.length <= 15) {
    return firstSentence;
  }

  if (words.length <= 15) {
    return firstSentence.slice(0, 92).trim().replace(/[,\s]+$/, "") + "...";
  }

  return words.slice(0, 14).join(" ").replace(/[,\s]+$/, "") + "...";
}

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

function getPreviewNodeSet(staticMode) {
  return {
    Div: staticMode ? "div" : motion.div,
    Span: staticMode ? "span" : motion.span,
    P: staticMode ? "p" : motion.p,
    withVariants: (variants) => (staticMode ? {} : { variants }),
  };
}

function MiniBall({ label, tone = "green", staticMode = false }) {
  const { Span } = getPreviewNodeSet(staticMode);
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
    <Span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold shadow-[0_8px_18px_rgba(0,0,0,0.18)] sm:h-9 sm:w-9 sm:text-xs sm:shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${toneClass}`}
    >
      {label}
    </Span>
  );
}

function PreviewSurface({ accent, heading, children, staticMode = false }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);

  return (
    <Div
      {...withVariants(previewStaggerVariants)}
      className={`relative overflow-hidden rounded-[26px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(12,14,20,0.96),rgba(7,8,12,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
        staticMode
          ? "home-desktop-preview-surface home-updates-desktop-preview"
          : "home-desktop-preview-surface"
      }`}
    >
      <Div
        {...withVariants(previewItemVariants)}
        className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${getAccentRail(
          accent
        )}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_18%)]" />
      <div className="relative z-10">
        <P
          {...withVariants(previewItemVariants)}
          className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400 drop-shadow-[0_4px_12px_rgba(255,255,255,0.06)]"
        >
          {heading}
        </P>
        <Div {...withVariants(previewStaggerVariants)} className="mt-4">
          {children}
        </Div>
      </div>
    </Div>
  );
}

function MiniStepFlowPreview({ staticMode = false }) {
  const { Div, withVariants } = getPreviewNodeSet(staticMode);

  return (
    <Div
      {...withVariants(previewItemVariants)}
      className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-3 py-3"
    >
      <div className="w-[21rem] origin-top-left scale-[0.72]">
        <StepFlow currentStep={1} />
      </div>
    </Div>
  );
}

function MiniTossSpinner() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex justify-center py-1">
      <motion.div
        animate={reduceMotion ? undefined : { rotateY: 720 }}
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 6,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              }
        }
        className="transform-3d scale-[0.5]"
      >
        <SpinningCoin />
      </motion.div>
    </div>
  );
}

function MiniPulseDot({ tone = "emerald" }) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.65)]"
      : tone === "violet"
      ? "bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.55)]"
      : tone === "cyan"
      ? "bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.55)]"
      : "bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.6)]";

  const ringClass =
    tone === "amber"
      ? "bg-amber-300/32"
      : tone === "violet"
      ? "bg-violet-300/28"
      : tone === "cyan"
      ? "bg-cyan-300/28"
      : "bg-emerald-300/30";

  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className={`absolute inset-0 rounded-full ${ringClass} animate-ping`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${toneClass}`} />
    </span>
  );
}

function MiniAudioBars({ tone = "emerald" }) {
  const reduceMotion = useReducedMotion();
  const barClass =
    tone === "amber"
      ? "bg-amber-300/90"
      : tone === "violet"
      ? "bg-violet-300/90"
      : tone === "cyan"
      ? "bg-cyan-300/90"
      : "bg-emerald-300/90";
  const barPatterns = [
    [8, 16, 10],
    [14, 7, 15],
    [10, 18, 8],
    [16, 9, 14],
  ];

  return (
    <div className="flex h-5 items-end gap-1">
      {barPatterns.map((pattern, index) => (
        <motion.span
          key={`${tone}-${index}`}
          className={`block w-1 rounded-full ${barClass}`}
          style={{ height: `${pattern[0]}px` }}
          animate={reduceMotion ? undefined : { height: pattern.map((value) => `${value}px`) }}
          transition={{
            duration: 1.2 + index * 0.08,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
            delay: index * 0.08,
          }}
        />
      ))}
    </div>
  );
}

function useLoopedFrame(frameCount, intervalMs = 1600) {
  const reduceMotion = useReducedMotion();
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion || frameCount <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frameCount);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [frameCount, intervalMs, reduceMotion]);

  return reduceMotion || frameCount <= 1 ? 0 : frameIndex % frameCount;
}

function AnimatedStepFlowPreview({ staticMode = false }) {
  const { Div, withVariants } = getPreviewNodeSet(staticMode);
  const currentStep = useLoopedFrame(4, 1450) + 1;

  return (
    <Div
      {...withVariants(previewItemVariants)}
      className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-3 py-3"
    >
      <motion.div
        key={currentStep}
        initial={{ opacity: 0.7, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="w-[21rem] origin-top-left scale-[0.72]"
      >
        <StepFlow currentStep={currentStep} />
      </motion.div>
    </Div>
  );
}

function AnimatedTeamsJourneyPreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedTeamsFrames.length, 1650);
  const frame = animatedTeamsFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading={`Step ${frame.step}`} staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-3 py-3"
        >
          <motion.div
            key={frame.step}
            initial={{ opacity: 0.72, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="w-[21rem] origin-top-left scale-[0.72]"
          >
            <StepFlow currentStep={frame.step} />
          </motion.div>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3"
        >
          <motion.div
            key={`${frame.step}-${frame.heading}`}
            initial={{ opacity: 0.74, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <P className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
              {frame.heading}
            </P>
            {frame.type === "session" ? (
              <div className="mt-2 space-y-3">
                <div className="rounded-[14px] border border-amber-300/16 bg-black/20 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Session name</p>
                  <p className="mt-2 text-sm font-semibold text-white">{frame.sessionName}</p>
                </div>
                <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Next</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-300">{frame.sessionNote}</p>
                </div>
              </div>
            ) : null}
            {frame.type === "teams" ? (
              <div className="mt-2 space-y-3">
                <div className="rounded-[14px] border border-amber-300/16 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                  {frame.sessionName}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[14px] border border-emerald-300/16 bg-emerald-400/10 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/70">Team A</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{frame.teamA}</p>
                      <FaCheckCircle className="text-sm text-emerald-200" />
                    </div>
                  </div>
                  <div className="rounded-[14px] border border-cyan-300/16 bg-cyan-400/10 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/70">Team B</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{frame.teamB}</p>
                      <FaCheckCircle className="text-sm text-cyan-200" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {frame.type === "toss" ? (
              <div className="mt-2 space-y-3">
                <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Call</p>
                  <p className="mt-2 text-sm font-semibold text-white">{frame.caller}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["Heads", "Tails"].map((side) => (
                    <div
                      key={`${frame.step}-${side}`}
                      className={`rounded-[14px] border px-3 py-3 text-center text-sm font-semibold ${
                        frame.selectedSide === side
                          ? "border-rose-300/18 bg-rose-400/10 text-rose-100"
                          : "border-sky-300/16 bg-sky-400/10 text-sky-100"
                      }`}
                    >
                      {side}
                    </div>
                  ))}
                </div>
                <div className="rounded-[14px] border border-amber-300/16 bg-[linear-gradient(180deg,rgba(120,53,15,0.16),rgba(15,12,16,0.98))] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-100/70">Result</p>
                  <p className="mt-2 text-sm font-semibold text-white">{frame.result}</p>
                </div>
              </div>
            ) : null}
            {frame.type === "decision" ? (
              <div className="mt-2 space-y-3">
                <div className="rounded-[14px] border border-amber-300/16 bg-[linear-gradient(180deg,rgba(120,53,15,0.16),rgba(15,12,16,0.98))] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-100/70">Toss winner</p>
                  <p className="mt-2 text-sm font-semibold text-white">{frame.tossWinner}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[14px] border border-emerald-300/18 bg-emerald-400/10 px-3 py-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/70">Decision</p>
                    <p className="mt-2 text-sm font-semibold text-white">{frame.decision}</p>
                  </div>
                  <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Other side</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-200">Bowl first</p>
                  </div>
                </div>
                <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Start</p>
                  <p className="mt-2 text-sm font-semibold text-white">{frame.support}</p>
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <span className="text-[11px] font-semibold text-white">{frame.note}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  frame.type === "decision"
                    ? "border border-emerald-300/18 bg-emerald-400/10 text-emerald-100"
                    : frame.type === "toss"
                    ? "border border-amber-300/18 bg-amber-400/10 text-amber-100"
                    : frame.type === "teams"
                    ? "border border-cyan-300/18 bg-cyan-400/10 text-cyan-100"
                    : "border border-white/10 bg-white/[0.04] text-zinc-300"
                }`}
              >
                {frame.badge}
              </span>
            </div>
          </motion.div>
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedMiniBallRow({
  frames,
  staticMode = false,
  className = "mt-3 flex min-h-[2rem] flex-wrap items-center gap-1.5 sm:gap-2",
  activeFrameIndex,
}) {
  const loopedFrameIndex = useLoopedFrame(frames.length, 1550);
  const frameIndex = Number.isInteger(activeFrameIndex) ? activeFrameIndex : loopedFrameIndex;
  const frame = frames[frameIndex] || [];

  return (
    <motion.div
      key={frameIndex}
      initial={{ opacity: 0.75, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {frame.map((ball, index) => (
        <MiniBall
          key={`${frameIndex}-${ball.label}-${index}`}
          label={ball.label}
          tone={ball.tone}
          staticMode={staticMode}
        />
      ))}
    </motion.div>
  );
}

function AnimatedUmpireJourneyPreview({ staticMode = false, accent }) {
  const { Div, Span, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedUmpireFrames.length, 1550);
  const frame = animatedUmpireFrames[frameIndex];
  const actionButtons = [
    { label: "Dot", className: "bg-sky-700 hover:bg-sky-600 text-white" },
    { label: "1", className: "bg-zinc-800 hover:bg-zinc-700 text-white" },
    { label: "2", className: "bg-zinc-800 hover:bg-zinc-700 text-white" },
    { label: "3", className: "bg-zinc-800 hover:bg-zinc-700 text-white" },
    { label: "4", className: "bg-zinc-800 hover:bg-zinc-700 text-amber-300" },
    { label: "6", className: "bg-zinc-800 hover:bg-zinc-700 text-white" },
    { label: "Wide", className: "bg-emerald-700 hover:bg-emerald-600 text-white" },
    { label: "OUT", className: "bg-rose-700 hover:bg-rose-600 text-white" },
  ];

  return (
    <PreviewSurface accent={accent} heading="Umpire Screen" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3"
        >
          <motion.div
            key={`${frame.target}-${frame.score}-${frame.overs}`}
            initial={{ opacity: 0.72, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <P className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Target
                </P>
                <P className="mt-1 text-lg font-semibold text-amber-300">{frame.target}</P>
              </div>
              <Span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white">
                <FaVolumeUp className="text-sm" />
              </Span>
            </div>
            <div className="mt-3 rounded-[20px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(16,18,24,0.98),rgba(10,12,16,0.98))] px-4 py-4 shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <P className="text-[2.8rem] font-black leading-none tracking-[-0.06em] text-emerald-300">
                    {frame.score}
                  </P>
                  <P className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                    Score / Wickets
                  </P>
                  <P className="mt-1 text-[12px] font-semibold text-zinc-500">(3)</P>
                </div>
                <div className="text-right">
                  <P className="text-[2.4rem] font-black leading-none tracking-[-0.05em] text-white">
                    {frame.overs}
                  </P>
                  <P className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                    Overs (6)
                  </P>
                  <P className="mt-1 text-[12px] font-semibold text-zinc-500">{frame.oversLeft}</P>
                </div>
              </div>
            </div>
          </motion.div>
        </Div>
        <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-4 gap-2">
          {actionButtons.map((action) => (
            <motion.div
              key={action.label}
              animate={
                frame.activeAction === action.label
                  ? { scale: 1.03, y: -2, opacity: 1 }
                  : { scale: 1, y: 0, opacity: 0.92 }
              }
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className={`flex min-h-[3.7rem] items-center justify-center rounded-[16px] border border-white/10 px-2 py-3 text-center text-[12px] font-bold uppercase tracking-[0.08em] shadow-[0_14px_26px_rgba(0,0,0,0.18)] ${
                action.className
              } ${
                frame.activeAction === action.label
                  ? "ring-1 ring-white/24 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_18px_30px_rgba(0,0,0,0.24)]"
                  : ""
              }`}
            >
              {action.label}
            </motion.div>
          ))}
        </Div>
        <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-3 gap-2">
          {[
            { icon: FaVolumeUp, label: "Read score" },
            { icon: FaMusic, label: "Sound FX" },
            { icon: FaBroadcastTower, label: "Walkie" },
          ].map((tool, index) => {
            const Icon = tool.icon;
            return (
              <motion.div
                key={tool.label}
                animate={frameIndex === index ? { y: -1, opacity: 1 } : { y: 0, opacity: 0.92 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <Icon className="text-sm text-cyan-200" />
                  <P className="text-[11px] font-semibold text-white">{tool.label}</P>
                </div>
              </motion.div>
            );
          })}
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedHistoryJourneyPreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedHistoryFrames.length, 1550);
  const frame = animatedHistoryFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="Ball History" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="flex items-start justify-between gap-3 rounded-[18px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(8,20,34,0.94),rgba(7,8,12,0.98))] px-4 py-3"
        >
          <motion.div
            key={frame.scoreLine}
            initial={{ opacity: 0.74, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <P className="text-lg font-semibold text-white">OVER 8</P>
            <P className="mt-1 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              {frame.scoreLine}
            </P>
          </motion.div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
            Live
          </span>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3"
        >
          <P className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
            This over
          </P>
          <AnimatedMiniBallRow
            frames={animatedHistoryFrames.map((item) => item.balls)}
            staticMode={staticMode}
            className="mt-3 flex min-h-[2rem] flex-wrap items-center gap-1.5 sm:gap-2"
            activeFrameIndex={frameIndex}
          />
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3 text-[12px]"
        >
          <span className="font-semibold text-white">Recent balls stay in view</span>
          <motion.span
            key={frame.note}
            initial={{ opacity: 0.72, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-zinc-400"
          >
            {frame.note}
          </motion.span>
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedSpectatorJourneyPreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedSpectatorFrames.length, 1550);
  const frame = animatedSpectatorFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="Spectator" staticMode={staticMode}>
      <Div
        {...withVariants(previewItemVariants)}
        className="rounded-[22px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,15,20,0.96),rgba(8,10,16,0.98))] p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.14),0_18px_44px_rgba(6,78,59,0.18)]"
      >
        <motion.div
          key={`${frame.need}-${frame.runs}`}
          initial={{ opacity: 0.76, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <Div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <MiniPulseDot tone="emerald" />
                <P className="text-xl font-semibold uppercase tracking-tight text-white">Team B</P>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="relative overflow-hidden rounded-[16px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(120,53,15,0.12))] px-3 py-2 shadow-[0_10px_24px_rgba(120,53,15,0.18)]">
                  <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/44 to-transparent" />
                  <div className="flex items-center gap-2">
                    <FaBullseye className="text-[11px] text-amber-200" />
                    <P className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/92">
                      Target {frame.target}
                    </P>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-3 py-2">
                  <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" />
                  <P className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-200">
                    Need {frame.need}
                  </P>
                </div>
              </div>
            </div>
            <div className="text-right">
              <P className="text-3xl font-black leading-none text-amber-300">{frame.runs}</P>
              <P className="mt-1 text-[13px] font-black uppercase tracking-tight text-amber-300">
                Runs
              </P>
            </div>
          </Div>
          <Div className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3">
            <P className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
              Over 1
            </P>
            <AnimatedMiniBallRow
              frames={animatedSpectatorFrames.map((item) => item.balls)}
              staticMode={staticMode}
              className="mt-3 flex min-h-[2rem] flex-wrap items-center gap-1.5 sm:gap-2"
              activeFrameIndex={frameIndex}
            />
          </Div>
        </motion.div>
      </Div>
    </PreviewSurface>
  );
}

function AnimatedWalkieFeaturePreview({ staticMode = false, accent }) {
  const { Div, Span, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedWalkieFeatureFrames.length, 1600);
  const frame = animatedWalkieFeatureFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="Live Audio" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[20px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,28,22,0.94),rgba(8,12,16,0.96))] p-4"
        >
          <motion.div
            key={frame.speaker}
            initial={{ opacity: 0.74, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <MiniPulseDot tone="emerald" />
                  <P className="text-sm font-semibold text-white">Walkie-Talkie</P>
                </div>
                <P className="mt-1 text-[12px] text-zinc-400">{frame.note}</P>
              </div>
              <Div className="inline-flex h-6 w-11 rounded-full border border-emerald-300/30 bg-emerald-400/18">
                <Span className="mt-0.5 inline-flex h-5 w-5 translate-x-5 rounded-full bg-white" />
              </Div>
            </div>
            <Div className="mt-4 flex items-center justify-between gap-3">
              <Div className="flex flex-wrap gap-2">
                {frame.badges.map((label, index) => (
                  <motion.span
                    key={`${frame.speaker}-${label}`}
                    animate={index === 0 ? { y: -1, opacity: 1 } : { y: 0, opacity: 0.92 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-full border border-emerald-300/16 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/90"
                  >
                    {label}
                  </motion.span>
                ))}
              </Div>
              <Span className="inline-flex h-18 w-18 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl text-white">
                <FaBroadcastTower />
              </Span>
            </Div>
            <P className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100/84">
              {frame.speaker}
            </P>
          </motion.div>
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedLoudspeakerFeaturePreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedLoudspeakerFrames.length, 1550);
  const frame = animatedLoudspeakerFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="PA Mic" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
        >
          <motion.div
            key={frame.status}
            initial={{ opacity: 0.72, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <P className="text-sm font-semibold text-white">Loudspeaker</P>
            <P className="mt-1 text-[11px] text-zinc-500">{frame.status}</P>
          </motion.div>
          <Div className="inline-flex h-6 w-11 rounded-full border border-emerald-300/30 bg-emerald-400/18">
            <motion.span
              animate={frame.live ? { x: 20 } : { x: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="mt-0.5 inline-flex h-5 w-5 rounded-full bg-white"
            />
          </Div>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-center"
        >
          <motion.span
            animate={frame.live ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 1.1, repeat: frame.live ? Number.POSITIVE_INFINITY : 0, ease: "easeInOut" }}
            className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/18 bg-[linear-gradient(180deg,rgba(249,115,22,0.94),rgba(245,158,11,0.94))] text-2xl text-black"
          >
            <FaMicrophoneAlt />
          </motion.span>
          <P className="mt-3 text-sm font-semibold text-white">
            {frame.live ? "Live call in progress" : "Hold to talk live"}
          </P>
          <P className="mt-2 text-[11px] text-zinc-400">{frame.footer}</P>
          <div className="mt-3 flex justify-center">
            <MiniAudioBars tone="amber" />
          </div>
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedJourneyWalkiePreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedJourneyWalkieFrames.length, 1600);
  const frame = animatedJourneyWalkieFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="In Match Walkie" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="flex items-center justify-between gap-3 rounded-[18px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,28,22,0.94),rgba(8,12,16,0.98))] px-4 py-3"
        >
          <motion.div
            key={frame.title}
            initial={{ opacity: 0.74, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2">
              <MiniPulseDot tone="emerald" />
              <P className="text-sm font-semibold text-white">{frame.title}</P>
            </div>
            <P className="mt-1 text-[11px] text-zinc-400">{frame.note}</P>
          </motion.div>
          <div className="inline-flex h-6 w-11 rounded-full border border-emerald-300/30 bg-emerald-400/18">
            <span className="mt-0.5 inline-flex h-5 w-5 translate-x-5 rounded-full bg-white" />
          </div>
        </Div>
        <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-3 gap-2">
          {frame.counts.map(([label, meta], index) => (
            <motion.div
              key={`${frame.title}-${label}`}
              animate={index === 0 ? { y: -1, opacity: 1 } : { y: 0, opacity: 0.92 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3"
            >
              <P className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {label}
              </P>
              <P className="mt-2 text-sm font-semibold text-white">{meta}</P>
            </motion.div>
          ))}
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="flex items-center justify-center gap-2 rounded-[16px] border border-emerald-300/16 bg-emerald-400/10 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90"
        >
          <FaBroadcastTower className="text-sm" />
          Press and hold
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedJourneyAudioPreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedJourneyAudioFrames.length, 1600);
  const frame = animatedJourneyAudioFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="Match Audio" staticMode={staticMode}>
      <div className="space-y-3">
        <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-2 gap-2">
          <Div
            {...withVariants(previewItemVariants)}
            className="rounded-[18px] border border-amber-300/16 bg-[linear-gradient(180deg,rgba(120,53,15,0.16),rgba(15,12,16,0.98))] px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <FaBullhorn className="text-sm text-amber-200" />
              <div className="inline-flex h-5 w-9 rounded-full border border-white/10 bg-white/[0.06]">
                <span className="mt-0.5 inline-flex h-4 w-4 translate-x-4 rounded-full bg-white" />
              </div>
            </div>
            <P className="mt-3 text-sm font-semibold text-white">Loudspeaker</P>
            <P className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Hold live</P>
            <div className="mt-3">
              <MiniAudioBars tone="amber" />
            </div>
          </Div>
          <Div
            {...withVariants(previewItemVariants)}
            className="rounded-[18px] border border-violet-300/16 bg-[linear-gradient(180deg,rgba(76,29,149,0.18),rgba(15,12,18,0.98))] px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <FaVolumeUp className="text-sm text-violet-200" />
              <div className="inline-flex h-5 w-9 rounded-full border border-emerald-300/30 bg-emerald-400/18">
                <span className="mt-0.5 inline-flex h-4 w-4 translate-x-4 rounded-full bg-white" />
              </div>
            </div>
            <P className="mt-3 text-sm font-semibold text-white">Announcer</P>
            <P className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Ready</P>
            <div className="mt-3">
              <MiniAudioBars tone="violet" />
            </div>
          </Div>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
        >
          <P className="text-sm font-semibold text-white">Next call queued</P>
          <motion.div
            key={frame.call}
            initial={{ opacity: 0.72, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <P className="mt-2 text-[12px] text-zinc-400">{frame.call}</P>
            <P className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/84">
              {frame.sub}
            </P>
          </motion.div>
          <div className="mt-3">
            <MiniAudioBars tone="violet" />
          </div>
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedAccessJourneyPreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedAccessFrames.length, 1550);
  const frame = animatedAccessFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="PIN Entry" staticMode={staticMode}>
      <div className="space-y-3">
        <Div {...withVariants(previewItemVariants)} className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white">
            Home
          </span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/18 bg-emerald-400/10 text-emerald-200">
            <FaBroadcastTower className="text-sm" />
          </span>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4"
        >
          <P className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
            Director PIN
          </P>
          <motion.div
            key={frame.pin}
            initial={{ opacity: 0.72, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3 rounded-[16px] border border-emerald-300/18 bg-black/20 px-4 py-4 text-center text-xl font-semibold tracking-[0.5em] text-white"
          >
            {frame.pin}
          </motion.div>
          <P className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/82">
            {frame.status}
          </P>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="btn-ui btn-ui-glass-dark inline-flex w-full justify-center rounded-[18px] px-4 py-3 text-[12px]"
        >
          <FaLock />
          {frameIndex === animatedAccessFrames.length - 1 ? "Enter Console" : "Checking PIN"}
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedAnnouncerFeaturePreview({ staticMode = false, accent }) {
  const { Div, Span, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedAnnouncerFrames.length, 1600);
  const frame = animatedAnnouncerFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="Voice" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
        >
          <P className="text-sm font-semibold text-white">Current score</P>
          <motion.div
            key={frame.score}
            initial={{ opacity: 0.72, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <P className="mt-2 text-[12px] text-zinc-400">{frame.score}</P>
          </motion.div>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="flex items-center justify-between gap-3 rounded-[18px] border border-violet-300/16 bg-[linear-gradient(180deg,rgba(124,58,237,0.16),rgba(20,14,32,0.94))] px-4 py-3"
        >
          <div>
            <P className="text-sm font-semibold text-white">Announcer ready</P>
            <P className="mt-1 text-[11px] text-zinc-300">{frame.queue}</P>
          </div>
          <Span className="flex items-center gap-2">
            <MiniAudioBars tone="violet" />
            <FaVolumeUp className="text-lg text-violet-200" />
          </Span>
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedShareFeaturePreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedShareFrames.length, 1600);
  const frame = animatedShareFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="Share" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[20px] border border-orange-300/16 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_30%),linear-gradient(180deg,rgba(30,20,14,0.96),rgba(10,10,14,0.98))] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <P className="text-sm font-semibold text-white">Live match link</P>
              <P className="mt-1 text-[12px] text-zinc-400">{frame.note}</P>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-orange-300/16 bg-orange-400/10 text-orange-200">
              <FaShareAlt />
            </span>
          </div>
          <motion.div
            key={frame.url}
            initial={{ opacity: 0.74, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 rounded-[16px] border border-white/10 bg-black/20 px-3 py-3 text-[12px] text-zinc-300"
          >
            {frame.url}
          </motion.div>
        </Div>
        <Div className="grid grid-cols-3 gap-2">
          {["Phone", "Tablet", "Big Screen"].map((label) => (
            <motion.div
              key={`${frame.activeDevice}-${label}`}
              animate={frame.activeDevice === label ? { y: -1, opacity: 1 } : { y: 0, opacity: 0.84 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`rounded-[16px] border px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] ${
                frame.activeDevice === label
                  ? "border-orange-300/18 bg-orange-400/10 text-orange-100"
                  : "border-white/10 bg-white/[0.03] text-zinc-300"
              }`}
            >
              {label}
            </motion.div>
          ))}
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedCoverFeaturePreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedCoverFrames.length, 1600);
  const frame = animatedCoverFrames[frameIndex];
  const toneClass =
    frame.tone === "amber"
      ? "border-amber-300/18 bg-amber-400/10 text-amber-100"
      : frame.tone === "cyan"
      ? "border-cyan-300/18 bg-cyan-400/10 text-cyan-100"
      : "border-rose-300/18 bg-rose-400/10 text-rose-100";

  return (
    <PreviewSurface accent={accent} heading="Cover Image" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_32%),linear-gradient(180deg,rgba(30,24,26,0.96),rgba(12,10,14,0.98))] p-3"
        >
          <div className="rounded-[18px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 text-center">
            <FaImage className="mx-auto text-2xl text-white/80" />
            <P className="mt-3 text-sm font-semibold text-white">Upload match image</P>
            <motion.div
              key={frame.label}
              initial={{ opacity: 0.72, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={`mx-auto mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClass}`}
            >
              {frame.label}
            </motion.div>
          </div>
        </Div>
        <P className="text-[12px] leading-6 text-zinc-400">{frame.note}</P>
      </div>
    </PreviewSurface>
  );
}

function AnimatedInsightsFeaturePreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedInsightsFrames.length, 1650);
  const frame = animatedInsightsFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="Result" staticMode={staticMode}>
      <div className="space-y-2.5 sm:space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="rounded-[22px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(217,119,6,0.12))] p-3.5 sm:p-4"
        >
          <motion.div
            key={frame.winner}
            initial={{ opacity: 0.74, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <P className="text-lg font-black tracking-[-0.04em] text-white sm:text-xl">{frame.winner}</P>
            <P className="mt-1.5 text-sm text-zinc-100/82 sm:mt-2">{frame.detail}</P>
          </motion.div>
        </Div>
        <div className="grid min-h-[4.25rem] grid-cols-3 gap-1.5 sm:gap-2">
          {[
            [frame.score, "Score"],
            [frame.overs, "Overs"],
            [frame.rr, "RR"],
          ].map(([value, label]) => (
            <div
              key={`${frame.winner}-${label}`}
              className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-2.5 py-2.5 sm:px-3 sm:py-3"
            >
              <P className="text-[13px] font-semibold text-white sm:text-sm">{value}</P>
              <P className="mt-1 text-[9px] uppercase tracking-[0.22em] text-zinc-500 sm:text-[10px] sm:tracking-[0.24em]">{label}</P>
            </div>
          ))}
        </div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedDirectorFeaturePreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedDirectorFrames.length, 1650);
  const frame = animatedDirectorFrames[frameIndex];
  const modules = [
    ["Walkie", FaBroadcastTower, "Live"],
    ["PA Mic", FaBullhorn, "Ready"],
    ["YouTube", FaYoutube, "Deck A"],
    ["Effects", FaVolumeUp, "6 pads"],
    ["Announcer", FaMicrophoneAlt, "Queued"],
    ["Crowd", FaVolumeUp, "Hot"],
  ];

  return (
    <PreviewSurface accent={accent} heading="Director" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="flex items-center justify-between gap-3 rounded-[18px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(8,24,36,0.96),rgba(9,12,18,0.98))] px-4 py-3"
        >
          <div>
            <P className="text-sm font-semibold text-white">Live control rack</P>
            <P className="mt-1 text-[11px] text-zinc-400">
              Audio, YouTube music, crowd effects, and talkback in one place.
            </P>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/18 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100/90">
            <MiniPulseDot tone="emerald" />
            Armed
          </span>
        </Div>
        <Div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {modules.map(([label, Icon, meta]) => {
            const active = frame.activeLabels.includes(label);
            return (
              <motion.div
                key={`${frameIndex}-${label}`}
                animate={active ? { y: -1, opacity: 1 } : { y: 0, opacity: 0.88 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className={`rounded-[18px] border px-3 py-3 ${
                  active
                    ? "border-cyan-300/16 bg-[linear-gradient(180deg,rgba(37,99,235,0.16),rgba(17,24,39,0.92))]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]"
                }`}
              >
                <Icon className={`text-sm ${label === "YouTube" ? "text-red-300" : "text-white"}`} />
                <P className="mt-3 text-sm font-semibold text-white">{label}</P>
                <P className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{meta}</P>
              </motion.div>
            );
          })}
        </Div>
        <Div className="grid gap-2 rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
          {[
            ["Mic", frame.meters.mic],
            ["Music", frame.meters.music],
            ["FX", frame.meters.fx],
          ].map(([label, value]) => (
            <Div key={`${frameIndex}-${label}`} className="flex items-center gap-3">
              <span className="w-11 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                {label}
              </span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(59,130,246,0.95),rgba(251,191,36,0.9))]"
                  animate={{ width: value }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {value}
              </span>
            </Div>
          ))}
        </Div>
      </div>
    </PreviewSurface>
  );
}

function AnimatedLiveBannerFeaturePreview({ staticMode = false, accent }) {
  const { Div, P, withVariants } = getPreviewNodeSet(staticMode);
  const frameIndex = useLoopedFrame(animatedLiveBannerFrames.length, 1650);
  const frame = animatedLiveBannerFrames[frameIndex];

  return (
    <PreviewSurface accent={accent} heading="Live Match Banner" staticMode={staticMode}>
      <div className="space-y-3">
        <Div
          {...withVariants(previewItemVariants)}
          className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_36%),linear-gradient(180deg,rgba(22,24,30,0.96),rgba(10,12,16,0.98))] px-3 py-3"
        >
          <div className="relative z-10 flex items-center justify-between gap-2.5">
            <div
              className={`relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[22px] px-3 py-2.5 text-white ${
                staticMode
                  ? "home-updates-desktop-inset"
                  : "liquid-glass shadow-[0_18px_34px_rgba(0,0,0,0.2)]"
              }`}
            >
              <div className="absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.1),transparent_40%)]" />
              <motion.div
                key={`${frame.teams}-${frame.score}`}
                initial={{ opacity: 0.74, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 flex min-w-0 items-center gap-2"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[14px]">
                  <SafeMatchImage
                    src="/Thumb1.png"
                    alt="Live match banner preview"
                    fill
                    sizes="40px"
                    className="object-cover"
                    fallbackClassName="object-contain p-0 opacity-100 scale-[1.38]"
                  />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-emerald-300">
                    <span className="inline-flex items-center gap-1.5">
                      <MiniPulseDot tone="emerald" />
                      Live Now
                    </span>
                  </div>
                  <div className="truncate text-[11px] font-semibold leading-tight text-white">
                    {frame.teams}
                  </div>
                  <div className="truncate text-[9px] leading-tight text-white/72">{frame.score}</div>
                </div>
              </motion.div>
              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] text-white ${
                  staticMode ? "home-updates-desktop-pill" : "liquid-pill"
                }`}
              >
                <FaArrowRight className="h-3 w-3" />
              </div>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center text-white/96">
              <FaBars className="text-[1.35rem] drop-shadow-[0_8px_18px_rgba(0,0,0,0.24)]" />
            </div>
          </div>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="relative overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
        >
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <P className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Home shortcut
              </P>
              <P className="mt-1 text-sm font-semibold text-white">Latest live match opens first</P>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/86">
              Instant
            </span>
          </div>
        </Div>
      </div>
    </PreviewSurface>
  );
}

function renderJourneyPreview(card, staticMode = false) {
  const { Div, Span, P, withVariants } = getPreviewNodeSet(staticMode);

  switch (card.previewType) {
    case "teams":
      return <AnimatedTeamsJourneyPreview staticMode={staticMode} accent={card.accent} />;
    case "toss":
      return (
        <PreviewSurface accent={card.accent} heading="Toss" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-3 py-2"
            >
              <MiniTossSpinner />
            </Div>
            <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-2 gap-3">
              <Div
                {...withVariants(previewItemVariants)}
                className={`btn-ui justify-center rounded-[18px] px-3 py-4 text-[12px] ${
                  staticMode ? "home-updates-desktop-button home-updates-desktop-button-warm" : "btn-ui-glass-dark"
                }`}
              >
                Heads
              </Div>
              <Div
                {...withVariants(previewItemVariants)}
                className={`btn-ui justify-center rounded-[18px] px-3 py-4 text-[12px] ${
                  staticMode ? "home-updates-desktop-button home-updates-desktop-button-cool" : "btn-ui-glass-dark-alt"
                }`}
              >
                Tails
              </Div>
            </Div>
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[20px] border border-amber-300/14 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.1),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4"
            >
              <P className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
                Result
              </P>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <P className="text-xl font-semibold tracking-tight text-white">Heads</P>
                  <P className="mt-2 text-[12px] text-zinc-400">Team A chooses to bat first.</P>
                </div>
                <Span {...withVariants(previewItemVariants)}>
                  <FaCheckCircle className="text-2xl text-emerald-300" />
                </Span>
              </div>
            </Div>
          </div>
        </PreviewSurface>
      );
    case "umpire":
      return <AnimatedUmpireJourneyPreview staticMode={staticMode} accent={card.accent} />;
    case "match-walkie":
      return <AnimatedJourneyWalkiePreview staticMode={staticMode} accent={card.accent} />;
    case "history":
      return <AnimatedHistoryJourneyPreview staticMode={staticMode} accent={card.accent} />;
    case "match-audio":
      return <AnimatedJourneyAudioPreview staticMode={staticMode} accent={card.accent} />;
    case "spectator":
      return <AnimatedSpectatorJourneyPreview staticMode={staticMode} accent={card.accent} />;
    case "status":
      return (
        <PreviewSurface accent={card.accent} heading="Match Status" staticMode={staticMode}>
          <div className="space-y-3">
            {[
              ["Live", "Scoring in progress"],
              ["Innings Complete", "Target locked in"],
            ].map(([title, meta], index) => (
              <Div
                key={title}
                {...withVariants(previewItemVariants)}
                className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
              >
                <div>
                  <P className="text-sm font-semibold text-white">{title}</P>
                  <P className="mt-1 text-[11px] text-zinc-500">{meta}</P>
                </div>
                {index === 0 ? (
                  <MiniPulseDot tone="emerald" />
                ) : (
                  <Span
                    {...withVariants(previewItemVariants)}
                    className="h-2.5 w-2.5 rounded-full bg-amber-300"
                  />
                )}
              </Div>
            ))}
            <Div
              {...withVariants(previewItemVariants)}
              className="relative overflow-hidden rounded-[22px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(251,191,36,0.2),rgba(217,119,6,0.14))] px-4 py-4 shadow-[0_18px_40px_rgba(120,53,15,0.22)]"
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {miniCelebrationConfetti.map((piece, index) => (
                  <span
                    key={`${piece.left}-${index}`}
                    className="absolute top-[-12%] h-2.5 w-1.5 rounded-full opacity-80 animate-[result-confetti_var(--confetti-duration)_linear_infinite]"
                    style={{
                      left: piece.left,
                      backgroundColor: piece.color,
                      animationDelay: piece.delay,
                      ["--confetti-duration"]: piece.duration,
                      transform: `rotate(${piece.rotate})`,
                    }}
                  />
                ))}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(120,53,15,0.16))]" />
              </div>
              <div className="relative z-10 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/16 text-white shadow-[0_10px_24px_rgba(120,53,15,0.18)]">
                  <FaTrophy className="text-lg" />
                </span>
                <P className="mt-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-50/84">
                  Final Result
                </P>
                <P className="mt-3 text-xl font-black uppercase leading-[1.05] tracking-[-0.04em] text-white">
                  Congratulations
                </P>
                <P className="mt-2 text-base font-bold text-white">Team Blue</P>
                <P className="mt-2 text-[12px] leading-5 text-amber-50/88">
                  Won by 2 wickets.
                </P>
              </div>
            </Div>
          </div>
        </PreviewSurface>
      );
    case "access":
      return <AnimatedAccessJourneyPreview staticMode={staticMode} accent={card.accent} />;
    default:
      return null;
  }
}

function renderFeaturePreview(card, staticMode = false) {
  const { Div, Span, P, withVariants } = getPreviewNodeSet(staticMode);

  switch (card.previewType) {
    case "walkie":
      return <AnimatedWalkieFeaturePreview staticMode={staticMode} accent={card.accent} />;
    case "loudspeaker":
      return <AnimatedLoudspeakerFeaturePreview staticMode={staticMode} accent={card.accent} />;
    case "director":
      return <AnimatedDirectorFeaturePreview staticMode={staticMode} accent={card.accent} />;
    case "share":
      return <AnimatedShareFeaturePreview staticMode={staticMode} accent={card.accent} />;
    case "announcer":
      return <AnimatedAnnouncerFeaturePreview staticMode={staticMode} accent={card.accent} />;
    case "cover":
      return <AnimatedCoverFeaturePreview staticMode={staticMode} accent={card.accent} />;
    case "insights":
      return <AnimatedInsightsFeaturePreview staticMode={staticMode} accent={card.accent} />;
    case "livebanner":
      return <AnimatedLiveBannerFeaturePreview staticMode={staticMode} accent={card.accent} />;
    default:
      return null;
  }
}

function renderFeatureDetail() {
  return null;
}

function useCardScrollMotion(prefersReducedMotion, accent, index, useFlatLaptopMotion) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.94", "end 0.08"],
  });
  const direction = index % 2 === 0 ? -1 : 1;
  const springConfig = { stiffness: 150, damping: 30, mass: 0.42 };

  const cardY = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], useFlatLaptopMotion ? [18, 0, -4] : [16, 0, -6]),
    springConfig
  );
  const cardX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      useFlatLaptopMotion ? [direction * 10, 0, direction * -2] : [direction * 14, 0, direction * -4]
    ),
    springConfig
  );
  const cardOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.28, 0.55, 1], useFlatLaptopMotion ? [0.76, 0.94, 1, 1] : [0.88, 0.96, 1, 1]),
    springConfig
  );
  const glowOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.32, 0.7, 1],
      useFlatLaptopMotion ? [0.22, 0.42, 0.54, 0.28] : [0.36, 0.78, 0.9, 0.52]
    ),
    springConfig
  );
  const accentSweepOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.35, 0.75, 1],
      useFlatLaptopMotion ? [0.04, 0.08, 0.12, 0.06] : [0.07, 0.16, 0.22, 0.1]
    ),
    springConfig
  );
  const accentSweepX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      useFlatLaptopMotion ? [direction * -6, 0, direction * 4] : [direction * -14, 0, direction * 10]
    ),
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
      opacity: cardOpacity,
      scale: 1,
    },
    glowStyle: { opacity: glowOpacity },
    previewStyle: undefined,
    contentStyle: undefined,
    accentSweepStyle: { opacity: accentSweepOpacity, x: accentSweepX },
  };
}

function useJourneySwipeMotion(prefersReducedMotion, index, useFlatLaptopMotion) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.92", "end 0.08"],
  });
  const direction = index % 2 === 0 ? -1 : 1;
  const springConfig = { stiffness: 120, damping: 24, mass: 0.46 };

  const cardY = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion ? [18, 8, 0, -3, -8] : [34, 18, 0, -10, -26]
    ),
    springConfig
  );
  const cardX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion
        ? [direction * 10, direction * 4, 0, direction * -2, direction * -6]
        : [direction * 44, direction * 18, 0, direction * -12, direction * -34]
    ),
    springConfig
  );
  const cardRotate = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion
        ? [0, 0, 0, 0, 0]
        : [direction * 5.5, direction * 2.5, 0, direction * -1.8, direction * -4]
    ),
    springConfig
  );
  const cardScale = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.22, 0.5, 0.82, 1],
      useFlatLaptopMotion ? [1, 1, 1, 1, 1] : [0.94, 0.975, 1, 0.985, 0.96]
    ),
    springConfig
  );
  const cardOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.18, 0.45, 0.8, 1],
      useFlatLaptopMotion ? [0.82, 0.92, 1, 0.96, 0.88] : [0.62, 0.82, 1, 0.94, 0.78]
    ),
    springConfig
  );
  const glowOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.35, 0.65, 1],
      useFlatLaptopMotion ? [0.22, 0.42, 0.54, 0.24] : [0.18, 0.48, 0.58, 0.2]
    ),
    springConfig
  );
  const accentSweepOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.28, 0.6, 1],
      useFlatLaptopMotion ? [0.03, 0.08, 0.1, 0.04] : [0.05, 0.16, 0.2, 0.04]
    ),
    springConfig
  );
  const accentSweepX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      useFlatLaptopMotion ? [direction * -6, 0, direction * 4] : [direction * -18, 0, direction * 14]
    ),
    springConfig
  );
  const previewX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion
        ? [direction * 3, direction * 1, 0, direction * -1, direction * -2]
        : [direction * 16, direction * 7, 0, direction * -4, direction * -10]
    ),
    springConfig
  );
  const previewY = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], useFlatLaptopMotion ? [2, 0, -1] : [8, 0, -4]),
    springConfig
  );
  const contentX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion
        ? [direction * 2, direction * 1, 0, direction * -1, direction * -2]
        : [direction * 10, direction * 4, 0, direction * -3, direction * -8]
    ),
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
      rotateZ: cardRotate,
      scale: cardScale,
      opacity: cardOpacity,
    },
    glowStyle: { opacity: glowOpacity },
    previewStyle: { x: previewX, y: previewY },
    contentStyle: { x: contentX },
    accentSweepStyle: { opacity: accentSweepOpacity, x: accentSweepX },
  };
}

function getFeatureCardWideSpan(previewType) {
  return "2xl:col-span-3";
}

function getJourneyCardWideSpan() {
  return "2xl:col-span-4";
}

function getFeatureCardWideOrder(previewType) {
  switch (previewType) {
    case "walkie":
      return "2xl:order-1";
    case "loudspeaker":
      return "2xl:order-2";
    case "director":
      return "2xl:order-3";
    case "announcer":
      return "2xl:order-4";
    case "share":
      return "2xl:order-5";
    case "cover":
      return "2xl:order-6";
    case "insights":
      return "2xl:order-7";
    case "livebanner":
      return "2xl:order-8";
    default:
      return "";
  }
}

function getAccentHueLayers(accent) {
  switch (accent) {
    case "amber":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(251,146,60,0.22)_0%,rgba(245,158,11,0.12)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(251,113,133,0.14)_0%,rgba(251,146,60,0.08)_44%,transparent_78%)]",
      };
    case "emerald":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(16,185,129,0.22)_0%,rgba(34,211,238,0.11)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(45,212,191,0.14)_0%,rgba(14,165,233,0.08)_44%,transparent_78%)]",
      };
    case "rose":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(244,63,94,0.2)_0%,rgba(251,113,133,0.11)_40%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(251,146,60,0.14)_0%,rgba(244,63,94,0.08)_46%,transparent_78%)]",
      };
    case "violet":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(168,85,247,0.22)_0%,rgba(99,102,241,0.11)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(217,70,239,0.14)_0%,rgba(129,140,248,0.08)_46%,transparent_78%)]",
      };
    case "yellow":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(250,204,21,0.2)_0%,rgba(251,146,60,0.11)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(253,224,71,0.14)_0%,rgba(250,204,21,0.08)_46%,transparent_78%)]",
      };
    case "orange":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(249,115,22,0.22)_0%,rgba(56,189,248,0.1)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(251,191,36,0.14)_0%,rgba(14,165,233,0.08)_46%,transparent_78%)]",
      };
    default:
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(56,189,248,0.2)_0%,rgba(96,165,250,0.11)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(34,211,238,0.14)_0%,rgba(99,102,241,0.08)_46%,transparent_78%)]",
      };
  }
}

function DesktopRevealCard({ children, index = 0, className = "" }) {
  const { ref, isVisible } = useHomeDesktopReveal(true, {
    threshold: 0.06,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });

  return (
    <div
      ref={ref}
      className={`home-desktop-reveal home-desktop-reveal-card ${
        isVisible ? "is-visible" : ""
      } ${className}`}
      style={{ "--home-reveal-delay": `${Math.min(index, 11) * 110}ms` }}
    >
      {children}
    </div>
  );
}

function FeatureCardDesktop({ card, index }) {
  return (
    <DesktopRevealCard
      index={index}
      className={`group relative h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6 xl:p-5 2xl:p-6 home-desktop-lite-card home-updates-desktop-card ${
        card.previewType === "director" ? "md:col-span-2 xl:col-span-2" : ""
      } ${getFeatureCardWideSpan(card.previewType)} ${getFeatureCardWideOrder(card.previewType)}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-72`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-65" />
      <div className="relative z-10 flex h-full flex-col home-desktop-card-sequence">
        <div>{renderFeaturePreview(card, true)}</div>
        <div className="mt-5 flex-1 home-desktop-panel-sequence">
          <h3 className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]">
            {card.title}
          </h3>
          <p className="mt-3 text-[15px] leading-7 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7">
            {card.copy}
          </p>
          {renderFeatureDetail(card)}
        </div>
      </div>
    </DesktopRevealCard>
  );
}

function JourneyCardDesktop({ card, index }) {
  return (
    <DesktopRevealCard
      index={index}
      className={`group relative h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6 xl:p-5 2xl:p-6 home-desktop-lite-card home-updates-desktop-card ${getJourneyCardWideSpan()}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-72`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-65" />
      <div className="relative z-10 flex h-full flex-col home-desktop-card-sequence">
        <div>{renderJourneyPreview(card, true)}</div>
        <div className="mt-5 flex-1 home-desktop-panel-sequence">
          <span className="inline-flex w-fit items-center rounded-full border border-white/12 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/58">
            {getJourneyStepLabel(index)}
          </span>
          <h3 className="mt-3 text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]">
            {card.title}
          </h3>
          <p className="mt-3 text-[15px] leading-7 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7">
            {card.copy}
          </p>
        </div>
      </div>
    </DesktopRevealCard>
  );
}

function FeatureCard({ card, index, prefersReducedMotion, useFlatLaptopMotion }) {
  const { ref, cardStyle, glowStyle, previewStyle, contentStyle, accentSweepStyle } = useCardScrollMotion(
    prefersReducedMotion,
    card.accent,
    index,
    useFlatLaptopMotion
  );
  const mobileCopy = getCompactCardCopy(card.copy);

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      whileHover={
        prefersReducedMotion
          ? undefined
          : useFlatLaptopMotion
          ? {
              y: -4,
              scale: 1.006,
              transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
            }
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
      } xl:p-5 2xl:p-6 ${getFeatureCardWideSpan(card.previewType)} ${getFeatureCardWideOrder(card.previewType)} will-change-transform [transform-style:preserve-3d]`}
    >
      <motion.div
        style={glowStyle}
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-90`}
      />
      <motion.div
        style={accentSweepStyle}
        className={`pointer-events-none absolute inset-y-6 ${index % 2 === 0 ? "-left-8" : "-right-8"} hidden w-28 rounded-full bg-gradient-to-b ${getAccentRail(
          card.accent
        )} blur-3xl sm:block`}
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
          className="mt-4 flex-1 will-change-transform sm:mt-5"
        >
          <motion.h3
            variants={previewTitleVariants}
            className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]"
          >
            {card.title}
          </motion.h3>
          <motion.p
            variants={previewItemVariants}
            className="mt-2.5 text-[14px] leading-6 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] sm:mt-3 sm:text-[15px] sm:leading-7 xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7"
          >
            {mobileCopy}
          </motion.p>
          {renderFeatureDetail(card)}
        </motion.div>
      </div>
    </motion.div>
  );
}

function JourneyCard({ card, index, prefersReducedMotion, useFlatLaptopMotion }) {
  const { ref, cardStyle, glowStyle, previewStyle, contentStyle, accentSweepStyle } =
    useJourneySwipeMotion(prefersReducedMotion, index, useFlatLaptopMotion);
  const mobileCopy = getCompactCardCopy(card.copy);

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      whileHover={
        prefersReducedMotion
          ? undefined
          : useFlatLaptopMotion
          ? {
              y: -4,
              scale: 1.006,
              transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
            }
          : {
              y: -5,
              scale: 1.01,
              rotateZ: index % 2 === 0 ? -1.2 : 1.2,
              transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
            }
      }
      style={cardStyle}
      className={`liquid-glass-soft group relative h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] will-change-transform [transform-style:preserve-3d] sm:p-6 xl:p-5 2xl:p-6 ${getJourneyCardWideSpan()}`}
    >
      <motion.div
        style={glowStyle}
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-90`}
      />
      <motion.div
        style={accentSweepStyle}
        className={`pointer-events-none absolute inset-y-6 ${index % 2 === 0 ? "-left-8" : "-right-8"} hidden w-28 rounded-full bg-gradient-to-b ${getAccentRail(
          card.accent
        )} blur-3xl sm:block`}
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
          className="mt-4 flex-1 will-change-transform sm:mt-5"
        >
          <motion.span
            variants={previewItemVariants}
            className="inline-flex w-fit items-center rounded-full border border-white/12 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/58"
          >
            {getJourneyStepLabel(index)}
          </motion.span>
          <motion.h3
            variants={previewTitleVariants}
            className="mt-3 text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]"
          >
            {card.title}
          </motion.h3>
          <motion.p
            variants={previewItemVariants}
            className="mt-2.5 text-[14px] leading-6 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] sm:mt-3 sm:text-[15px] sm:leading-7 xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7"
          >
            {mobileCopy}
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function HowItWorksSection() {
  const prefersReducedMotion = useReducedMotion();
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const shouldReduceMotion = prefersReducedMotion;
  const useFlatLaptopMotion = true;
  const featurePanelReveal = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: 0.06,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });
  const journeyPanelReveal = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: 0.06,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });
  const FeaturePanelTag = useDesktopLiteMotion ? "div" : motion.div;
  const JourneyPanelTag = useDesktopLiteMotion ? "div" : motion.div;
  const FeatureGridTag = useDesktopLiteMotion ? "div" : motion.div;
  const JourneyGridTag = useDesktopLiteMotion ? "div" : motion.div;
  const featurePanelProps = useDesktopLiteMotion
    ? {
        ref: featurePanelReveal.ref,
      }
    : {
        initial: { opacity: 0, x: -26, y: 16, scale: 0.992 },
        whileInView: { opacity: 1, x: 0, y: 0, scale: 1 },
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
      };
  const journeyPanelProps = useDesktopLiteMotion
    ? {
        ref: journeyPanelReveal.ref,
      }
    : {
        initial: { opacity: 0, x: 26, y: 16, scale: 0.992 },
        whileInView: { opacity: 1, x: 0, y: 0, scale: 1 },
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1], delay: 0.03 },
      };
  const featureGridProps = useDesktopLiteMotion
    ? {}
    : {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        variants: gridVariants,
      };
  const journeyGridProps = useDesktopLiteMotion
    ? {}
    : {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        variants: gridVariants,
      };

  return (
    <AnimatedSection
      id="updates"
      direction="left"
      className="mx-auto w-full max-w-7xl scroll-mt-28 overflow-hidden xl:max-w-[88rem] 2xl:max-w-[108rem]"
    >
      <div className="space-y-8">
        <FeaturePanelTag
          {...featurePanelProps}
          className={`${useDesktopLiteMotion ? "home-desktop-lite-panel home-updates-desktop-panel" : "liquid-glass-soft"} rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(8,8,14,0.62))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10 xl:p-8 2xl:p-10 ${
            useDesktopLiteMotion
              ? `home-desktop-reveal home-desktop-reveal-panel ${
                  featurePanelReveal.isVisible ? "is-visible" : ""
                }`
              : ""
          }`}
        >
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-amber-200/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.2),rgba(120,53,15,0.16))] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_rgba(245,158,11,0.18)]">
              New Update
            </span>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.34em] text-white/48">
              GV Cricket 2.0
            </p>
            <div className="mt-3">
              {useDesktopLiteMotion ? (
                <DesktopLiteHeadline
                  text={["New tools for", "live scoring"]}
                  isVisible={featurePanelReveal.isVisible}
                  delay={0.03}
                  className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                  lineClassName="leading-[0.98]"
                />
              ) : (
                <LiquidSportText
                  text={["New tools for", "live scoring"]}
                  characterTyping
                  characterStagger={0.02}
                  characterLineDelay={0.12}
                  characterDuration={0.34}
                  simplifyMotion={shouldReduceMotion}
                  lightweightCharacterReveal={useDesktopLiteMotion}
                  delay={0.03}
                  className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                  lineClassName="leading-[0.98]"
                />
              )}
            </div>
          </div>

          <FeatureGridTag
            {...featureGridProps}
            className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-4 2xl:grid-cols-12 2xl:gap-5"
          >
            {featureCards.map((card, index) => (
              useDesktopLiteMotion ? (
                <FeatureCardDesktop key={card.title} card={card} index={index} />
              ) : (
                <FeatureCard
                  key={card.title}
                  card={card}
                  index={index}
                  prefersReducedMotion={shouldReduceMotion}
                  useFlatLaptopMotion={useFlatLaptopMotion}
                />
              )
            ))}
          </FeatureGridTag>
        </FeaturePanelTag>

        <JourneyPanelTag
          {...journeyPanelProps}
          className={`${useDesktopLiteMotion ? "home-desktop-lite-panel home-updates-desktop-panel" : "liquid-glass-soft"} rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(8,8,14,0.62))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10 xl:p-8 2xl:p-10 ${
            useDesktopLiteMotion
              ? `home-desktop-reveal home-desktop-reveal-panel ${
                  journeyPanelReveal.isVisible ? "is-visible" : ""
                }`
              : ""
          }`}
        >
          <div className="mx-auto max-w-3xl text-center">
            {useDesktopLiteMotion ? (
              <DesktopLiteHeadline
                text={["What is", "GV Cricket?"]}
                isVisible={journeyPanelReveal.isVisible}
                delay={0.03}
                className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                lineClassName="leading-[0.98]"
              />
            ) : (
              <LiquidSportText
                text={["What is", "GV Cricket?"]}
                characterTyping
                characterStagger={0.02}
                characterLineDelay={0.12}
                characterDuration={0.34}
                simplifyMotion={shouldReduceMotion}
                lightweightCharacterReveal={useDesktopLiteMotion}
                delay={0.03}
                className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                lineClassName="leading-[0.98]"
              />
            )}
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/72 md:hidden">
              GV Cricket lets one person score live while everyone else can watch, hear updates, and follow the match in real time.
            </p>
            <p className="mx-auto mt-4 hidden max-w-xl text-sm leading-6 text-white/72 md:block md:text-base">
              GV Cricket is a mobile-first live scoring app for local cricket matches. One person updates the game, everyone else can watch it live, and the app can speak updates, play audio, and keep the match organized from start to finish.
            </p>
          </div>

          <JourneyGridTag
            {...journeyGridProps}
            className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-4 2xl:grid-cols-12 2xl:gap-5"
          >
            {journeyCards.map((card, index) => (
              useDesktopLiteMotion ? (
                <JourneyCardDesktop key={card.title} card={card} index={index} />
              ) : (
                <JourneyCard
                  key={card.title}
                  card={card}
                  index={index}
                  prefersReducedMotion={shouldReduceMotion}
                  useFlatLaptopMotion={useFlatLaptopMotion}
                />
              )
            ))}
          </JourneyGridTag>
        </JourneyPanelTag>
      </div>
    </AnimatedSection>
  );
}
