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
  const [isEditingName, setIsEditingName] = useState(false);
  const teamColorClass = color === "blue" ? "text-blue-400" : "text-red-400";
  const teamRingClass =
    color === "blue" ? "focus:ring-blue-500" : "focus:ring-red-500";
  const teamGlowClass =
    color === "blue"
      ? "shadow-[0_18px_45px_rgba(59,130,246,0.08)]"
      : "shadow-[0_18px_45px_rgba(248,113,113,0.08)]";
  const badgeClass =
    color === "blue"
      ? "border-blue-400/20 bg-blue-500/10 text-blue-300"
      : "border-rose-400/20 bg-rose-500/10 text-rose-300";

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
    <div
      className={`rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,14,0.96))] p-6 ring-1 ring-white/5 transition-all duration-300 ${teamGlowClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {isEditingName ? (
              <input
                type="text"
                value={roster.name}
                onChange={(event) =>
                  setRoster((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                placeholder="Team Name"
                className={`min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-2xl font-black text-white outline-none transition focus:ring-2 ${teamRingClass}`}
              />
            ) : (
              <>
                <h2 className={`truncate text-2xl font-black ${teamColorClass}`}>
                  {roster.name}
                </h2>
                <button
                  onClick={() => setIsEditingName(true)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${badgeClass}`}
                  aria-label={`Edit ${roster.name} name`}
                >
                  <FaPen size={13} />
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-sm text-zinc-500">Set players and names.</p>
        </div>

        <button
          onClick={() => setIsEditing((current) => !current)}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:bg-white/[0.08] ${
            isEditing ? "text-emerald-400" : "text-zinc-300"
          }`}
          aria-label={isEditing ? "Finish editing roster" : "Edit roster"}
        >
          {isEditing ? <FaCheck size={18} /> : <FaPen size={16} />}
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            Players
          </span>
          <div className="mt-1 text-sm text-zinc-300">Squad size</div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={removeLastPlayer}
            disabled={roster.players.length <= 1}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-zinc-200 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FaMinus />
          </button>
          <span className="w-8 text-center text-3xl font-black text-white">
            {roster.players.length}
          </span>
          <button
            onClick={addPlayer}
            disabled={roster.players.length >= 15}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-zinc-200 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
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
            <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
                Player names
              </p>

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
                    className={`flex-1 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:ring-2 ${teamRingClass}`}
                  />
                  <button
                    onClick={() => removePlayerAtIndex(index)}
                    disabled={roster.players.length <= 1}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
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
