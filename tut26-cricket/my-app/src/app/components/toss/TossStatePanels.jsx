"use client";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaCircle } from "react-icons/fa";
import LoadingButton from "../shared/LoadingButton";
import { CoinHeads, CoinTails, SpinningCoin } from "./CoinArt";

function ChoiceButton({ onClick, tone, children }) {
  return (
    <button
      onClick={onClick}
      className={`btn-ui press-feedback group flex min-h-24 flex-1 items-center justify-center rounded-3xl px-5 py-4 text-center transition duration-300 hover:-translate-y-0.5 ${
        tone === "heads"
          ? "btn-ui-glass-dark"
          : "btn-ui-glass-dark-alt"
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
  const { winnerName, side } = tossResult;
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        id: index,
        left: `${(index * 19) % 100}%`,
        delay: `${(index % 6) * 0.14}s`,
        duration: `${4.2 + (index % 4) * 0.4}s`,
        rotate: `${(index % 2 === 0 ? 1 : -1) * (12 + index * 3)}deg`,
        color: ["#f6b400", "#fde68a", "#ffffff", "#f59e0b"][index % 4],
      })),
    []
  );

  return (
    <div className="relative min-h-130 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.99))] px-5 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,rgba(251,191,36,0.96),rgba(251,146,60,0.72),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_16%)]" />
      {status === "finished" ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-65 overflow-hidden">
          {confettiPieces.map((piece) => (
            <span
              key={piece.id}
              className="absolute top-[-10%] h-3 w-2 rounded-full opacity-80 animate-[result-confetti_var(--confetti-duration)_linear_forwards]"
              style={{
                left: piece.left,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
                ["--confetti-duration"]: piece.duration,
                transform: `rotate(${piece.rotate})`,
              }}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.16))]" />
        </div>
      ) : null}
      <AnimatePresence mode="wait">
        {status === "choosing" ? (
          <motion.div
            key="choosing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex min-h-117 flex-col justify-between"
          >
            <div className="text-center">
              <h2 className="text-[2.15rem] font-semibold tracking-tight text-white">{teamName}</h2>
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
                className="transform-3d"
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
            className="flex min-h-117 flex-col items-center justify-center text-center"
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
            className="flex min-h-117 flex-col items-center justify-center text-center"
          >
            <motion.div
              animate={{ rotateY: 1440 }}
              transition={{ duration: 2.2, ease: "easeInOut" }}
              className="transform-3d"
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
            className="flex min-h-117 flex-col items-center justify-between text-center"
          >
            <div>
              <div className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Result
              </div>
              <div className="mt-6 flex justify-center">
                {side === "heads" ? <CoinHeads /> : <CoinTails />}
              </div>
              <h2 className="mt-6 text-balance text-[1.9rem] font-semibold uppercase leading-[1.05] tracking-[0.04em] text-white sm:text-[2.2rem]">
                {winnerName} won
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Landed on <span className="capitalize text-white">{side}</span>.
              </p>
            </div>

            <div className="w-full">
              <div className="grid grid-cols-2 gap-4">
                <LoadingButton
                  onClick={() => onDecision("bat")}
                  disabled={false}
                  loading={isSubmitting}
                  className="btn-ui btn-ui-glass-dark toss-decision-button group rounded-3xl px-4 py-4 text-base font-medium disabled:hover:translate-y-0"
                  pendingLabel="Saving..."
                >
                  <span className="block transition-transform group-hover:translate-x-0.5">
                    BAT FIRST
                  </span>
                </LoadingButton>
                <LoadingButton
                  onClick={() => onDecision("bowl")}
                  disabled={false}
                  loading={isSubmitting}
                  className="btn-ui btn-ui-glass-dark-alt toss-decision-button group rounded-3xl px-4 py-4 text-base font-medium disabled:hover:translate-y-0"
                  pendingLabel="Saving..."
                >
                  <span className="block transition-transform group-hover:translate-x-0.5">
                    BOWL FIRST
                  </span>
                </LoadingButton>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
