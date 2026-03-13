"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FaMinus, FaPen, FaPlus, FaTrash } from "react-icons/fa";
import { getTeamBundle } from "../../lib/team-utils";
import { ModalBase } from "./MatchBaseModals";

function EditableRoster({
  title,
  name,
  setName,
  players,
  setPlayers,
  canEditPlayers,
  lockedReason = "",
  theme = "blue",
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const isBlue = theme === "blue";
  const cardClass = isBlue
    ? "border-sky-400/20 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_32%),linear-gradient(180deg,rgba(16,24,44,0.985),rgba(10,12,20,0.99))]"
    : "border-rose-300/20 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.18),transparent_32%),linear-gradient(180deg,rgba(40,18,24,0.985),rgba(12,10,16,0.99))]";
  const titleClass = isBlue ? "text-sky-100" : "text-rose-100";
  const panelClass = isBlue
    ? "border-sky-300/10 bg-sky-950/25"
    : "border-rose-300/10 bg-rose-950/25";
  const inputClass = isBlue
    ? "border-sky-400/14 bg-zinc-950/92 focus:border-sky-300/40"
    : "border-rose-300/14 bg-zinc-950/92 focus:border-rose-300/40";
  const iconButtonClass = isBlue
    ? "border border-sky-300/12 bg-sky-950/42 text-sky-100 hover:bg-sky-900/60"
    : "border border-rose-300/12 bg-rose-950/38 text-rose-100 hover:bg-rose-900/55";

  const updatePlayer = (index, nextValue) => {
    setPlayers((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? nextValue : player
      )
    );
  };

  const addPlayer = () => {
    if (!canEditPlayers) return;

    setPlayers((current) => {
      if (current.length >= 15) return current;
      return [...current, `Player ${current.length + 1}`];
    });
  };

  const removeLastPlayer = () => {
    if (!canEditPlayers) return;

    setPlayers((current) => {
      if (current.length <= 1) return current;
      return current.slice(0, -1);
    });
  };

  const removePlayerAtIndex = (indexToRemove) => {
    if (!canEditPlayers) return;

    setPlayers((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, index) => index !== indexToRemove);
    });
  };

  return (
    <div
      className={`relative space-y-4 overflow-hidden rounded-[24px] border p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] ${cardClass}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 ${
          isBlue
            ? "bg-[linear-gradient(90deg,rgba(56,189,248,0.96),rgba(34,211,238,0.72),transparent)]"
            : "bg-[linear-gradient(90deg,rgba(251,113,133,0.96),rgba(244,63,94,0.72),transparent)]"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_18%)]" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${titleClass}`}>
            {title}
          </p>
          {isEditingName ? (
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value.toUpperCase())}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setIsEditingName(false);
                }
              }}
              autoFocus
              placeholder="Team name"
              className={`mt-2 w-full rounded-2xl border px-3 py-2.5 text-lg font-semibold uppercase tracking-[0.08em] text-white outline-none transition ${inputClass}`}
            />
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-[1.55rem] font-semibold uppercase tracking-[0.08em] text-white">
                {name || "Team name"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${iconButtonClass}`}
                aria-label={`Edit ${title} name`}
              >
                <FaPen size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`flex items-center justify-between rounded-[22px] border px-3 py-3 ${panelClass}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Players
          </p>
          <p className="mt-1 text-sm text-zinc-300">{players.length} selected</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={removeLastPlayer}
            disabled={!canEditPlayers || players.length <= 1}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.06] text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FaMinus />
          </button>
          <button
            type="button"
            onClick={addPlayer}
            disabled={!canEditPlayers || players.length >= 15}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.06] text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FaPlus />
          </button>
        </div>
      </div>

      {!canEditPlayers && lockedReason ? (
        <p className="rounded-[18px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(120,53,15,0.28),rgba(70,32,10,0.18))] px-3 py-2.5 text-sm text-amber-200">
          {lockedReason}
        </p>
      ) : null}

      <div className="space-y-3">
        {players.map((player, index) => (
          <div key={`${title}-${index}`} className="flex items-center gap-3">
            <input
              type="text"
              value={player}
              onChange={(event) => updatePlayer(index, event.target.value)}
              placeholder={`Player ${index + 1}`}
              className={`w-full rounded-2xl border px-3 py-2.5 text-sm text-white outline-none transition ${inputClass}`}
            />
            <button
              type="button"
              onClick={() => removePlayerAtIndex(index)}
              disabled={!canEditPlayers || players.length <= 1}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${iconButtonClass}`}
            >
              <FaTrash size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EditTeamsModal({ match, onUpdate, onClose }) {
  const initialTeamA = getTeamBundle(match, "teamA");
  const initialTeamB = getTeamBundle(match, "teamB");
  const [teamAName, setTeamAName] = useState(initialTeamA.name);
  const [teamBName, setTeamBName] = useState(initialTeamB.name);
  const [teamAPlayers, setTeamAPlayers] = useState([...initialTeamA.players]);
  const [teamBPlayers, setTeamBPlayers] = useState([...initialTeamB.players]);
  const secondInningsTeamName = match?.innings2?.team || "";
  const isSecondInningsLive = match?.innings === "second";
  const canEditTeamAPlayers = !isSecondInningsLive || initialTeamA.name === secondInningsTeamName;
  const canEditTeamBPlayers = !isSecondInningsLive || initialTeamB.name === secondInningsTeamName;
  const lockedReason =
    isSecondInningsLive && secondInningsTeamName
      ? `Only ${secondInningsTeamName} can add or remove players right now. Names still work.`
      : "";

  const handleSaveChanges = () => {
    onUpdate({
      teamAName: teamAName.trim(),
      teamBName: teamBName.trim(),
      teamA: teamAPlayers.map((player) => player.trim()).filter(Boolean),
      teamB: teamBPlayers.map((player) => player.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <ModalBase title="Edit Teams" onExit={onClose}>
      <div className="space-y-4 text-left max-h-[70vh] overflow-y-auto p-1 pr-2">
        <EditableRoster
          title="Team A"
          name={teamAName}
          setName={setTeamAName}
          players={teamAPlayers}
          setPlayers={setTeamAPlayers}
          canEditPlayers={canEditTeamAPlayers}
          lockedReason={!canEditTeamAPlayers ? lockedReason : ""}
          theme="blue"
        />
        <EditableRoster
          title="Team B"
          name={teamBName}
          setName={setTeamBName}
          players={teamBPlayers}
          setPlayers={setTeamBPlayers}
          canEditPlayers={canEditTeamBPlayers}
          lockedReason={!canEditTeamBPlayers ? lockedReason : ""}
          theme="red"
        />
      </div>
      <button
        onClick={handleSaveChanges}
        className="mt-6 w-full rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,185,90,0.96),rgba(22,163,74,0.98))] py-3.5 text-base font-semibold tracking-tight text-white shadow-[0_18px_36px_rgba(22,163,74,0.24)] transition-all hover:brightness-105 active:scale-[0.99]"
      >
        Save Changes
      </button>
    </ModalBase>
  );
}

export function EditOversModal({
  currentOvers,
  currentOverNumber,
  innings,
  firstInningsOversPlayed,
  onUpdate,
  onClose,
}) {
  const [overs, setOvers] = useState(currentOvers);
  const minAllowedOvers =
    innings === "first"
      ? Math.max(1, currentOverNumber)
      : Math.max(1, firstInningsOversPlayed, currentOverNumber);
  const isInvalid = Number(overs) < minAllowedOvers;

  return (
    <ModalBase title="Edit Match Overs" onExit={onClose}>
      <div className="flex items-center justify-between p-2 my-6 bg-zinc-800 rounded-2xl">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setOvers((value) => Math.max(minAllowedOvers, value - 1))}
          disabled={Number(overs) <= minAllowedOvers}
          className="w-14 h-14 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-3xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -
        </motion.button>
        <input
          type="number"
          value={overs}
          onChange={(event) =>
            setOvers(event.target.value === "" ? "" : Number(event.target.value))
          }
          className="w-28 h-20 text-center text-5xl font-bold bg-transparent outline-none text-white"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setOvers((value) => (Number(value) || 0) + 1)}
          className="w-14 h-14 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-3xl flex items-center justify-center transition-colors"
        >
          +
        </motion.button>
      </div>
      {isInvalid && (
        <p className="text-center text-amber-400 text-sm mb-4 font-semibold">
          Cannot set total overs below {minAllowedOvers}.
        </p>
      )}
      <button
        onClick={() => {
          if (isInvalid) return;
          onUpdate({ overs: Number(overs) });
          onClose();
        }}
        disabled={isInvalid}
        className="w-full py-3 text-lg bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition-all active:scale-95 disabled:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Save Changes
      </button>
    </ModalBase>
  );
}
