"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  FaBookOpen,
  FaInfoCircle,
  FaRegClock,
  FaShareAlt,
  FaUserEdit,
} from "react-icons/fa";
import { LuUndo2 } from "react-icons/lu";
import { countLegalBalls } from "../../lib/match-scoring";
import { getBattingTeamBundle } from "../../lib/team-utils";
import {
  AccessGate,
  ActionButton,
  BallTracker,
  Controls,
  MatchHeader,
  Scoreboard,
  Splash,
} from "../../components/match/MatchPieces";
import {
  EditOversModal,
  EditTeamsModal,
  HistoryModal,
  InningsEndModal,
  ModalBase,
  RulesModal,
  RunInputModal,
} from "../../components/match/MatchModals";
import useMatch, {
  triggerMatchHapticFeedback,
} from "../../components/match/useMatch";

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

    triggerMatchHapticFeedback();
    const link = `${window.location.origin}/session/${match.sessionId}/view`;
    const shareTitle = `${match.innings1.team} vs ${match.innings2.team}`;
    const shareText = `Follow the live score for ${shareTitle}. Current score: ${match.score}/${match.outs}.`;

    if (navigator.share) {
      navigator
        .share({ title: shareTitle, text: shareText, url: link })
        .catch(console.error);
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
          <MatchHeader match={match} />
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
