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
    const wideRuns = Math.max(Number(runs || 0), 0);
    label = wideRuns > 0 ? `Wd+${wideRuns}` : "Wd";
  } else if (extraType) {
    style = "bg-purple-500 text-white";
    const noBallRuns = Math.max(Number(runs || 0), 0);
    label = noBallRuns > 0 ? `NB+${noBallRuns}` : "NB";
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
      className={`flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm shadow-md ${style}`}
    >
      {label}
    </div>
  );
}

export default function TeamInningsDetail({
  title,
  inningsData,
  statusLabel = "",
  targetSummary = "",
  teamSide = "",
}) {
  if (!inningsData) return null;

  const runRate = calculateRunRate(inningsData.score, inningsData.history);
  const formattedTargetSummary = String(targetSummary || "").replace(
    /\s*(?:•|â€¢|Ã¢â‚¬Â¢)\s*/g,
    "\n"
  );
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const normalizedTeamSide = String(teamSide || "").trim().toLowerCase();
  const isBlueSide =
    normalizedTeamSide === "blue" || /\bblue\b/.test(normalizedTitle);
  const isRedSide =
    normalizedTeamSide === "red" ||
    /\bred\b/.test(normalizedTitle) ||
    (!isBlueSide && /\bteam b\b/.test(normalizedTitle));
  const accentStripClass = isRedSide
    ? "from-rose-500 via-red-500 to-orange-400"
    : "from-cyan-400 via-sky-500 to-blue-500";
  const glowClass = isRedSide
    ? "shadow-[0_0_0_1px_rgba(244,63,94,0.16),0_16px_44px_rgba(127,29,29,0.3)]"
    : "shadow-[0_0_0_1px_rgba(56,189,248,0.14),0_16px_44px_rgba(30,58,138,0.28)]";
  const panelGlowClass = isRedSide
    ? "before:from-rose-500/18 before:via-red-500/8 before:to-transparent"
    : "before:from-cyan-400/18 before:via-sky-500/8 before:to-transparent";
  const surfaceClass = isRedSide
    ? "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.08),transparent_28%),linear-gradient(180deg,rgba(22,14,18,0.96),rgba(8,9,15,0.98))]"
    : "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.09),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.12),transparent_28%),linear-gradient(180deg,rgba(10,16,28,0.96),rgba(8,10,18,0.98))]";
  const scoreToneClass = isRedSide ? "text-amber-300" : "text-sky-300";
  const targetToneClass = isRedSide ? "text-amber-200/90" : "text-sky-200/90";
  const runRateClass = isRedSide
    ? "border-amber-300/12 bg-[linear-gradient(180deg,rgba(245,158,11,0.07),rgba(255,255,255,0.03))] text-zinc-100"
    : "border-sky-300/12 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(255,255,255,0.03))] text-sky-50";
  const statusToneClass = /live/i.test(statusLabel)
    ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
    : /completed/i.test(statusLabel)
    ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
    : "border-white/10 bg-white/[0.05] text-zinc-200";

  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border border-white/10 p-6 ${surfaceClass} ${glowClass} before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-gradient-to-br before:blur-2xl before:content-[''] ${panelGlowClass}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-[4px] bg-gradient-to-r ${accentStripClass}`}
        aria-hidden="true"
      />
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3">
        <div className="relative min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {title}
            </h2>
            {statusLabel ? (
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusToneClass}`}
              >
                {statusLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="relative shrink-0 self-start text-right">
          <div
            className={`text-[2.1rem] font-black leading-none tracking-tight ${scoreToneClass}`}
          >
            {inningsData.score ?? 0}
          </div>
          <div
            className={`mt-1 text-[1rem] font-black uppercase leading-none tracking-tight ${scoreToneClass}`}
          >
            Runs
          </div>
        </div>
        {formattedTargetSummary ? (
          <p
            className={`col-span-2 whitespace-pre-line text-xs font-medium uppercase leading-5 tracking-[0.14em] ${targetToneClass}`}
          >
            {formattedTargetSummary}
          </p>
        ) : null}
      </div>
      <div
        className={`relative mb-5 rounded-[16px] border px-3 py-2 text-sm font-medium ${runRateClass}`}
      >
        Run Rate: {runRate}
      </div>
      <div className="custom-scrollbar max-h-72 space-y-4 overflow-y-auto pr-2">
        {inningsData.history.length > 0 ? (
          [...inningsData.history].reverse().map((over) => (
            <div
              key={over.overNumber}
              className="relative overflow-hidden rounded-2xl border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-4 py-3"
            >
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">
                Over {over.overNumber}
              </p>
              <div className="flex flex-wrap gap-2">
                {over.balls.map((ball, index) => (
                  <Ball key={index} {...ball} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p
            className={`relative text-sm font-bold ${isRedSide ? "text-yellow-200" : "text-sky-200"}`}
          >
            No overs bowled yet.
          </p>
        )}
      </div>
    </div>
  );
}
