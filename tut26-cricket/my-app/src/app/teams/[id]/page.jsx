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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_26%),radial-gradient(circle_at_bottom,rgba(239,68,68,0.08),transparent_24%),linear-gradient(180deg,#050505_0%,#0b0b11_55%,#050505_100%)] px-5 py-10 text-zinc-100">
      <div className="w-full max-w-4xl mx-auto">
        <header className="mb-8 mt-7 text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200">
            Setup
          </div>
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-yellow-300 via-rose-200 to-orange-400 bg-clip-text text-transparent">
              Team Selection
            </h1>
          </div>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
            Set names, squad size, and overs before the toss.
          </p>
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition-colors hover:bg-white/[0.08] hover:text-amber-300"
            aria-label="Open team setup help"
          >
            <FaInfoCircle size={24} />
          </button>
        </header>

        <section className="grid md:grid-cols-2 gap-8 mb-10">
          <TeamRoster color="blue" roster={teamA} setRoster={setTeamA} />
          <TeamRoster color="red" roster={teamB} setRoster={setTeamB} />
        </section>

        <section className="w-full max-w-md mx-auto space-y-8">
          <div className="flex items-center justify-between rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,14,0.96))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <div>
              <h2 className="text-xl font-black text-white">Overs</h2>
              <p className="mt-1 text-sm text-zinc-500">Match length</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => overs > 1 && setOvers(overs - 1)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-zinc-100 transition-colors hover:bg-white/15"
              >
                <FaMinus />
              </button>
              <span className="w-12 text-center text-4xl font-black text-white">
                {overs}
              </span>
              <button
                onClick={() => overs < 50 && setOvers(overs + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-zinc-100 transition-colors hover:bg-white/15"
              >
                <FaPlus />
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-[28px] bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 py-5 text-xl font-black text-white shadow-[0_20px_40px_rgba(249,115,22,0.24)] transition-all hover:scale-[1.02] hover:brightness-105 active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Proceed to Toss"}
            {!isLoading && <FaArrowRight />}
          </button>
          {error && (
            <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
              {error}
            </p>
          )}
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
