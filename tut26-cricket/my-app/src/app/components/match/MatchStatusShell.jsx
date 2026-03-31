"use client";

import { useState } from "react";
import { Barlow_Condensed } from "next/font/google";
import LoadingButton from "../shared/LoadingButton";
import { countLegalBalls } from "../../lib/match-scoring";
import { getBattingTeamBundle } from "../../lib/team-utils";

const scoreboardDisplayFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800"],
});

function getBattingStripClasses(battingTeam) {
  const normalizedName = String(battingTeam?.name || "").trim().toLowerCase();

  if (normalizedName.includes("blue")) {
    return "from-sky-400/20 via-sky-400 to-blue-600/20";
  }

  if (normalizedName.includes("red")) {
    return "from-rose-400/20 via-rose-500 to-red-600/20";
  }

  return battingTeam?.key === "teamB"
    ? "from-sky-400/20 via-sky-400 to-blue-600/20"
    : "from-rose-400/20 via-rose-500 to-red-600/20";
}

export function Splash({ children }) {
  return (
    <main className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white text-xl">
      {children}
    </main>
  );
}

export function AccessGate({ onSubmit, isSubmitting, error }) {
  const [pin, setPin] = useState("");

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4">
      <div className="w-full max-w-sm bg-zinc-900 p-8 rounded-2xl ring-1 ring-white/10 shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-3">Umpire Access</h1>
        <p className="text-zinc-400 text-center mb-6">
          Enter the server PIN to unlock match controls.
        </p>
        <div className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={pin}
            onChange={(event) =>
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit(pin);
              }
            }}
            placeholder="0000"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-blue-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
          />
          <LoadingButton
            type="button"
            onClick={() => onSubmit(pin)}
            disabled={pin.length !== 4}
            loading={isSubmitting}
            pendingLabel="Checking..."
            className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enter
          </LoadingButton>
        </div>
        {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
      </div>
    </main>
  );
}

export function MatchHeader({ match }) {
  const battingTeam = getBattingTeamBundle(match);

  return (
    <header className="text-center mb-6">
      <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
        Umpire View
      </h1>
      <br />
      <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
        <span className="font-bold text-amber-300">{battingTeam.name}</span> is
        batting now
      </h2>
      {match.innings === "second" && (
        <p className="text-zinc-400 text-lg mt-1">
          Target: <span className="font-bold text-amber-300">{match.innings1.score + 1}</span>
        </p>
      )}
    </header>
  );
}

export function Scoreboard({ match, history }) {
  const legalBalls = countLegalBalls(history);
  const oversDisplay = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const battingTeam = getBattingTeamBundle(match);
  const ballsLeft = Math.max(Number(match?.overs || 0) * 6 - legalBalls, 0);
  const stripClasses = getBattingStripClasses(battingTeam);

  return (
    <div className="relative grid grid-cols-2 gap-4 text-center mb-6 bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10">
      <span
        className={`pointer-events-none absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-gradient-to-r ${stripClasses}`}
      />
      <div className="flex flex-col items-center justify-center">
        <div
          className={`${scoreboardDisplayFont.className} font-bold tabular-nums [font-variant-numeric:tabular-nums]`}
        >
          <span className="inline-flex items-baseline justify-center">
            <span className="text-8xl text-emerald-400 sm:text-9xl">
              {match.score}
            </span>
            <span className="text-4xl text-rose-500 sm:text-5xl">/</span>
            <span className="text-6xl text-rose-500 sm:text-7xl">
              {match.outs}
            </span>
          </span>
        </div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          Score / Wickets <strong>({battingTeam.players.length})</strong>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <div
          className={`${scoreboardDisplayFont.className} text-7xl font-bold text-white tabular-nums [font-variant-numeric:tabular-nums] sm:text-8xl`}
        >
          <span>{oversDisplay}</span>
        </div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          Overs <strong>({match.overs})</strong>
          <strong className="block">({ballsLeft})</strong>
        </div>
      </div>
    </div>
  );
}
