"use client";

/**
 * File overview:
 * Purpose: Renders Session View UI for the app's screens and flows.
 * Main exports: LiveScoreCard.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { countLegalBalls } from "../../lib/match-scoring";
import { getBattingTeamBundle } from "../../lib/team-utils";

export default function LiveScoreCard({ match }) {
  if (!match) return null;

  const battingTeam = getBattingTeamBundle(match);
  const activeHistory =
    match?.innings === "second"
      ? match?.innings2?.history || []
      : match?.innings1?.history || [];
  const legalBalls = Number.isFinite(Number(match?.legalBallCount))
    ? Number(match.legalBallCount)
    : countLegalBalls(activeHistory);
  const oversDisplay = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const targetRuns =
    match?.innings === "second" ? Number(match?.innings1?.score || 0) + 1 : 0;

  return (
    <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_30%),linear-gradient(180deg,rgba(10,12,18,0.96),rgba(6,8,14,0.98))] p-6 text-center shadow-[0_22px_54px_rgba(0,0,0,0.34)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/64 via-35% via-amber-200/56 to-transparent" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-16 rounded-b-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.02)_40%,transparent_78%)] blur-xl" />
      <div className="relative space-y-2">
      <p className="mb-5 text-5xl font-bold tracking-wide text-amber-300">
        {battingTeam.name}
      </p>
      <p className="text-6xl font-extrabold text-white">
        <span className="text-green-600">{match.score}</span>/
        <span className="text-red-600">{match.outs}</span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
        <div className="relative min-w-[92px] overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] px-3.5 py-2.5 text-center shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/28 to-transparent" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Players
            </p>
            <p className="mt-1 text-[1.1rem] font-bold tracking-tight text-white">
              {battingTeam.players.length}
            </p>
          </div>
        </div>
        <div className="relative min-w-[92px] overflow-hidden rounded-[18px] border border-sky-300/16 bg-[linear-gradient(180deg,rgba(56,189,248,0.1),rgba(29,78,216,0.08))] px-3.5 py-2.5 text-center shadow-[0_10px_24px_rgba(29,78,216,0.16)]">
          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/44 to-transparent" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/72">
              Overs
            </p>
            <p className="mt-1 text-[1.1rem] font-bold tracking-tight text-sky-100">
              {oversDisplay}
            </p>
          </div>
        </div>
        {targetRuns > 0 ? (
          <div className="relative min-w-[108px] overflow-hidden rounded-[18px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(245,158,11,0.1),rgba(120,53,15,0.1))] px-3.5 py-2.5 text-center shadow-[0_10px_24px_rgba(120,53,15,0.16)]">
            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/44 to-transparent" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/72">
                Target
              </p>
              <p className="mt-1 text-[1.1rem] font-bold tracking-tight text-amber-200">
                {targetRuns}
              </p>
            </div>
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}


