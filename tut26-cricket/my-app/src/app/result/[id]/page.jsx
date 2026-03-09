"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaChartLine,
  FaChartPie,
  FaTrophy,
  FaUsers,
} from "react-icons/fa";
import { GiCricketBat } from "react-icons/gi";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateInningsSummary,
  calculateTrackedPlayerStats,
  hasTrackedPlayerStats,
} from "../../lib/match-stats";
import { getTeamBundle } from "../../lib/team-utils";

const fetcher = (url) => fetch(url).then((res) => res.json());

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-800 text-white p-3 rounded-lg border border-zinc-700 shadow-lg">
      <p className="label font-bold mb-2">{label}</p>
      {payload.map((item, index) => (
        <p
          key={index}
          style={{ color: item.color || item.fill }}
        >{`${item.name}: ${item.value}`}</p>
      ))}
    </div>
  );
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
        Congratulations,
        <br />
        {winnerName}!
      </h1>
      <p className="text-2xl mt-2 font-medium">{result}</p>
    </motion.div>
  );
};

const EnhancedScorecard = ({ match, innings1Summary, innings2Summary }) => {
  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const innings1Team =
    match.innings1.team === teamB.name ? teamB.players : teamA.players;
  const innings2Team =
    match.innings2.team === teamA.name ? teamA.players : teamB.players;

  const InningsColumn = ({ innings, summary, players, teamColor }) => {
    const wickets = innings.history
      .flatMap((over) => over.balls)
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
            <span>Total Players:</span>{" "}
            <span className="font-bold">{players.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Run Rate:</span>{" "}
            <span className="font-bold">{summary.runRate}</span>
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
          summary={innings1Summary}
          players={innings1Team}
          teamColor="border-sky-400"
        />
        <InningsColumn
          innings={match.innings2}
          summary={innings2Summary}
          players={innings2Team}
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

const PlayerLists = ({ match }) => {
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
};

const RunsPerOverChart = ({ innings1Summary, innings2Summary, team1Name, team2Name }) => {
  const maxOvers = Math.max(
    innings1Summary.runsPerOver.length,
    innings2Summary.runsPerOver.length
  );
  const chartData = Array.from({ length: maxOvers }, (_, index) => ({
    name: `Over ${index + 1}`,
    [team1Name]: innings1Summary.runsPerOver[index]?.runs,
    [team2Name]: innings2Summary.runsPerOver[index]?.runs,
  }));

  return (
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
        <FaChartLine /> Runs Per Over
      </h2>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
            <XAxis dataKey="name" stroke="#a1a1aa" fontSize={14} tick={{ dy: 10 }} />
            <YAxis stroke="#a1a1aa" fontSize={14} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(113, 113, 122, 0.2)" }} />
            <Legend wrapperStyle={{ fontSize: "16px", paddingTop: "30px" }} />
            <Line type="monotone" dataKey={team1Name} stroke="#60a5fa" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            <Line type="monotone" dataKey={team2Name} stroke="#f87171" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const ScoringBreakdownCharts = ({ innings1Summary, innings2Summary, team1Name, team2Name }) => {
  const colors = ["#38bdf8", "#8b5cf6", "#f87171"];
  const radian = Math.PI / 180;

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * radian);
    const y = cy + radius * Math.sin(-midAngle * radian);

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
            {team1Name}
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={innings1Summary.scoringBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {innings1Summary.scoringBreakdown.map((entry, index) => (
                  <Cell key={`team1-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "16px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full h-80">
          <h3 className="font-bold text-center text-red-400 text-lg">
            {team2Name}
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={innings2Summary.scoringBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {innings2Summary.scoringBreakdown.map((entry, index) => (
                  <Cell key={`team2-${index}`} fill={colors[index % colors.length]} />
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

const PlayerStatsSection = ({ match }) => {
  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const innings1Players =
    match.innings1.team === teamB.name ? teamB.players : teamA.players;
  const innings2Players =
    match.innings2.team === teamA.name ? teamA.players : teamB.players;
  const innings1Tracked = calculateTrackedPlayerStats(match.innings1, innings1Players);
  const innings2Tracked = calculateTrackedPlayerStats(match.innings2, innings2Players);
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
    { title: match.innings1.team, batting: innings1Tracked.battingStats, bowling: innings1Tracked.bowlingStats },
    { title: match.innings2.team, batting: innings2Tracked.battingStats, bowling: innings2Tracked.bowlingStats },
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
};

export default function ResultPage() {
  const { id: matchId } = useParams();
  const router = useRouter();
  const { data: match, error, isLoading } = useSWR(
    matchId ? `/api/matches/${matchId}` : null,
    fetcher
  );

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-red-400">Failed to load match results.</div>
      </main>
    );
  }

  if (isLoading || !match) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-lg font-medium">Loading Match Results...</div>
      </main>
    );
  }

  const innings1Summary = calculateInningsSummary(match.innings1);
  const innings2Summary = calculateInningsSummary(match.innings2);

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
            match={match}
            innings1Summary={innings1Summary}
            innings2Summary={innings2Summary}
          />
        </section>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white text-center pt-8 border-t border-white/10">
            Graphical Analysis
          </h2>
          <RunsPerOverChart
            innings1Summary={innings1Summary}
            innings2Summary={innings2Summary}
            team1Name={match.innings1.team}
            team2Name={match.innings2.team}
          />
          <ScoringBreakdownCharts
            innings1Summary={innings1Summary}
            innings2Summary={innings2Summary}
            team1Name={match.innings1.team}
            team2Name={match.innings2.team}
          />
        </section>

        <PlayerStatsSection match={match} />

        <section>
          <PlayerLists match={match} />
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
