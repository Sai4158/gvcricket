"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaInfoCircle } from "react-icons/fa";
import { countLegalBalls } from "../../lib/match-scoring";
import { getBattingTeamBundle } from "../../lib/team-utils";

export function Splash({ children }) {
  return (
    <main className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white text-xl">
      {children}
    </main>
  );
}

export function AccessGate({ onSubmit, isSubmitting, error }) {
  const [pin, setPin] = useState("");

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4">
      <div className="w-full max-w-sm bg-zinc-900 p-8 rounded-2xl ring-1 ring-white/10 shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-3">Umpire Access</h1>
        <p className="text-zinc-400 text-center mb-6">
          Enter the server PIN to unlock match controls.
        </p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit(pin);
          }}
          className="w-full p-4 text-center text-2xl tracking-[1rem] rounded-lg bg-zinc-800 ring-1 ring-zinc-700 focus:ring-blue-500 outline-none text-white"
          placeholder="----"
        />
        {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
        <button
          onClick={() => onSubmit(pin)}
          disabled={isSubmitting}
          className="w-full mt-6 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-60"
        >
          {isSubmitting ? "Checking..." : "Enter"}
        </button>
      </div>
    </main>
  );
}

export function MatchHeader({ match }) {
  const battingTeam = getBattingTeamBundle(match);

  return (
    <header className="text-center mb-6">
      <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
        Umpire View
      </h1>
      <br />
      <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
        <span className="font-bold text-amber-300">{battingTeam.name}</span> is
        batting now
      </h2>
      {match.innings === "second" && (
        <p className="text-zinc-400 text-lg mt-1">
          Target: <span className="font-bold text-amber-300">{match.innings1.score + 1}</span>
        </p>
      )}
    </header>
  );
}

export function Scoreboard({ match, history }) {
  const legalBalls = countLegalBalls(history);
  const oversDisplay = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const battingTeam = getBattingTeamBundle(match);

  return (
    <div className="grid grid-cols-2 gap-4 text-center mb-6 bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10">
      <div>
        <div className="text-6xl font-bold text-white">
          {match.score}
          <span className="text-4xl text-rose-500">/{match.outs}</span>
        </div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          Score / Wickets <strong>({battingTeam.players.length})</strong>
        </div>
      </div>
      <div>
        <div className="text-6xl font-bold text-white">{oversDisplay}</div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          Overs <strong>({match.overs})</strong>
        </div>
      </div>
    </div>
  );
}

export function Ball({ ball, ballNumber }) {
  let style = "bg-zinc-700";
  let label = ball.runs;

  if (ball.isOut) {
    style = "bg-rose-600";
    label = ball.runs > 0 ? `${ball.runs}+W` : "W";
  } else if (ball.extraType === "wide") {
    style = "bg-green-600";
    label = `${ball.runs}Wd`;
  } else if (ball.extraType === "noball") {
    style = "bg-orange-600";
    label = `${ball.runs}NB`;
  } else if (ball.runs === 0) {
    label = ".";
  }

  return (
    <div className="flex flex-col items-center gap-2 w-10">
      <div
        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md ${style}`}
      >
        {label}
      </div>
      <span className="text-xs font-semibold text-zinc-400">{ballNumber}</span>
    </div>
  );
}

export function BallTracker({ history }) {
  const trackerRef = useRef(null);
  const currentOver = history.at(-1) ?? { overNumber: 1, balls: [] };

  useEffect(() => {
    if (trackerRef.current) {
      trackerRef.current.scrollLeft = trackerRef.current.scrollWidth;
    }
  }, [currentOver.balls.length]);

  return (
    <div className="bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10 mb-6">
      <h3 className="font-bold text-white text-center mb-4">
        Over {currentOver.overNumber}
      </h3>
      <div
        ref={trackerRef}
        className="flex items-start min-h-[4rem] gap-4 overflow-x-auto pb-2 pr-2"
      >
        <AnimatePresence>
          {currentOver.balls.map((ball, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Ball ball={ball} ballNumber={index + 1} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

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
