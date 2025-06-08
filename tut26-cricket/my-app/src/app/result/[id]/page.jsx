/* ------------------------------------------------------------------
   src/app/results/[id]/page.jsx – (Player Lists & Counts Added)
-------------------------------------------------------------------*/
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  FaTrophy,
  FaChartLine,
  FaChartPie,
  FaUsers,
  FaArrowLeft,
  FaRunning,
  FaStar,
} from "react-icons/fa";
import { GiCricketBat, GiLaurelsTrophy } from "react-icons/gi";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// --- Advanced Helper Functions ---
const calculateAllStats = (innings, teamArray) => {
  if (!innings || !innings.history) {
    return {
      fours: 0,
      sixes: 0,
      dots: 0,
      extras: 0,
      runRate: "0.00",
      overs: "0.0",
      balls: 0,
      battingStats: [],
      bowlingStats: [],
    };
  }

  const allBalls = innings.history.flatMap((o) => o.balls);
  const legalBalls = allBalls.filter(
    (b) => b.extraType !== "wide" && b.extraType !== "noball"
  ).length;
  const oversFacedValue = legalBalls / 6;
  const runRate =
    oversFacedValue > 0 ? (innings.score / oversFacedValue).toFixed(2) : "0.00";
  const oversDisplay = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

  const battingStats = {};
  const bowlingStats = {};

  // Initialize stats for all players on the team to ensure everyone is listed.
  teamArray?.forEach((player) => {
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
      if (!battingStats[batsmanName]) {
        // Handles case where batsman might not be in the original list
        battingStats[batsmanName] = {
          name: batsmanName,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          status: "Not out",
        };
      }
      if (battingStats[batsmanName].status === "Did not bat")
        battingStats[batsmanName].status = "Not out";

      bowlingStats[bowlerName].runsConceded += ball.runs;
      if (ball.extraType !== "wide") bowlingStats[bowlerName].ballsBowled++;
      if (ball.isOut) {
        bowlingStats[bowlerName].wickets++;
        if (battingStats[batsmanName]) battingStats[batsmanName].status = "Out";
      }

      battingStats[batsmanName].runs += ball.runs;
      if (ball.extraType !== "wide") battingStats[batsmanName].balls++;
      if (ball.runs === 4) battingStats[batsmanName].fours++;
      if (ball.runs === 6) battingStats[batsmanName].sixes++;
    });
  });

  const finalBattingStats = Object.values(battingStats).map((stats) => ({
    ...stats,
    strikeRate:
      stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(2) : "0.00",
  }));
  const finalBowlingStats = Object.values(bowlingStats).map((stats) => ({
    ...stats,
    economy:
      stats.ballsBowled > 0
        ? (stats.runsConceded / (stats.ballsBowled / 6)).toFixed(2)
        : "0.00",
  }));

  const runsFromRunning = allBalls
    .filter((b) => b.runs > 0 && b.runs < 4)
    .reduce((acc, ball) => acc + ball.runs, 0);

  return {
    fours: allBalls.filter((b) => b.runs === 4).length,
    sixes: allBalls.filter((b) => b.runs === 6).length,
    runRate,
    overs: oversDisplay,
    balls: legalBalls,
    battingStats: finalBattingStats,
    bowlingStats: finalBowlingStats,
    runsPerOver: innings.history.map((over, index) => ({
      over: index + 1,
      runs: over.balls.reduce((acc, ball) => acc + ball.runs, 0),
    })),
    scoringBreakdown: [
      { name: "Fours", value: allBalls.filter((b) => b.runs === 4).length * 4 },
      { name: "Sixes", value: allBalls.filter((b) => b.runs === 6).length * 6 },
      { name: "Running", value: runsFromRunning },
    ].filter((item) => item.value > 0),
  };
};

// --- UI Sub-components ---

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length)
    return (
      <div className="bg-zinc-800 text-white p-3 rounded-lg border border-zinc-700 shadow-lg">
        <p className="label font-bold mb-2">{label}</p>
        {payload.map((p, i) => (
          <p
            key={i}
            style={{ color: p.color || p.fill }}
          >{`${p.name}: ${p.value}`}</p>
        ))}
      </div>
    );
  return null;
};

const CongratulationsCard = ({ result }) => {
  const winnerName = result.split(" won by")[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-gradient-to-br from-amber-500 to-yellow-600 text-white p-8 rounded-2xl shadow-2xl shadow-amber-500/10 text-center"
    >
      <FaTrophy className="mx-auto text-6xl mb-4 text-yellow-300" />
      <h1 className="text-4xl font-extrabold tracking-tight text-yellow-50">
        Congratulations, <br /> {winnerName}!
      </h1>
      <p className="text-2xl mt-2 font-medium">{result}</p>
    </motion.div>
  );
};

const EnhancedScorecard = ({ match, stats1, stats2 }) => {
  const InningsColumn = ({ innings, stats, teamData, teamColor }) => {
    const wickets = innings.history
      .flatMap((o) => o.balls)
      .filter((b) => b.isOut).length;
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
            <span>Overs:</span> <span className="font-bold">{stats.overs}</span>
          </div>
          {/* ✅ ADDED: Total Players count */}
          <div className="flex justify-between">
            <span>Total Players:</span>{" "}
            <span className="font-bold">{teamData.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Run Rate:</span>{" "}
            <span className="font-bold">{stats.runRate}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 space-y-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2">
        <GiCricketBat /> Match Summary
      </h2>
      <div className="grid md:grid-cols-2 gap-6">
        <InningsColumn
          innings={match.innings1}
          stats={stats1}
          teamData={match.teamA}
          teamColor="border-sky-400"
        />
        <InningsColumn
          innings={match.innings2}
          stats={stats2}
          teamData={match.teamB}
          teamColor="border-red-400"
        />
      </div>
      <p className="text-center text-sm text-zinc-400 pt-4 border-t border-white/10">
        Toss won by{" "}
        <span className="font-semibold text-zinc-200">{match.tossWinner}</span>.
      </p>
    </div>
  );
};

// ✅ ADDED: This component from your original code to list all players.
const PlayerLists = ({ teamA, teamB, team1Name, team2Name }) => (
  <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10">
    <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
      <FaUsers /> Final Teams
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="text-center">
        <h3 className="font-bold text-blue-400 mb-2 text-lg">{team1Name}</h3>
        <ul className="text-zinc-300 space-y-1">
          {teamA.map((player, i) => (
            <li key={i}>{player}</li>
          ))}
        </ul>
      </div>
      <div className="text-center">
        <h3 className="font-bold text-red-400 mb-2 text-lg">{team2Name}</h3>
        <ul className="text-zinc-300 space-y-1">
          {teamB.map((player, i) => (
            <li key={i}>{player}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

const RunsPerOverChart = ({ stats1, stats2, team1Name, team2Name }) => {
  // ... This component remains the same ...
  const maxOvers = Math.max(
    stats1.runsPerOver.length,
    stats2.runsPerOver.length
  );
  const chartData = Array.from({ length: maxOvers }, (_, i) => ({
    name: `Over ${i + 1}`,
    [team1Name]: stats1.runsPerOver[i]?.runs,
    [team2Name]: stats2.runsPerOver[i]?.runs,
  }));
  return (
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
        <FaChartLine /> Runs Per Over
      </h2>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
            <XAxis
              dataKey="name"
              stroke="#a1a1aa"
              fontSize={14}
              tick={{ dy: 10 }}
            />
            <YAxis stroke="#a1a1aa" fontSize={14} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(113, 113, 122, 0.2)" }}
            />
            <Legend wrapperStyle={{ fontSize: "16px", paddingTop: "30px" }} />
            <Line
              type="monotone"
              dataKey={team1Name}
              stroke="#60a5fa"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey={team2Name}
              stroke="#f87171"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ... Other components like InningsBreakdown, TopPerformers, etc. remain the same ...
const InningsBreakdown = ({ teamName, teamColor, stats }) => (
  <div
    className={`bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10 border-t-4 ${teamColor}`}
  >
    <h3
      className={`text-2xl font-bold text-center mb-4 ${
        teamColor === "border-blue-400" ? "text-blue-400" : "text-red-400"
      }`}
    >
      {teamName}'s Innings
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
      <div>
        <p className="text-zinc-400 text-sm">Run Rate</p>
        <p className="text-2xl font-bold text-white">{stats.runRate}</p>
      </div>
      <div>
        <p className="text-zinc-400 text-sm">Boundaries</p>
        <p className="text-2xl font-bold text-white">
          {stats.fours + stats.sixes}
        </p>
      </div>
      <div>
        <p className="text-zinc-400 text-sm">Fours</p>
        <p className="text-2xl font-bold text-white">{stats.fours}</p>
      </div>
      <div>
        <p className="text-zinc-400 text-sm">Sixes</p>
        <p className="text-2xl font-bold text-white">{stats.sixes}</p>
      </div>
    </div>
  </div>
);
const TopPerformers = ({ allBatting, allBowling, team1Name, team2Name }) => {
  const findTopPerformers = (stats, key, order = "desc", count = 3) => {
    if (!stats || stats.length === 0) return [];
    return [...stats]
      .sort((a, b) => (order === "desc" ? b[key] - a[key] : a[key] - b[key]))
      .slice(0, count);
  };
  const topRunScorers = findTopPerformers(allBatting, "runs");
  const topStrikeRates = findTopPerformers(
    allBatting.filter((p) => p.balls >= 10),
    "strikeRate"
  );
  const Leaderboard = ({ title, players, statKey, statLabel, icon }) => (
    <div className="bg-zinc-800 p-4 rounded-lg ring-1 ring-white/10">
      <h4 className="font-bold text-lg text-white mb-3 flex items-center gap-2">
        {icon} {title}
      </h4>
      <ul className="space-y-2">
        {players.map((player, index) => (
          <li
            key={index}
            className="flex justify-between items-center text-zinc-300"
          >
            <span>
              {index + 1}. {player.name}{" "}
              <span
                className={`text-xs ${
                  player.team === team1Name ? "text-blue-400" : "text-red-400"
                }`}
              >
                ({player.team})
              </span>
            </span>
            <span className="font-mono font-bold text-white">
              {player[statKey]} {statLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
        <GiLaurelsTrophy /> Match Leaders
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Leaderboard
          title="Top Run Scorers"
          players={topRunScorers}
          statKey="runs"
          statLabel="Runs"
          icon={<FaRunning className="text-yellow-400" />}
        />
        <Leaderboard
          title="Highest Strike Rates"
          players={topStrikeRates}
          statKey="strikeRate"
          statLabel="SR"
          icon={<FaStar className="text-yellow-400" />}
        />
      </div>
    </div>
  );
};
const ScoringBreakdownCharts = ({ stats1, stats2, team1Name, team2Name }) => {
  const COLORS = ["#38bdf8", "#8b5cf6", "#f87171"];
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight="bold"
      >{`${(percent * 100).toFixed(0)}%`}</text>
    );
  };
  return (
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
        <FaChartPie /> Run Source Breakdown
      </h2>
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="w-full h-80">
          <h3 className="font-bold text-center text-blue-400 text-lg">
            {team1Name}'s Team
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats1.scoringBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {stats1.scoringBreakdown.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "16px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <hr />
        <div className="w-full h-80">
          <h3 className="font-bold text-center text-red-400 text-lg">
            {team2Name}'s Team
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats2.scoringBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {stats2.scoringBreakdown.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "16px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component ---
export default function ResultPage() {
  const { id: matchId } = useParams();
  const router = useRouter();
  const fetcher = (url) => fetch(url).then((res) => res.json());
  const {
    data: match,
    error,
    isLoading,
  } = useSWR(matchId ? `/api/matches/${matchId}` : null, fetcher);

  if (error)
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-red-400">
          Failed to load match results.
        </div>
      </main>
    );
  if (isLoading || !match)
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-lg font-medium">Loading Match Results...</div>
      </main>
    );

  const innings1Stats = calculateAllStats(match.innings1, match.teamA);
  const innings2Stats = calculateAllStats(match.innings2, match.teamB);

  const allBattingStats = [
    ...innings1Stats.battingStats.map((p) => ({
      ...p,
      team: match.innings1.team,
    })),
    ...innings2Stats.battingStats.map((p) => ({
      ...p,
      team: match.innings2.team,
    })),
  ];

  return (
    <main className="min-h-screen bg-zinc-950 p-4 sm:p-8 text-zinc-300 font-sans">
      <div className="max-w-5xl mx-auto space-y-12 py-10">
        <header className="text-center space-y-4">
          <button
            onClick={() => router.push("/session")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors mb-4"
          >
            <FaArrowLeft />
            <span>Back to Sessions</span>
          </button>
          <h1 className="text-5xl font-extrabold text-white">Match Result</h1>
        </header>

        <section className="space-y-8">
          {match.result && <CongratulationsCard result={match.result} />}
          <EnhancedScorecard
            innings1={match.innings1}
            innings2={match.innings2}
            stats1={innings1Stats}
            stats2={innings2Stats}
            match={match}
          />
        </section>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white text-center pt-8 border-t border-white/10">
            Innings Deep Dive
          </h2>
          <InningsBreakdown
            teamName={match.innings1.team}
            teamColor="border-blue-400"
            stats={innings1Stats}
          />
          <InningsBreakdown
            teamName={match.innings2.team}
            teamColor="border-red-400"
            stats={innings2Stats}
          />
        </section>

        <section>
          <TopPerformers
            allBatting={allBattingStats}
            allBowling={[]}
            team1Name={match.innings1.team}
            team2Name={match.innings2.team}
          />
        </section>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white text-center pt-8 border-t border-white/10">
            Graphical Analysis
          </h2>
          <RunsPerOverChart
            stats1={innings1Stats}
            stats2={innings2Stats}
            team1Name={match.innings1.team}
            team2Name={match.innings2.team}
          />
          <ScoringBreakdownCharts
            stats1={innings1Stats}
            stats2={innings2Stats}
            team1Name={match.innings1.team}
            team2Name={match.innings2.team}
          />
        </section>

        {/* ✅ ADDED: Section for the final player lists */}
        <section>
          <PlayerLists
            teamA={match.teamA}
            teamB={match.teamB}
            team1Name={match.innings1.team}
            team2Name={match.innings2.team}
          />
        </section>

        <footer className="text-center pt-8 border-t border-white/10">
          <button
            onClick={() => router.push("/session")}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-blue-500 transition-colors font-semibold"
          >
            View All Match History
          </button>
        </footer>
      </div>
    </main>
  );
}
