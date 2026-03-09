"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { countLegalBalls } from "../../lib/match-scoring";
import { getBattingTeamBundle } from "../../lib/team-utils";
import { MatchHeader, Scoreboard, Splash, AccessGate } from "../../components/match/MatchStatusShell";
import { Controls } from "../../components/match/MatchControls";
import { BallTracker } from "../../components/match/MatchBallHistory";
import MatchActionGrid from "../../components/match/MatchActionGrid";
import MatchModalLayer from "../../components/match/MatchModalLayer";
import useMatch, {
  triggerMatchHapticFeedback,
} from "../../components/match/useMatch";
import useMatchAccess from "../../components/match/useMatchAccess";

export default function MatchPage() {
  const { id: matchId } = useParams();
  const [modal, setModal] = useState({ type: null });
  const [infoText, setInfoText] = useState(null);
  const { authStatus, authError, authSubmitting, submitPin } =
    useMatchAccess(matchId);
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
  const legalBalls = countLegalBalls(oversHistory);
  const oversDone = legalBalls >= match.overs * 6;
  const maxWickets = getBattingTeamBundle(match).players.length;
  const isAllOut = maxWickets > 0 && match.outs >= maxWickets;
  const showInningsEnd = !match.isOngoing || Boolean(match.result) || oversDone || isAllOut;
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
          <MatchActionGrid
            isUpdating={isUpdating}
            historyStackLength={historyStack.length}
            onEditTeams={() => setModal({ type: "editTeams" })}
            onEditOvers={() => setModal({ type: "editOvers" })}
            onUndo={handleUndo}
            onHistory={() => setModal({ type: "history" })}
            onShare={handleCopyShareLink}
            onRules={() => setModal({ type: "rules" })}
          />
        </div>
      </main>
      <MatchModalLayer
        showInningsEnd={showInningsEnd}
        match={match}
        modalType={modal.type}
        oversHistory={oversHistory}
        currentOverNumber={currentOverNumber}
        firstInningsOversPlayed={firstInningsOversPlayed}
        infoText={infoText}
        onNext={handleNextInningsOrEnd}
        onUpdate={patchAndUpdate}
        onScoreEvent={handleScoreEvent}
        onClose={() => setModal({ type: null })}
        onInfoClose={() => setInfoText(null)}
      />
    </>
  );
}
