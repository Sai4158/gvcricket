"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: ModalBase, RunInputModal, HistoryModal, RulesModal, InningsEndModal, MatchImageModal.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import { motion } from "framer-motion";
import { FaTimes, FaUndoAlt } from "react-icons/fa";
import LiquidSportText from "../home/LiquidSportText";
import LoadingButton from "../shared/LoadingButton";
import ModalGradientTitle from "../shared/ModalGradientTitle";
import { Ball, buildBallSlotLabels } from "./MatchBallHistory";
import MatchImageUploader from "./MatchImageUploader";
import { countLegalBalls } from "../../lib/match-scoring";

function parseWinnerName(resultText) {
  const result = String(resultText || "").trim();
  const match = result.match(/^(.+?) won by /i);
  return match ? match[1] : "";
}

function formatRequiredRunRateDisplay(target, overs) {
  const safeTarget = Number(target || 0);
  const safeOvers = Number(overs || 0);

  if (safeTarget <= 0 || safeOvers <= 0) {
    return "—";
  }

  const requiredRate = safeTarget / safeOvers;
  if (!Number.isFinite(requiredRate) || requiredRate <= 0) {
    return "—";
  }

  if (requiredRate < 1) {
    return "Under 1";
  }

  return requiredRate.toFixed(2);
}

export function ModalBase({
  children,
  title,
  onExit,
  hideHeader = false,
  closeOnBackdrop = true,
  showCloseButton = Boolean(!hideHeader && onExit),
  headerLeading = null,
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
      onClick={closeOnBackdrop && onExit ? onExit : undefined}
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
            {headerLeading ? (
              <div className="flex items-center gap-3 pr-2">
                <div className="shrink-0">
                  {headerLeading}
                </div>
                <ModalGradientTitle
                  as="h2"
                  text={String(title || "").toUpperCase()}
                  className="min-w-0 text-left text-2xl font-bold leading-none"
                />
              </div>
            ) : (
              <ModalGradientTitle
                as="h2"
                text={String(title || "").toUpperCase()}
                className="text-center text-2xl font-bold"
              />
            )}
          </div>
        ) : null}
        <div className={bodyClasses}>
          {children}
        </div>
        {!hideHeader && showCloseButton ? (
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
        {[...history].reverse().map((over) => {
          const ballSlotLabels = buildBallSlotLabels(over.balls || []);

          return (
            <div
              key={`${title}-${over.overNumber}`}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <p className="font-semibold text-zinc-100">Over {over.overNumber}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(over.balls || []).map((ball, index) => (
                  <Ball
                    key={index}
                    ball={ball}
                    ballNumber={ballSlotLabels[index] || "•"}
                  />
                ))}
              </div>
            </div>
          );
        })}
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

export function InningsEndModal({
  match,
  onNext,
  onUndo,
  undoDisabled = false,
}) {
  const isFirstInningsBreak = match.innings === "first" && !match.result;
  const firstInningsTeam = match?.innings1?.team || "Innings 1";
  const firstInningsScore = Number(match?.score || 0);
  const firstInningsOuts = Number(match?.outs || 0);
  const target = firstInningsScore + 1;
  const firstInningsLegalBalls = countLegalBalls(match?.innings1?.history || []);
  const firstInningsOvers =
    firstInningsLegalBalls > 0
      ? `${Math.floor(firstInningsLegalBalls / 6)}.${firstInningsLegalBalls % 6}`
      : "0.0";
  const inningsOvers = Number(match?.overs || 0);
  const requiredRunRate = formatRequiredRunRateDisplay(target, inningsOvers);
  const winnerName = parseWinnerName(match?.result);
  const confettiPieces = [
    "left-[8%] top-5 bg-emerald-400/80",
    "left-[18%] top-10 bg-cyan-300/80",
    "left-[30%] top-4 bg-amber-300/85",
    "left-[42%] top-11 bg-rose-400/80",
    "right-[32%] top-6 bg-violet-400/80",
    "right-[20%] top-12 bg-sky-300/80",
    "right-[10%] top-5 bg-orange-300/85",
  ];

  return (
    <ModalBase
      title={match.result ? "Match Over" : "Innings Over"}
      onExit={undefined}
      closeOnBackdrop={false}
      showCloseButton={false}
      headerLeading={
        typeof onUndo === "function" ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={undoDisabled}
            aria-label="Undo the last ball"
            className={`press-feedback inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              undoDisabled
                ? "cursor-not-allowed border-white/8 bg-white/4 text-zinc-500"
                : "border-white/10 bg-white/8 text-white hover:bg-white/12"
            }`}
          >
            <FaUndoAlt className="text-[0.78rem]" />
            <span>Undo</span>
          </button>
        ) : null
      }
      panelClassName="max-w-md"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_26%),linear-gradient(180deg,rgba(18,18,24,0.98),rgba(9,10,14,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_28%)]" />
        {match.result
          ? confettiPieces.map((pieceClass, index) => (
              <motion.span
                key={pieceClass}
                className={`pointer-events-none absolute h-2.5 w-2.5 rounded-full ${pieceClass}`}
                animate={{ y: [0, 18, 0], rotate: [0, index % 2 === 0 ? 16 : -16, 0], opacity: [0.65, 1, 0.72] }}
                transition={{ duration: 2.8 + index * 0.18, repeat: Infinity, ease: "easeInOut" }}
              />
            ))
          : null}

        <div className="relative z-10 text-center">
          {match.result ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/78">
                Winning Result
              </p>
              <LiquidSportText
                as="h3"
                text={String(winnerName || "MATCH WON").toUpperCase()}
                variant="hero-bright"
                simplifyMotion
                className="mt-3 text-[2rem] font-black tracking-[-0.05em] sm:text-[2.3rem]"
              />
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                {match.result}
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/78">
                Second Innings Ready
              </p>
              <LiquidSportText
                as="h3"
                text={`TARGET ${target}`}
                variant="hero-bright"
                simplifyMotion
                className="mt-3 text-[1.95rem] font-black tracking-[-0.05em] sm:text-[2.2rem]"
              />
              <p className="mt-1 text-base font-medium text-cyan-200">
                {firstInningsTeam} posted {firstInningsScore}/{firstInningsOuts}
              </p>
            </>
          )}

          <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {match.result ? "Final Score" : "Innings 1 Summary"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-300">
              {match.score} / {match.outs}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {isFirstInningsBreak
                ? `${firstInningsOvers} overs · ${firstInningsOuts} down`
                : winnerName
                ? `${winnerName} closed the chase in style.`
                : "The match result is locked in."}
            </p>
          </div>

          {isFirstInningsBreak ? (
            <div className="mt-3 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-[20px] border border-emerald-300/14 bg-[linear-gradient(180deg,rgba(6,95,70,0.16),rgba(12,18,22,0.92))] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/76">
                  Runs To Win
                </p>
                <p className="mt-1 text-xl font-semibold text-white">{target}</p>
                <p className="mt-1 text-xs text-zinc-400">Need {target} for the win</p>
              </div>
              <div className="rounded-[20px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(8,47,73,0.16),rgba(12,18,22,0.92))] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/76">
                  Req. Rate
                </p>
                <p className="mt-1 text-xl font-semibold text-white">{requiredRunRate}</p>
                <p className="mt-1 text-xs text-zinc-400">Per over to chase</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <LoadingButton
        onClick={onNext}
        pendingLabel={match.innings === "first" && !match.result ? "Opening..." : "Loading result..."}
        className="mt-5 w-full rounded-[22px] border border-emerald-300/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.96),rgba(5,150,105,0.96))] py-3.5 text-lg font-bold text-white shadow-[0_18px_32px_rgba(5,150,105,0.18)] transition hover:brightness-105"
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
      onExit={undefined}
      hideHeader
      panelClassName="max-w-md"
      bodyClassName="max-h-[calc(100vh-7rem)]"
    >
      <MatchImageUploader
        matchId={String(match._id)}
        existingImages={Array.isArray(match?.matchImages) ? match.matchImages : []}
        existingImageUrl={match?.matchImageUrl || ""}
        existingImageCount={
          Array.isArray(match?.matchImages) && match.matchImages.length
            ? match.matchImages.length
            : match?.matchImageUrl
              ? 1
              : 0
        }
        appendOnUpload={
          (Array.isArray(match?.matchImages) && match.matchImages.length > 0) ||
          Boolean(match?.matchImageUrl)
        }
        onUploaded={(updatedMatch) => {
          onUploaded(updatedMatch);
        }}
        onComplete={() => {
          onClose?.();
        }}
        onRequestClose={onClose}
        promptForUploadPin
        title={match?.matchImageUrl ? "Replace Match Image" : "Add Match Image"}
        description="Manage match images."
        primaryLabel={match?.matchImageUrl ? "Save Images" : "Upload Images"}
      />
    </ModalBase>
  );
}


