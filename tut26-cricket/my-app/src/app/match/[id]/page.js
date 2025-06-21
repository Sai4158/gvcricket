/* ------------------------------------------------------------------
    src/app/match/[id]/page.jsx – (Final Corrected Version)
-------------------------------------------------------------------*/
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBookOpen,
  FaShareAlt,
  FaTimes,
  FaUserEdit,
  FaRegClock,
  FaInfoCircle,
  FaPlus,
  FaMinus,
  FaCheck,
  FaTrash,
} from "react-icons/fa";
import { LuUndo2 } from "react-icons/lu";

// --- Haptic Feedback Utility ---
const triggerHapticFeedback = () => {
  if (typeof window !== "undefined" && navigator.vibrate) {
    navigator.vibrate(50);
  }
};

// --- Custom Hook for All Match Logic (Finalized) ---
const useMatch = (matchId) => {
  const router = useRouter();
  const fetcher = (url) => fetch(url).then((res) => res.json());
  const {
    data: match,
    error,
    isLoading,
    mutate,
  } = useSWR(matchId ? `/api/matches/${matchId}` : null, fetcher, {
    revalidateOnFocus: false,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [historyStack, setHistoryStack] = useState([]);

  const patchAndUpdate = async (payload, isUndo = false) => {
    if (!matchId || isUpdating) return;
    setIsUpdating(true);
    if (!isUndo && match) {
      setHistoryStack((prev) => [...prev, match]);
    }
    const optimisticData = { ...match, ...payload };
    try {
      await mutate(optimisticData, false);
      await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await mutate();
    } catch (e) {
      console.error("Failed to update match:", e);
      await mutate(match, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const addBallToHistory = (currentMatch, ball) => {
    const activeInningsKey =
      currentMatch.innings === "first" ? "innings1" : "innings2";
    if (!currentMatch[activeInningsKey].history) {
      currentMatch[activeInningsKey].history = [];
    }
    const history = currentMatch[activeInningsKey].history;
    let lastOver = history.at(-1);
    const isLegalBall =
      ball.extraType !== "wide" && ball.extraType !== "noball";
    const validBallsInLastOver =
      lastOver?.balls.filter(
        (b) => b.extraType !== "wide" && b.extraType !== "noball"
      ).length ?? 0;

    if (!lastOver || (validBallsInLastOver >= 6 && isLegalBall)) {
      history.push({
        overNumber: (lastOver?.overNumber ?? 0) + 1,
        balls: [ball],
      });
    } else {
      lastOver.balls.push(ball);
    }
  };

  const handleScoreEvent = (runs, isOut = false, extraType = null) => {
    if (!match || match.result) return;
    triggerHapticFeedback();
    const payload = structuredClone(match);
    const activeInningsKey =
      payload.innings === "first" ? "innings1" : "innings2";

    payload[activeInningsKey].score += runs;
    payload.score = payload[activeInningsKey].score;
    if (isOut) payload.outs++;

    const newBall = { runs, isOut, extraType };
    if (!payload.balls) payload.balls = [];
    payload.balls.push(newBall);
    addBallToHistory(payload, newBall);

    if (
      payload.innings === "second" &&
      payload.score > payload.innings1.score
    ) {
      payload.isOngoing = false;
      const battingTeamName = payload.innings2.team;
      const battingTeamArray =
        payload.teamA[0] === battingTeamName ? payload.teamA : payload.teamB;
      // ✅ FIX: "Last Man Stands" rule applied here
      const wicketsLeft = battingTeamArray.length - payload.outs;
      payload.result = `${battingTeamName} won by ${
        wicketsLeft > 0 ? wicketsLeft : 1
      } ${wicketsLeft === 1 ? "wicket" : "wickets"}.`;
    }
    patchAndUpdate(payload);
  };

  const handleUndo = async () => {
    triggerHapticFeedback();
    if (historyStack.length === 0) return;
    const lastState = historyStack.at(-1);
    setHistoryStack((prev) => prev.slice(0, -1));
    await patchAndUpdate(lastState, true);
  };

  const handleNextInningsOrEnd = () => {
    if (!match) return;
    if (match.innings === "first") {
      patchAndUpdate({
        score: 0,
        outs: 0,
        balls: [],
        innings: "second",
      });
      return;
    }

    if (match.innings === "second") {
      const firstInningsScore = match.innings1.score;
      const secondInningsScore = match.score;
      let resultText = "Match Tied";

      if (secondInningsScore > firstInningsScore) {
        const battingTeamName = match.innings2.team;
        const battingTeamArray =
          match.teamA[0] === battingTeamName ? match.teamA : match.teamB;
        // ✅ FIX: "Last Man Stands" rule applied here
        const wicketsLeft = battingTeamArray.length - match.outs;
        resultText = `${battingTeamName} won by ${wicketsLeft} ${
          wicketsLeft === 1 ? "wicket" : "wickets"
        }.`;
      } else if (firstInningsScore > secondInningsScore) {
        const runsMargin = firstInningsScore - secondInningsScore;
        resultText = `${match.innings1.team} won by ${runsMargin} ${
          runsMargin === 1 ? "run" : "runs"
        }.`;
      }
      patchAndUpdate({ isOngoing: false, result: resultText });
      router.push(`/result/${matchId}`);
    }
  };

  return {
    match,
    error,
    isLoading,
    isUpdating,
    historyStack,
    handleScoreEvent,
    handleNextInningsOrEnd,
    handleUndo,
    patchAndUpdate,
  };
};

// --- UI Sub-components ---

const Header = ({ match }) => {
  const { innings, teamA, innings1, innings2 } = match;
  const teamAName = teamA?.[0];
  const currentBattingTeam =
    innings === "first" ? innings1.team : innings2.team;
  const teamColorClass =
    currentBattingTeam === teamAName ? "text-sky-400" : "text-red-400";
  return (
    <header className="text-center mb-6">
      <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
        Umpire View
      </h1>
      <br />
      <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
        <span className={`font-bold ${teamColorClass}`}>
          {currentBattingTeam}
        </span>{" "}
        is Batting Now!
      </h1>
      {match.innings === "second" && (
        <p className="text-zinc-400 text-lg mt-1">
          Target:{" "}
          <span className="font-bold text-amber-300">
            {match.innings1.score + 1}
          </span>
        </p>
      )}
    </header>
  );
};
const Scoreboard = ({ match, history }) => {
  const legalBalls = history
    .flatMap((o) => o.balls)
    .filter((b) => b.extraType !== "wide" && b.extraType !== "noball").length;
  const oversDisplay = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const battingTeamName =
    match.innings === "first" ? match.innings1.team : match.innings2.team;
  const currentTeamArray =
    match.teamA?.[0] === battingTeamName ? match.teamA : match.teamB;
  const totalPlayers = currentTeamArray?.length || 11;
  return (
    <div className="grid grid-cols-2 gap-4 text-center mb-6 bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10">
      <div>
        <div className="text-6xl font-bold text-white">
          {match.score}
          <span className="text-4xl text-rose-500">/{match.outs}</span>
        </div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          Score / Wickets <strong>({totalPlayers})</strong>
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
};
const BallTracker = ({ history }) => {
  const trackerRef = useRef(null);
  const currentOver = history.at(-1) ?? { overNumber: 1, balls: [] };
  useEffect(() => {
    if (trackerRef.current) {
      trackerRef.current.scrollLeft = trackerRef.current.scrollWidth;
    }
  }, [currentOver.balls.length]);
  const getOrdinal = (n) => {
    if (n <= 0) return "1st";
    const s = ["th", "st", "nd", "rd"],
      v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return (
    <div className="bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10 mb-6">
      <h3 className="font-bold text-white text-center mb-4">
        {getOrdinal(currentOver.overNumber)} Over
      </h3>
      <div
        ref={trackerRef}
        className="flex items-start min-h-[4rem] gap-4 overflow-x-auto pb-2 pr-2 scrollbar-hide"
      >
        <AnimatePresence>
          {currentOver.balls.map((ball, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Ball ball={ball} ballNumber={i + 1} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
const Ball = ({ ball, ballNumber }) => {
  let style, label;
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
    style = "bg-zinc-700";
    label = "•";
  } else {
    style = "bg-zinc-700";
    label = ball.runs;
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
};
const ButtonWithInfo = ({ children, info, setInfoText, ...props }) => (
  <div className="relative flex-1 col-span-2">
    <motion.button {...props}>{children}</motion.button>
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        setInfoText(info);
      }}
      onPointerUp={() => setTimeout(() => setInfoText(null), 2000)}
      className="absolute top-1 right-1 w-6 h-6 bg-black/20 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
    >
      <FaInfoCircle size={12} />
    </button>
  </div>
);
const Controls = ({
  onScore,
  onOut,
  onNoBall,
  onWide,
  setInfoText,
  disabled,
}) => {
  const baseBtn =
    "py-6 text-xl font-bold rounded-2xl transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg w-full";
  const Button = ({ onClick, ...props }) => (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick} {...props} />
  );
  return (
    <div className="grid grid-cols-4 gap-3">
      <Button
        onClick={() => onScore(0)}
        className={`${baseBtn} bg-zinc-800 hover:bg-zinc-700`}
      >
        Dot
      </Button>
      {[1, 2, 3, 4, 6].map((r) => (
        <Button
          key={r}
          onClick={() => onScore(r)}
          className={`${baseBtn} bg-zinc-800 hover:bg-zinc-700`}
        >
          {r}
        </Button>
      ))}
      <ButtonWithInfo
        info="A dismissal. Specify runs completed in the next step."
        setInfoText={setInfoText}
        onClick={onOut}
        className={`${baseBtn} bg-rose-700 hover:bg-rose-600`}
      >
        OUT
      </ButtonWithInfo>
      <ButtonWithInfo
        info="A Wide delivery. Does not count as a legal ball."
        setInfoText={setInfoText}
        onClick={onWide}
        className={`${baseBtn} bg-green-600 hover:bg-green-500`}
      >
        Wide
      </ButtonWithInfo>
      <ButtonWithInfo
        info="A No Ball. Does not count as a legal ball."
        setInfoText={setInfoText}
        onClick={onNoBall}
        className={`${baseBtn} bg-orange-600 hover:bg-orange-500`}
      >
        No Ball
      </ButtonWithInfo>
    </div>
  );
};
const ActionButton = ({ onClick, icon, label, colorClass, disabled }) => (
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

// --- Modals & Popups ---

const ModalBase = ({ children, title, onExit }) => (
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
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-2xl font-bold mb-4 text-center text-white">
        {title}
      </h2>
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

const RunInputModal = ({ title, onConfirm, onClose }) => {
  let prompt, primaryOption, secondaryOptions;
  const subTextStyle = "text-sm text-zinc-400 mt-1 block font-normal";

  if (title === "Wide") {
    prompt = (
      <>
        How many runs to add for this wide ball?
        <span className={subTextStyle}>Ball does not count</span>
      </>
    );
    primaryOption = {
      label: "0",
      value: 0,
      color: "bg-green-600 hover:bg-green-500",
    };
    secondaryOptions = [1];
  } else if (title === "Dismissal") {
    // ✅ CORRECTED PROMPT: More generic for all types of outs (caught, bowled, etc.)
    prompt = "How many runs were completed on this dismissal?";
    primaryOption = {
      label: "0",
      value: 0,
      color: "bg-rose-700 hover:bg-rose-600",
    };
    secondaryOptions = [1, 2, 3];
  } else {
    // No Ball
    prompt = (
      <>
        Total runs to add for this No Ball?
        <span className={subTextStyle}>Ball does not count</span>
      </>
    );
    primaryOption = {
      label: "0",
      value: 0,
      color: "bg-orange-600 hover:bg-orange-500",
    };
    secondaryOptions = [1, 2, 3, 4, 6];
  }

  const buttonBaseStyle =
    "w-full py-4 rounded-full text-2xl font-bold transition-transform text-white";

  return (
    <ModalBase title={title} onExit={onClose}>
      <p className="text-zinc-300 text-center mb-6 font-semibold">{prompt}</p>
      <div className="flex flex-col items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onConfirm(primaryOption.value)}
          className={`${buttonBaseStyle} ${primaryOption.color}`}
        >
          {primaryOption.label}
        </motion.button>
        {secondaryOptions.map((runs) => (
          <motion.button
            whileTap={{ scale: 0.95 }}
            key={runs}
            onClick={() => onConfirm(runs)}
            className={`${buttonBaseStyle} bg-zinc-800 hover:bg-zinc-700`}
          >
            {runs}
          </motion.button>
        ))}
      </div>
    </ModalBase>
  );
};

const RulesModal = ({ onClose }) => (
  <ModalBase title="Scoring Rules" onExit={onClose}>
    <div className="max-h-[60vh] overflow-y-auto p-1 pr-3 space-y-5 text-left text-zinc-300">
      <div>
        <h3 className="font-bold text-white">Wide Balls</h3>
        <ul className="list-disc list-inside mt-2 pl-2 space-y-1">
          <li>
            <strong className="text-amber-300">Wide (0):</strong> Adds{" "}
            <strong>0</strong> runs. Used when no extra run is gained.
          </li>
          <li>
            <strong className="text-amber-300">Wide (1):</strong> Adds{" "}
            <strong>1</strong> run. Use this if the team gains a run from a
            wide.
          </li>
        </ul>
      </div>
      <div>
        <h3 className="font-bold text-green-400">Core Gameplay Rules</h3>
        <ul className="list-disc list-inside mt-2 pl-2 space-y-1">
          <li>
            Max <strong>3 overs</strong> per batsman.
          </li>
          <li>
            Max <strong>2 overs</strong> per bowler.
          </li>
          <li>
            To score runs, the ball must hit the grass. Aerial flicks earn
            nothing.
          </li>
          <li>
            An umpire and wicket-keeper must be present throughout the match.
          </li>
        </ul>
      </div>
      <div>
        <h3 className="font-bold text-red-400">Umpiring & Dismissals</h3>
        <ul className="list-disc list-inside mt-2 pl-2 space-y-1">
          <li>The umpire’s call is final and should be loud and clear.</li>
          <li>
            <strong>No LBWs</strong> (Leg Before Wicket).
          </li>
          <li>
            <strong>No back runs</strong> or pitch boundary running allowed.
          </li>
          <li>
            Waist-high full toss = <strong>No Ball</strong>.
          </li>
        </ul>
      </div>
      <div>
        <h3 className="font-bold text-teal-400">Fair Play & Team Selection</h3>
        <ul className="list-disc list-inside mt-2 pl-2 space-y-1">
          <li>
            Every player must bat and bowl for at least <strong>1 over</strong>.
          </li>
          <li>
            Teams should be <strong>randomized</strong> to avoid bias.
          </li>
          <li>
            Toss winner chooses to bat or bowl; other captain gets first team
            pick.
          </li>
          <li>
            Fair rotation: The player who bats first bowls last, and vice versa.
          </li>
        </ul>
      </div>
    </div>
  </ModalBase>
);

// --- Main Page Component ---
export default function MatchPage() {
  const { id: matchId } = useParams();
  const {
    match,
    error,
    isLoading,
    isUpdating,
    historyStack,
    handleScoreEvent,
    handleNextInningsOrEnd,
    handleUndo,
    patchAndUpdate,
  } = useMatch(matchId);

  const [modal, setModal] = useState({ type: null });
  const [showInningsEnd, setShowInningsEnd] = useState(false);
  const [infoText, setInfoText] = useState(null);

  useEffect(() => {
    // ✅ CORRECTED LOGIC: Add a top-level guard to handle the initial loading state.
    // This prevents the "Cannot read properties of undefined" error.
    if (!match) {
      // If match data isn't loaded yet, do nothing.
      return;
    }

    // Now that we know 'match' exists, we can safely check its properties.
    if (!match.isOngoing || match.result) {
      setShowInningsEnd(!!match.result);
      return;
    }

    const battingTeamName =
      match.innings === "first" ? match.innings1.team : match.innings2.team;
    const currentTeamArray =
      match.teamA?.[0] === battingTeamName ? match.teamA : match.teamB;

    if (!currentTeamArray || currentTeamArray.length === 0) return;

    // Use a variable for balls per over for consistency.
    const BALLS_PER_OVER = 6;
    const maxWickets = currentTeamArray.length;
    const activeInningsKey =
      match.innings === "first" ? "innings1" : "innings2";
    const oversHistory = match[activeInningsKey]?.history ?? [];
    const legalBallsInInnings = oversHistory
      .flatMap((o) => o.balls)
      .filter((b) => b.extraType !== "wide" && b.extraType !== "noball").length;

    const oversDone = legalBallsInInnings >= match.overs * BALLS_PER_OVER;
    const isAllOut = maxWickets > 0 && match.outs >= maxWickets;

    // An innings ends if overs are done OR the team is all out.
    // This condition is universal and applies correctly to both the first and second innings.
    const endCondition = oversDone || isAllOut;

    setShowInningsEnd(endCondition);
  }, [match]); // The dependency array is correct.

  // ... (the rest of the handler functions remain the same) ...
  const handleCopyShareLink = () => {
    triggerHapticFeedback();
    if (!match) return;
    const link = `${window.location.origin}/session/${match.sessionId}/view`;
    const shareTitle = `${match.innings1.team} vs ${match.innings2.team}`;
    const shareText = `Follow the live score for ${shareTitle}! Current score: ${match.score}/${match.outs}. #cricket`;
    if (navigator.share) {
      navigator
        .share({ title: shareTitle, text: shareText, url: link })
        .catch(console.error);
    } else {
      navigator.clipboard
        .writeText(link)
        .then(() => alert("Spectator link copied to clipboard!"));
    }
  };
  const handleOutConfirm = (runs) => {
    handleScoreEvent(runs, true);
    setModal({ type: null });
  };
  const handleNoBallConfirm = (runs) => {
    handleScoreEvent(runs, false, "noball");
    setModal({ type: null });
  };
  const handleWideConfirm = (runs) => {
    handleScoreEvent(runs, false, "wide");
    setModal({ type: null });
  };

  if (isLoading) return <Splash>Loading Match...</Splash>;
  if (error) return <Splash>Error: Could not load match data.</Splash>;
  if (!match) return <Splash>Match not found.</Splash>;

  const activeInningsKey = match.innings === "first" ? "innings1" : "innings2";
  const oversHistory = match[activeInningsKey]?.history ?? [];
  const currentOverNumber = oversHistory.at(-1)?.overNumber ?? 1;

  // ✅ NEW: Get the number of legal balls in the first innings to pass to the modal
  const firstInningsLegalBalls = match.innings1.history
    .flatMap((o) => o.balls)
    .filter((b) => b.extraType !== "wide" && b.extraType !== "noball").length;
  const firstInningsOversCompleted = Math.floor(firstInningsLegalBalls / 6);

  const controlsDisabled = isUpdating || showInningsEnd || !!match.result;
  const firstInningsOversPlayed =
    match.innings1.history.at(-1)?.overNumber ?? 0;

  return (
    <>
      <main className="min-h-screen font-sans bg-zinc-950 text-white p-4">
        <div className="max-w-md mx-auto pt-8 pb-24">
          {match.result && (
            <div className="bg-green-900/50 text-green-300 p-4 rounded-xl text-center mb-4 ring-1 ring-green-500">
              <h3 className="font-bold text-xl">Match Over</h3>
              <p>{match.result}</p>
            </div>
          )}
          <Header match={match} />
          <Scoreboard match={match} history={oversHistory} />
          <BallTracker history={oversHistory} />
          <Controls
            onScore={handleScoreEvent}
            onOut={() => setModal({ type: "out" })}
            onNoBall={() => setModal({ type: "noball" })}
            onWide={() => setModal({ type: "wide" })}
            setInfoText={setInfoText}
            disabled={controlsDisabled}
          />

          <div className="mt-8 pt-6 border-t border-zinc-700 flex justify-center">
            <div className="grid grid-cols-3 gap-x-4 gap-y-6">
              <ActionButton
                onClick={() => setModal({ type: "editTeams" })}
                icon={<FaUserEdit />}
                label="Edit Teams"
                colorClass="text-sky-400"
                disabled={isUpdating}
              />
              <ActionButton
                onClick={() => setModal({ type: "editOvers" })}
                icon={<FaRegClock />}
                label="Edit Overs"
                colorClass="text-amber-400"
                disabled={isUpdating}
              />
              <ActionButton
                onClick={handleUndo}
                icon={<LuUndo2 />}
                label="Undo"
                colorClass="text-zinc-400"
                disabled={isUpdating || historyStack.length === 0}
              />
              <ActionButton
                onClick={() => setModal({ type: "history" })}
                icon={<FaBookOpen />}
                label="History"
                colorClass="text-violet-400"
              />
              <ActionButton
                onClick={handleCopyShareLink}
                icon={<FaShareAlt />}
                label="Share"
                colorClass="text-green-400"
              />
              <ActionButton
                onClick={() => setModal({ type: "rules" })}
                icon={<FaInfoCircle />}
                label="Rules"
                colorClass="text-teal-400"
              />
            </div>
          </div>
        </div>
      </main>
      <AnimatePresence>
        {showInningsEnd && (
          <InningsEndModal match={match} onNext={handleNextInningsOrEnd} />
        )}
        {modal.type === "history" && (
          <HistoryModal
            history={oversHistory}
            onClose={() => setModal({ type: null })}
          />
        )}
        {modal.type === "editTeams" && (
          <EditTeamsModal
            match={match}
            onUpdate={patchAndUpdate}
            onClose={() => setModal({ type: null })}
          />
        )}
        {modal.type === "out" && (
          <RunInputModal
            title="Dismissal"
            onConfirm={handleOutConfirm}
            onClose={() => setModal({ type: null })}
          />
        )}
        {modal.type === "noball" && (
          <RunInputModal
            title="No Ball"
            onConfirm={handleNoBallConfirm}
            onClose={() => setModal({ type: null })}
          />
        )}
        {modal.type === "wide" && (
          <RunInputModal
            title="Wide"
            onConfirm={handleWideConfirm}
            onClose={() => setModal({ type: null })}
          />
        )}
        {modal.type === "editOvers" && (
          <EditOversModal
            currentOvers={match.overs}
            onUpdate={patchAndUpdate}
            onClose={() => setModal({ type: null })}
            currentOverNumber={currentOverNumber}
            // ✅ NEW PROPS
            innings={match.innings}
            firstInningsOversPlayed={firstInningsOversPlayed}
          />
        )}
        {modal.type === "rules" && (
          <RulesModal onClose={() => setModal({ type: null })} />
        )}
        {infoText && (
          <ModalBase title="Rule Info" onExit={() => setInfoText(null)}>
            <p className="text-center text-zinc-300">{infoText}</p>
          </ModalBase>
        )}
      </AnimatePresence>
    </>
  );
}

// --- Other Helper Components (Unchanged) ---
const Splash = ({ children }) => (
  <main className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white text-xl">
    {children}
  </main>
);
const InningsEndModal = ({ match, onNext }) => (
  <ModalBase
    title={match.result ? "Match Over!" : "Innings Over!"}
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
const HistoryModal = ({ history, onClose }) => (
  <ModalBase title="Over History" onExit={onClose}>
    <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2 text-left">
      {history.length > 0 ? (
        [...history].reverse().map((over, i) => (
          <div key={i}>
            <p className="font-semibold text-zinc-200">
              Over {over.overNumber}
            </p>
            <div className="flex gap-2 flex-wrap mt-1">
              {over.balls.map((ball, j) => (
                <Ball key={j} ball={ball} ballNumber={j + 1} />
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
// ✅ Modal with a modern green save button
const EditTeamsModal = ({ match, onUpdate, onClose }) => {
  const [teamA, setTeamA] = useState([...match.teamA]);
  const [teamB, setTeamB] = useState([...match.teamB]);

  const isTeamABatting =
    (match.innings === "first" && match.innings1.team === match.teamA[0]) ||
    (match.innings === "second" && match.innings2.team === match.teamA[0]);

  const handleSaveChanges = () => {
    const finalTeamA = teamA.map((p) => p.trim()).filter(Boolean);
    const finalTeamB = teamB.map((p) => p.trim()).filter(Boolean);
    onUpdate({ teamA: finalTeamA, teamB: finalTeamB });
    onClose();
  };

  return (
    <ModalBase title="Edit Teams" onExit={onClose}>
      <div className="space-y-4 text-left max-h-[70vh] overflow-y-auto p-1 pr-2">
        <MidGameTeamRoster
          title="Team A"
          teamNames={teamA}
          setTeamNames={setTeamA}
          isBatting={isTeamABatting}
        />
        <MidGameTeamRoster
          title="Team B"
          teamNames={teamB}
          setTeamNames={setTeamB}
          isBatting={!isTeamABatting}
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
};
// ✅ FIXED: Disables the minus button AND shows the warning message for invalid states.
// ✅ FINAL, CORRECTED LOGIC FOR ALL SCENARIOS
// ✅ FINAL, CORRECTED LOGIC FOR ALL SCENARIOS
const EditOversModal = ({
  currentOvers,
  onUpdate,
  onClose,
  currentOverNumber,
  innings,
  firstInningsOversPlayed, // ✅ Using the new, accurate prop
}) => {
  const [overs, setOvers] = useState(currentOvers);

  // ✅ TRULY CORRECTED LOGIC: Determine the absolute minimum allowed overs for the match.
  let minAllowedOvers;
  if (innings === "first") {
    // In the first innings, the minimum is simply the current over number being played.
    minAllowedOvers = currentOverNumber;
  } else {
    // In the second innings, the minimum must be the GREATER of:
    // 1. The total overs played in the first innings.
    // 2. The current over number of the second innings.
    // This prevents setting overs lower than either innings' progress.
    minAllowedOvers = Math.max(firstInningsOversPlayed, currentOverNumber);
  }

  // Ensure the absolute minimum is at least 1.
  minAllowedOvers = Math.max(1, minAllowedOvers);

  const isInvalid = Number(overs) < minAllowedOvers;
  const isAtLowestPoint = Number(overs) === minAllowedOvers;

  const handleSave = () => {
    if (isInvalid) return;
    const newOvers = parseInt(overs, 10);
    if (!isNaN(newOvers) && newOvers > 0) {
      onUpdate({ overs: newOvers });
      onClose();
    }
  };

  return (
    <ModalBase title="Edit Match Overs" onExit={onClose}>
      <div className="flex items-center justify-between p-2 my-6 bg-zinc-800 rounded-2xl">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setOvers((o) => Math.max(minAllowedOvers, o - 1))}
          disabled={Number(overs) <= minAllowedOvers}
          className="w-14 h-14 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-3xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Decrease overs"
        >
          -
        </motion.button>

        <input
          type="number"
          value={overs}
          onChange={(e) =>
            setOvers(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="w-28 h-20 text-center text-5xl font-bold bg-transparent outline-none text-white"
        />

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setOvers((o) => (Number(o) || 0) + 1)}
          className="w-14 h-14 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-3xl flex items-center justify-center transition-colors"
          aria-label="Increase overs"
        >
          +
        </motion.button>
      </div>

      <AnimatePresence>
        {(isInvalid || isAtLowestPoint) && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-center text-amber-400 text-sm mb-4 font-semibold overflow-hidden"
          >
            Cannot set total overs below {minAllowedOvers}.
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={handleSave}
        disabled={isInvalid}
        className="w-full py-3 text-lg bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition-all active:scale-95 disabled:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Save Changes
      </button>
    </ModalBase>
  );
};
// ✅ UPDATED: Original structure with interactive +/- player controls.
const MidGameTeamRoster = ({ title, teamNames, setTeamNames, isBatting }) => {
  const [isEditing, setIsEditing] = useState(false);

  const teamColorClass = isBatting ? "text-amber-300" : "text-sky-400";
  const teamRingClass = isBatting
    ? "focus:ring-amber-500"
    : "focus:ring-sky-500";

  const handleNameChange = (index, newName) => {
    setTeamNames((current) =>
      current.map((name, i) => (i === index ? newName : name))
    );
  };

  const addPlayer = () => {
    // Limit the number of players to prevent overly long lists
    if (teamNames.length < 15) {
      setTeamNames((current) => [...current, `Player ${current.length}`]);
    }
  };

  const removeLastPlayer = () => {
    // Ensure the team name itself cannot be removed
    if (teamNames.length > 1) {
      setTeamNames((current) => current.slice(0, -1));
    }
  };

  return (
    <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700 space-y-3">
      {/* --- Header with Edit Toggle --- */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className={`text-xl font-bold ${teamColorClass}`}>
            {teamNames[0] || title}
          </h2>
          {isBatting && (
            <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
              BATTING
            </span>
          )}
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 rounded-full hover:bg-zinc-700 transition-colors"
          aria-label={isEditing ? "Confirm team changes" : "Edit team players"}
        >
          {isEditing ? (
            <FaCheck className="text-green-400" size={18} />
          ) : (
            <FaUserEdit size={18} />
          )}
        </button>
      </div>

      {/* --- Player Management Bar with +/- Controls --- */}
      <div className="flex items-center justify-between p-2 bg-zinc-900/70 rounded-lg">
        <span className="font-semibold text-zinc-300 text-sm">Players</span>
        <div className="flex items-center gap-3">
          <button
            onClick={removeLastPlayer}
            disabled={teamNames.length <= 1}
            className="w-7 h-7 rounded-md bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaMinus />
          </button>
          <span className="text-lg font-bold w-6 text-center">
            {teamNames.length}
          </span>
          <button
            onClick={addPlayer}
            disabled={teamNames.length >= 15}
            className="w-7 h-7 rounded-md bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPlus />
          </button>
        </div>
      </div>

      {/* --- Conditionally Rendered Player List for Editing --- */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-3 border-t border-zinc-700">
              {teamNames.map((name, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(i, e.target.value)}
                    placeholder={i === 0 ? "Team Name" : `Player ${i}`}
                    className={`w-full px-3 py-2 text-sm rounded-lg bg-zinc-900 border border-zinc-700 focus:ring-2 ${teamRingClass} outline-none transition`}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
