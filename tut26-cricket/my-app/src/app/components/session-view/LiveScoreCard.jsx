"use client";

import { FaBullseye, FaUser } from "react-icons/fa";
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
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2 text-sm font-semibold text-white">
          <FaUser className="text-zinc-300" />
          {battingTeam.players.length}
        </span>
        {targetRuns > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3.5 py-2 text-sm font-semibold text-amber-200">
            <FaBullseye className="text-amber-300" />
            Target {targetRuns}
          </span>
        ) : null}
      </div>
    </div>
  );
}
