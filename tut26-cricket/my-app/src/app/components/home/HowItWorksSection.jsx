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
  FaVolumeUp,
  FaYoutube,
} from "react-icons/fa";
import StepFlow from "../shared/StepFlow";
import SafeMatchImage from "../shared/SafeMatchImage";
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
    filter: "blur(6px)",
  }),
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
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
    filter: "blur(3px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
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
    filter: "blur(3px)",
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
    copy: "Keep the umpire, spectators, and director on one shared live channel for faster listen-and-respond audio.",
    accent: "emerald",
    previewType: "walkie",
  },
  {
    title: "Loudspeaker",
    copy: "Turn one phone into a clean hold-to-talk PA mic for score calls, ground updates, and quick match announcements.",
    accent: "amber",
    previewType: "loudspeaker",
  },
  {
    title: "Score Announcer",
    copy: "Queue cleaner score reads with better timing, sharper phrasing, and clearer delivery between balls.",
    accent: "violet",
    previewType: "announcer",
  },
  {
    title: "Share The Match",
    copy: "Share one live match link so spectators can open the scoreboard on any phone, tablet, or big screen in seconds.",
    accent: "orange",
    previewType: "share",
  },
  {
    title: "Match Images",
    copy: "Upload one match image and carry it across the live scoreboard, spectator page, and final result screen.",
    accent: "rose",
    previewType: "cover",
  },
  {
    title: "Result Insights",
    copy: "Finish with a cleaner result screen, stronger winner context, and a better closing summary of the match.",
    accent: "yellow",
    previewType: "insights",
  },
  {
    title: "Director Console",
    copy: "Run effects, YouTube music, walkie, loudspeaker, and score audio from one sharper live control deck.",
    accent: "cyan",
    previewType: "director",
  },
  {
    title: "Live Match Banner",
    copy: "Bring the newest live match to the home page so anyone can jump into the scoreboard in one tap.",
    accent: "emerald",
    previewType: "livebanner",
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
    title: "In-Match Walkie",
    copy: "Keep the umpire, director, and spectators on one quick live talk channel during the match.",
    accent: "emerald",
    previewType: "match-walkie",
  },
  {
    title: "Ball History",
    copy: "Track the latest over at a glance with a clean live ball history strip and current match context.",
    accent: "cyan",
    previewType: "history",
  },
  {
    title: "Loudspeaker And Announcer",
    copy: "Use the PA mic for live calls and keep the score announcer ready for the next update.",
    accent: "violet",
    previewType: "match-audio",
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

function getPreviewNodeSet(staticMode) {
  return {
    Div: staticMode ? "div" : motion.div,
    Span: staticMode ? "span" : motion.span,
    P: staticMode ? "p" : motion.p,
    withVariants: (variants) => (staticMode ? {} : { variants }),
  };
}

function MiniBall({ label, tone = "green", staticMode = false }) {
  const { Span, withVariants } = getPreviewNodeSet(staticMode);
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
      {...withVariants(previewItemVariants)}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${toneClass}`}
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
      className="home-desktop-preview-surface relative overflow-hidden rounded-[26px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(12,14,20,0.96),rgba(7,8,12,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
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

function renderJourneyPreview(card, staticMode = false) {
  const { Div, Span, P, withVariants } = getPreviewNodeSet(staticMode);

  switch (card.previewType) {
    case "teams":
      return (
        <PreviewSurface accent={card.accent} heading="Step 1" staticMode={staticMode}>
          <div className="space-y-3">
            <MiniStepFlowPreview staticMode={staticMode} />
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3"
            >
              <P className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
                Session name
              </P>
              <div className="mt-2 rounded-[14px] border border-amber-300/16 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                Friday Night Finals
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Team A
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">Team A</p>
                </div>
                <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Team B
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">Team B</p>
                </div>
              </div>
            </Div>
          </div>
        </PreviewSurface>
      );
    case "toss":
      return (
        <PreviewSurface accent={card.accent} heading="Toss" staticMode={staticMode}>
          <div className="space-y-3">
            <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-2 gap-3">
              <Div {...withVariants(previewItemVariants)} className="btn-ui btn-ui-glass-dark justify-center rounded-[18px] px-3 py-4 text-[12px]">
                Heads
              </Div>
              <Div {...withVariants(previewItemVariants)} className="btn-ui btn-ui-glass-dark-alt justify-center rounded-[18px] px-3 py-4 text-[12px]">
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
      return (
        <PreviewSurface accent={card.accent} heading="Umpire Mode" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="flex items-start justify-between gap-3"
            >
              <div>
                <P className="text-lg font-semibold text-white">52/3</P>
                <P className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Over 8.2</P>
              </div>
              <div className="text-right">
                <P className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">This over</P>
                <div className="mt-2 flex gap-1.5">
                  <MiniBall label="1" staticMode={staticMode} />
                  <MiniBall label="4" tone="amber" staticMode={staticMode} />
                  <MiniBall label="Wd" tone="amber" staticMode={staticMode} />
                  <MiniBall label="W" tone="rose" staticMode={staticMode} />
                </div>
              </div>
            </Div>
            <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-4 gap-2">
              {[
                { label: "Dot", className: "bg-zinc-800 hover:bg-zinc-700 text-white" },
                { label: "1", className: "bg-zinc-800 hover:bg-zinc-700 text-white" },
                { label: "4", className: "bg-zinc-800 hover:bg-zinc-700 text-amber-300" },
                { label: "OUT", className: "bg-rose-700 hover:bg-rose-600 text-white" },
              ].map((action) => (
                <Div
                  key={action.label}
                  {...withVariants(previewItemVariants)}
                  className={`flex min-h-[4.1rem] items-center justify-center rounded-[16px] border border-white/10 px-2 py-3 text-center text-[13px] font-bold uppercase tracking-[0.08em] shadow-[0_14px_26px_rgba(0,0,0,0.18)] ${action.className}`}
                >
                  {action.label}
                </Div>
              ))}
            </Div>
          </div>
        </PreviewSurface>
      );
    case "match-walkie":
      return (
        <PreviewSurface accent={card.accent} heading="In Match Walkie" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,28,22,0.94),rgba(8,12,16,0.98))] px-4 py-3"
            >
              <div>
                <P className="text-sm font-semibold text-white">Walkie live</P>
                <P className="mt-1 text-[11px] text-zinc-400">Tap and hold to answer fast.</P>
              </div>
              <div className="inline-flex h-6 w-11 rounded-full border border-emerald-300/30 bg-emerald-400/18">
                <span className="mt-0.5 inline-flex h-5 w-5 translate-x-5 rounded-full bg-white" />
              </div>
            </Div>
            <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-3 gap-2">
              {[
                ["Umpire", "1 live"],
                ["Director", "ready"],
                ["Spectators", "2 joined"],
              ].map(([label, meta]) => (
                <Div
                  key={label}
                  {...withVariants(previewItemVariants)}
                  className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3"
                >
                  <P className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {label}
                  </P>
                  <P className="mt-2 text-sm font-semibold text-white">{meta}</P>
                </Div>
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
    case "history":
      return (
        <PreviewSurface accent={card.accent} heading="Ball History" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="flex items-start justify-between gap-3 rounded-[18px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(8,20,34,0.94),rgba(7,8,12,0.98))] px-4 py-3"
            >
              <div>
                <P className="text-lg font-semibold text-white">OVER 8</P>
                <P className="mt-1 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Team A 52/3
                </P>
              </div>
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
              <Div {...withVariants(previewStaggerVariants)} className="mt-3 flex flex-wrap gap-2">
                <MiniBall label="1" staticMode={staticMode} />
                <MiniBall label="4" tone="amber" staticMode={staticMode} />
                <MiniBall label="Wd" tone="amber" staticMode={staticMode} />
                <MiniBall label="W" tone="rose" staticMode={staticMode} />
                <MiniBall label="2" staticMode={staticMode} />
                <MiniBall label="1" staticMode={staticMode} />
              </Div>
            </Div>
            <Div
              {...withVariants(previewItemVariants)}
              className="flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3 text-[12px]"
            >
              <span className="font-semibold text-white">Recent balls stay in view</span>
              <span className="text-zinc-400">Latest first</span>
            </Div>
          </div>
        </PreviewSurface>
      );
    case "match-audio":
      return (
        <PreviewSurface accent={card.accent} heading="Match Audio" staticMode={staticMode}>
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
                <P className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Hold live
                </P>
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
                <P className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Ready
                </P>
              </Div>
            </Div>
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
            >
              <P className="text-sm font-semibold text-white">Next call queued</P>
              <P className="mt-2 text-[12px] text-zinc-400">
                Team A 52 for 3 after 8.2 overs.
              </P>
            </Div>
          </div>
        </PreviewSurface>
      );
    case "spectator":
      return (
        <PreviewSurface accent={card.accent} heading="Spectator" staticMode={staticMode}>
          <Div
            {...withVariants(previewItemVariants)}
            className="rounded-[22px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,15,20,0.96),rgba(8,10,16,0.98))] p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.14),0_18px_44px_rgba(6,78,59,0.18)]"
          >
            <Div {...withVariants(previewItemVariants)} className="flex items-start justify-between gap-3">
              <div>
                <P className="text-xl font-semibold uppercase tracking-tight text-white">Team B</P>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative overflow-hidden rounded-[16px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(120,53,15,0.12))] px-3 py-2 shadow-[0_10px_24px_rgba(120,53,15,0.18)]">
                    <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/44 to-transparent" />
                    <div className="flex items-center gap-2">
                      <FaBullseye className="text-[11px] text-amber-200" />
                      <P className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/92">
                        Target 45
                      </P>
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-3 py-2">
                    <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" />
                    <P className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-200">
                      Need 43
                    </P>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <P className="text-3xl font-black leading-none text-amber-300">2</P>
                <P className="mt-1 text-[13px] font-black uppercase tracking-tight text-amber-300">
                  Runs
                </P>
              </div>
            </Div>
            <Div
              {...withVariants(previewItemVariants)}
              className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3"
            >
              <P className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Over 1
              </P>
              <Div {...withVariants(previewStaggerVariants)} className="mt-3 flex gap-2">
                <MiniBall label="1" staticMode={staticMode} />
                <MiniBall label="1" staticMode={staticMode} />
              </Div>
            </Div>
          </Div>
        </PreviewSurface>
      );
    case "status":
      return (
        <PreviewSurface accent={card.accent} heading="Match Status" staticMode={staticMode}>
          <div className="space-y-3">
            {[
              ["Live", "Scoring in progress"],
              ["Innings Complete", "Target locked in"],
              ["Final Result", "Winner available"],
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
                <Span
                  {...withVariants(previewItemVariants)}
                  className={`h-2.5 w-2.5 rounded-full ${
                    index === 0 ? "bg-emerald-400" : index === 1 ? "bg-amber-300" : "bg-sky-300"
                  }`}
                />
              </Div>
            ))}
          </div>
        </PreviewSurface>
      );
    case "access":
      return (
        <PreviewSurface accent={card.accent} heading="PIN Entry" staticMode={staticMode}>
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
              <div className="mt-3 rounded-[16px] border border-emerald-300/18 bg-black/20 px-4 py-4 text-center text-xl font-semibold tracking-[0.5em] text-white">
                - - - -
              </div>
            </Div>
            <Div
              {...withVariants(previewItemVariants)}
              className="btn-ui btn-ui-glass-dark inline-flex w-full justify-center rounded-[18px] px-4 py-3 text-[12px]"
            >
              <FaLock />
              Enter Console
            </Div>
          </div>
        </PreviewSurface>
      );
    default:
      return null;
  }
}

function renderFeaturePreview(card, staticMode = false) {
  const { Div, Span, P, withVariants } = getPreviewNodeSet(staticMode);

  switch (card.previewType) {
    case "walkie":
      return (
        <PreviewSurface accent={card.accent} heading="Live Audio" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[20px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,28,22,0.94),rgba(8,12,16,0.96))] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <P className="text-sm font-semibold text-white">Walkie-Talkie</P>
                  <P className="mt-1 text-[12px] text-zinc-400">Tap and hold to talk.</P>
                </div>
                <Div
                  {...withVariants(previewItemVariants)}
                  className="inline-flex h-6 w-11 rounded-full border border-emerald-300/30 bg-emerald-400/18"
                >
                  <Span
                    {...withVariants(previewItemVariants)}
                    className="mt-0.5 inline-flex h-5 w-5 translate-x-5 rounded-full bg-white"
                  />
                </Div>
              </div>
              <Div {...withVariants(previewItemVariants)} className="mt-4 flex items-center justify-between gap-3">
                <Div {...withVariants(previewStaggerVariants)} className="flex flex-wrap gap-2">
                  {["Umpire", "Director", "Spectators"].map((label) => (
                    <Span
                      key={label}
                      {...withVariants(previewItemVariants)}
                      className="rounded-full border border-emerald-300/16 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/90"
                    >
                      {label}
                    </Span>
                  ))}
                </Div>
                <Span
                  {...withVariants(previewItemVariants)}
                  className="inline-flex h-18 w-18 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl text-white"
                >
                  <FaBroadcastTower />
                </Span>
              </Div>
            </Div>
          </div>
        </PreviewSurface>
      );
    case "loudspeaker":
      return (
        <PreviewSurface accent={card.accent} heading="PA Mic" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
            >
              <div>
                <P className="text-sm font-semibold text-white">Loudspeaker</P>
                <P className="mt-1 text-[11px] text-zinc-500">Armed for hold to talk.</P>
              </div>
              <Div
                {...withVariants(previewItemVariants)}
                className="inline-flex h-6 w-11 rounded-full border border-emerald-300/30 bg-emerald-400/18"
              >
                <Span
                  {...withVariants(previewItemVariants)}
                  className="mt-0.5 inline-flex h-5 w-5 translate-x-5 rounded-full bg-white"
                />
              </Div>
            </Div>
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-center"
            >
              <Span
                {...withVariants(previewItemVariants)}
                className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/18 bg-[linear-gradient(180deg,rgba(249,115,22,0.94),rgba(245,158,11,0.94))] text-2xl text-black"
              >
                <FaMicrophoneAlt />
              </Span>
              <P {...withVariants(previewItemVariants)} className="mt-3 text-sm font-semibold text-white">
                Hold to talk live
              </P>
            </Div>
          </div>
        </PreviewSurface>
      );
    case "director":
      return (
        <PreviewSurface accent={card.accent} heading="Director" staticMode={staticMode}>
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
              <span className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100/90">
                Armed
              </span>
            </Div>
            <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {[
                ["Walkie", FaBroadcastTower, "Live"],
                ["PA Mic", FaBullhorn, "Ready"],
                ["YouTube", FaYoutube, "Deck A"],
                ["Effects", FaVolumeUp, "6 pads"],
                ["Announcer", FaMicrophoneAlt, "Queued"],
                ["Crowd", FaVolumeUp, "Hot"],
              ].map(([label, Icon, meta], index) => (
                <Div
                  key={label}
                  {...withVariants(previewItemVariants)}
                  className={`rounded-[18px] border px-3 py-3 ${
                    index === 0 || index === 1
                      ? "border-cyan-300/16 bg-[linear-gradient(180deg,rgba(37,99,235,0.16),rgba(17,24,39,0.92))]"
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]"
                  }`}
                >
                  <Icon
                    className={`text-sm ${
                      label === "YouTube" ? "text-red-300" : "text-white"
                    }`}
                  />
                  <P className="mt-3 text-sm font-semibold text-white">{label}</P>
                  <P className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{meta}</P>
                </Div>
              ))}
            </Div>
            <Div
              {...withVariants(previewStaggerVariants)}
              className="grid gap-2 rounded-[20px] border border-white/10 bg-white/[0.03] p-3"
            >
              {[
                ["Mic", "84%"],
                ["Music", "62%"],
                ["FX", "71%"],
              ].map(([label, value]) => (
                <Div
                  key={label}
                  {...withVariants(previewItemVariants)}
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
                </Div>
              ))}
            </Div>
          </div>
        </PreviewSurface>
      );
    case "share":
      return (
        <PreviewSurface accent={card.accent} heading="Share" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[20px] border border-orange-300/16 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_30%),linear-gradient(180deg,rgba(30,20,14,0.96),rgba(10,10,14,0.98))] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <P className="text-sm font-semibold text-white">Live match link</P>
                  <P className="mt-1 text-[12px] text-zinc-400">Share instantly with players and spectators.</P>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-orange-300/16 bg-orange-400/10 text-orange-200">
                  <FaShareAlt />
                </span>
              </div>
              <div className="mt-4 rounded-[16px] border border-white/10 bg-black/20 px-3 py-3 text-[12px] text-zinc-300">
                gvcricket.live/session/friday-finals
              </div>
            </Div>
            <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-3 gap-2">
              {["Phone", "Tablet", "Big Screen"].map((label) => (
                <Div
                  key={label}
                  {...withVariants(previewItemVariants)}
                  className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300"
                >
                  {label}
                </Div>
              ))}
            </Div>
          </div>
        </PreviewSurface>
      );
    case "announcer":
      return (
        <PreviewSurface accent={card.accent} heading="Voice" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3"
            >
              <P className="text-sm font-semibold text-white">Current score</P>
              <P className="mt-2 text-[12px] text-zinc-400">Team B 52 for 3 after 8.2 overs.</P>
            </Div>
            <Div
              {...withVariants(previewItemVariants)}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-violet-300/16 bg-[linear-gradient(180deg,rgba(124,58,237,0.16),rgba(20,14,32,0.94))] px-4 py-3"
            >
              <div>
                <P className="text-sm font-semibold text-white">Announcer ready</P>
                <P className="mt-1 text-[11px] text-zinc-300">Next ball update is queued.</P>
              </div>
              <Span {...withVariants(previewItemVariants)}>
                <FaVolumeUp className="text-lg text-violet-200" />
              </Span>
            </Div>
          </div>
        </PreviewSurface>
      );
    case "cover":
      return (
        <PreviewSurface accent={card.accent} heading="Cover Image" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_32%),linear-gradient(180deg,rgba(30,24,26,0.96),rgba(12,10,14,0.98))] p-3"
            >
              <div className="rounded-[18px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 text-center">
                <FaImage className="mx-auto text-2xl text-white/80" />
                <P className="mt-3 text-sm font-semibold text-white">Upload match image</P>
                <P className="mt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  Live, spectator, result
                </P>
              </div>
            </Div>
            <P {...withVariants(previewItemVariants)} className="text-[12px] leading-6 text-zinc-400">
              Upload once and reuse the same match image everywhere the session appears.
            </P>
          </div>
        </PreviewSurface>
      );
    case "insights":
      return (
        <PreviewSurface accent={card.accent} heading="Result" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="rounded-[22px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(217,119,6,0.12))] p-4"
            >
              <P className="text-xl font-black tracking-[-0.04em] text-white">Team A won</P>
              <P className="mt-2 text-sm text-zinc-100/82">Won by 7 wickets</P>
            </Div>
            <Div {...withVariants(previewStaggerVariants)} className="grid grid-cols-3 gap-2">
              {[
                ["44/4", "Score"],
                ["4.0", "Overs"],
                ["11.00", "RR"],
              ].map(([value, label]) => (
                <Div
                  key={label}
                  {...withVariants(previewItemVariants)}
                  className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-3 py-3"
                >
                  <P className="text-sm font-semibold text-white">{value}</P>
                  <P className="mt-1 text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                    {label}
                  </P>
                </Div>
              ))}
            </Div>
          </div>
        </PreviewSurface>
      );
    case "livebanner":
      return (
        <PreviewSurface accent={card.accent} heading="Live Match Banner" staticMode={staticMode}>
          <div className="space-y-3">
            <Div
              {...withVariants(previewItemVariants)}
              className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_36%),linear-gradient(180deg,rgba(22,24,30,0.96),rgba(10,12,16,0.98))] px-3 py-3"
            >
              <div className="relative z-10 flex items-center justify-between gap-2.5">
                <div className="liquid-glass relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[22px] px-3 py-2.5 text-white shadow-[0_18px_34px_rgba(0,0,0,0.2)]">
                  <div className="absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.1),transparent_40%)]" />
                  <div className="relative z-10 flex min-w-0 items-center gap-2">
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
                        Live Now
                      </div>
                      <div className="truncate text-[11px] font-semibold leading-tight text-white">
                        TEAM A vs TEAM B
                      </div>
                      <div className="truncate text-[9px] leading-tight text-white/72">
                        1/0 - View score now
                      </div>
                    </div>
                  </div>
                  <div className="liquid-pill relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] text-white">
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
        ? [0.8 * direction, 0.3 * direction, 0, -0.1 * direction, -0.4 * direction]
        : [direction * 5.5, direction * 2.5, 0, direction * -1.8, direction * -4]
    ),
    springConfig
  );
  const cardScale = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.22, 0.5, 0.82, 1],
      useFlatLaptopMotion ? [0.985, 0.995, 1, 0.995, 0.988] : [0.94, 0.975, 1, 0.985, 0.96]
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
      className={`group relative h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6 xl:p-5 2xl:p-6 home-desktop-lite-card ${
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
      className={`group relative h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6 xl:p-5 2xl:p-6 home-desktop-lite-card ${getJourneyCardWideSpan()}`}
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
          <h3 className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]">
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
            className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]"
          >
            {card.title}
          </motion.h3>
          <motion.p
            variants={previewItemVariants}
            className="mt-3 text-[15px] leading-7 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7"
          >
            {card.copy}
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
            className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]"
          >
            {card.title}
          </motion.h3>
          <motion.p
            variants={previewItemVariants}
            className="mt-3 text-[15px] leading-7 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7"
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
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const shouldReduceMotion = prefersReducedMotion || useDesktopLiteMotion;
  const useFlatLaptopMotion = useDesktopLiteMotion;
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
        initial: { opacity: 0, x: -34, y: 18, scale: 0.992, filter: "blur(6px)" },
        whileInView: { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" },
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] },
      };
  const journeyPanelProps = useDesktopLiteMotion
    ? {
        ref: journeyPanelReveal.ref,
      }
    : {
        initial: { opacity: 0, x: 34, y: 18, scale: 0.992, filter: "blur(6px)" },
        whileInView: { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" },
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1], delay: 0.03 },
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
          className={`${useDesktopLiteMotion ? "home-desktop-lite-panel" : "liquid-glass-soft"} rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(8,8,14,0.62))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10 xl:p-8 2xl:p-10 ${
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
          className={`${useDesktopLiteMotion ? "home-desktop-lite-panel" : "liquid-glass-soft"} rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(8,8,14,0.62))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10 xl:p-8 2xl:p-10 ${
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
                text={["From toss to final", "result"]}
                isVisible={journeyPanelReveal.isVisible}
                delay={0.03}
                className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                lineClassName="leading-[0.98]"
              />
            ) : (
              <LiquidSportText
                text={["From toss to final", "result"]}
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
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/72 md:text-base">
              A fresh live match flow with instant scoring, premium spectator view, smarter match status, and secure access from start to finish.
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
