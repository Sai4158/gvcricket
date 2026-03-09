"use client";

import { motion } from "framer-motion";
import { FaInfoCircle } from "react-icons/fa";

function ScoreButton({ onClick, disabled, className, children }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
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
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {children}
      </motion.button>
      <button
        onPointerDown={(event) => {
          event.stopPropagation();
          setInfoText(info);
        }}
        onPointerUp={() => setTimeout(() => setInfoText(null), 2000)}
        className="absolute top-1 right-1 w-6 h-6 bg-black/20 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
      >
        <FaInfoCircle size={12} />
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
    "py-6 text-xl font-bold rounded-2xl transition-transform active:scale-95 shadow-lg w-full disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="grid grid-cols-4 gap-3">
      <ScoreButton
        onClick={() => onScore(0)}
        disabled={disabled}
        className={`${baseBtn} bg-zinc-800 hover:bg-zinc-700`}
      >
        Dot
      </ScoreButton>
      {[1, 2, 3, 4, 6].map((runs) => (
        <ScoreButton
          key={runs}
          onClick={() => onScore(runs)}
          disabled={disabled}
          className={`${baseBtn} bg-zinc-800 hover:bg-zinc-700`}
        >
          {runs}
        </ScoreButton>
      ))}
      <ButtonWithInfo
        info="A dismissal. Specify runs completed in the next step."
        setInfoText={setInfoText}
        onClick={onOut}
        disabled={disabled}
        className={`${baseBtn} bg-rose-700 hover:bg-rose-600`}
      >
        OUT
      </ButtonWithInfo>
      <ButtonWithInfo
        info="A wide adds runs but does not count as a legal ball."
        setInfoText={setInfoText}
        onClick={onWide}
        disabled={disabled}
        className={`${baseBtn} bg-green-600 hover:bg-green-500`}
      >
        WIDE
      </ButtonWithInfo>
      <ButtonWithInfo
        info="A no ball adds runs but does not count as a legal ball."
        setInfoText={setInfoText}
        onClick={onNoBall}
        disabled={disabled}
        className={`${baseBtn} bg-orange-600 hover:bg-orange-500`}
      >
        NO BALL
      </ButtonWithInfo>
    </div>
  );
}

export function ActionButton({ onClick, icon, label, colorClass, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-2 p-2 text-zinc-300 hover:text-white transition w-24 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className={`text-4xl ${colorClass}`}>{icon}</div>
      <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
    </motion.button>
  );
}
