"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaRedo } from "react-icons/fa";
import MatchImageUploader from "../match/MatchImageUploader";
import TossStatePanels from "./TossStatePanels";
import { getTeamBundle } from "../../lib/team-utils";

function createActionId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export default function TossPageClient({ matchId, initialMatch }) {
  const router = useRouter();
  const [status, setStatus] = useState("choosing");
  const [countdown, setCountdown] = useState(3);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [tossResult, setTossResult] = useState({
    side: null,
    winnerName: null,
    call: null,
  });
  const [matchDetails, setMatchDetails] = useState(initialMatch);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showImageStep, setShowImageStep] = useState(false);

  useEffect(() => {
    if (status !== "counting") return undefined;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }

    const teamA = getTeamBundle(matchDetails, "teamA");
    const teamB = getTeamBundle(matchDetails, "teamB");
    const actualSide = Math.random() < 0.5 ? "heads" : "tails";
    const winnerName = playerChoice === actualSide ? teamA.name : teamB.name;

    setStatus("flipping");
    const timer = setTimeout(() => {
      setTossResult({ side: actualSide, winnerName, call: playerChoice });
      setStatus("finished");
    }, 3000);

    return () => clearTimeout(timer);
  }, [status, countdown, matchDetails, playerChoice]);

  const handleChoice = (choice) => {
    setPlayerChoice(choice);
    setCountdown(3);
    setStatus("counting");
  };

  const startMatch = async (decision) => {
    if (isSubmitting || !tossResult.winnerName || !decision || !matchDetails) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/matches/${matchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: createActionId("toss"),
          type: "set_toss",
          tossWinner: tossResult.winnerName,
          tossDecision: decision,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to update match.");
      }

      const payload = await res.json();
      setMatchDetails(payload.match);
      setShowImageStep(true);
      setIsSubmitting(false);
    } catch (caughtError) {
      setError(caughtError.message);
      setIsSubmitting(false);
    }
  };

  const redoToss = () => {
    setStatus("choosing");
    setPlayerChoice(null);
    setCountdown(3);
    setTossResult({ side: null, winnerName: null, call: null });
    setIsSubmitting(false);
    setShowImageStep(false);
  };

  if (error) {
    return (
      <main className="min-h-screen grid place-content-center bg-black">
        <p className="text-red-400 text-xl p-8">{error}</p>
      </main>
    );
  }

  if (!matchDetails) {
    return (
      <main className="min-h-screen grid place-content-center bg-zinc-950">
        <p className="text-white text-xl animate-pulse">LOADING...</p>
      </main>
    );
  }

  const teamA = getTeamBundle(matchDetails, "teamA");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black p-6 text-white overflow-hidden">
      <div className="relative w-full max-w-lg bg-black/50 backdrop-blur-xl ring-1 ring-yellow-400/30 rounded-3xl p-8 sm:px-12 sm:py-16 text-center shadow-2xl shadow-yellow-500/10">
        <button
          onClick={redoToss}
          className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          aria-label="Redo Toss"
        >
          <FaRedo />
        </button>

        <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent mb-8 sm:mb-12">
          The Toss
        </h1>

        {showImageStep ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Add a Match Image</h2>
              <p className="text-zinc-400 mt-2">
                Upload a team photo, ground photo, poster, or skip and add it later after admin access.
              </p>
            </div>
            <MatchImageUploader
              matchId={String(matchDetails._id)}
              existingImageUrl={matchDetails.matchImageUrl || ""}
              onUploaded={() => {
                router.push(`/match/${matchId}`);
              }}
              onSkip={() => router.push(`/match/${matchId}`)}
              title="Optional pre-game image"
              description="Keep the flow fast: upload now, or choose later once the umpire view is unlocked."
              primaryLabel="Upload and Start Match"
              secondaryLabel="Skip and Start Match"
            />
          </div>
        ) : (
          <TossStatePanels
            status={status}
            countdown={countdown}
            teamName={teamA.name}
            tossResult={tossResult}
            isSubmitting={isSubmitting}
            onChoice={handleChoice}
            onDecision={startMatch}
          />
        )}
      </div>
    </main>
  );
}
