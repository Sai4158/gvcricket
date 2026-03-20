"use client";

import { getBattingTeamBundle } from "../../lib/team-utils";

export default function LiveScoreCard({ match }) {
  if (!match) return null;

  const battingTeam = getBattingTeamBundle(match);
  const targetRuns =
    match?.innings === "second" ? Number(match?.innings1?.score || 0) + 1 : 0;

  return (
    <div className="w-full max-w-xl bg-black/30 backdrop-blur-sm ring-1 ring-white/10 rounded-3xl p-6 text-center space-y-2 shadow-2xl shadow-zinc-900">
      <p className="text-5xl font-bold text-amber-300 tracking-wide mb-5">
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
  );
}
