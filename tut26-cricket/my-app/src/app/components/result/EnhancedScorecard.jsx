"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: EnhancedScorecard.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { GiCricketBat } from "react-icons/gi";
import { getWinningTeamName } from "../../lib/match-result-display";
import { getTeamBundle } from "../../lib/team-utils";
import InningsColumn from "./InningsColumn";

export default function EnhancedScorecard({
  match,
  innings1Summary,
  innings2Summary,
}) {
  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const innings1Team =
    match.innings1.team === teamB.name ? teamB.players : teamA.players;
  const innings2Team =
    match.innings2.team === teamA.name ? teamA.players : teamB.players;
  const winningTeamName = getWinningTeamName(match?.result || "");

  return (
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 space-y-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2">
        <GiCricketBat /> Match Summary
      </h2>
      <div className="grid md:grid-cols-2 gap-6">
        <InningsColumn
          innings={match.innings1}
          summary={innings1Summary}
          players={innings1Team}
          teamColor="border-sky-400"
          isWinner={Boolean(winningTeamName && match?.innings1?.team === winningTeamName)}
        />
        <InningsColumn
          innings={match.innings2}
          summary={innings2Summary}
          players={innings2Team}
          teamColor="border-red-400"
          isWinner={Boolean(winningTeamName && match?.innings2?.team === winningTeamName)}
        />
      </div>
      <p className="text-center text-sm text-zinc-400 pt-4 border-t border-white/10">
        Toss won by{" "}
        <span className="font-semibold text-zinc-200">{match.tossWinner}</span>.
      </p>
    </div>
  );
}


