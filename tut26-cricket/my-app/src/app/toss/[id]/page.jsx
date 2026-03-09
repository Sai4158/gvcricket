"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaRedo } from "react-icons/fa";
import TossStatePanels from "../../components/toss/TossStatePanels";
import { getTeamBundle } from "../../lib/team-utils";

export default function TossPage() {
  const { id: matchId } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState("choosing");
  const [countdown, setCountdown] = useState(3);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [tossResult, setTossResult] = useState({
    side: null,
    winnerName: null,
    call: null,
  });
  const [matchDetails, setMatchDetails] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!matchId) return;

    fetch(`/api/matches/${matchId}`)
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Match data could not be loaded."))
      )
      .then((data) => setMatchDetails(data))
      .catch((caughtError) => setError(caughtError.message));
  }, [matchId]);

  useEffect(() => {
    if (status !== "counting") return;

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
    const teamA = getTeamBundle(matchDetails, "teamA");
    const teamB = getTeamBundle(matchDetails, "teamB");
    const winnerName = tossResult.winnerName;
    const teamBattingFirst =
      decision === "bat"
        ? winnerName
        : winnerName === teamA.name
        ? teamB.name
        : teamA.name;
    const teamBowlingFirst =
      teamBattingFirst === teamA.name ? teamB.name : teamA.name;

    const payload = {
      tossWinner: winnerName,
      tossDecision: decision,
      innings1: { ...matchDetails.innings1, team: teamBattingFirst },
      innings2: { ...matchDetails.innings2, team: teamBowlingFirst },
    };

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to update match.");
      }

      router.push(`/match/${matchId}`);
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

        <TossStatePanels
          status={status}
          countdown={countdown}
          teamName={teamA.name}
          tossResult={tossResult}
          isSubmitting={isSubmitting}
          onChoice={handleChoice}
          onDecision={startMatch}
        />
      </div>
    </main>
  );
}
