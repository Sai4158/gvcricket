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

  return (
    <div className="bg-zinc-900/50 p-6 rounded-2xl ring-1 ring-zinc-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <span className="text-2xl font-mono font-bold text-amber-300">
          {inningsData.score ?? 0} Runs
        </span>
      </div>
      <div className="text-sm text-zinc-100 mb-4">Run Rate: {runRate}</div>
      <div className="space-y-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
        {inningsData.history.length > 0 ? (
          [...inningsData.history].reverse().map((over) => (
            <div key={over.overNumber}>
              <p className="font-semibold text-zinc-300 mb-2">
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
          <p className="text-sm text-yellow-200 font-bold">No overs bowled yet.</p>
        )}
      </div>
    </div>
  );
}
