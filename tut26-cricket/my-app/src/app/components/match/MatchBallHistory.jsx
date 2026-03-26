"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";

function getBallKey(ball, ballNumber, overNumber) {
  return [
    "over",
    overNumber,
    "ball",
    ballNumber,
    Number(ball?.runs || 0),
    ball?.isOut ? "out" : "in",
    ball?.extraType || "legal",
  ].join(":");
}

export const Ball = memo(function Ball({ ball, ballNumber }) {
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
        className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm text-white tabular-nums ${style}`}
      >
        {label}
      </div>
      <span className="text-xs font-semibold text-zinc-400 tabular-nums">
        {ballNumber}
      </span>
    </div>
  );
});

export function BallTracker({ history }) {
  const trackerRef = useRef(null);
  const previousTrackerStateRef = useRef({
    overNumber: 1,
    ballCount: 0,
  });
  const currentOver = useMemo(
    () => history.at(-1) ?? { overNumber: 1, balls: [] },
    [history]
  );
  const currentBalls = Array.isArray(currentOver.balls) ? currentOver.balls : [];

  useLayoutEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker) {
      return;
    }

    const previous = previousTrackerStateRef.current;
    const hasNewBall = currentBalls.length > previous.ballCount;
    const changedOver = currentOver.overNumber !== previous.overNumber;

    if (hasNewBall || changedOver) {
      tracker.scrollLeft = tracker.scrollWidth;
    }

    previousTrackerStateRef.current = {
      overNumber: currentOver.overNumber,
      ballCount: currentBalls.length,
    };
  }, [currentBalls.length, currentOver.overNumber]);

  return (
    <div className="bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10 mb-6">
      <h3 className="font-bold text-white text-center mb-4">
        Over {currentOver.overNumber}
      </h3>
      <div
        ref={trackerRef}
        className="flex min-h-[4.5rem] items-start gap-4 overflow-x-auto overflow-y-hidden pb-2 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {currentBalls.map((ball, index) => (
          <div key={getBallKey(ball, index + 1, currentOver.overNumber)}>
            <Ball ball={ball} ballNumber={index + 1} />
          </div>
        ))}
      </div>
    </div>
  );
}
