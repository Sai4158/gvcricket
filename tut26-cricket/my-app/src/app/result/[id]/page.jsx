"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { FaArrowLeft } from "react-icons/fa";
import {
  calculateInningsSummary,
} from "../../lib/match-stats";
import CongratulationsCard from "../../components/result/CongratulationsCard";
import EnhancedScorecard from "../../components/result/EnhancedScorecard";
import PlayerLists from "../../components/result/PlayerLists";
import PlayerStatsSection from "../../components/result/PlayerStatsSection";
import RunsPerOverChart from "../../components/result/RunsPerOverChart";
import ScoringBreakdownCharts from "../../components/result/ScoringBreakdownCharts";

const fetcher = (url) => fetch(url).then((res) => res.json());

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
