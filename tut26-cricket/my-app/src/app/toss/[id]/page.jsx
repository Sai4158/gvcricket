/* ------------------------------------------------------------------
   src/app/toss/[id]/page.jsx – (Taller Gold Design with Modern Logic)
-------------------------------------------------------------------*/
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaRedo } from "react-icons/fa";

// --- SVG Coin Components ---
const CoinHeads = () => (
  <svg
    width="160"
    height="160"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="50"
      cy="50"
      r="48"
      fill="#ffc700"
      stroke="#b38b00"
      strokeWidth="4"
    />
    <text
      x="50"
      y="58"
      fontFamily="Arial, sans-serif"
      fontSize="22"
      fill="#664d00"
      textAnchor="middle"
      fontWeight="bold"
    >
      HEADS
    </text>
  </svg>
);

const CoinTails = () => (
  <svg
    width="160"
    height="160"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="50"
      cy="50"
      r="48"
      fill="#cccccc"
      stroke="#8e8e8e"
      strokeWidth="4"
    />
    <text
      x="50"
      y="58"
      fontFamily="Arial, sans-serif"
      fontSize="22"
      fill="#4f4f4f"
      textAnchor="middle"
      fontWeight="bold"
    >
      TAILS
    </text>
  </svg>
);

const SpinningCoin = () => (
  <svg
    width="160"
    height="160"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="50"
      cy="50"
      r="48"
      fill="url(#grad)"
      stroke="#b38b00"
      strokeWidth="4"
    />
    <defs>
      <radialGradient id="grad">
        <stop offset="0%" stopColor="#ffc700" />
        <stop offset="100%" stopColor="#b38b00" />
      </radialGradient>
    </defs>
  </svg>
);

// --- Main Page Component ---
export default function TossPage() {
  const { id: matchId } = useParams();
  const router = useRouter();

  // State management
  const [status, setStatus] = useState("choosing"); // 'choosing', 'counting', 'flipping', 'finished'
  const [countdown, setCountdown] = useState(10);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [tossResult, setTossResult] = useState({
    side: null,
    winnerName: null,
    call: null,
  });
  const [matchDetails, setMatchDetails] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch match details
  useEffect(() => {
    if (!matchId) return;
    fetch(`/api/matches/${matchId}`)
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Match data could not be loaded."))
      )
      .then((data) => setMatchDetails(data))
      .catch((e) => setError(e.message));
  }, [matchId]);

  // Countdown and toss logic
  useEffect(() => {
    if (status !== "counting") return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setStatus("flipping");
      const teamAName = matchDetails?.teamA?.[0] || "Team A";
      const teamBName = matchDetails?.teamB?.[0] || "Team B";
      const actualSide = Math.random() < 0.5 ? "heads" : "tails";
      const winnerName = playerChoice === actualSide ? teamAName : teamBName;
      setTimeout(() => {
        setTossResult({ side: actualSide, winnerName, call: playerChoice });
        setStatus("finished");
      }, 3000); // 3-second spin
    }
  }, [status, countdown, matchDetails, playerChoice]);

  const handleChoice = (choice) => {
    setPlayerChoice(choice);
    setStatus("counting");
  };

  const startMatch = async (decision) => {
    if (isSubmitting || !tossResult.winnerName || !decision || !matchDetails)
      return;
    setIsSubmitting(true);
    const { teamA, teamB } = matchDetails;
    const teamAName = teamA[0];
    const teamBName = teamB[0];
    const { winnerName } = tossResult;
    const teamBattingFirst =
      winnerName === teamAName
        ? decision === "bat"
          ? teamAName
          : teamBName
        : decision === "bat"
        ? teamBName
        : teamAName;
    const teamBowlingFirst =
      teamBattingFirst === teamAName ? teamBName : teamAName;

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
      if (!res.ok) throw new Error("Failed to update match.");
      router.push(`/match/${matchId}`);
    } catch (e) {
      setError(e.message);
      setIsSubmitting(false);
    }
  };

  const redoToss = () => {
    setStatus("choosing");
    setPlayerChoice(null);
    setCountdown(10);
    setTossResult({ side: null, winnerName: null, call: null });
    setIsSubmitting(false);
  };

  // --- Render Logic ---
  if (error)
    return (
      <main className="min-h-screen grid place-content-center bg-black">
        <p className="text-red-400 text-xl p-8">{error}</p>
      </main>
    );
  if (!matchDetails)
    return (
      <main className="min-h-screen grid place-content-center bg-zinc-950">
        <p className="text-white text-xl animate-pulse">LOADING...</p>
      </main>
    );

  const teamAName = matchDetails.teamA[0];
  const { winnerName, call, side } = tossResult;

  // --- FINAL UI ---
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black p-6 text-white overflow-hidden">
      {/* Main container with increased vertical padding */}
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

        {/* Content area with increased height */}
        <div className="h-[480px] flex flex-col items-center justify-center gap-8">
          <AnimatePresence mode="wait">
            {/* --- STATE 1: CHOOSING --- */}
            {status === "choosing" && (
              <motion.div
                key="choosing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full flex flex-col items-center gap-6"
              >
                <p className="text-white text-2xl">
                  <span className="font-bold">{teamAName}'s Team</span>, pick a
                  side:
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => handleChoice("heads")}
                    className="w-36 py-3 font-bold rounded-lg text-lg transition-all duration-300 ease-in-out hover:scale-105 bg-yellow-400 text-black focus:ring-2 focus:ring-white "
                  >
                    Heads
                  </button>
                  <button
                    onClick={() => handleChoice("tails")}
                    className="w-36 py-3 font-bold rounded-lg text-lg transition-all duration-300 ease-in-out hover:scale-105 bg-slate-300 text-black focus:ring-2 focus:ring-white"
                  >
                    Tails
                  </button>
                </div>
              </motion.div>
            )}

            {/* --- STATE 2: COUNTING DOWN --- */}
            {status === "counting" && (
              <motion.div
                key="counting"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center gap-4"
              >
                <p className="text-xl text-zinc-400">Tossing in...</p>
                <p className="text-9xl font-mono font-bold text-white">
                  {countdown}
                </p>
              </motion.div>
            )}

            {/* --- STATE 3: FLIPPING --- */}
            {status === "flipping" && (
              <motion.div
                key="flipping"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, rotateY: 1080 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 3, ease: "easeInOut" }}
              >
                <SpinningCoin />
              </motion.div>
            )}

            {/* --- STATE 4: FINISHED --- */}
            {status === "finished" && (
              <motion.div
                key="finished"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex flex-col items-center gap-6"
              >
                {side === "heads" ? <CoinHeads /> : <CoinTails />}
                <div className="text-xl font-semibold text-center leading-relaxed">
                  <p>
                    {teamAName}'s Team called{" "}
                    <strong className="text-amber-300 capitalize">
                      {call}
                    </strong>
                    .
                  </p>
                  <br />
                  <p>
                    It's{" "}
                    <strong className="text-amber-300 capitalize">
                      {side}
                    </strong>
                    .
                  </p>
                  <br />
                  <p className="text-2xl font-bold text-white mt-2">
                    {winnerName}'s Team wins the toss!
                  </p>
                </div>
                <div className="w-full max-w-xs mt-2 space-y-4">
                  <p className="text-lg text-zinc-200">
                    What will {winnerName}'s Team do?
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => startMatch("bat")}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 font-bold disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? "..." : "Bat First"}
                    </button>
                    <button
                      onClick={() => startMatch("bowl")}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-bold disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? "..." : "Bowl First"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
