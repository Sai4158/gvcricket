"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function Ball({ ball, ballNumber }) {
  let style = "bg-zinc-700";
  let label = ball.runs;

  if (ball.isOut) {
    style = "bg-rose-600";
    label = ball.runs > 0 ? `${ball.runs}+W` : "W";
  } else if (ball.extraType === "wide") {
    style = "bg-green-600";
    const extraRuns = Math.max(Number(ball.runs || 0) - 1, 0);
    label = extraRuns > 0 ? `Wd+${extraRuns}` : "Wd";
  } else if (ball.extraType === "noball") {
    style = "bg-orange-600";
    const extraRuns = Math.max(Number(ball.runs || 0) - 1, 0);
    label = extraRuns > 0 ? `NB+${extraRuns}` : "NB";
  } else if (ball.runs === 0) {
    label = ".";
  }

  return (
    <div className="flex flex-col items-center gap-2 w-10">
      <div
        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md ${style}`}
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
  }, [currentOver.balls.length]);

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
