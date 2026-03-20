"use client";

export default function InningsColumn({ innings, summary, players, teamColor }) {
  const wickets = (innings.history || [])
    .flatMap((over) => over.balls || [])
    .filter((ball) => ball.isOut).length;

  const accentClass =
    teamColor === "border-red-400"
      ? "from-rose-500 via-red-400 to-orange-300"
      : "from-sky-400 via-cyan-300 to-blue-500";

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.92),rgba(10,10,14,0.96))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${accentClass}`}
        aria-hidden="true"
      />
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
