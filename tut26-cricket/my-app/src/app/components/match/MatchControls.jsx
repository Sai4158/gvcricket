"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: Controls, ActionButton.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { motion } from "framer-motion";
import { FaInfoCircle } from "react-icons/fa";
import {
  getScoreControlToneClasses,
  scoreControlFont,
} from "./score-control-theme";

function ScoreButton({ onClick, disabled, className, children }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92, y: 2 }}
      onClick={onClick}
      disabled={disabled}
      className={`press-feedback ${className}`}
    >
      <span
        className={`${scoreControlFont.className} inline-flex origin-center scale-[1.08] items-center justify-center whitespace-nowrap text-[1.45rem] font-bold leading-none`}
      >
        {children}
      </span>
    </motion.button>
  );
}

function ButtonWithInfo({
  children,
  info,
  setInfoText,
  disabled,
  className,
  onClick,
}) {
  return (
    <div className="relative flex-1 col-span-2">
      <motion.button
        whileTap={{ scale: 0.92, y: 2 }}
        onClick={onClick}
        disabled={disabled}
        className={`press-feedback pr-12 ${className}`}
      >
        <span
          className={`${scoreControlFont.className} inline-flex origin-center scale-[1.08] items-center justify-center whitespace-nowrap text-[1.45rem] font-bold leading-none`}
        >
          {children}
        </span>
      </motion.button>
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setInfoText(info);
        }}
        aria-label="Show scoring help"
        className="press-feedback absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/30 text-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.25)] transition-colors hover:bg-black/40 hover:text-white"
      >
        <FaInfoCircle size={13} />
      </button>
    </div>
  );
}

export function Controls({
  onScore,
  onOut,
  onNoBall,
  onWide,
  setInfoText,
  disabled,
}) {
  const baseBtn =
    "py-6 rounded-2xl transition-transform active:scale-95 shadow-lg w-full disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="grid grid-cols-4 gap-3">
      <ScoreButton
        onClick={() => onScore(0)}
        disabled={disabled}
        className={`${baseBtn} ${getScoreControlToneClasses("dot")}`}
      >
        Dot
      </ScoreButton>
      {[
        { key: "one", runs: 1 },
        { key: "two", runs: 2 },
        { key: "three", runs: 3 },
        { key: "four", runs: 4 },
        { key: "six", runs: 6 },
      ].map(({ key, runs }) => (
        <ScoreButton
          key={key}
          onClick={() => onScore(runs)}
          disabled={disabled}
          className={`${baseBtn} ${getScoreControlToneClasses("neutral")}`}
        >
          {runs}
        </ScoreButton>
      ))}
      <ButtonWithInfo
        info="A dismissal. Specify runs completed in the next step."
        setInfoText={setInfoText}
        onClick={onOut}
        disabled={disabled}
        className={`${baseBtn} ${getScoreControlToneClasses("out")}`}
      >
        OUT
      </ButtonWithInfo>
      <ButtonWithInfo
        info="A wide adds runs but does not count as a legal ball."
        setInfoText={setInfoText}
        onClick={onWide}
        disabled={disabled}
        className={`${baseBtn} ${getScoreControlToneClasses("wide")}`}
      >
        WIDE
      </ButtonWithInfo>
      <ButtonWithInfo
        info="A no ball adds runs but does not count as a legal ball."
        setInfoText={setInfoText}
        onClick={onNoBall}
        disabled={disabled}
        className={`${baseBtn} ${getScoreControlToneClasses("noball")}`}
      >
        NO BALL
      </ButtonWithInfo>
    </div>
  );
}

export function ActionButton({ onClick, icon, label, colorClass, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92, y: 2 }}
      onClick={onClick}
      disabled={disabled}
      className="press-feedback flex flex-col items-center justify-center gap-2 p-2 text-zinc-300 hover:text-white transition w-24 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className={`text-4xl ${colorClass}`}>{icon}</div>
      <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
    </motion.button>
  );
}


