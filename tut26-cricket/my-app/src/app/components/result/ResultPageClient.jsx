"use client";

import dynamic from "next/dynamic";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";
import useEventSource from "../live/useEventSource";
import MatchHeroBackdrop from "../match/MatchHeroBackdrop";
import { calculateInningsSummary } from "../../lib/match-stats";
import CongratulationsCard from "./CongratulationsCard";
import EnhancedScorecard from "./EnhancedScorecard";
import PlayerLists from "./PlayerLists";
import PlayerStatsSection from "./PlayerStatsSection";

const RunsPerOverChart = dynamic(() => import("./RunsPerOverChart"), {
  ssr: false,
});
const ScoringBreakdownCharts = dynamic(() => import("./ScoringBreakdownCharts"), {
  ssr: false,
});

export default function ResultPageClient({ matchId, initialMatch }) {
  const router = useRouter();
  const [match, setMatch] = useState(initialMatch);
  const [streamError, setStreamError] = useState("");

  useEventSource({
    url: matchId ? `/api/live/matches/${matchId}` : null,
    event: "match",
    enabled: Boolean(matchId) && Boolean(!match || match.isOngoing),
    onMessage: (payload) => {
      startTransition(() => {
        setMatch(payload.match || null);
        setStreamError("");
      });
    },
    onError: () => {
      if (!match) {
        setStreamError("Failed to load match results.");
      }
    },
  });

  if (streamError) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-red-400">{streamError}</div>
      </main>
    );
  }

  if (!match) {
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
        <MatchHeroBackdrop match={match} className="mb-2">
          <div className="px-5 py-7 sm:px-8 sm:py-8">
            <header className="text-center space-y-4">
              <button
                onClick={() => router.push("/session")}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-zinc-100 backdrop-blur-sm transition-colors hover:bg-black/45"
              >
                <FaArrowLeft />
                <span>Back to Sessions</span>
              </button>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/90">
                  Match Complete
                </p>
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                  Match Result
                </h1>
                <p className="text-sm text-zinc-300">
                  {match.innings1.team} vs {match.innings2.team}
                </p>
              </div>
            </header>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[28px] border border-white/10 bg-black/35 p-4 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:p-5">
                {match.result && <CongratulationsCard result={match.result} />}
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/35 p-5 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.32)]">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-400">Final score</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {match.score}
                      <span className="text-zinc-400">/{match.outs}</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-400">Overs</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {innings2Summary.overs || innings1Summary.overs || "0.0"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-center text-sm text-zinc-300">
                  Toss won by <span className="font-semibold text-white">{match.tossWinner}</span>
                </p>
              </div>
            </div>
          </div>
        </MatchHeroBackdrop>

        <section className="space-y-8">
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
