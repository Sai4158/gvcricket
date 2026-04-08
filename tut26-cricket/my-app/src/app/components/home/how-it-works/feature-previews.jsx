/**
 * File overview:
 * Purpose: Home-page feature preview renderers and shared preview primitives.
 * Main exports: getPreviewNodeSet, MiniBall, PreviewSurface, MiniStepFlowPreview, MiniTossSpinner, MiniPulseDot, MiniAudioBars, useLoopedFrame, AnimatedMiniBallRow, AnimatedWalkieFeaturePreview, AnimatedLoudspeakerFeaturePreview, AnimatedAnnouncerFeaturePreview, AnimatedShareFeaturePreview, AnimatedCoverFeaturePreview, AnimatedInsightsFeaturePreview, AnimatedDirectorFeaturePreview, AnimatedLiveBannerFeaturePreview, renderFeaturePreview.
 * Major callers: HowItWorksSectionContent and adjacent journey preview modules.
 * Side effects: uses React hooks and browser motion APIs.
 * Read next: README.md
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  FaArrowRight,
  FaBars,
  FaBroadcastTower,
  FaBullhorn,
  FaImage,
  FaMicrophoneAlt,
  FaShareAlt,
  FaVolumeUp,
  FaYoutube,
} from "react-icons/fa";
import StepFlow from "../../shared/StepFlow";
import SafeMatchImage from "../../shared/SafeMatchImage";
import { SpinningCoin } from "../../toss/CoinArt";
import {
  animatedAnnouncerFrames,
  animatedCoverFrames,
  animatedDirectorFrames,
  animatedInsightsFrames,
  animatedLiveBannerFrames,
  animatedLoudspeakerFrames,
  animatedShareFrames,
  animatedWalkieFeatureFrames,
} from "./how-it-works-data";
import { previewItemVariants, previewStaggerVariants } from "./how-it-works-motion";
import { getAccentRail } from "./how-it-works-utils";
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


export {
  AnimatedAnnouncerFeaturePreview,
  AnimatedCoverFeaturePreview,
  AnimatedDirectorFeaturePreview,
  AnimatedInsightsFeaturePreview,
  AnimatedLiveBannerFeaturePreview,
  AnimatedLoudspeakerFeaturePreview,
  AnimatedMiniBallRow,
  AnimatedShareFeaturePreview,
  AnimatedWalkieFeaturePreview,
  MiniAudioBars,
  MiniBall,
  MiniPulseDot,
  MiniStepFlowPreview,
  MiniTossSpinner,
  PreviewSurface,
  getPreviewNodeSet,
  renderFeaturePreview,
  useLoopedFrame,
};

