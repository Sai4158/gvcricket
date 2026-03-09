"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaArrowRight,
  FaCheck,
  FaInfoCircle,
  FaMinus,
  FaPen,
  FaPlus,
  FaTimes,
  FaTrash,
} from "react-icons/fa";

function useSessionStorageState(key, defaultValue) {
  const [state, setState] = useState(defaultValue);

  useEffect(() => {
    const storedValue = window.sessionStorage.getItem(key);
    if (!storedValue) return;

    try {
      setState(JSON.parse(storedValue));
    } catch (error) {
      console.error("Error parsing session storage value", error);
    }
  }, [key]);

  useEffect(() => {
    window.sessionStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}

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
      onClick={(event) => event.stopPropagation()}
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
            change the number of players. Team names are kept separate from the
            player count.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-lg text-amber-300 mb-1">
            2. Edit Names
          </h3>
          <p className="text-zinc-300">
            Click the edit icon to update the team name and the player list.
            Click done to save the local draft.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-lg text-amber-300 mb-1">
            3. Delete a Player
          </h3>
          <p className="text-zinc-300">
            While editing, use the trash icon next to a player to remove that
            player from the roster.
          </p>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

function createDefaultRoster(teamLabel) {
  return {
    name: teamLabel,
    players: Array.from({ length: 3 }, (_, index) => `Player ${index + 1}`),
  };
}

const TeamRoster = ({ color, roster, setRoster }) => {
  const [isEditing, setIsEditing] = useState(false);
  const teamColorClass = color === "blue" ? "text-blue-400" : "text-red-400";
  const teamRingClass =
    color === "blue" ? "focus:ring-blue-500" : "focus:ring-red-500";

  const updatePlayer = (index, nextValue) => {
    setRoster((current) => ({
      ...current,
      players: current.players.map((player, playerIndex) =>
        playerIndex === index ? nextValue : player
      ),
    }));
  };

  const addPlayer = () => {
    setRoster((current) => {
      if (current.players.length >= 15) return current;
      return {
        ...current,
        players: [...current.players, `Player ${current.players.length + 1}`],
      };
    });
  };

  const removeLastPlayer = () => {
    setRoster((current) => {
      if (current.players.length <= 1) return current;
      return {
        ...current,
        players: current.players.slice(0, -1),
      };
    });
  };

  const removePlayerAtIndex = (indexToRemove) => {
    setRoster((current) => ({
      ...current,
      players: current.players.filter((_, index) => index !== indexToRemove),
    }));
  };

  return (
    <div className="bg-zinc-900/50 p-6 rounded-2xl ring-1 ring-white/10 space-y-4 transition-all duration-300">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${teamColorClass}`}>{roster.name}</h2>
        <button
          onClick={() => setIsEditing((current) => !current)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          {isEditing ? (
            <FaCheck className="text-green-400" size={20} />
          ) : (
            <FaPen size={20} />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
        <span className="font-semibold text-zinc-300">Players</span>
        <div className="flex items-center gap-4">
          <button
            onClick={removeLastPlayer}
            disabled={roster.players.length <= 1}
            className="w-8 h-8 rounded-md bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaMinus />
          </button>
          <span className="text-xl font-bold w-8 text-center">
            {roster.players.length}
          </span>
          <button
            onClick={addPlayer}
            disabled={roster.players.length >= 15}
            className="w-8 h-8 rounded-md bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPlus />
          </button>
        </div>
      </div>

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
                Editing team and player names...
              </p>

              <input
                type="text"
                value={roster.name}
                onChange={(event) =>
                  setRoster((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Team Name"
                className={`w-full px-4 py-3 rounded-xl bg-zinc-900 focus:ring-2 ${teamRingClass} outline-none transition`}
              />

              {roster.players.map((player, index) => (
                <motion.div
                  key={`${player}-${index}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={player}
                    onChange={(event) => updatePlayer(index, event.target.value)}
                    placeholder={`Player ${index + 1}`}
                    className={`flex-1 px-4 py-3 rounded-xl bg-zinc-900 focus:ring-2 ${teamRingClass} outline-none transition`}
                  />
                  <button
                    onClick={() => removePlayerAtIndex(index)}
                    disabled={roster.players.length <= 1}
                    className="p-3 text-zinc-500 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaTrash />
                  </button>
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
          <InfoModal onExit={() => setIsInfoModalOpen(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
