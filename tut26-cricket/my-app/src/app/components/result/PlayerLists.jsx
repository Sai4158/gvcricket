"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: PlayerLists.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { FaUsers } from "react-icons/fa";
import { getTeamBundle } from "../../lib/team-utils";

export default function PlayerLists({ match }) {
  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const teamCards = [
    {
      name: teamA.name,
      players: teamA.players,
      accent: "text-cyan-300",
      border: "border-cyan-400/20",
      glow: "bg-cyan-400/8",
    },
    {
      name: teamB.name,
      players: teamB.players,
      accent: "text-rose-300",
      border: "border-rose-400/20",
      glow: "bg-rose-400/8",
    },
  ];

  return (
    <div className="rounded-[28px] border border-white/10 bg-zinc-900/50 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)] ring-1 ring-white/6">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
        <FaUsers /> Final Teams
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        {teamCards.map((team) => (
          <div
            key={team.name}
            className={`rounded-[24px] border ${team.border} ${team.glow} p-4 text-center backdrop-blur-sm sm:p-5`}
          >
            <h3 className={`text-lg font-black uppercase ${team.accent}`}>
              {team.name}
            </h3>
            <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              {team.players.length} players
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-200 sm:text-base">
              {team.players.map((player, index) => (
                <li
                  key={`${team.name}-${player}-${index}`}
                  className="rounded-xl border border-white/6 bg-black/18 px-3 py-2"
                >
                  {player}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}


