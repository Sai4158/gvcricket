"use client";

import { motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import { Ball } from "./MatchBallHistory";

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
  const options =
    title === "Wide"
      ? [0, 1]
      : title === "OUT"
      ? [0, 1, 2, 3]
      : [0, 1, 2, 3, 4, 6];

  return (
    <ModalBase title={title} onExit={onClose}>
      <p className="text-zinc-300 text-center mb-6 font-semibold">
        {title === "OUT"
          ? "How many runs were completed on the wicket?"
          : `How many runs should be added for this ${title.toLowerCase()}?`}
      </p>
      <div className="flex flex-col items-center gap-3">
        {options.map((runs) => (
          <motion.button
            whileTap={{ scale: 0.95 }}
            key={runs}
            onClick={() => onConfirm(runs)}
            className="w-full py-4 rounded-full text-2xl font-bold transition-transform text-white bg-zinc-800 hover:bg-zinc-700"
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
