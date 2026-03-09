"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { FaArrowRight, FaInfoCircle, FaMinus, FaPlus } from "react-icons/fa";
import TeamsInfoModal from "../../components/teams/InfoModal";
import TeamRoster, {
  createDefaultRoster,
} from "../../components/teams/TeamRoster";
import useSessionStorageState from "../../components/teams/useSessionStorageState";

export default function TeamSelectionPage() {
  const { id: sessionId } = useParams();
  const router = useRouter();
  const [teamA, setTeamA] = useSessionStorageState(
    `session_${sessionId}_teamA_v2`,
    createDefaultRoster("Team A")
  );
  const [teamB, setTeamB] = useSessionStorageState(
    `session_${sessionId}_teamB_v2`,
    createDefaultRoster("Team B")
  );
  const [overs, setOvers] = useSessionStorageState(
    `session_${sessionId}_overs_v2`,
    6
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const handleSubmit = async () => {
    const finalTeamAName = teamA.name.trim();
    const finalTeamBName = teamB.name.trim();
    const finalTeamAPlayers = teamA.players.map((player) => player.trim()).filter(Boolean);
    const finalTeamBPlayers = teamB.players.map((player) => player.trim()).filter(Boolean);

    if (!finalTeamAName || !finalTeamBName) {
      setError("Each team must have a name.");
      return;
    }

    if (!finalTeamAPlayers.length || !finalTeamBPlayers.length) {
      setError("Each team must have at least one player.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/sessions/${sessionId}/setup-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamAName: finalTeamAName,
          teamAPlayers: finalTeamAPlayers,
          teamBName: finalTeamBName,
          teamBPlayers: finalTeamBPlayers,
          overs,
        }),
      });

      if (!response.ok) {
        throw new Error(
          (await response.json()).message || "Failed to set up the match."
        );
      }

      const match = await response.json();
      router.push(`/toss/${match._id}`);
    } catch (caughtError) {
      setError(caughtError.message);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center bg-zinc-950 text-zinc-100 py-10 px-5">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-5 mt-7">
          <div className="flex justify-center items-center gap-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-yellow-300 via-rose-200 to-orange-400 bg-clip-text text-transparent">
              Team Selection
            </h1>
          </div>
          <p className="text-zinc-100 mt-2">
            Set player counts, team names, and match overs.
          </p>
          <br />
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="text-white hover:text-blue-400 transition-colors"
          >
            <FaInfoCircle size={40} />
          </button>
        </header>

        <section className="grid md:grid-cols-2 gap-8 mb-10">
          <TeamRoster color="blue" roster={teamA} setRoster={setTeamA} />
          <TeamRoster color="red" roster={teamB} setRoster={setTeamB} />
        </section>

        <section className="w-full max-w-md mx-auto space-y-8">
          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl ring-1 ring-white/10">
            <h2 className="text-xl font-bold">Overs</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => overs > 1 && setOvers(overs - 1)}
                className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
              >
                <FaMinus />
              </button>
              <span className="text-3xl font-bold w-12 text-center">{overs}</span>
              <button
                onClick={() => overs < 50 && setOvers(overs + 1)}
                className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
              >
                <FaPlus />
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full text-xl font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 text-white shadow-lg shadow-orange-800/30 hover:scale-105 active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Saving..." : "Proceed to Toss"}
            {!isLoading && <FaArrowRight />}
          </button>
          {error && <p className="text-red-500 text-center mt-4">{error}</p>}
        </section>
      </div>
      <AnimatePresence>
        {isInfoModalOpen && (
          <TeamsInfoModal onExit={() => setIsInfoModalOpen(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
