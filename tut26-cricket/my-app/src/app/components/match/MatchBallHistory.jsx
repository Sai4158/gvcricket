"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { Rajdhani } from "next/font/google";

const matchControlsFont = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
});

function getBallKey(ballNumber, overNumber) {
  return ["over", overNumber, "slot", ballNumber].join(":");
}

function isCountableBall(ball) {
  return ball?.extraType !== "wide" && ball?.extraType !== "noball";
}

export function buildBallSlotLabels(balls = []) {
  let legalBallCount = 0;

  return (Array.isArray(balls) ? balls : []).map((ball) => {
    if (!isCountableBall(ball)) {
      return "•";
    }

    legalBallCount += 1;
    return String(legalBallCount);
  });
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
    <div className="flex w-10 flex-col items-center gap-2">
      <div
        className={`${matchControlsFont.className} flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm text-white tabular-nums ${style}`}
      >
        {label}
      </div>
      <span
        className={`${matchControlsFont.className} text-sm font-bold text-white/92 tabular-nums`}
      >
        {ballNumber}
      </span>
    </div>
  );
});

export function BallTracker({ history }) {
  const trackerRef = useRef(null);
  const currentOver = useMemo(
    () => history.at(-1) ?? { overNumber: 1, balls: [] },
    [history]
  );
  const currentBalls = useMemo(
    () => (Array.isArray(currentOver.balls) ? currentOver.balls : []),
    [currentOver]
  );
  const currentBallSlotLabels = useMemo(
    () => buildBallSlotLabels(currentBalls),
    [currentBalls]
  );
  const currentBallSignature = useMemo(
    () =>
      currentBalls
        .map((ball, index) =>
          [
            index,
            Number(ball?.runs || 0),
            ball?.isOut ? "out" : "in",
            ball?.extraType || "legal",
          ].join(":")
        )
        .join("|"),
    [currentBalls]
  );

  useLayoutEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker) {
      return;
    }

    const scrollToLatest = () => {
      tracker.scrollTo({
        left: tracker.scrollWidth,
        behavior: "auto",
      });
    };

    scrollToLatest();
    const frameId = window.requestAnimationFrame(scrollToLatest);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentBallSignature, currentOver.overNumber]);

  return (
    <div className="mb-6 rounded-2xl bg-zinc-900/50 p-4 ring-1 ring-white/10">
      <h3
        className={`${matchControlsFont.className} mb-4 text-center font-bold text-white`}
      >
        Over {currentOver.overNumber}
      </h3>
      <div
        ref={trackerRef}
        className="overflow-x-auto overflow-y-hidden pb-3 pr-1 [scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-2"
      >
        <div className="ml-auto flex min-h-18 min-w-max items-start gap-4">
          {currentBalls.map((ball, index) => (
            <div key={getBallKey(index + 1, currentOver.overNumber)}>
              <Ball
                ball={ball}
                ballNumber={currentBallSlotLabels[index] || "•"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
