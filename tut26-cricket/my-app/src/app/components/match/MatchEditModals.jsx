"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { syncTeamNamesAcrossMatch } from "../../lib/match-scoring";
import { getTeamBundle } from "../../lib/team-utils";
import { ModalBase } from "./MatchBaseModals";

function EditableRoster({ title, name, setName, players, setPlayers }) {
  const updatePlayer = (index, nextValue) => {
    setPlayers((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? nextValue : player
      )
    );
  };

  return (
    <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700 space-y-3">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Team name"
        className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-900 border border-zinc-700 outline-none transition"
      />
      {players.map((player, index) => (
        <input
          key={`${title}-${index}`}
          type="text"
          value={player}
          onChange={(event) => updatePlayer(index, event.target.value)}
          placeholder={`Player ${index + 1}`}
          className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-900 border border-zinc-700 outline-none transition"
        />
      ))}
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

  const handleSaveChanges = () => {
    const nextNames = {
      teamAName: teamAName.trim(),
      teamBName: teamBName.trim(),
    };

    const previousNames = {
      teamAName: initialTeamA.name,
      teamBName: initialTeamB.name,
    };

    const updatedMatch = syncTeamNamesAcrossMatch(match, previousNames, nextNames);

    onUpdate({
      teamAName: nextNames.teamAName,
      teamBName: nextNames.teamBName,
      teamA: teamAPlayers.map((player) => player.trim()).filter(Boolean),
      teamB: teamBPlayers.map((player) => player.trim()).filter(Boolean),
      innings1: updatedMatch.innings1,
      innings2: updatedMatch.innings2,
      tossWinner: updatedMatch.tossWinner,
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
        />
        <EditableRoster
          title="Team B"
          name={teamBName}
          setName={setTeamBName}
          players={teamBPlayers}
          setPlayers={setTeamBPlayers}
        />
      </div>
      <button
        onClick={handleSaveChanges}
        className="mt-6 w-full py-3 text-lg bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition-all active:scale-95"
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
