"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaCheck, FaMinus, FaPen, FaPlus, FaTrash } from "react-icons/fa";

export function createDefaultRoster(teamLabel) {
  return {
    name: teamLabel,
    players: Array.from({ length: 3 }, (_, index) => `Player ${index + 1}`),
  };
}

export default function TeamRoster({ color, roster, setRoster }) {
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
}
