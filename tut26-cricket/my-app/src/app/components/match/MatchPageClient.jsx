"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaBroadcastTower } from "react-icons/fa";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useAnnouncementSettings from "../live/useAnnouncementSettings";
import { WalkieNotice, WalkieRequestQueue } from "../live/WalkiePanel";
import useWalkieTalkie from "../live/useWalkieTalkie";
import MatchHeroBackdrop from "./MatchHeroBackdrop";
import { countLegalBalls } from "../../lib/match-scoring";
import {
  buildCurrentScoreAnnouncement,
  buildUmpireAnnouncement,
  buildUmpireTapAnnouncement,
  createScoreLiveEvent,
  createUndoLiveEvent,
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
import OptionalFeatureBoundary from "../shared/OptionalFeatureBoundary";

export default function MatchPageClient({
  matchId,
  initialAuthStatus,
  initialMatch,
}) {
  const router = useRouter();
  const [modal, setModal] = useState({ type: null });
  const [infoText, setInfoText] = useState(null);
  const localAnnouncementIdRef = useRef(0);
  const lastWalkieRequestSignatureRef = useRef("");
  const umpireAnnouncementTimerRef = useRef(null);
  const pendingUmpireAnnouncementRef = useRef(null);
  const { authStatus, authError, authSubmitting, submitPin } = useMatchAccess(
    matchId,
    initialAuthStatus
  );
  const { settings: umpireSettings, updateSetting: updateUmpireSetting } =
    useAnnouncementSettings("umpire", matchId);
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
    currentInningsHasHistory,
    replaceMatch,
    handleScoreEvent,
    handleUndo,
    handleNextInningsOrEnd,
    patchAndUpdate,
  } = useMatch(matchId, authStatus === "granted", initialMatch);
  const liveUpdatedLabel = useLiveRelativeTime(lastUpdatedAt);
  const isLiveMatch = Boolean(match?.isOngoing && !match?.result);
  const tossPending = Boolean(match && !match.tossReady);
  const walkie = useWalkieTalkie({
    matchId,
    enabled: Boolean(authStatus === "granted" && isLiveMatch),
    role: "umpire",
    hasUmpireAccess: authStatus === "granted",
    displayName: "Umpire",
    autoConnectAudio: Boolean(authStatus === "granted" && isLiveMatch),
  });
  const hasPendingWalkieRequests = Boolean(isLiveMatch && walkie.pendingRequests?.length);

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
    return () => {
      if (umpireAnnouncementTimerRef.current) {
        window.clearTimeout(umpireAnnouncementTimerRef.current);
        umpireAnnouncementTimerRef.current = null;
      }
      pendingUmpireAnnouncementRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isLiveMatch || !walkie.pendingRequests?.length) {
      lastWalkieRequestSignatureRef.current = "";
      return;
    }

    const nextSignature = walkie.pendingRequests
      .map((request) => request.requestId)
      .join("|");
    if (nextSignature === lastWalkieRequestSignatureRef.current) {
      return;
    }

    lastWalkieRequestSignatureRef.current = nextSignature;
    const latestRequest = walkie.pendingRequests[0];
    const requestRole =
      latestRequest?.role === "director" ? "Director" : "Spectator";

    try {
      speak(`${requestRole} requested walkie-talkie.`, {
        key: `umpire-walkie-request-${latestRequest?.requestId || nextSignature}`,
        rate: 0.9,
        interrupt: true,
        ignoreEnabled: true,
      });
    } catch (error) {
      console.error("Walkie request speech failed:", error);
    }
  }, [isLiveMatch, speak, walkie.pendingRequests]);

  const flushPendingUmpireAnnouncement = () => {
    const next = pendingUmpireAnnouncementRef.current;
    if (!next) return;

    pendingUmpireAnnouncementRef.current = null;
    localAnnouncementIdRef.current += 1;
    speak(next.text, {
      key: `umpire-${localAnnouncementIdRef.current}`,
      rate: 0.92,
      minGapMs: 0,
      userGesture: true,
      interrupt: true,
      ignoreEnabled: true,
    });
  };

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
    const text = buildUmpireTapAnnouncement(event, umpireSettings.mode);

    if (!text) return;

    pendingUmpireAnnouncementRef.current = { text };
    if (umpireAnnouncementTimerRef.current) {
      window.clearTimeout(umpireAnnouncementTimerRef.current);
    }
    umpireAnnouncementTimerRef.current = window.setTimeout(() => {
      umpireAnnouncementTimerRef.current = null;
      flushPendingUmpireAnnouncement();
    }, 140);
  };

  const handleAnnouncedScoreEvent = (runs, isOut = false, extraType = null) => {
    announceUmpireAction(runs, isOut, extraType);
    handleScoreEvent(runs, isOut, extraType);
  };

  const handleManualScoreAnnouncement = () => {
    if (!match) {
      return;
    }

    localAnnouncementIdRef.current += 1;
    speak(buildCurrentScoreAnnouncement(match), {
      key: `umpire-current-score-${localAnnouncementIdRef.current}`,
      rate: 0.9,
      minGapMs: 0,
      userGesture: true,
      ignoreEnabled: true,
      interrupt: true,
    });
  };

  const handleAnnouncedUndo = async () => {
    if (umpireAnnouncementTimerRef.current) {
      window.clearTimeout(umpireAnnouncementTimerRef.current);
      umpireAnnouncementTimerRef.current = null;
    }
    pendingUmpireAnnouncementRef.current = null;
    localAnnouncementIdRef.current += 1;
    const undoEvent = createUndoLiveEvent(match);
    const undoText = buildUmpireTapAnnouncement(undoEvent, umpireSettings.mode) || "Undo.";

    speak(undoText, {
      key: `umpire-undo-${localAnnouncementIdRef.current}`,
      rate: 0.92,
      minGapMs: 0,
      userGesture: true,
      interrupt: true,
      ignoreEnabled: true,
    });

    await handleUndo();
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
      await walkie.prepareToTalk?.();
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

  if (isLoading) return <Splash>Loading match...</Splash>;
  if (error && !match) return <Splash>Error: Could not load the match data.</Splash>;
  if (!match) return <Splash>Match not found.</Splash>;
  if (tossPending) return <Splash>Opening toss...</Splash>;

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
  const firstInningsComplete =
    match.innings === "first" && (oversDone || isAllOut);
  const matchFinished =
    Boolean(match.result) || (match.innings === "second" && !match.isOngoing);
  const showInningsEnd = firstInningsComplete || matchFinished;
  const controlsDisabled =
    isUpdating || showInningsEnd || Boolean(match.result) || tossPending;
  const showCompactUmpireWalkie = Boolean(
    !hasPendingWalkieRequests && isLiveMatch && walkie.snapshot?.enabled
  );

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
          <OptionalFeatureBoundary label="Walkie unavailable right now.">
            {showCompactUmpireWalkie ? (
              <div className="mb-4">
                <WalkieNotice
                  notice={walkie.notice}
                  onDismiss={walkie.dismissNotice}
                  quickTalkEnabled
                  quickTalkActive={walkie.isSelfTalking}
                  quickTalkFinishing={walkie.isFinishing}
                  quickTalkCountdown={walkie.countdown}
                  quickTalkFinishDelayLeft={walkie.finishDelayLeft}
                  onQuickTalkPrepare={walkie.prepareToTalk}
                  onQuickTalkStart={walkie.startTalking}
                  onQuickTalkStop={walkie.stopTalking}
                />
              </div>
            ) : !hasPendingWalkieRequests && walkie.notice && walkie.snapshot?.enabled ? (
              <section className="mb-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(10,10,14,0.98))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/14 text-emerald-300">
                      <FaBroadcastTower />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">Walkie-Talkie</h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        {walkie.isSelfTalking
                          ? "You are live"
                          : walkie.isFinishing
                          ? "Finishing"
                          : walkie.snapshot?.enabled
                          ? "Channel is live"
                          : "Channel update"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="min-h-[84px]">
                  <WalkieNotice
                    embedded
                    notice={walkie.notice}
                    onDismiss={walkie.dismissNotice}
                  />
                </div>
              </section>
            ) : null}
            {hasPendingWalkieRequests ? (
              <WalkieRequestQueue
                requests={walkie.pendingRequests}
                onAccept={walkie.acceptRequest}
                onDismiss={walkie.dismissRequest}
              />
            ) : null}
          </OptionalFeatureBoundary>
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
            historyStackLength={currentInningsHasHistory ? historyStack.length : 0}
            onEditTeams={() => setModal({ type: "editTeams" })}
            onEditOvers={() => setModal({ type: "editOvers" })}
            onUndo={handleAnnouncedUndo}
            onHistory={() => setModal({ type: "history" })}
            onImage={() => setModal({ type: "image" })}
            onCommentary={() => setModal({ type: "commentary" })}
            onWalkie={() => setModal({ type: "walkie" })}
            onMic={() => setModal({ type: "mic" })}
            onShare={handleCopyShareLink}
            onWalkiePressStart={walkie.prepareToTalk}
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
      <OptionalFeatureBoundary label="Optional match tools unavailable right now.">
        <MatchModalLayer
          showInningsEnd={showInningsEnd}
          match={match}
          modalType={modal.type}
          isUpdating={isUpdating}
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
                      try {
                        prime();
                        speak("Umpire voice on.", {
                          key: "umpire-voice-enabled",
                          rate: 0.9,
                          interrupt: false,
                          userGesture: true,
                          ignoreEnabled: true,
                        });
                      } catch (error) {
                        console.error("Umpire announcer enable failed:", error);
                      }
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
                  announceLabel: "Read Score",
                  announceDisabled: false,
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
                  needsAudioUnlock: walkie.needsAudioUnlock,
                  requestCooldownLeft: 0,
                  requestState: "idle",
                  pendingRequests: walkie.pendingRequests,
                  onRequestEnable: () => {},
                  onToggleEnabled: walkie.toggleEnabled,
                  onStartTalking: walkie.startTalking,
                  onStopTalking: walkie.stopTalking,
                  onUnlockAudio: walkie.unlockAudio,
                  onPrepareTalking: walkie.prepareToTalk,
                  onDismissNotice: walkie.dismissNotice,
                  onAcceptRequest: walkie.acceptRequest,
                  onDismissRequest: walkie.dismissRequest,
                }
              : null
          }
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
      </OptionalFeatureBoundary>
    </>
  );
}
