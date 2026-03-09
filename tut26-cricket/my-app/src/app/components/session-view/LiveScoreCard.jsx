"use client";

import { getBattingTeamBundle } from "../../lib/team-utils";

export default function LiveScoreCard({ match }) {
  if (!match) return null;

  const battingTeam = getBattingTeamBundle(match);

  return (
    <div className="w-full max-w-xl bg-black/30 backdrop-blur-sm ring-1 ring-white/10 rounded-3xl p-6 text-center space-y-2 shadow-2xl shadow-zinc-900">
      <p className="text-5xl font-bold text-amber-300 tracking-wide mb-5">
        {battingTeam.name}
      </p>
      <p className="text-6xl font-extrabold text-white">
        <span className="text-green-600">{match.score}</span>/
        <span className="text-red-600">{match.outs}</span>
      </p>
      <br />
      <div className="text-2xl text-white flex justify-center items-center gap-4">
        <span>
          Total Players:{" "}
          <span className="font-bold text-white">{battingTeam.players.length}</span>
        </span>
      </div>
    </div>
  );
}
