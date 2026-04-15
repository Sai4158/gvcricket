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

  return (
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
        <FaUsers /> Final Teams
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="text-center">
          <h3 className="font-bold text-blue-400 mb-2 text-lg">{teamA.name}</h3>
          <ul className="text-zinc-300 space-y-1">
            {teamA.players.map((player, index) => (
              <li key={index}>{player}</li>
            ))}
          </ul>
        </div>
        <div className="text-center">
          <h3 className="font-bold text-red-400 mb-2 text-lg">{teamB.name}</h3>
          <ul className="text-zinc-300 space-y-1">
            {teamB.players.map((player, index) => (
              <li key={index}>{player}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}


