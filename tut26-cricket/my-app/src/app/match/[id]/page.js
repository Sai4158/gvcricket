"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaBookOpen,
  FaInfoCircle,
  FaMinus,
  FaPlus,
  FaRegClock,
  FaShareAlt,
  FaTimes,
  FaUserEdit,
} from "react-icons/fa";
import { LuUndo2 } from "react-icons/lu";
import {
  addBallToHistory,
  buildWinByWicketsText,
  countLegalBalls,
  syncTeamNamesAcrossMatch,
} from "../../lib/match-scoring";
import { getBattingTeamBundle, getTeamBundle } from "../../lib/team-utils";

const fetcher = (url) => fetch(url).then((res) => res.json());

const triggerHapticFeedback = () => {
  if (typeof window !== "undefined" && navigator.vibrate) {
    navigator.vibrate(50);
  }
};

function useMatch(matchId, hasAccess) {
  const router = useRouter();
  const {
    data: match,
    error,
    isLoading,
    mutate,
  } = useSWR(matchId && hasAccess ? `/api/matches/${matchId}` : null, fetcher, {
    revalidateOnFocus: false,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [historyStack, setHistoryStack] = useState([]);

  const patchAndUpdate = async (payload, isUndo = false) => {
    if (!matchId || !hasAccess || isUpdating || !match) return;

    setIsUpdating(true);
    if (!isUndo) {
      setHistoryStack((prev) => [...prev, match]);
    }

    const optimisticData = { ...match, ...payload };

    try {
      await mutate(optimisticData, false);
      const response = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Failed to update match." }));
        throw new Error(body.message || "Failed to update match.");
      }

      await mutate();
    } catch (caughtError) {
      console.error("Failed to update match:", caughtError);
      await mutate(match, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleScoreEvent = (runs, isOut = false, extraType = null) => {
    if (!match || match.result || !hasAccess) return;

    triggerHapticFeedback();
    const payload = structuredClone(match);
    const activeInningsKey =
      payload.innings === "first" ? "innings1" : "innings2";

    payload[activeInningsKey].score += runs;
    payload.score = payload[activeInningsKey].score;
    if (isOut) payload.outs += 1;

    const newBall = { runs, isOut, extraType };
    if (!payload.balls) payload.balls = [];
    payload.balls.push(newBall);
    addBallToHistory(payload, newBall);

    if (payload.innings === "second" && payload.score > payload.innings1.score) {
      payload.isOngoing = false;
      payload.result = buildWinByWicketsText(payload, payload.outs);
    }

    patchAndUpdate(payload);
  };

  const handleUndo = async () => {
    triggerHapticFeedback();
    if (historyStack.length === 0) return;

    const previousState = historyStack.at(-1);
    setHistoryStack((prev) => prev.slice(0, -1));
    await patchAndUpdate(previousState, true);
  };

  const handleNextInningsOrEnd = () => {
    if (!match || !hasAccess) return;

    if (match.innings === "first") {
      patchAndUpdate({
        score: 0,
        outs: 0,
        balls: [],
        innings: "second",
      });
      return;
    }

    const firstInningsScore = match.innings1.score;
    const secondInningsScore = match.score;
    let resultText = "Match Tied";

    if (secondInningsScore > firstInningsScore) {
      resultText = buildWinByWicketsText(match, match.outs);
    } else if (firstInningsScore > secondInningsScore) {
      const runsMargin = firstInningsScore - secondInningsScore;
      resultText = `${match.innings1.team} won by ${runsMargin} ${
        runsMargin === 1 ? "run" : "runs"
      }.`;
    }

    patchAndUpdate({ isOngoing: false, result: resultText });
    router.push(`/result/${matchId}`);
  };

  return {
    match,
    error,
    isLoading,
    isUpdating,
    historyStack,
    handleScoreEvent,
    handleUndo,
    handleNextInningsOrEnd,
    patchAndUpdate,
  };
}

const Splash = ({ children }) => (
  <main className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white text-xl">
    {children}
  </main>
);

const AccessGate = ({ onSubmit, isSubmitting, error }) => {
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
};

const Header = ({ match }) => {
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
};

const Ball = ({ ball, ballNumber }) => {
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
};

const BallTracker = ({ history }) => {
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
};

const Controls = ({
  onScore,
  onOut,
  onNoBall,
  onWide,
  setInfoText,
  disabled,
}) => {
  const baseBtn =
    "py-6 text-xl font-bold rounded-2xl transition-transform active:scale-95 shadow-lg w-full disabled:opacity-50 disabled:cursor-not-allowed";

  const Button = ({ onClick, className, children }) => (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </motion.button>
  );

  return (
    <div className="grid grid-cols-4 gap-3">
      <Button onClick={() => onScore(0)} className={`${baseBtn} bg-zinc-800 hover:bg-zinc-700`}>
        Dot
      </Button>
      {[1, 2, 3, 4, 6].map((runs) => (
        <Button
          key={runs}
          onClick={() => onScore(runs)}
          className={`${baseBtn} bg-zinc-800 hover:bg-zinc-700`}
        >
          {runs}
        </Button>
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
};

const ButtonWithInfo = ({
  children,
  info,
  setInfoText,
  disabled,
  className,
  onClick,
}) => (
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

const RunInputModal = ({ title, onConfirm, onClose }) => {
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
};

const HistoryModal = ({ history, onClose }) => (
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

const RulesModal = ({ onClose }) => (
  <ModalBase title="Scoring Rules" onExit={onClose}>
    <div className="space-y-3 text-left text-zinc-300">
      <p>Six legal balls complete an over. Wides and no balls do not.</p>
      <p>The innings ends when overs are completed or all players are out.</p>
      <p>Undo restores the previous saved state without changing old history.</p>
    </div>
  </ModalBase>
);

const InningsEndModal = ({ match, onNext }) => (
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

const EditTeamsModal = ({ match, onUpdate, onClose }) => {
  const initialTeamA = getTeamBundle(match, "teamA");
  const initialTeamB = getTeamBundle(match, "teamB");
  const [teamAName, setTeamAName] = useState(initialTeamA.name);
  const [teamBName, setTeamBName] = useState(initialTeamB.name);
  const [teamAPlayers, setTeamAPlayers] = useState([...initialTeamA.players]);
  const [teamBPlayers, setTeamBPlayers] = useState([...initialTeamB.players]);

  const handleSaveChanges = () => {
    const nextNames = {
      teamAName: teamAName.trim(),
      teamBName: teamBName.trim(),
    };

    const previousNames = {
      teamAName: initialTeamA.name,
      teamBName: initialTeamB.name,
    };

    const updatedMatch = syncTeamNamesAcrossMatch(match, previousNames, nextNames);

    onUpdate({
      teamAName: nextNames.teamAName,
      teamBName: nextNames.teamBName,
      teamA: teamAPlayers.map((player) => player.trim()).filter(Boolean),
      teamB: teamBPlayers.map((player) => player.trim()).filter(Boolean),
      innings1: updatedMatch.innings1,
      innings2: updatedMatch.innings2,
      tossWinner: updatedMatch.tossWinner,
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
        />
        <EditableRoster
          title="Team B"
          name={teamBName}
          setName={setTeamBName}
          players={teamBPlayers}
          setPlayers={setTeamBPlayers}
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

const EditableRoster = ({ title, name, setName, players, setPlayers }) => {
  const updatePlayer = (index, nextValue) => {
    setPlayers((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? nextValue : player
      )
    );
  };

  return (
    <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700 space-y-3">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Team name"
        className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-900 border border-zinc-700 outline-none transition"
      />
      {players.map((player, index) => (
        <input
          key={`${title}-${index}`}
          type="text"
          value={player}
          onChange={(event) => updatePlayer(index, event.target.value)}
          placeholder={`Player ${index + 1}`}
          className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-900 border border-zinc-700 outline-none transition"
        />
      ))}
    </div>
  );
};

const EditOversModal = ({
  currentOvers,
  currentOverNumber,
  innings,
  firstInningsOversPlayed,
  onUpdate,
  onClose,
}) => {
  const [overs, setOvers] = useState(currentOvers);
  const minAllowedOvers =
    innings === "first"
      ? Math.max(1, currentOverNumber)
      : Math.max(1, firstInningsOversPlayed, currentOverNumber);
  const isInvalid = Number(overs) < minAllowedOvers;

  return (
    <ModalBase title="Edit Match Overs" onExit={onClose}>
      <div className="flex items-center justify-between p-2 my-6 bg-zinc-800 rounded-2xl">
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
      {isInvalid && (
        <p className="text-center text-amber-400 text-sm mb-4 font-semibold">
          Cannot set total overs below {minAllowedOvers}.
        </p>
      )}
      <button
        onClick={() => {
          if (isInvalid) return;
          onUpdate({ overs: Number(overs) });
          onClose();
        }}
        disabled={isInvalid}
        className="w-full py-3 text-lg bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition-all active:scale-95 disabled:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Save Changes
      </button>
    </ModalBase>
  );
};

export default function MatchPage() {
  const { id: matchId } = useParams();
  const [authStatus, setAuthStatus] = useState("checking");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [modal, setModal] = useState({ type: null });
  const [showInningsEnd, setShowInningsEnd] = useState(false);
  const [infoText, setInfoText] = useState(null);
  const {
    match,
    error,
    isLoading,
    isUpdating,
    historyStack,
    handleScoreEvent,
    handleUndo,
    handleNextInningsOrEnd,
    patchAndUpdate,
  } = useMatch(matchId, authStatus === "granted");

  useEffect(() => {
    if (!matchId) return;

    fetch(`/api/matches/${matchId}/auth`)
      .then((res) => res.json())
      .then((data) => setAuthStatus(data.authorized ? "granted" : "locked"))
      .catch(() => setAuthStatus("locked"));
  }, [matchId]);

  useEffect(() => {
    if (!match) return;

    if (!match.isOngoing || match.result) {
      setShowInningsEnd(Boolean(match.result));
      return;
    }

    const activeInningsKey = match.innings === "first" ? "innings1" : "innings2";
    const oversHistory = match[activeInningsKey]?.history ?? [];
    const legalBalls = countLegalBalls(oversHistory);
    const oversDone = legalBalls >= match.overs * 6;
    const maxWickets = getBattingTeamBundle(match).players.length;
    const isAllOut = maxWickets > 0 && match.outs >= maxWickets;

    setShowInningsEnd(oversDone || isAllOut);
  }, [match]);

  const submitPin = async (pin) => {
    setAuthSubmitting(true);
    setAuthError("");

    try {
      const response = await fetch(`/api/matches/${matchId}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Incorrect PIN." }));
        throw new Error(body.message || "Incorrect PIN.");
      }

      setAuthStatus("granted");
    } catch (caughtError) {
      setAuthError(caughtError.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!match) return;

    triggerHapticFeedback();
    const link = `${window.location.origin}/session/${match.sessionId}/view`;
    const shareTitle = `${match.innings1.team} vs ${match.innings2.team}`;
    const shareText = `Follow the live score for ${shareTitle}. Current score: ${match.score}/${match.outs}.`;

    if (navigator.share) {
      navigator.share({ title: shareTitle, text: shareText, url: link }).catch(console.error);
      return;
    }

    navigator.clipboard
      .writeText(link)
      .then(() => alert("Spectator link copied to clipboard."));
  };

  if (authStatus !== "granted") {
    if (authStatus === "checking") return <Splash>Checking umpire access...</Splash>;
    return (
      <AccessGate
        onSubmit={submitPin}
        isSubmitting={authSubmitting}
        error={authError}
      />
    );
  }

  if (isLoading) return <Splash>Loading Match...</Splash>;
  if (error) return <Splash>Error: Could not load match data.</Splash>;
  if (!match) return <Splash>Match not found.</Splash>;

  const activeInningsKey = match.innings === "first" ? "innings1" : "innings2";
  const oversHistory = match[activeInningsKey]?.history ?? [];
  const currentOverNumber = oversHistory.at(-1)?.overNumber ?? 1;
  const firstInningsOversPlayed = Math.max(
    1,
    Math.ceil(countLegalBalls(match.innings1.history) / 6)
  );
  const controlsDisabled = isUpdating || showInningsEnd || Boolean(match.result);

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
            title="OUT"
            onConfirm={(runs) => {
              handleScoreEvent(runs, true);
              setModal({ type: null });
            }}
            onClose={() => setModal({ type: null })}
          />
        )}
        {modal.type === "noball" && (
          <RunInputModal
            title="No Ball"
            onConfirm={(runs) => {
              handleScoreEvent(runs, false, "noball");
              setModal({ type: null });
            }}
            onClose={() => setModal({ type: null })}
          />
        )}
        {modal.type === "wide" && (
          <RunInputModal
            title="Wide"
            onConfirm={(runs) => {
              handleScoreEvent(runs, false, "wide");
              setModal({ type: null });
            }}
            onClose={() => setModal({ type: null })}
          />
        )}
        {modal.type === "editOvers" && (
          <EditOversModal
            currentOvers={match.overs}
            currentOverNumber={currentOverNumber}
            innings={match.innings}
            firstInningsOversPlayed={firstInningsOversPlayed}
            onUpdate={patchAndUpdate}
            onClose={() => setModal({ type: null })}
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
