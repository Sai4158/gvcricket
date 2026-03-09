"use client";

export default function InningsColumn({ innings, summary, players, teamColor }) {
  const wickets = (innings.history || [])
    .flatMap((over) => over.balls || [])
    .filter((ball) => ball.isOut).length;

  return (
    <div
      className={`bg-zinc-800/50 p-6 rounded-xl ring-1 ring-white/10 border-l-4 ${teamColor}`}
    >
      <h3 className="text-2xl font-bold text-white mb-4">{innings.team}</h3>
      <p className="text-5xl font-extrabold text-white mb-4">
        <span className="text-green-400">{innings.score}</span>/
        <span className="text-red-400">{wickets}</span>
      </p>
      <div className="space-y-2 text-zinc-300">
        <div className="flex justify-between">
          <span>Overs:</span> <span className="font-bold">{summary.overs}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Players:</span>
          <span className="font-bold">{players.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Run Rate:</span>
          <span className="font-bold">{summary.runRate}</span>
        </div>
      </div>
    </div>
  );
}
