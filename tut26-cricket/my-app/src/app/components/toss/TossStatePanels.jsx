"use client";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircle } from "react-icons/fa";
import { CoinHeads, CoinTails, SpinningCoin } from "./CoinArt";

function ChoiceButton({ onClick, tone, children }) {
  return (
    <button
      onClick={onClick}
      className={`group flex min-h-[96px] flex-1 items-center justify-center rounded-[24px] border px-5 py-4 text-center transition duration-300 hover:-translate-y-0.5 ${
        tone === "heads"
          ? "border-amber-300/18 bg-[linear-gradient(180deg,rgba(244,181,49,0.92),rgba(216,137,30,0.92))] text-black shadow-[0_14px_30px_rgba(216,137,30,0.16)]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(38,38,46,0.98),rgba(18,18,24,0.98))] text-white shadow-[0_14px_30px_rgba(0,0,0,0.22)]"
      }`}
    >
      <div className="text-[1.55rem] font-extrabold uppercase tracking-[0.22em] transition-transform group-hover:translate-x-0.5">
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
    <div className="min-h-[520px] rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,12,0.98))] px-5 py-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
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
              <h2 className="text-[2.15rem] font-bold tracking-tight text-white">{teamName}</h2>
              <p className="mt-2 text-sm text-zinc-400">Choose heads or tails.</p>
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
            <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">Starting in</p>
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
              <p className="mt-6 text-sm text-zinc-400">
                {teamName} called {call}.
              </p>
              <h2 className="mt-3 text-[2.1rem] font-bold leading-tight tracking-tight text-white">
                {winnerName} won the toss
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Landed on <span className="capitalize text-white">{side}</span>.
              </p>
            </div>

            <div className="w-full">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => onDecision("bat")}
                  disabled={isSubmitting}
                  className="btn-ui btn-ui-primary group rounded-[24px] px-4 py-4 text-base font-medium disabled:hover:translate-y-0"
                >
                  <span className="block transition-transform group-hover:translate-x-0.5">
                    {isSubmitting ? "Saving..." : "Bat First"}
                  </span>
                </button>
                <button
                  onClick={() => onDecision("bowl")}
                  disabled={isSubmitting}
                  className="btn-ui btn-ui-neutral group rounded-[24px] px-4 py-4 text-base font-medium disabled:hover:translate-y-0"
                >
                  <span className="block transition-transform group-hover:translate-x-0.5">
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
