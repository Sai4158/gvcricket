"use client";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircle } from "react-icons/fa";
import { CoinHeads, CoinTails, SpinningCoin } from "./CoinArt";

function ChoiceButton({ onClick, tone, children }) {
  return (
    <button
      onClick={onClick}
      className={`group flex-1 rounded-[24px] px-5 py-4 text-left transition duration-300 hover:-translate-y-0.5 ${
        tone === "heads"
          ? "bg-[linear-gradient(135deg,#fde047,#f59e0b)] text-black shadow-[0_16px_36px_rgba(245,158,11,0.24)]"
          : "bg-[linear-gradient(135deg,#e5e7eb,#94a3b8)] text-black shadow-[0_16px_36px_rgba(148,163,184,0.18)]"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] opacity-70">
        Call
      </div>
      <div className="mt-2 text-2xl font-black transition-transform group-hover:translate-x-0.5">
        {children}
      </div>
    </button>
  );
}

export default function TossStatePanels({
  status,
  countdown,
  teamName,
  tossResult,
  isSubmitting,
  onChoice,
  onDecision,
}) {
  const { winnerName, call, side } = tossResult;

  return (
    <div className="min-h-[520px] rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-6">
      <AnimatePresence mode="wait">
        {status === "choosing" ? (
          <motion.div
            key="choosing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex min-h-[468px] flex-col justify-between"
          >
            <div className="text-center">
              <h2 className="text-3xl font-black text-white">{teamName}</h2>
              <p className="mt-2 text-sm text-zinc-400">Call it.</p>
            </div>

            <div className="py-8 flex justify-center">
              <motion.div
                animate={{ rotateY: 720 }}
                transition={{
                  duration: 6,
                  ease: "linear",
                  repeat: Number.POSITIVE_INFINITY,
                }}
                className="[transform-style:preserve-3d]"
              >
                <SpinningCoin />
              </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ChoiceButton tone="heads" onClick={() => onChoice("heads")}>
                Heads
              </ChoiceButton>
              <ChoiceButton tone="tails" onClick={() => onChoice("tails")}>
                Tails
              </ChoiceButton>
            </div>
          </motion.div>
        ) : null}

        {status === "counting" ? (
          <motion.div
            key="counting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex min-h-[468px] flex-col items-center justify-center text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-300">
              <FaCircle className="text-[9px] text-amber-300" />
              Tossing
            </div>
            <div className="my-8">
              <SpinningCoin />
            </div>
            <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">In</p>
            <p className="mt-2 text-8xl font-black text-white">{countdown}</p>
          </motion.div>
        ) : null}

        {status === "flipping" ? (
          <motion.div
            key="flipping"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex min-h-[468px] flex-col items-center justify-center text-center"
          >
            <motion.div
              animate={{ rotateY: 1440 }}
              transition={{ duration: 2.2, ease: "easeInOut" }}
              className="[transform-style:preserve-3d]"
            >
              <SpinningCoin />
            </motion.div>
            <p className="mt-8 text-lg font-semibold text-zinc-200">Flipping...</p>
          </motion.div>
        ) : null}

        {status === "finished" ? (
          <motion.div
            key="finished"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[468px] flex-col items-center justify-between text-center"
          >
            <div>
              <div className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Result
              </div>
              <div className="mt-6 flex justify-center">
                {side === "heads" ? <CoinHeads /> : <CoinTails />}
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.38em] text-zinc-500">
                {teamName} called {call}
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white">
                {winnerName} won the toss
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Landed on <span className="capitalize text-white">{side}</span>
              </p>
            </div>

            <div className="w-full">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.34em] text-zinc-500">
                Next move
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => onDecision("bat")}
                  disabled={isSubmitting}
                  className="group rounded-[24px] border border-amber-200/40 bg-[linear-gradient(135deg,#fde047_0%,#f59e0b_100%)] px-4 py-4 text-base font-black text-black shadow-[0_18px_40px_rgba(245,158,11,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(245,158,11,0.28)] disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <span className="block text-[10px] uppercase tracking-[0.28em] opacity-70">
                    Attack
                  </span>
                  <span className="mt-1 block transition-transform group-hover:translate-x-0.5">
                    {isSubmitting ? "Saving..." : "Bat First"}
                  </span>
                </button>
                <button
                  onClick={() => onDecision("bowl")}
                  disabled={isSubmitting}
                  className="group rounded-[24px] border border-sky-200/20 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-4 py-4 text-base font-black text-white shadow-[0_18px_40px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(37,99,235,0.3)] disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <span className="block text-[10px] uppercase tracking-[0.28em] opacity-75">
                    Control
                  </span>
                  <span className="mt-1 block transition-transform group-hover:translate-x-0.5">
                    {isSubmitting ? "Saving..." : "Bowl First"}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
