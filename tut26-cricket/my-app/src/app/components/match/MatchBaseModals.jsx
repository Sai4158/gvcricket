"use client";

import { motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import { Ball } from "./MatchBallHistory";
import MatchImageUploader from "./MatchImageUploader";

export function ModalBase({ children, title, onExit }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onExit}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="relative bg-zinc-900 p-6 rounded-2xl max-w-sm w-full border border-zinc-700 shadow-2xl shadow-black"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-4 text-center text-white">{title}</h2>
        {children}
        <button
          onClick={onExit}
          className="absolute top-3 right-3 p-2 text-zinc-500 hover:text-white rounded-full transition-colors"
          aria-label="Close modal"
        >
          <FaTimes size={20} />
        </button>
      </motion.div>
    </motion.div>
  );
}

export function RunInputModal({ title, onConfirm, onClose }) {
  const config =
    title === "OUT"
      ? {
          options: [0, 1, 2, 3],
          prompt: "How many runs were taken (run out)?",
          helper: "",
          activeClass: "bg-rose-600 hover:bg-rose-500",
        }
      : title === "Wide"
      ? {
          options: [0, 1],
          prompt: "How many runs to add for this wide ball?",
          helper: "Ball does not count",
          activeClass: "bg-emerald-600 hover:bg-emerald-500",
        }
      : {
          options: [0, 1, 2, 3, 4, 6],
          prompt: "How many runs to add for this No Ball?",
          helper: "Ball does not count",
          activeClass: "bg-orange-600 hover:bg-orange-500",
        };

  return (
    <ModalBase title={title} onExit={onClose}>
      <div className="mb-6 text-center">
        <p className="font-semibold text-zinc-300">{config.prompt}</p>
        {config.helper ? (
          <p className="mt-2 text-sm text-zinc-400">{config.helper}</p>
        ) : null}
      </div>
      <div className="flex flex-col items-center gap-3">
        {config.options.map((runs, index) => (
          <motion.button
            whileTap={{ scale: 0.95 }}
            key={runs}
            onClick={() => onConfirm(runs)}
            className={`w-full rounded-full py-4 text-2xl font-bold text-white transition-transform ${
              index === 0 ? config.activeClass : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            {runs}
          </motion.button>
        ))}
      </div>
    </ModalBase>
  );
}

export function HistoryModal({ history, onClose }) {
  return (
    <ModalBase title="Over History" onExit={onClose}>
      <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2 text-left">
        {history.length > 0 ? (
          [...history].reverse().map((over) => (
            <div key={over.overNumber}>
              <p className="font-semibold text-zinc-200">Over {over.overNumber}</p>
              <div className="flex gap-2 flex-wrap mt-1">
                {over.balls.map((ball, index) => (
                  <Ball key={index} ball={ball} ballNumber={index + 1} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-zinc-500 text-center">No history yet.</p>
        )}
      </div>
    </ModalBase>
  );
}

export function RulesModal({ onClose }) {
  return (
    <ModalBase title="Scoring Rules" onExit={onClose}>
      <div className="space-y-3 text-left text-zinc-300">
        <p>Six legal balls complete an over. Wides and no balls do not.</p>
        <p>The innings ends when overs are completed or all players are out.</p>
        <p>Undo restores the previous saved state without changing old history.</p>
      </div>
    </ModalBase>
  );
}

export function InningsEndModal({ match, onNext }) {
  return (
    <ModalBase
      title={match.result ? "Match Over" : "Innings Over"}
      onExit={onNext}
    >
      <p className="text-2xl mb-2 text-center">
        Final Score:{" "}
        <strong className="text-amber-300">
          {match.score} / {match.outs}
        </strong>
      </p>
      {match.result && (
        <p className="text-lg text-green-400 font-bold mb-6 text-center">
          {match.result}
        </p>
      )}
      <button
        onClick={onNext}
        className="mt-6 w-full py-3 text-lg bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition"
      >
        {match.innings === "first" && !match.result
          ? "Start Second Innings"
          : "View Final Results"}
      </button>
    </ModalBase>
  );
}

export function MatchImageModal({ match, onUploaded, onClose }) {
  return (
    <ModalBase
      title={match?.matchImageUrl ? "Replace Match Image" : "Add Match Image"}
      onExit={onClose}
    >
      <MatchImageUploader
        matchId={String(match._id)}
        existingImageUrl={match?.matchImageUrl || ""}
        onUploaded={(updatedMatch) => {
          onUploaded(updatedMatch);
          onClose();
        }}
        title={match?.matchImageUrl ? "Replace the current image" : "Upload a match image"}
        description="Upload a team photo, ground photo, poster, or winning team picture. Safe raster images only."
        primaryLabel={match?.matchImageUrl ? "Replace Image" : "Upload Image"}
      />
    </ModalBase>
  );
}
