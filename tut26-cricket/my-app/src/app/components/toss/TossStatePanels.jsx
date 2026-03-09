"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CoinHeads, CoinTails, SpinningCoin } from "./CoinArt";

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
    <div className="h-[480px] flex flex-col items-center justify-center gap-8">
      <AnimatePresence mode="wait">
        {status === "choosing" && (
          <motion.div
            key="choosing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full flex flex-col items-center gap-6"
          >
            <p className="text-white text-2xl">
              <span className="font-bold">{teamName}</span>, pick a side:
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => onChoice("heads")}
                className="w-36 py-3 font-bold rounded-lg text-lg transition-all duration-300 ease-in-out hover:scale-105 bg-yellow-400 text-black focus:ring-2 focus:ring-white"
              >
                Heads
              </button>
              <button
                onClick={() => onChoice("tails")}
                className="w-36 py-3 font-bold rounded-lg text-lg transition-all duration-300 ease-in-out hover:scale-105 bg-slate-300 text-black focus:ring-2 focus:ring-white"
              >
                Tails
              </button>
            </div>
          </motion.div>
        )}

        {status === "counting" && (
          <motion.div
            key="counting"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-4"
          >
            <p className="text-xl text-zinc-400">Tossing in...</p>
            <p className="text-9xl font-mono font-bold text-white">{countdown}</p>
          </motion.div>
        )}

        {status === "flipping" && (
          <motion.div
            key="flipping"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, rotateY: 1080 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 3, ease: "easeInOut" }}
          >
            <SpinningCoin />
          </motion.div>
        )}

        {status === "finished" && (
          <motion.div
            key="finished"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center gap-6"
          >
            {side === "heads" ? <CoinHeads /> : <CoinTails />}
            <div className="text-xl font-semibold text-center leading-relaxed">
              <p>
                {teamName} called{" "}
                <strong className="text-amber-300 capitalize">{call}</strong>.
              </p>
              <br />
              <p>
                It is <strong className="text-amber-300 capitalize">{side}</strong>.
              </p>
              <br />
              <p className="text-2xl font-bold text-white mt-2">
                {winnerName} wins the toss!
              </p>
            </div>
            <div className="w-full max-w-xs mt-2 space-y-4">
              <p className="text-lg text-zinc-200">What will {winnerName} do?</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => onDecision("bat")}
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-black rounded-2xl font-bold shadow-lg shadow-yellow-900/40 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:animate-none disabled:hover:scale-100 animate-[animate-gradient-slow_6s_ease-in-out_infinite]"
                  style={{
                    backgroundSize: "200% auto",
                    backgroundImage:
                      "linear-gradient(to right, #fde047, #f59e0b, #fbbf24, #f59e0b, #fde047)",
                  }}
                >
                  {isSubmitting ? "..." : "Bat First"}
                </button>

                <button
                  onClick={() => onDecision("bowl")}
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-white rounded-2xl font-bold shadow-lg shadow-cyan-900/40 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:animate-none disabled:hover:scale-100 animate-[animate-gradient-slow_6s_ease-in-out_infinite]"
                  style={{
                    backgroundSize: "200% auto",
                    backgroundImage:
                      "linear-gradient(to right, #22d3ee, #0ea5e9, #38bdf8, #0ea5e9, #22d3ee)",
                  }}
                >
                  {isSubmitting ? "..." : "Bowl First"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
