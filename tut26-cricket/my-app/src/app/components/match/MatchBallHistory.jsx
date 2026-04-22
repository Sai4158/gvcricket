"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: buildBallSlotLabels, BallTracker, Ball.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

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
      return ".";
    }

    legalBallCount += 1;
    return String(legalBallCount);
  });
}

function countLegalBallsInOver(balls = []) {
  return (Array.isArray(balls) ? balls : []).reduce((total, ball) => {
    return isCountableBall(ball) ? total + 1 : total;
  }, 0);
}

function calculateRunsInOver(balls = []) {
  return (Array.isArray(balls) ? balls : []).reduce((total, ball) => {
    return total + Number(ball?.runs || 0);
  }, 0);
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

export const BallTracker = memo(function BallTracker({
  history = null,
  activeOverBalls = null,
  activeOverNumber = null,
}) {
  const trackerRef = useRef(null);
  const fallbackOver = useMemo(
    () => (Array.isArray(history) && history.length ? history.at(-1) : null),
    [history],
  );
  const resolvedOverNumber = Number.isFinite(Number(activeOverNumber)) &&
    Number(activeOverNumber) > 0
      ? Number(activeOverNumber)
      : Number(fallbackOver?.overNumber || 1);
  const currentBalls = useMemo(
    () =>
      Array.isArray(activeOverBalls)
        ? activeOverBalls
        : Array.isArray(fallbackOver?.balls)
          ? fallbackOver.balls
          : [],
    [activeOverBalls, fallbackOver],
  );
  const currentBallSlotLabels = useMemo(
    () => buildBallSlotLabels(currentBalls),
    [currentBalls],
  );
  const legalBallsInOver = useMemo(() => {
    return countLegalBallsInOver(currentBalls);
  }, [currentBalls]);
  const runsThisOver = useMemo(() => {
    return calculateRunsInOver(currentBalls);
  }, [currentBalls]);
  const ballsLeftInOver = useMemo(() => {
    return Math.max(6 - legalBallsInOver, 0);
  }, [legalBallsInOver]);
  const overRateLabel = useMemo(() => {
    if (legalBallsInOver <= 0) {
      return "RATE 0.00";
    }

    return `RATE ${((runsThisOver / legalBallsInOver) * 6).toFixed(2)}`;
  }, [legalBallsInOver, runsThisOver]);
  const overStatusLabel =
    ballsLeftInOver === 0
      ? "OVER DONE"
      : `${ballsLeftInOver} LEFT`;
  const currentBallSignature = useMemo(
    () =>
      currentBalls
        .map((ball, index) =>
          [
            index,
            Number(ball?.runs || 0),
            ball?.isOut ? "out" : "in",
            ball?.extraType || "legal",
          ].join(":"),
        )
        .join("|"),
    [currentBalls],
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
  }, [resolvedOverNumber, currentBallSignature]);

  return (
    <div className="mb-6 rounded-2xl bg-zinc-900/50 p-4 ring-1 ring-white/10">
      <div
        className={`${matchControlsFont.className} mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[0.82rem] font-bold uppercase tracking-[0.12em] text-white sm:text-[0.9rem]`}
      >
        <span className="justify-self-start text-left leading-none">
          {overRateLabel}
        </span>
        <h3 className="text-center text-[1.02rem] leading-none sm:text-lg">
          OVER {resolvedOverNumber}
        </h3>
        <span className="justify-self-end text-right leading-none">
          {overStatusLabel}
        </span>
      </div>
      <div
        ref={trackerRef}
        className="overflow-x-auto overflow-y-hidden pb-3 pr-1 [scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-2"
      >
        <div className="ml-auto flex min-h-18 min-w-max items-start gap-4">
          {currentBalls.map((ball, index) => (
            <div key={getBallKey(index + 1, resolvedOverNumber)}>
              <Ball
                ball={ball}
                ballNumber={currentBallSlotLabels[index] || "."}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
