/**
 * File overview:
 * Purpose: Shared helper module for Match Stats logic.
 * Main exports: hasTrackedPlayerStats, calculateInningsSummary, calculateTrackedPlayerStats.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: README.md
 */
import { countLegalBalls } from "./match-scoring";

export function hasTrackedPlayerStats(innings) {
  if (!innings?.history?.length) return false;

  return innings.history.some(
    (over) =>
      over?.bowler &&
      over.balls?.some((ball) => typeof ball?.batsmanOnStrike === "string")
  );
}

export function calculateInningsSummary(innings) {
  const history = innings?.history || [];
  const allBalls = history.flatMap((over) => over.balls || []);
  const legalBalls = countLegalBalls(history);
  const oversDisplay = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const runRate =
    legalBalls > 0 ? ((innings?.score || 0) / (legalBalls / 6)).toFixed(2) : "0.00";
  const runsFromRunning = allBalls
    .filter((ball) => ball.runs > 0 && ball.runs < 4)
    .reduce((total, ball) => total + ball.runs, 0);

  return {
    fours: allBalls.filter((ball) => ball.runs === 4).length,
    sixes: allBalls.filter((ball) => ball.runs === 6).length,
    runRate,
    overs: oversDisplay,
    balls: legalBalls,
    runsPerOver: history.map((over, index) => ({
      over: index + 1,
      runs: (over.balls || []).reduce((total, ball) => total + ball.runs, 0),
    })),
    scoringBreakdown: [
      { name: "Fours", value: allBalls.filter((ball) => ball.runs === 4).length * 4 },
      { name: "Sixes", value: allBalls.filter((ball) => ball.runs === 6).length * 6 },
      { name: "Running", value: runsFromRunning },
    ].filter((item) => item.value > 0),
  };
}

export function calculateTrackedPlayerStats(innings, teamPlayers = []) {
  if (!hasTrackedPlayerStats(innings)) {
    return { battingStats: [], bowlingStats: [] };
  }

  const battingStats = {};
  const bowlingStats = {};

  teamPlayers.forEach((player) => {
    battingStats[player] = {
      name: player,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      status: "Did not bat",
    };
  });

  innings.history.forEach((over) => {
    const bowlerName = over.bowler || "Unknown Bowler";
    bowlingStats[bowlerName] = bowlingStats[bowlerName] || {
      name: bowlerName,
      runsConceded: 0,
      ballsBowled: 0,
      wickets: 0,
    };

    over.balls.forEach((ball) => {
      const batsmanName = ball.batsmanOnStrike || "Unknown Batsman";
      battingStats[batsmanName] = battingStats[batsmanName] || {
        name: batsmanName,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        status: "Not out",
      };

      if (battingStats[batsmanName].status === "Did not bat") {
        battingStats[batsmanName].status = "Not out";
      }

      bowlingStats[bowlerName].runsConceded += ball.runs;
      if (ball.extraType !== "wide") bowlingStats[bowlerName].ballsBowled++;
      if (ball.isOut) {
        bowlingStats[bowlerName].wickets++;
        battingStats[batsmanName].status = "Out";
      }

      battingStats[batsmanName].runs += ball.runs;
      if (ball.extraType !== "wide") battingStats[batsmanName].balls++;
      if (ball.runs === 4) battingStats[batsmanName].fours++;
      if (ball.runs === 6) battingStats[batsmanName].sixes++;
    });
  });

  return {
    battingStats: Object.values(battingStats).map((player) => ({
      ...player,
      strikeRate:
        player.balls > 0 ? ((player.runs / player.balls) * 100).toFixed(2) : "0.00",
    })),
    bowlingStats: Object.values(bowlingStats).map((player) => ({
      ...player,
      economy:
        player.ballsBowled > 0
          ? (player.runsConceded / (player.ballsBowled / 6)).toFixed(2)
          : "0.00",
    })),
  };
}
