"use client";

import { motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import LoadingButton from "../shared/LoadingButton";
import { Ball } from "./MatchBallHistory";
import MatchImageUploader from "./MatchImageUploader";

export function ModalBase({
  children,
  title,
  onExit,
  hideHeader = false,
  panelClassName = "",
  bodyClassName = "",
}) {
  const panelClasses = [
    "relative max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black",
    "max-w-sm",
    panelClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const bodyClasses = [
    "overflow-y-auto px-5 pb-5",
    hideHeader ? "pt-5" : "max-h-[calc(100vh-7.5rem)] pt-4",
    bodyClassName,
  ]
    .filter(Boolean)
    .join(" ");

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
        className={panelClasses}
        onClick={(event) => event.stopPropagation()}
      >
        {!hideHeader ? (
          <div className="sticky top-0 z-10 border-b border-white/6 bg-zinc-900/95 px-5 pb-3 pt-5 backdrop-blur">
            <h2 className="text-center text-2xl font-bold text-white">{title}</h2>
          </div>
        ) : null}
        <div className={bodyClasses}>
          {children}
        </div>
        {!hideHeader ? (
          <button
            onClick={onExit}
            className="press-feedback absolute right-3 top-3 z-20 rounded-full p-2 text-zinc-500 transition-colors hover:text-white"
            aria-label="Close modal"
          >
            <FaTimes size={20} />
          </button>
        ) : null}
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
          prompt: "Tap the total runs to add for this wide.",
          helper: "",
          activeClass: "bg-emerald-600 hover:bg-emerald-500",
        }
      : {
          options: [0, 1, 2, 3, 4, 6],
          prompt: "Tap the total runs to add for this no ball.",
          helper: "",
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

function HistorySection({ title, history }) {
  if (!history?.length) {
    return null;
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-400">
          {title}
        </h3>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-300">
          {history.length} over{history.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-4">
        {[...history].reverse().map((over) => (
          <div
            key={`${title}-${over.overNumber}`}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
          >
            <p className="font-semibold text-zinc-100">Over {over.overNumber}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {over.balls.map((ball, index) => (
                <Ball key={index} ball={ball} ballNumber={index + 1} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HistoryModal({ match, onClose }) {
  const innings1History = match?.innings1?.history ?? [];
  const innings2History = match?.innings2?.history ?? [];

  return (
    <ModalBase title="Over History" onExit={onClose}>
      <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2 text-left">
        {innings1History.length > 0 || innings2History.length > 0 ? (
          <>
            <HistorySection
              title={match?.innings1?.team || "Innings 1"}
              history={innings1History}
            />
            {innings2History.length > 0 ? (
              <HistorySection
                title={match?.innings2?.team || "Innings 2"}
                history={innings2History}
              />
            ) : null}
          </>
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
      <LoadingButton
        onClick={onNext}
        pendingLabel={match.innings === "first" && !match.result ? "Opening..." : "Loading result..."}
        className="mt-6 w-full py-3 text-lg bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition"
      >
        {match.innings === "first" && !match.result
          ? "Start Second Innings"
          : "View Final Results"}
      </LoadingButton>
    </ModalBase>
  );
}

export function MatchImageModal({ match, onUploaded, onClose }) {
  return (
    <ModalBase
      title={match?.matchImageUrl ? "Replace Match Image" : "Add Match Image"}
      onExit={onClose}
      panelClassName="max-w-md"
      bodyClassName="max-h-[calc(100vh-7rem)]"
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
