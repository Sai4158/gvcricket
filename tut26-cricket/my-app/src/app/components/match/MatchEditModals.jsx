"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: EditTeamsModal, EditOversModal.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import { useState } from "react";
import { motion } from "framer-motion";
import { FaMinus, FaPen, FaPlus, FaTrash } from "react-icons/fa";
import LoadingButton from "../shared/LoadingButton";
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
  const [isExpanded, setIsExpanded] = useState(false);
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
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
          >
            {isExpanded ? "Close" : "Open"}
          </button>
        </div>
      </div>

      {!canEditPlayers && lockedReason ? (
        <p className="rounded-[18px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(120,53,15,0.28),rgba(70,32,10,0.18))] px-3 py-2.5 text-sm text-amber-200">
          {lockedReason}
        </p>
      ) : null}

      {isExpanded ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}

export function EditTeamsModal({ match, onUpdate, onClose, isUpdating = false }) {
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

  const handleSaveChanges = async () => {
    await onUpdate({
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
      <LoadingButton
        onClick={handleSaveChanges}
        loading={isUpdating}
        pendingLabel="Saving..."
        className="mt-6 w-full rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,185,90,0.96),rgba(22,163,74,0.98))] py-3.5 text-base font-semibold tracking-tight text-white shadow-[0_18px_36px_rgba(22,163,74,0.24)] transition-all hover:brightness-105 active:scale-[0.99]"
      >
        Save Changes
      </LoadingButton>
    </ModalBase>
  );
}

export function EditOversModal({
  currentOvers,
  currentLegalBalls,
  currentOverNumber,
  innings,
  firstInningsOversPlayed,
  currentFirstInningsScore = 0,
  firstInningsTeamName = "",
  currentSecondInningsScore = 0,
  onUpdate,
  onClose,
  isUpdating = false,
}) {
  const [overs, setOvers] = useState(currentOvers);
  const [firstInningsScore, setFirstInningsScore] = useState(currentFirstInningsScore);
  const isSecondInningsEditor = innings === "second";
  const firstInningsMinScore = Math.max(
    0,
    Number(currentFirstInningsScore || 0) - 7
  );
  const firstInningsMaxScore = Math.max(
    firstInningsMinScore,
    Number(currentFirstInningsScore || 0) + 7
  );
  const clampFirstInningsScore = (value) =>
    Math.min(
      firstInningsMaxScore,
      Math.max(firstInningsMinScore, Number(value) || 0)
    );
  const nextOvers = Number(overs) || 0;
  const nextFirstInningsScore = isSecondInningsEditor
    ? clampFirstInningsScore(firstInningsScore)
    : Math.max(0, Number(firstInningsScore) || 0);
  const minAllowedOvers =
    innings === "first"
      ? Math.max(1, currentOverNumber)
      : Math.max(1, firstInningsOversPlayed, currentOverNumber);
  const isInvalid = nextOvers < minAllowedOvers;
  const isShortened = nextOvers < currentOvers;
  const nextTotalBalls = nextOvers * 6;
  const ballsLeftAfterSave = Math.max(0, nextTotalBalls - currentLegalBalls);
  const willEndNow = !isInvalid && isShortened && ballsLeftAfterSave === 0;
  const inningsLabel = innings === "second" ? "match" : "innings";
  const ballsLabel =
    ballsLeftAfterSave === 1 ? "1 ball" : `${ballsLeftAfterSave} balls`;
  const oversLabel =
    ballsLeftAfterSave > 0
      ? `${Math.floor(ballsLeftAfterSave / 6)}.${ballsLeftAfterSave % 6} overs`
      : "0.0 overs";
  const shouldShowShortenWarning = !isInvalid && isShortened;
  const shortenWarningText = willEndNow
    ? `Saving this will end the ${inningsLabel} now.`
    : innings === "second"
    ? `Saving this leaves ${ballsLabel} (${oversLabel}) before the match ends on overs if the target is not reached sooner.`
    : `Saving this leaves ${ballsLabel} (${oversLabel}) before the innings ends on overs.`;
  const saveLabel = willEndNow
    ? innings === "second"
      ? "Save And End Match"
      : "Save And End Innings"
    : "Save Changes";
  const nextTarget = nextFirstInningsScore + 1;
  const nextRunsNeeded = Math.max(0, nextTarget - Number(currentSecondInningsScore || 0));
  const firstInningsChanged =
    nextFirstInningsScore !== Number(currentFirstInningsScore || 0);
  const oversChanged = nextOvers !== Number(currentOvers || 0);
  const shouldShowTargetReachedWarning =
    isSecondInningsEditor &&
    Number(currentSecondInningsScore || 0) > nextFirstInningsScore &&
    firstInningsChanged;
  const modalTitle = isSecondInningsEditor
    ? "Edit Overs / Innings"
    : "Edit Match Overs";

  return (
    <ModalBase title={modalTitle} onExit={onClose}>
      <div className="mb-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Match overs
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          Adjust the total overs limit for this {innings === "second" ? "chase" : "innings"}.
        </p>
      </div>
      <div className="my-6 flex items-center justify-between rounded-2xl bg-zinc-800 p-2">
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
      {isSecondInningsEditor ? (
        <div className="mb-6 rounded-[24px] border border-amber-300/16 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_38%),linear-gradient(180deg,rgba(33,24,12,0.98),rgba(15,12,10,0.99))] p-4 shadow-[0_18px_36px_rgba(120,53,15,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/70">
                1st innings
              </p>
              <p className="mt-1 text-base font-semibold uppercase tracking-[0.08em] text-white">
                {firstInningsTeamName || "First innings"}
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-amber-100/70">
                Limit {firstInningsMinScore} to {firstInningsMaxScore}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/16 bg-amber-500/10 px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/70">
                Target
              </p>
              <p className="mt-1 text-xl font-bold text-amber-200">{nextTarget}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 p-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() =>
                setFirstInningsScore((value) =>
                  clampFirstInningsScore((Number(value) || 0) - 1)
                )
              }
              disabled={nextFirstInningsScore <= firstInningsMinScore}
              className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-700 text-3xl transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              -
            </motion.button>
            <input
              type="number"
              value={firstInningsScore}
              onChange={(event) =>
                setFirstInningsScore(
                  event.target.value === ""
                    ? ""
                    : clampFirstInningsScore(Number(event.target.value))
                )
              }
              min={firstInningsMinScore}
              max={firstInningsMaxScore}
              className="h-20 w-32 bg-transparent text-center text-5xl font-bold text-white outline-none"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() =>
                setFirstInningsScore((value) =>
                  clampFirstInningsScore((Number(value) || 0) + 1)
                )
              }
              disabled={nextFirstInningsScore >= firstInningsMaxScore}
              className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-700 text-3xl transition-colors hover:bg-zinc-600"
            >
              +
            </motion.button>
          </div>
          <p className="mt-3 text-sm text-zinc-300">
            {nextRunsNeeded > 0
              ? `${nextRunsNeeded} to win`
              : "Target reached"}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Max change: +/-7
          </p>
        </div>
      ) : null}
      {isInvalid && (
        <p className="text-center text-amber-400 text-sm mb-4 font-semibold">
          Cannot set total overs below {minAllowedOvers}.
        </p>
      )}
      {shouldShowTargetReachedWarning ? (
        <div className="mb-4 rounded-[22px] border border-emerald-400/22 bg-[linear-gradient(180deg,rgba(4,120,87,0.24),rgba(6,78,59,0.16))] px-4 py-3 text-left">
          <p className="text-sm font-semibold text-emerald-100">
            Saving this will complete the chase immediately with the corrected target.
          </p>
        </div>
      ) : null}
      {shouldShowShortenWarning ? (
        <div
          className={`mb-4 rounded-[22px] border px-4 py-3 text-left ${
            willEndNow
              ? "border-rose-400/25 bg-[linear-gradient(180deg,rgba(127,29,29,0.28),rgba(68,12,12,0.2))]"
              : "border-amber-400/20 bg-[linear-gradient(180deg,rgba(113,63,18,0.24),rgba(68,40,10,0.16))]"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              willEndNow ? "text-rose-100" : "text-amber-100"
            }`}
          >
            {shortenWarningText}
          </p>
          <p className="mt-1 text-xs text-zinc-300">
            Current progress: {Math.floor(currentLegalBalls / 6)}.
            {currentLegalBalls % 6} overs bowled.
          </p>
        </div>
      ) : null}
      <LoadingButton
        onClick={async () => {
          if (isInvalid) return;
          const patch = {};
          if (oversChanged) {
            patch.overs = nextOvers;
          }
          if (isSecondInningsEditor && firstInningsChanged) {
            patch.innings1Score = nextFirstInningsScore;
          }
          if (!Object.keys(patch).length) {
            onClose();
            return;
          }
          await onUpdate(patch);
          onClose();
        }}
        disabled={isInvalid}
        loading={isUpdating}
        pendingLabel="Saving..."
        className="w-full py-3 text-lg bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition-all active:scale-95 disabled:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saveLabel}
      </LoadingButton>
    </ModalBase>
  );
}


