"use client";

import { useState } from "react";
import { countLegalBalls } from "../../lib/match-scoring";
import { getBattingTeamBundle } from "../../lib/team-utils";

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
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          name="umpire-access-pin"
          data-form-type="other"
          data-lpignore="true"
          value={pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit(pin);
          }}
          maxLength={6}
          className="w-full p-4 text-center text-2xl tracking-[0.65rem] rounded-lg bg-zinc-800 ring-1 ring-zinc-700 focus:ring-blue-500 outline-none text-white"
          style={{ WebkitTextSecurity: "disc" }}
          placeholder="------"
        />
        {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
        <button
          onClick={() => onSubmit(pin)}
          disabled={isSubmitting}
          className="w-full mt-6 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-60"
        >
          {isSubmitting ? "Checking..." : "Enter"}
        </button>
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

  return (
    <div className="grid grid-cols-2 gap-4 text-center mb-6 bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10">
      <div>
        <div className="text-6xl font-bold text-white">
          {match.score}
          <span className="text-4xl text-rose-500">/{match.outs}</span>
        </div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          Score / Wickets <strong>({battingTeam.players.length})</strong>
        </div>
      </div>
      <div>
        <div className="text-6xl font-bold text-white">{oversDisplay}</div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          Overs <strong>({match.overs})</strong>
        </div>
      </div>
    </div>
  );
}
