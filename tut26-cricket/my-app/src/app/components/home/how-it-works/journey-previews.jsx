/**
 * File overview:
 * Purpose: Renders the journey-step previews used in the home-page how-it-works section.
 * Main exports: renderJourneyPreview, AnimatedStepFlowPreview, and related preview components.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { motion } from "framer-motion";
import StepFlow from "../../shared/StepFlow";
import {
  FaBroadcastTower,
  FaBullhorn,
  FaBullseye,
  FaCheckCircle,
  FaLock,
  FaMusic,
  FaTrophy,
  FaVolumeUp,
} from "react-icons/fa";
import {
  animatedAccessFrames,
  animatedHistoryFrames,
  animatedJourneyAudioFrames,
  animatedJourneyWalkieFrames,
  animatedSpectatorFrames,
  animatedTeamsFrames,
  animatedUmpireFrames,
  miniCelebrationConfetti,
} from "./how-it-works-data";
import { previewItemVariants, previewStaggerVariants } from "./how-it-works-motion";
import {
  AnimatedMiniBallRow,
  MiniAudioBars,
  MiniBall,
  MiniPulseDot,
  MiniStepFlowPreview,
  MiniTossSpinner,
  PreviewSurface,
  getPreviewNodeSet,
  useLoopedFrame,
} from "./feature-previews";
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
        className="w-full"
      >
        <StepFlow currentStep={currentStep} compact />
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
            initial={{ opacity: 0.72 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <StepFlow currentStep={frame.step} compact />
          </motion.div>
        </Div>
        <Div
          {...withVariants(previewItemVariants)}
          className="h-[22.5rem] overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 sm:h-[22rem]"
        >
          <motion.div
            key={`${frame.step}-${frame.heading}`}
            initial={{ opacity: 0.74 }}
            animate={{ opacity: 1 }}
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


export {
  AnimatedAccessJourneyPreview,
  AnimatedHistoryJourneyPreview,
  AnimatedJourneyAudioPreview,
  AnimatedJourneyWalkiePreview,
  AnimatedSpectatorJourneyPreview,
  AnimatedStepFlowPreview,
  AnimatedTeamsJourneyPreview,
  AnimatedUmpireJourneyPreview,
  renderJourneyPreview,
};



