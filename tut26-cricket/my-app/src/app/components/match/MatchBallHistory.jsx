"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function Ball({ ball, ballNumber }) {
  let style =
    "border border-white/10 bg-[linear-gradient(180deg,rgba(55,60,72,0.96),rgba(36,40,50,0.98))] shadow-[0_10px_24px_rgba(0,0,0,0.24)]";
  let label = ball.runs;

  if (ball.isOut) {
    style =
      "border border-rose-300/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.95),rgba(225,29,72,0.98))] shadow-[0_12px_28px_rgba(225,29,72,0.28)]";
    label = ball.runs > 0 ? `${ball.runs}+W` : "W";
  } else if (ball.extraType === "wide") {
    style =
      "border border-emerald-300/18 bg-[linear-gradient(180deg,rgba(22,163,74,0.95),rgba(22,129,61,0.98))] shadow-[0_12px_28px_rgba(22,163,74,0.24)]";
    const wideRuns = Math.max(Number(ball.runs || 0), 0);
    label = wideRuns > 0 ? `Wd+${wideRuns}` : "Wd";
  } else if (ball.extraType === "noball") {
    style =
      "border border-orange-300/18 bg-[linear-gradient(180deg,rgba(249,115,22,0.95),rgba(234,88,12,0.98))] shadow-[0_12px_28px_rgba(249,115,22,0.26)]";
    const noBallRuns = Math.max(Number(ball.runs || 0), 0);
    label = noBallRuns > 0 ? `NB+${noBallRuns}` : "NB";
  } else if (ball.runs === 0) {
    style =
      "border border-sky-300/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.95),rgba(37,99,235,0.98))] shadow-[0_12px_28px_rgba(37,99,235,0.28)]";
    label = ".";
  }

  return (
    <div className="flex flex-col items-center gap-2 w-10">
      <div
        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm text-white ${style}`}
      >
        {label}
      </div>
      <span className="text-xs font-semibold text-zinc-400">{ballNumber}</span>
    </div>
  );
}

export function BallTracker({ history }) {
  const trackerRef = useRef(null);
  const currentOver = history.at(-1) ?? { overNumber: 1, balls: [] };

  useEffect(() => {
    if (trackerRef.current) {
      trackerRef.current.scrollLeft = trackerRef.current.scrollWidth;
    }
  }, [currentOver.balls.length, currentOver.overNumber]);

  return (
    <div className="bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10 mb-6">
      <h3 className="font-bold text-white text-center mb-4">
        Over {currentOver.overNumber}
      </h3>
      <div
        ref={trackerRef}
        className="flex items-start min-h-[4rem] gap-4 overflow-x-auto pb-2 pr-2"
      >
        <AnimatePresence>
          {currentOver.balls.map((ball, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Ball ball={ball} ballNumber={index + 1} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
