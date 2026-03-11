"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useAnnouncementSettings from "../live/useAnnouncementSettings";
import { WalkieNotice, WalkieRequestQueue } from "../live/WalkiePanel";
import useWalkieTalkie from "../live/useWalkieTalkie";
import MatchHeroBackdrop from "./MatchHeroBackdrop";
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
  const router = useRouter();
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
  const micMonitor = useLocalMicMonitor();
  const { speak, prime, stop, status, voiceName } =
    useSpeechAnnouncer(umpireSettings);
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
  const tossPending = !match?.tossWinner || !match?.tossDecision;
  const walkie = useWalkieTalkie({
    matchId,
    enabled: Boolean(authStatus === "granted" && isLiveMatch),
    role: "umpire",
    hasUmpireAccess: authStatus === "granted",
    displayName: "Umpire",
  });
  const hasPendingWalkieRequests = Boolean(isLiveMatch && walkie.pendingRequests?.length);

  useEffect(() => {
    lastLocalActionRef.current = "";
  }, [match?.lastLiveEvent?.id]);

  useEffect(() => {
    if (authStatus === "granted" && match && tossPending) {
      router.replace(`/toss/${matchId}`);
    }
  }, [authStatus, match, matchId, router, tossPending]);

  useEffect(() => {
    if (!isLiveMatch) {
      stop();
    }
  }, [isLiveMatch, stop]);

  useEffect(() => {
    if (announceCooldownLeft <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setAnnounceCooldownLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [announceCooldownLeft]);

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
      rate: 0.92,
      minGapMs: 250,
      userGesture: true,
    });
  };

  const handleAnnouncedScoreEvent = (runs, isOut = false, extraType = null) => {
    announceUmpireAction(runs, isOut, extraType);
    handleScoreEvent(runs, isOut, extraType);
  };

  const handleManualScoreAnnouncement = () => {
    if (!match || announceCooldownLeft > 0) {
      return;
    }

    setAnnounceCooldownLeft(3);
    speak(buildCurrentScoreAnnouncement(match), {
      key: `umpire-current-score-${match._id}`,
      rate: 0.9,
      minGapMs: 2500,
      userGesture: true,
      ignoreEnabled: true,
    });
  };

  const handleUmpirePressFeedback = () => {
    triggerMatchHapticFeedback();
  };

  const openModalWithFeedback = (type) => {
    triggerMatchHapticFeedback();
    setModal({ type });
  };

  const handleCopyShareLink = async () => {
    if (!match) return;

    triggerMatchHapticFeedback();
    const link = `${window.location.origin}/session/${match.sessionId}/view`;
    const shareTitle = `${match.innings1.team} vs ${match.innings2.team}`;
    const shareText = `Follow the live score for ${shareTitle}. Current score: ${match.score}/${match.outs}.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: link });
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(link);
        alert("Spectator link copied to clipboard.");
        return;
      } catch {
        // Fall through to the browser prompt if clipboard access is blocked.
      }
    }

    window.prompt("Copy spectator link", link);
  };

  const handleWalkieHoldStart = async () => {
    if (!isLiveMatch) {
      return;
    }

    if (!walkie.snapshot?.enabled) {
      if (!walkie.canEnable) {
        return;
      }

      await walkie.toggleEnabled(true);
    }

    if (walkie.canTalk || walkie.snapshot?.enabled) {
      await walkie.startTalking();
    }
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
  if (error && !match) return <Splash>Error: Could not load match data.</Splash>;
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
  const controlsDisabled =
    isUpdating || showInningsEnd || Boolean(match.result) || tossPending;

  return (
    <>
      <main className="min-h-screen font-sans bg-zinc-950 text-white p-4">
        <div className="max-w-md mx-auto pt-8 pb-24">
          <MatchHeroBackdrop match={match} className="mb-5">
            <div className="px-5 pt-6 pb-5">
              <div className="flex items-center justify-center gap-3 mb-4 text-sm text-zinc-200">
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
              <MatchHeader match={match} />
              <Scoreboard match={match} history={oversHistory} />
            </div>
          </MatchHeroBackdrop>
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {error.message || "Match update failed."}
            </div>
          ) : null}
          {!hasPendingWalkieRequests ? (
            <WalkieNotice
              notice={walkie.notice}
              onDismiss={walkie.dismissNotice}
            />
          ) : null}
          {hasPendingWalkieRequests ? (
            <WalkieRequestQueue
              requests={walkie.pendingRequests}
              onAccept={walkie.acceptRequest}
              onDismiss={walkie.dismissRequest}
            />
          ) : null}
          <BallTracker history={oversHistory} />
          <Controls
            onScore={handleAnnouncedScoreEvent}
            onOut={() => openModalWithFeedback("out")}
            onNoBall={() => openModalWithFeedback("noball")}
            onWide={() => openModalWithFeedback("wide")}
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
            onCommentary={() => setModal({ type: "commentary" })}
            onWalkie={() => setModal({ type: "walkie" })}
            onMic={() => setModal({ type: "mic" })}
            onShare={handleCopyShareLink}
            onWalkieHoldStart={handleWalkieHoldStart}
            onWalkieHoldEnd={() => walkie.stopTalking()}
            onMicHoldStart={
              isLiveMatch ? () => micMonitor.start({ pauseMedia: true }) : undefined
            }
            onMicHoldEnd={() => micMonitor.stop({ resumeMedia: true })}
            onPressFeedback={handleUmpirePressFeedback}
            isWalkieActive={Boolean(walkie.snapshot?.enabled)}
            isWalkieTalking={Boolean(walkie.isSelfTalking)}
            isWalkieFinishing={Boolean(walkie.isFinishing)}
            isCommentaryActive={micMonitor.isActive || micMonitor.isPaused}
            isCommentaryTalking={Boolean(micMonitor.isActive)}
            isAnnounceActive={Boolean(umpireSettings.enabled)}
          />
        </div>
      </main>
      <MatchModalLayer
        showInningsEnd={showInningsEnd}
        match={match}
        modalType={modal.type}
        micMonitor={micMonitor}
        commentaryProps={
          isLiveMatch
            ? {
                title: "Umpire Commentary",
                variant: "modal",
                simpleMode: true,
                onClose: () => setModal({ type: null }),
                settings: umpireSettings,
                updateSetting: updateUmpireSetting,
                onToggleEnabled: (nextEnabled) => {
                  if (nextEnabled) {
                    prime();
                    speak("Umpire voice on.", {
                      key: "umpire-voice-enabled",
                      rate: 0.9,
                      interrupt: false,
                      userGesture: true,
                      ignoreEnabled: true,
                    });
                  } else {
                    stop();
                  }
                },
                statusText: umpireSettings.enabled
                  ? status === "waiting_for_gesture"
                    ? voiceName
                      ? voiceName
                      : "Tap Read Score once."
                    : voiceName
                    ? voiceName
                    : ""
                  : "",
                onAnnounceNow: handleManualScoreAnnouncement,
                announceLabel:
                  announceCooldownLeft > 0
                    ? `Read Score (${announceCooldownLeft}s)`
                    : "Read Score",
                announceDisabled: announceCooldownLeft > 0,
              }
            : null
        }
        walkieProps={
          isLiveMatch
            ? {
                role: "umpire",
                snapshot: walkie.snapshot,
                notice: walkie.notice,
                error: walkie.error,
                canEnable: walkie.canEnable,
                canRequestEnable: false,
                canTalk: walkie.canTalk,
                isSelfTalking: walkie.isSelfTalking,
                isFinishing: walkie.isFinishing,
                countdown: walkie.countdown,
                finishDelayLeft: walkie.finishDelayLeft,
                requestCooldownLeft: 0,
                requestState: "idle",
                pendingRequests: walkie.pendingRequests,
                onRequestEnable: () => {},
                onToggleEnabled: walkie.toggleEnabled,
                onStartTalking: walkie.startTalking,
                onStopTalking: walkie.stopTalking,
                onDismissNotice: walkie.dismissNotice,
                onAcceptRequest: walkie.acceptRequest,
                onDismissRequest: walkie.dismissRequest,
              }
            : null
        }
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
