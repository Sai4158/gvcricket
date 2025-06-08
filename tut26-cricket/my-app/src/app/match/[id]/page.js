/* ------------------------------------------------------------------
    src/app/match/[id]/page.jsx – (Final UI and Grammar Fix)
-------------------------------------------------------------------*/
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBookOpen,
  FaShareAlt,
  FaSyncAlt,
  FaInfoCircle,
  FaTimes,
  FaUserEdit,
  FaTrash,
  FaPen,
  FaCheck,
  FaPlus,
  FaMinus,
} from "react-icons/fa";
import { LuUndo2 } from "react-icons/lu";

// --- Custom Hook for All Match Logic & Data ---
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
    const history = currentMatch[activeInningsKey].history;
    let lastOver = history.at(-1);
    const isLegalBall =
      ball.extraType !== "wide" && ball.extraType !== "noball";
    const validBallsInLastOver =
      lastOver?.balls.filter(
        (b) => b.extraType !== "wide" && b.extraType !== "noball"
      ).length ?? 0;
    if (!lastOver || (validBallsInLastOver >= 6 && isLegalBall)) {
      history.push({ overNumber: history.length + 1, balls: [ball] });
    } else {
      lastOver.balls.push(ball);
    }
  };

  const handleScoreEvent = (runs, isOut = false, extraType = null) => {
    if (!match || match.result) return;
    const payload = structuredClone(match);
    const activeInningsKey =
      payload.innings === "first" ? "innings1" : "innings2";
    payload[activeInningsKey].score += runs;
    payload.score = payload[activeInningsKey].score;
    if (isOut) payload.outs++;
    const newBall = { runs, isOut, extraType };
    payload.balls.push(newBall);
    addBallToHistory(payload, newBall);
    if (
      payload.innings === "second" &&
      payload.score > payload.innings1.score
    ) {
      payload.isOngoing = false;
      const wicketsLeft = (match.teamB?.length || 11) - 1 - payload.outs;
      payload.result = `${
        payload[activeInningsKey].team
      } won by ${wicketsLeft} ${wicketsLeft === 1 ? "wicket" : "wickets"}.`;
    }
    patchAndUpdate(payload);
  };

  const handleUndo = async () => {
    if (historyStack.length === 0) return;
    const lastState = historyStack.at(-1);
    setHistoryStack((prev) => prev.slice(0, -1));
    await patchAndUpdate(lastState, true);
  };

  const handleNextInningsOrEnd = () => {
    if (match.innings === "first") {
      patchAndUpdate({ score: 0, outs: 0, balls: [], innings: "second" });
    } else {
      const innings1Score = match.innings1.score;
      const innings2Score = match.score;
      let result;
      if (innings2Score > innings1Score) {
        const wicketsLeft = (match.teamB?.length || 11) - 1 - match.outs;
        result = `${match.innings2.team} won by ${wicketsLeft} ${
          wicketsLeft === 1 ? "wicket" : "wickets"
        }.`;
      } else if (innings1Score > innings2Score) {
        const runDifference = innings1Score - innings2Score;
        result = `${match.innings1.team} won by ${runDifference} ${
          runDifference === 1 ? "run" : "runs"
        }.`;
      } else {
        result = "Match Tied";
      }
      patchAndUpdate({ isOngoing: false, result });
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
    mutate,
  };
};

// --- UI Sub-components ---

// ✅ FIX: Header grammar corrected and team name is now color-coded.
const Header = ({ match }) => {
  const { innings, tossWinner, tossDecision, teamA, teamB } = match;

  const teamAName = teamA[0];
  const teamBName = teamB[0];

  let firstBattingTeamName;
  if (tossWinner === teamAName) {
    firstBattingTeamName = tossDecision === "bat" ? teamAName : teamBName;
  } else {
    firstBattingTeamName = tossDecision === "bat" ? teamBName : teamAName;
  }

  const currentBattingTeam =
    innings === "first"
      ? firstBattingTeamName
      : firstBattingTeamName === teamAName
      ? teamBName
      : teamAName;
  const target = innings === "first" ? null : (match.innings1.score ?? 0) + 1;

  // Determine color based on which team is batting
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
      {target !== null && (
        <p className="text-zinc-400 text-lg mt-1">
          Target: <span className="font-bold text-amber-300">{target}</span>
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
  const battingTeamKey = match.innings === "first" ? "teamA" : "teamB";
  const totalWickets = match[battingTeamKey]?.length || 11;
  return (
    <div className="grid grid-cols-2 gap-4 text-center mb-6 bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10">
      <div>
        <div className="text-6xl font-bold text-white">
          {match.score}
          <span className="text-4xl text-rose-500">/{match.outs}</span>
        </div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          Score / Wickets <strong>({totalWickets})</strong>
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

// ✅ FIX: UI is now smaller and more compact.
const MidGameTeamRoster = ({ title, teamNames, setTeamNames, isBatting }) => {
  const [isEditing, setIsEditing] = useState(false);

  const teamColorClass = isBatting ? "text-amber-300" : "text-sky-400";
  const teamRingClass = isBatting
    ? "focus:ring-amber-500"
    : "focus:ring-sky-500";

  const handleNameChange = (index, newName) =>
    setTeamNames((current) =>
      current.map((name, i) => (i === index ? newName : name))
    );
  const addPlayer = () => {
    if (teamNames.length < 15)
      setTeamNames((current) => [...current, `Player ${current.length + 1}`]);
  };
  const removeLastPlayer = () => {
    if (teamNames.length > 1) setTeamNames((current) => current.slice(0, -1));
  };
  const removePlayerAtIndex = (indexToRemove) =>
    setTeamNames((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );

  return (
    <div className="bg-zinc-900/50 p-4 rounded-xl ring-1 ring-white/10 space-y-3 transition-all duration-300">
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
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          {isEditing ? (
            <FaCheck className="text-green-400" size={18} />
          ) : (
            <FaPen size={18} />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between p-2 bg-zinc-800 rounded-lg">
        <span className="font-semibold text-zinc-300 text-sm">Players</span>
        <div className="flex items-center gap-3">
          <button
            onClick={removeLastPlayer}
            className="w-7 h-7 rounded-md bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
          >
            <FaMinus />
          </button>
          <span className="text-lg font-bold w-6 text-center">
            {teamNames.length}
          </span>
          <button
            onClick={addPlayer}
            className="w-7 h-7 rounded-md bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
          >
            <FaPlus />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-3 border-t border-white/10">
              {teamNames.map((name, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(i, e.target.value)}
                    placeholder={i === 0 ? "Team Name" : `Player ${i + 1}`}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg bg-zinc-900 focus:ring-2 ${teamRingClass} outline-none transition`}
                  />
                  {i > 0 && (
                    <button
                      onClick={() => removePlayerAtIndex(i)}
                      className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                    >
                      <FaTrash />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
      <div className="space-y-4 text-left max-h-[70vh] overflow-y-auto p-1">
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
        className="mt-6 w-full py-2.5 text-md bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition"
      >
        Save Changes
      </button>
    </ModalBase>
  );
};

const BallTracker = ({ history }) => {
  const lastOverBalls = history.at(-1)?.balls ?? [];
  return (
    <div className="flex justify-center items-center flex-wrap gap-2 mb-6 bg-zinc-900/50 p-3 rounded-full min-h-[4rem] ring-1 ring-white/10">
      <AnimatePresence>
        {lastOverBalls.map((ball, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Ball ball={ball} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const Ball = ({ ball }) => {
  let style, label, ariaLabel;
  if (ball.isOut) {
    style = "bg-rose-600 text-white";
    label = "W";
    ariaLabel = "Out";
  } else if (ball.extraType === "wide") {
    style = "bg-amber-500 text-black";
    label = `${ball.runs}Wd`;
    ariaLabel = `Wide, ${ball.runs} runs`;
  } else if (ball.extraType) {
    style = "bg-purple-500 text-white";
    label = `${ball.runs}${ball.extraType.substring(0, 2)}`;
    ariaLabel = `${ball.extraType}, ${ball.runs} runs`;
  } else if (ball.runs === 0) {
    style = "bg-zinc-600 text-white";
    label = "•";
    ariaLabel = "Dot ball, 0 runs";
  } else {
    style = "bg-sky-500 text-white";
    label = ball.runs;
    ariaLabel = `${ball.runs} runs`;
  }
  return (
    <div
      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${style}`}
      aria-label={ariaLabel}
      role="listitem"
    >
      {label}
    </div>
  );
};

const Controls = ({ onScore, disabled }) => {
  const baseBtnClass =
    "py-6 text-xl font-bold rounded-2xl transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg";
  return (
    <div className="grid grid-cols-4 gap-3">
      {[0, 1, 2, 3, 4, 6].map((r) => (
        <button
          key={r}
          onClick={() => onScore(r)}
          className={`${baseBtnClass} bg-zinc-800 hover:bg-zinc-700`}
          disabled={disabled}
        >
          {r === 0 ? "Dot" : r}
        </button>
      ))}
      <button
        onClick={() => onScore(0, true)}
        className={`${baseBtnClass} bg-rose-800 hover:bg-rose-500 col-span-2`}
        disabled={disabled}
      >
        OUT
      </button>
      <button
        onClick={() => onScore(0, false, "wide")}
        className={`${baseBtnClass} bg-green-600 hover:bg-amber-500 col-span-2`}
        disabled={disabled}
      >
        Wide <br /> (No run)
      </button>
      <button
        onClick={() => onScore(1, false, "wide")}
        className={`${baseBtnClass} bg-orange-700 hover:bg-amber-500 col-span-2`}
        disabled={disabled}
      >
        Wide <br /> (Add 1 Run)
      </button>
    </div>
  );
};

const ActionButton = ({ onClick, icon, label, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center gap-1.5 p-2 text-zinc-400 hover:text-white transition w-20 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {icon}
    <span className="text-xs font-medium text-center">{label}</span>
  </button>
);

const Splash = ({ children }) => (
  <main className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white text-xl">
    {children}
  </main>
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
                <Ball key={j} ball={ball} />
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

const InningsEndModal = ({ match, onNext }) => (
  <ModalBase
    title={match.result ? "Match Over!" : "Innings Over!"}
    onExit={onNext}
  >
    <p className="text-2xl mb-2">
      Final Score:{" "}
      <strong className="text-amber-300">
        {match.score} / {match.outs}
      </strong>
    </p>
    {match.result && (
      <p className="text-lg text-green-400 font-bold mb-6">{match.result}</p>
    )}
    <button
      onClick={onNext}
      className="mt-6 w-full py-4 text-xl bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition"
    >
      {match.innings === "first" && !match.result
        ? "Start Second Innings"
        : "View Final Results"}
    </button>
  </ModalBase>
);

const RulesModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">
    <div className="relative w-full max-w-3xl max-h-[90vh] bg-zinc-900 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-lg flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition"
          aria-label="Close Rules"
        >
          <FaTimes className="text-3xl" />
        </button>
        <h2 className="text-lg font-bold text-white text-center flex-1 -ml-6">
          Scoring Rules
        </h2>
      </div>
      <div className="overflow-y-auto p-6 space-y-6 text-left text-zinc-300">
        <div>
          <h3 className="font-bold text-white">Wide Balls</h3>
          <p>There are two wide ball options:</p>
          <ul className="list-disc list-inside mt-2 pl-2">
            <li>
              <strong className="text-amber-300">Wide (0):</strong> Adds{" "}
              <strong>0</strong> runs. Used when no extra run is gained on the
              wide.
            </li>
            <li>
              <strong className="text-amber-300">Wide (+1):</strong> Adds{" "}
              <strong>1</strong> run. Use this if the batter or team gains a run
              from a wide.
            </li>
          </ul>
          <p className="text-sm text-zinc-400 mt-2">
            This gives umpires control over how wides impact the score.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-green-400">Core Gameplay Rules</h3>
          <ul className="list-disc list-inside mt-2 pl-2">
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
          <ul className="list-disc list-inside mt-2 pl-2">
            <li>The umpire’s call is final and should be loud and clear.</li>
            <li>
              <strong>No LBWs</strong> (Leg Before Wicket).
            </li>
            <li>
              <strong>No back runs</strong> or pitch boundary running allowed.
            </li>
            <li>
              Waist-high full toss = <strong>No Ball</strong>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-bold text-teal-400">
            Fair Play & Team Selection
          </h3>
          <ul className="list-disc list-inside mt-2 pl-2">
            <li>
              Every player must bat and bowl for at least{" "}
              <strong>1 over</strong>.
            </li>
            <li>
              Teams should be <strong>randomized</strong> to avoid bias.
            </li>
            <li>
              Toss winner chooses to bat or bowl; other captain gets first team
              pick.
            </li>
            <li>
              Fair rotation: The player who bats first bowls last, and vice
              versa.
            </li>
          </ul>
        </div>
      </div>
      <div className="p-4 border-t border-zinc-800 text-center">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

const ModalBase = ({ children, title, onExit }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onExit();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onExit}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative bg-zinc-900 p-5 sm:p-6 rounded-2xl max-w-sm w-full ring-1 ring-white/10 shadow-2xl shadow-black"
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
};

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
    mutate,
  } = useMatch(matchId);
  const [showHistory, setShowHistory] = useState(false);
  const [showInningsEnd, setShowInningsEnd] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showEditTeams, setShowEditTeams] = useState(false);

  useEffect(() => {
    if (!match) return;
    const isFirstInnings = match.innings === "first";
    const activeInningsKey = isFirstInnings ? "innings1" : "innings2";
    const oversHistory = match[activeInningsKey]?.history ?? [];
    const legalBallsInInnings = oversHistory
      .flatMap((o) => o.balls)
      .filter((b) => b.extraType !== "wide" && b.extraType !== "noball").length;
    const oversDone = legalBallsInInnings >= match.overs * 6;
    const battingTeamKey = match.innings === "first" ? "teamA" : "teamB";
    const isAllOut = match.outs >= (match[battingTeamKey]?.length || 1);
    const endCondition =
      oversDone || isAllOut || !!match.result || !match.isOngoing;
    setShowInningsEnd(endCondition);
  }, [match]);

  const handleCopyShareLink = () => {
    const link = `${window.location.origin}/session/${match.sessionId}/view`;
    navigator.clipboard
      .writeText(link)
      .then(() => alert("Spectator link copied!"));
  };

  if (isLoading) return <Splash>Loading Match...</Splash>;
  if (error) return <Splash>Error: Could not load match data.</Splash>;
  if (!match) return <Splash>Match not found.</Splash>;

  const isFirstInnings = match.innings === "first";
  const activeInningsKey = isFirstInnings ? "innings1" : "innings2";
  const oversHistory = match[activeInningsKey]?.history ?? [];
  const controlsDisabled = isUpdating || showInningsEnd;

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
          <Controls onScore={handleScoreEvent} disabled={controlsDisabled} />
          <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-around">
              <ActionButton
                onClick={() => setShowEditTeams(true)}
                icon={<FaUserEdit size={40} />}
                label="Edit Teams"
                disabled={isUpdating}
              />
              <ActionButton
                onClick={handleCopyShareLink}
                icon={<FaShareAlt size={40} />}
                label="Share"
              />
              <ActionButton
                onClick={handleUndo}
                icon={<LuUndo2 size={40} />}
                label="Undo"
                disabled={isUpdating || historyStack.length === 0}
              />
            </div>
            <div className="flex items-center justify-around">
              <ActionButton
                onClick={() => setShowRules(true)}
                icon={<FaInfoCircle size={40} />}
                label="Rules"
              />
              <ActionButton
                onClick={() => mutate()}
                icon={<FaSyncAlt size={40} />}
                label="Sync"
                disabled={isUpdating}
              />
              <ActionButton
                onClick={() => setShowHistory(true)}
                icon={<FaBookOpen size={40} />}
                label="History"
              />
            </div>
          </div>
        </div>
      </main>
      <AnimatePresence>
        {showInningsEnd && (
          <InningsEndModal match={match} onNext={handleNextInningsOrEnd} />
        )}
        {showHistory && (
          <HistoryModal
            history={oversHistory}
            onClose={() => setShowHistory(false)}
          />
        )}
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {showEditTeams && (
          <EditTeamsModal
            match={match}
            onUpdate={patchAndUpdate}
            onClose={() => setShowEditTeams(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
