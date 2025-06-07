/* ------------------------------------------------------------------
   src/app/teams/[id]/page.jsx - (Final Version with Counter UI)
-------------------------------------------------------------------*/
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlus,
  FaMinus,
  FaTrash,
  FaPen,
  FaCheck,
  FaArrowRight,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";

// A custom hook to persist state in sessionStorage (hydration-safe)
function useSessionStorageState(key, defaultValue) {
  const [state, setState] = useState(defaultValue);
  useEffect(() => {
    const storedValue = window.sessionStorage.getItem(key);
    if (storedValue) {
      try {
        setState(JSON.parse(storedValue));
      } catch (e) {
        console.error("Error parsing session storage value", e);
      }
    }
  }, [key]);
  useEffect(() => {
    window.sessionStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

// --- Information Modal Component ---
const InfoModal = ({ onExit }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    onClick={onExit}
  >
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 20 }}
      className="relative w-full max-w-lg bg-zinc-900 p-8 rounded-2xl ring-1 ring-white/10 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">How to Set Up Teams</h2>
        <button
          onClick={onExit}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <FaTimes size={20} />
        </button>
      </div>
      <div className="space-y-5 text-left">
        <div>
          <h3 className="font-bold text-lg text-amber-300 mb-1">
            1. Set Player Count
          </h3>
          <p className="text-zinc-300">
            Use the <strong className="text-white">+/-</strong> buttons to
            quickly change the number of players. The list below will update
            automatically.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-lg text-amber-300 mb-1">
            2. Edit Names
          </h3>
          <p className="text-zinc-300">
            Click the <strong className="text-white">Edit</strong> (
            <FaPen className="inline" />) icon to show text fields. You can then
            rename the teams and players. Click{" "}
            <strong className="text-white">Done</strong> (
            <FaCheck className="inline" />) to save.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-lg text-amber-300 mb-1">
            3. Delete a Player
          </h3>
          <p className="text-zinc-300">
            While in <strong className="text-white">Edit Mode</strong>, a{" "}
            <strong className="text-white">Trash</strong> (
            <FaTrash className="inline" />) icon will appear, allowing you to
            remove a specific player from the roster.
          </p>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// --- ✨ NEW: Final Roster Component with Counter ---
const TeamRoster = ({ title, color, teamNames, setTeamNames }) => {
  const [isEditing, setIsEditing] = useState(false);
  const teamColorClass = color === "blue" ? "text-blue-400" : "text-red-400";
  const teamRingClass =
    color === "blue" ? "focus:ring-blue-500" : "focus:ring-red-500";

  const handleNameChange = (index, newName) => {
    setTeamNames((currentNames) =>
      currentNames.map((name, i) => (i === index ? newName : name))
    );
  };

  const addPlayer = () => {
    if (teamNames.length < 15) {
      // Max player limit
      setTeamNames((currentNames) => [
        ...currentNames,
        `Player ${currentNames.length + 1}`,
      ]);
    }
  };

  const removeLastPlayer = () => {
    if (teamNames.length > 1) {
      // Min player limit
      setTeamNames((currentNames) => currentNames.slice(0, -1));
    }
  };

  const removePlayerAtIndex = (indexToRemove) => {
    setTeamNames((currentNames) =>
      currentNames.filter((_, index) => index !== indexToRemove)
    );
  };

  return (
    <div className="bg-zinc-900/50 p-6 rounded-2xl ring-1 ring-white/10 space-y-4 transition-all duration-300">
      {/* Header with Title and Edit Toggle */}
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${teamColorClass}`}>
          {teamNames[0] || title}
        </h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          {isEditing ? (
            <FaCheck className="text-green-400" size={20} />
          ) : (
            <FaPen size={20} />
          )}
        </button>
      </div>

      {/* Player Counter */}
      <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
        <span className="font-semibold text-zinc-300">Players</span>
        <div className="flex items-center gap-4">
          <button
            onClick={removeLastPlayer}
            className="w-8 h-8 rounded-md bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
          >
            <FaMinus />
          </button>
          <span className="text-xl font-bold w-8 text-center">
            {teamNames.length}
          </span>
          <button
            onClick={addPlayer}
            className="w-8 h-8 rounded-md bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
          >
            <FaPlus />
          </button>
        </div>
      </div>

      {/* Editable Player List */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-4 border-t border-white/10">
              <p className="text-sm text-zinc-400 px-1">
                Editing team & player names...
              </p>
              {teamNames.map((name, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(i, e.target.value)}
                    placeholder={i === 0 ? "Team Name" : `Player ${i + 1}`}
                    className={`flex-1 px-4 py-3 rounded-xl bg-zinc-900 focus:ring-2 ${teamRingClass} outline-none transition`}
                  />
                  {i > 0 && (
                    <button
                      onClick={() => removePlayerAtIndex(i)}
                      className="p-3 text-zinc-500 hover:text-red-500 transition-colors"
                    >
                      <FaTrash />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function TeamSelectionPage() {
  const { id: sessionId } = useParams();
  const router = useRouter();

  const [teamANames, setTeamANames] = useSessionStorageState(
    `session_${sessionId}_teamA`,
    Array.from({ length: 4 }, (_, i) =>
      i === 0 ? "Team A" : `Player ${i + 1}`
    )
  );
  const [teamBNames, setTeamBNames] = useSessionStorageState(
    `session_${sessionId}_teamB`,
    Array.from({ length: 4 }, (_, i) =>
      i === 0 ? "Team B" : `Player ${i + 1}`
    )
  );

  const [overs, setOvers] = useSessionStorageState(
    `session_${sessionId}_overs`,
    6
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const handleSubmit = async () => {
    const finalTeamA = teamANames.map((p) => p.trim()).filter((p) => p);
    const finalTeamB = teamBNames.map((p) => p.trim()).filter((p) => p);
    if (!finalTeamA[0] || !finalTeamB[0]) {
      setError("Each team must have a name.");
      return;
    }
    if (finalTeamA.length < 2 || finalTeamB.length < 2) {
      setError("Each team must have at least one player.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/setup-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamA: finalTeamA, teamB: finalTeamB, overs }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).message || "Failed to set up the match."
        );
      const match = await response.json();
      router.push(`/toss/${match._id}`);
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center bg-zinc-950 text-zinc-100 py-10 px-5">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-5 mt-7">
          <div className="flex justify-center items-center gap-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-yellow-300 via-rose-200 to-orange-400 bg-clip-text text-transparent">
              🏏Team Selection
            </h1>
          </div>
          <p className="text-zinc-400 mt-2">
            Set player counts, team names, and match overs.
          </p>
          <br />
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="text-zinc-500 hover:text-blue-400 transition-colors"
          >
            <FaInfoCircle size={24} />
          </button>
        </header>

        <section className="grid md:grid-cols-2 gap-8 mb-10">
          <TeamRoster
            title="Team A"
            color="blue"
            teamNames={teamANames}
            setTeamNames={setTeamANames}
          />
          <TeamRoster
            title="Team B"
            color="red"
            teamNames={teamBNames}
            setTeamNames={setTeamBNames}
          />
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
              <span className="text-3xl font-bold w-12 text-center">
                {overs}
              </span>
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
          <InfoModal onExit={() => setIsInfoModalOpen(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
