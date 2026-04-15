"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: PlayerStatsSection.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import {
  calculateTrackedPlayerStats,
  hasTrackedPlayerStats,
} from "../../lib/match-stats";
import { getTeamBundle } from "../../lib/team-utils";

export default function PlayerStatsSection({ match }) {
  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const innings1Players =
    match.innings1.team === teamB.name ? teamB.players : teamA.players;
  const innings2Players =
    match.innings2.team === teamA.name ? teamA.players : teamB.players;
  const innings1Tracked = calculateTrackedPlayerStats(
    match.innings1,
    innings1Players
  );
  const innings2Tracked = calculateTrackedPlayerStats(
    match.innings2,
    innings2Players
  );
  const hasTracking =
    hasTrackedPlayerStats(match.innings1) || hasTrackedPlayerStats(match.innings2);

  if (!hasTracking) {
    return (
      <section className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">Player Stats</h2>
        <p className="text-zinc-300">
          This scorecard was recorded in quick scoring mode, so player-by-player
          batting and bowling stats are not available.
        </p>
      </section>
    );
  }

  const innings = [
    {
      title: match.innings1.team,
      batting: innings1Tracked.battingStats,
      bowling: innings1Tracked.bowlingStats,
    },
    {
      title: match.innings2.team,
      batting: innings2Tracked.battingStats,
      bowling: innings2Tracked.bowlingStats,
    },
  ];

  return (
    <section className="space-y-6">
      {innings.map((entry) => (
        <div
          key={entry.title}
          className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-4">{entry.title}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-zinc-200 mb-3">Batting</h3>
              <div className="space-y-2">
                {entry.batting.map((player) => (
                  <div
                    key={`${entry.title}-${player.name}`}
                    className="flex justify-between text-sm text-zinc-300"
                  >
                    <span>{player.name}</span>
                    <span>
                      {player.runs} ({player.balls}) SR {player.strikeRate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200 mb-3">Bowling</h3>
              <div className="space-y-2">
                {entry.bowling.map((player) => (
                  <div
                    key={`${entry.title}-${player.name}-bowl`}
                    className="flex justify-between text-sm text-zinc-300"
                  >
                    <span>{player.name}</span>
                    <span>
                      {player.wickets} wickets, Econ {player.economy}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}


