"use client";

import { useEffect, useRef, useState } from "react";
import AnnouncementControls from "../live/AnnouncementControls";
import useAnnouncementSettings from "../live/useAnnouncementSettings";
import MatchImageCard from "./MatchImageCard";
import { countLegalBalls } from "../../lib/match-scoring";
import {
  buildCurrentScoreAnnouncement,
  buildUmpireAnnouncement,
  createScoreLiveEvent,
} from "../../lib/live-announcements";
import { getTotalDismissalsAllowed } from "../../lib/team-utils";
import {
  MatchHeader,
  Scoreboard,
  Splash,
  AccessGate,
} from "./MatchStatusShell";
import { Controls } from "./MatchControls";
import { BallTracker } from "./MatchBallHistory";
import MatchActionGrid from "./MatchActionGrid";
import MatchModalLayer from "./MatchModalLayer";
import useLiveRelativeTime from "../live/useLiveRelativeTime";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import useMatch, { triggerMatchHapticFeedback } from "./useMatch";
import useMatchAccess from "./useMatchAccess";

export default function MatchPageClient({
  matchId,
  initialAuthStatus,
  initialMatch,
}) {
  const [modal, setModal] = useState({ type: null });
  const [infoText, setInfoText] = useState(null);
  const [announceCooldownLeft, setAnnounceCooldownLeft] = useState(0);
  const lastLocalActionRef = useRef("");
  const { authStatus, authError, authSubmitting, submitPin } = useMatchAccess(
    matchId,
    initialAuthStatus
  );
  const { settings: umpireSettings, updateSetting: updateUmpireSetting } =
    useAnnouncementSettings("umpire");
  const { speak, prime, stop, status, voiceName } = useSpeechAnnouncer(umpireSettings);
  const {
    match,
    error,
    isLoading,
    isUpdating,
    lastUpdatedAt,
    historyStack,
    replaceMatch,
    handleScoreEvent,
    handleUndo,
    handleNextInningsOrEnd,
    patchAndUpdate,
  } = useMatch(matchId, authStatus === "granted", initialMatch);
  const liveUpdatedLabel = useLiveRelativeTime(lastUpdatedAt);
  const isLiveMatch = Boolean(match?.isOngoing && !match?.result);

  useEffect(() => {
    lastLocalActionRef.current = "";
  }, [match?.lastLiveEvent?.id]);

  useEffect(() => {
    if (!isLiveMatch) {
      stop();
    }
  }, [isLiveMatch, stop]);

  const announceUmpireAction = (runs, isOut = false, extraType = null) => {
    const nextMatch = match
      ? {
          ...match,
          score: match.score + runs,
          outs: isOut ? match.outs + 1 : match.outs,
        }
      : null;
    const event = createScoreLiveEvent(match, nextMatch || match, {
      runs,
      isOut,
      extraType,
    });
    const text = buildUmpireAnnouncement(event, umpireSettings.mode);

    if (!text || lastLocalActionRef.current === text) return;
    lastLocalActionRef.current = text;
    speak(text, {
      key: `umpire-${text}`,
      rate: 1.03,
      minGapMs: 250,
      userGesture: true,
    });
  };

  const handleAnnouncedScoreEvent = (runs, isOut = false, extraType = null) => {
    announceUmpireAction(runs, isOut, extraType);
    handleScoreEvent(runs, isOut, extraType);
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
  const legalBalls = countLegalBalls(oversHistory);
  const oversDone = legalBalls >= match.overs * 6;
  const maxWickets = getTotalDismissalsAllowed(match);
  const isAllOut = maxWickets > 0 && match.outs >= maxWickets;
  const showInningsEnd =
    !match.isOngoing || Boolean(match.result) || oversDone || isAllOut;
  const controlsDisabled = isUpdating || showInningsEnd || Boolean(match.result);

  return (
    <>
      <main className="min-h-screen font-sans bg-zinc-950 text-white p-4">
        <div className="max-w-md mx-auto pt-8 pb-24">
          <div className="flex items-center justify-center gap-3 mb-4 text-sm text-zinc-300">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
              Live
            </span>
            <span suppressHydrationWarning>{liveUpdatedLabel}</span>
          </div>
          {match.result && (
            <div className="bg-green-900/50 text-green-300 p-4 rounded-xl text-center mb-4 ring-1 ring-green-500">
              <h3 className="font-bold text-xl">Match Over</h3>
              <p>{match.result}</p>
            </div>
          )}
          <div className="mb-5">
            <MatchImageCard match={match} compact title="Match Cover" />
          </div>
          {isLiveMatch ? <div className="mb-5">
            <AnnouncementControls
              title="Umpire Feedback"
              subtitle="Short local voice confirmation for each scoring input."
              settings={umpireSettings}
              updateSetting={updateUmpireSetting}
              showAccessibility
              onToggleEnabled={(nextEnabled) => {
                if (nextEnabled) {
                  prime();
                }
              }}
              statusText={
                umpireSettings.enabled
                  ? voiceName
                    ? `Voice ready: ${voiceName}${status === "waiting_for_gesture" ? " · tap once if playback is blocked" : ""}`
                    : status === "waiting_for_gesture"
                    ? "Tap once to enable voice playback on this browser."
                    : "Voice will use your browser's English voice."
                  : ""
              }
              onAnnounceNow={() =>
                speak(buildCurrentScoreAnnouncement(match), {
                  key: "umpire-current-score",
                  rate: 1,
                  userGesture: true,
                })
              }
            />
          </div> : null}
          <MatchHeader match={match} />
          <Scoreboard match={match} history={oversHistory} />
          <BallTracker history={oversHistory} />
          <Controls
            onScore={handleAnnouncedScoreEvent}
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
            onImage={() => setModal({ type: "image" })}
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
        onImageUploaded={replaceMatch}
        onScoreEvent={handleAnnouncedScoreEvent}
        onClose={() => setModal({ type: null })}
        onInfoClose={() => setInfoText(null)}
      />
    </>
  );
}
