"use client";

import { calculateRunRate } from "./session-view-utils";

function Ball({ runs, isOut, extraType }) {
  let style;
  let label;

  if (isOut) {
    style = "bg-rose-600 text-white";
    label = "W";
  } else if (extraType === "wide") {
    style = "bg-amber-500 text-black";
    const extraRuns = Math.max(Number(runs || 0) - 1, 0);
    label = extraRuns > 0 ? `Wd+${extraRuns}` : "Wd";
  } else if (extraType) {
    style = "bg-purple-500 text-white";
    const extraRuns = Math.max(Number(runs || 0) - 1, 0);
    label = extraRuns > 0 ? `NB+${extraRuns}` : "NB";
  } else if (runs === 0) {
    style = "bg-zinc-700 text-zinc-300";
    label = ".";
  } else if (runs === 6) {
    style = "bg-purple-500 text-white";
    label = "6";
  } else if (runs === 4) {
    style = "bg-sky-500 text-white";
    label = "4";
  } else {
    style = "bg-green-600 text-white";
    label = runs;
  }

  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${style}`}
    >
      {label}
    </div>
  );
}

export default function TeamInningsDetail({ title, inningsData }) {
  if (!inningsData) return null;

  const runRate = calculateRunRate(inningsData.score, inningsData.history);
  const isRedSide = /red|team b/i.test(title || "");
  const accentStripClass = isRedSide
    ? "from-rose-500 via-red-500 to-orange-400"
    : "from-cyan-400 via-sky-500 to-blue-500";
  const glowClass = isRedSide
    ? "shadow-[0_0_0_1px_rgba(244,63,94,0.16),0_16px_44px_rgba(127,29,29,0.3)]"
    : "shadow-[0_0_0_1px_rgba(56,189,248,0.14),0_16px_44px_rgba(30,58,138,0.28)]";
  const panelGlowClass = isRedSide
    ? "before:from-rose-500/18 before:via-red-500/8 before:to-transparent"
    : "before:from-cyan-400/18 before:via-sky-500/8 before:to-transparent";

  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,14,22,0.96),rgba(8,9,15,0.98))] p-6 ${glowClass} before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-gradient-to-br before:blur-2xl before:content-['']`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-[4px] bg-gradient-to-r ${accentStripClass}`}
        aria-hidden="true"
      />
      <div className="flex justify-between items-center mb-4">
        <h2 className="relative text-2xl font-bold tracking-tight text-white">
          {title}
        </h2>
        <span className="relative text-[2rem] font-black tracking-tight text-amber-300">
          {inningsData.score ?? 0} Runs
        </span>
      </div>
      <div className="relative mb-5 text-sm font-medium text-zinc-200">
        Run Rate: {runRate}
      </div>
      <div className="space-y-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
        {inningsData.history.length > 0 ? (
          [...inningsData.history].reverse().map((over) => (
            <div key={over.overNumber} className="relative rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">
                Over {over.overNumber}
              </p>
              <div className="flex gap-2 flex-wrap">
                {over.balls.map((ball, index) => (
                  <Ball key={index} {...ball} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="relative text-sm font-bold text-yellow-200">
            No overs bowled yet.
          </p>
        )}
      </div>
    </div>
  );
}
