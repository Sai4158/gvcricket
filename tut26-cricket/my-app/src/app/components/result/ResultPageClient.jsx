"use client";

import dynamic from "next/dynamic";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaImage, FaTrashAlt } from "react-icons/fa";
import useEventSource from "../live/useEventSource";
import MatchHeroBackdrop from "../match/MatchHeroBackdrop";
import ImagePinModal from "../shared/ImagePinModal";
import { calculateInningsSummary } from "../../lib/match-stats";
import CongratulationsCard from "./CongratulationsCard";
import EnhancedScorecard from "./EnhancedScorecard";
import PlayerLists from "./PlayerLists";
import ResultInsightsSections from "./ResultInsightsSections";
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
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [showConfetti, setShowConfetti] = useState(true);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: `${(index * 17) % 100}%`,
        delay: `${(index % 8) * 0.18}s`,
        duration: `${4 + (index % 5) * 0.45}s`,
        rotate: `${(index % 2 === 0 ? 1 : -1) * (10 + index * 3)}deg`,
        color:
          ["#f6b400", "#fde68a", "#ffffff", "#ffdd57", "#f59e0b"][index % 5],
      })),
    []
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowConfetti(false), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

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

  const handleRemoveImage = async (pin) => {
    const response = await fetch(`/api/matches/${matchId}/image`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Failed to remove the image.");
    }

    startTransition(() => {
      setMatch(payload);
      setRemoveError("");
      setIsRemoveModalOpen(false);
    });
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-4 sm:p-8 text-zinc-300 font-sans">
      <div className="max-w-5xl mx-auto space-y-12 py-10">
        <div className="flex justify-start">
          <button
            onClick={() => router.push("/session")}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-zinc-100 backdrop-blur-sm transition-colors hover:bg-black/45"
          >
            <FaArrowLeft />
            <span>Back to Sessions</span>
          </button>
        </div>

        <MatchHeroBackdrop match={match} className="mb-2">
          <div className="px-5 py-7 sm:px-8 sm:py-8">
            {showConfetti ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[320px] overflow-hidden">
                {confettiPieces.map((piece) => (
                  <span
                    key={piece.id}
                    className="absolute top-[-10%] h-3 w-2 rounded-full opacity-80 animate-[result-confetti_var(--confetti-duration)_linear_forwards]"
                    style={{
                      left: piece.left,
                      backgroundColor: piece.color,
                      animationDelay: piece.delay,
                      ["--confetti-duration"]: piece.duration,
                      transform: `rotate(${piece.rotate})`,
                    }}
                  />
                ))}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.18))]" />
              </div>
            ) : null}
            <header className="text-center space-y-4">
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

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              {match.result && <CongratulationsCard result={match.result} />}
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

        {match?.matchImageUrl ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300/85">
                  Match Photo
                </p>
                <h2 className="mt-2 text-3xl font-bold text-white">Session Cover</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRemoveError("");
                  setIsRemoveModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
              >
                <FaTrashAlt />
                <span>Remove</span>
              </button>
            </div>
            <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.94),rgba(10,10,14,0.96))] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-300">
                  <FaImage />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">Shared match image</h3>
                  <p className="text-sm text-zinc-400">
                    This cover stays with the whole session.
                  </p>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={match.matchImageUrl}
                alt={match.name || "Match cover"}
                className="max-h-[420px] w-full object-cover"
                loading="lazy"
              />
            </div>
            {removeError ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {removeError}
              </div>
            ) : null}
          </section>
        ) : null}

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

        <ResultInsightsSections match={match} />

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
      <ImagePinModal
        isOpen={isRemoveModalOpen}
        title="Remove picture"
        subtitle="Enter the 4-digit PIN to remove this session image."
        confirmLabel="Remove picture"
        onConfirm={handleRemoveImage}
        onClose={() => setIsRemoveModalOpen(false)}
      />
    </main>
  );
}
