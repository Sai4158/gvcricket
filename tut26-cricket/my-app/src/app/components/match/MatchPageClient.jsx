"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaBroadcastTower } from "react-icons/fa";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useAnnouncementSettings from "../live/useAnnouncementSettings";
import useLiveSoundEffectsPlayer from "../live/useLiveSoundEffectsPlayer";
import { WalkieNotice, WalkieRequestQueue } from "../live/WalkiePanel";
import useWalkieTalkie from "../live/useWalkieTalkie";
import MatchHeroBackdrop from "./MatchHeroBackdrop";
import { countLegalBalls } from "../../lib/match-scoring";
import {
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
  createScoreLiveEvent,
  createUndoLiveEvent,
} from "../../lib/live-announcements";
import { getWalkieRemoteSpeakerState } from "../../lib/walkie-ui";
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
import MatchSoundEffectsPanel from "./MatchSoundEffectsPanel";
import useLiveRelativeTime from "../live/useLiveRelativeTime";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import useMatch, { triggerMatchHapticFeedback } from "./useMatch";
import useMatchAccess from "./useMatchAccess";
import OptionalFeatureBoundary from "../shared/OptionalFeatureBoundary";
import { buildShareUrl } from "../../lib/site-metadata";
import {
  fetchCachedSoundEffectsLibrary,
  persistSoundEffectsOrder,
  readCachedSoundEffectsLibrary,
  readCachedSoundEffectsOrder,
  sortSoundEffectsByOrder,
  writeCachedSoundEffectsLibrary,
  writeCachedSoundEffectsOrder,
} from "../../lib/sound-effects-client";
import { applyMatchAction } from "../../lib/match-engine";

function createSoundEffectRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `sound-effect:${crypto.randomUUID()}`;
  }

  return `sound-effect:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export default function MatchPageClient({
  matchId,
  initialAuthStatus,
  initialMatch,
}) {
  const router = useRouter();
  const [modal, setModal] = useState({ type: null });
  const [infoText, setInfoText] = useState(null);
  const [soundEffectsOpen, setSoundEffectsOpen] = useState(false);
  const [soundEffectFiles, setSoundEffectFiles] = useState(() => {
    const cachedFiles = readCachedSoundEffectsLibrary();
    return sortSoundEffectsByOrder(cachedFiles, readCachedSoundEffectsOrder());
  });
  const [soundEffectLibraryStatus, setSoundEffectLibraryStatus] = useState(() =>
    readCachedSoundEffectsLibrary().length ? "ready" : "idle",
  );
  const [soundEffectError, setSoundEffectError] = useState("");
  const localAnnouncementIdRef = useRef(0);
  const lastWalkieRequestSignatureRef = useRef("");
  const umpireAnnouncementTimerRef = useRef(null);
  const pendingUmpireAnnouncementRef = useRef(null);
  const previousSoundEffectMatchIdRef = useRef(initialMatch?._id || "");
  const lastSoundEffectTriggerRef = useRef({ effectId: "", at: 0 });
  const lastHandledSoundEffectEventRef = useRef(
    initialMatch?.lastLiveEvent?.type === "sound_effect"
      ? initialMatch.lastLiveEvent.id || ""
      : "",
  );
  const localSoundEffectRequestIdRef = useRef("");
  const { authStatus, authError, authSubmitting, submitPin } = useMatchAccess(
    matchId,
    initialAuthStatus
  );
  const { settings: umpireSettings, updateSetting: updateUmpireSetting } =
    useAnnouncementSettings("umpire", matchId);
  const micMonitor = useLocalMicMonitor();
  const { speak, speakSequence, prime, stop, status, voiceName } =
    useSpeechAnnouncer(umpireSettings);
  const {
    audioRef: soundEffectsAudioRef,
    activeEffectId: activeSoundEffectId,
    needsUnlock: soundEffectsNeedsUnlock,
    playEffect: playLocalSoundEffect,
  } = useLiveSoundEffectsPlayer({
    volume: 1,
    onBeforePlay: () => {
      stop();
    },
  });
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
  const umpireRemoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot: walkie.snapshot,
    participantId: walkie.participantId,
    isSelfTalking: walkie.isSelfTalking,
  });

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
    const nextMatchId = match?._id || "";
    if (previousSoundEffectMatchIdRef.current === nextMatchId) {
      return;
    }

    previousSoundEffectMatchIdRef.current = nextMatchId;
    localSoundEffectRequestIdRef.current = "";
    lastHandledSoundEffectEventRef.current =
      match?.lastLiveEvent?.type === "sound_effect"
        ? match.lastLiveEvent.id || ""
        : "";
  }, [match?._id, match?.lastLiveEvent?.id, match?.lastLiveEvent?.type]);

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
    if (!umpireSettings.enabled || umpireSettings.mode === "silent") {
      return;
    }
    localAnnouncementIdRef.current += 1;
    speakSequence(next.items, {
      key: `umpire-${localAnnouncementIdRef.current}`,
      priority: next.priority || 2,
      minGapMs: 0,
      userGesture: true,
      interrupt: true,
    });
  };

  const speakImmediateUmpireSequence = (sequence, keyPrefix) => {
    if (!sequence?.items?.length || !umpireSettings.enabled || umpireSettings.mode === "silent") {
      return;
    }

    localAnnouncementIdRef.current += 1;
    speakSequence(sequence.items, {
      key: `${keyPrefix}-${localAnnouncementIdRef.current}`,
      priority: sequence.priority || 2,
      minGapMs: 0,
      userGesture: true,
      interrupt: true,
    });
  };

  const announceUmpireAction = (runs, isOut = false, extraType = null) => {
    if (!umpireSettings.enabled || umpireSettings.mode === "silent" || !isLiveMatch) {
      return;
    }

    let nextMatch = match;
    if (match) {
      try {
        nextMatch = applyMatchAction(match, {
          actionId: `umpire-preview:${Date.now()}`,
          type: "score_ball",
          runs,
          isOut,
          extraType,
        });
      } catch {
        nextMatch = match;
      }
    }
    const event = createScoreLiveEvent(match, nextMatch || match, {
      runs,
      isOut,
      extraType,
    });
    const sequence = buildLiveScoreAnnouncementSequence(
      event,
      nextMatch || match,
      umpireSettings.mode
    );

    if (!sequence.items.length) return;

    pendingUmpireAnnouncementRef.current = sequence;
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

  const ensureUmpireScoreFeedbackEnabled = () => {
    if (!umpireSettings.enabled) {
      updateUmpireSetting("enabled", true);
    }

    if (umpireSettings.mode === "silent") {
      updateUmpireSetting("mode", "simple");
    }
  };

  const handleScoreFeedbackHoldStart = () => {
    if (!match) {
      return;
    }

    ensureUmpireScoreFeedbackEnabled();
    prime({ userGesture: true });
    handleManualScoreAnnouncement();
  };

  const loadSoundEffectsLibrary = useCallback(async () => {
    if (soundEffectLibraryStatus === "loading") {
      return;
    }

    if (soundEffectFiles.length) {
      setSoundEffectLibraryStatus("ready");
      return;
    }

    setSoundEffectLibraryStatus("loading");
    setSoundEffectError("");

    try {
      const nextFiles = await fetchCachedSoundEffectsLibrary();
      setSoundEffectFiles(nextFiles);
      setSoundEffectLibraryStatus("ready");
    } catch (caughtError) {
      setSoundEffectLibraryStatus("idle");
      setSoundEffectError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load sound effects.",
      );
    }
  }, [soundEffectFiles.length, soundEffectLibraryStatus]);

  const toggleSoundEffectsPanel = useCallback(() => {
    setSoundEffectsOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        void loadSoundEffectsLibrary();
      }
      return nextOpen;
    });
  }, [loadSoundEffectsLibrary]);

  const handlePlaySoundEffect = useCallback(
    async (file) => {
      if (!match?._id || !isLiveMatch || !file?.src) {
        return;
      }

      const now = Date.now();
      if (
        lastSoundEffectTriggerRef.current.effectId === file.id &&
        now - lastSoundEffectTriggerRef.current.at < 220
      ) {
        return;
      }
      lastSoundEffectTriggerRef.current = {
        effectId: file.id,
        at: now,
      };

      triggerMatchHapticFeedback();
      setSoundEffectError("");

      const clientRequestId = createSoundEffectRequestId();
      const playedLocally = await playLocalSoundEffect(file, {
        userGesture: true,
      });
      if (!playedLocally) {
        return;
      }
      localSoundEffectRequestIdRef.current = clientRequestId;

      try {
        const response = await fetch(`/api/matches/${matchId}/sound-effects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            effectId: file.id,
            clientRequestId,
          }),
        });
        if (!response.ok) {
          const payload = await response
            .json()
            .catch(() => ({ message: "Could not play the sound effect." }));
          throw new Error(payload?.message || "Could not play the sound effect.");
        }
      } catch (caughtError) {
        console.error("Sound effect trigger failed:", caughtError);
        setSoundEffectError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not play the sound effect.",
        );
      }
    },
    [isLiveMatch, match?._id, matchId, playLocalSoundEffect],
  );

  const handleReorderSoundEffects = useCallback((activeId, targetId) => {
    if (!activeId || !targetId || activeId === targetId) {
      return;
    }

    setSoundEffectFiles((currentFiles) => {
      const activeIndex = currentFiles.findIndex((file) => file.id === activeId);
      const targetIndex = currentFiles.findIndex((file) => file.id === targetId);

      if (activeIndex < 0 || targetIndex < 0) {
        return currentFiles;
      }

      const nextFiles = [...currentFiles];
      const [movedItem] = nextFiles.splice(activeIndex, 1);
      nextFiles.splice(targetIndex, 0, movedItem);

      writeCachedSoundEffectsLibrary(nextFiles);
      const nextOrder = nextFiles.map((file) => file.id);
      writeCachedSoundEffectsOrder(nextOrder);
      void persistSoundEffectsOrder(nextOrder);

      return nextFiles;
    });
  }, []);

  useEffect(() => {
    const liveEvent = match?.lastLiveEvent;
    if (!liveEvent?.id || liveEvent.type !== "sound_effect") {
      return;
    }

    if (lastHandledSoundEffectEventRef.current === liveEvent.id) {
      return;
    }

    lastHandledSoundEffectEventRef.current = liveEvent.id;
    if (
      liveEvent.clientRequestId &&
      liveEvent.clientRequestId === localSoundEffectRequestIdRef.current
    ) {
      localSoundEffectRequestIdRef.current = "";
      return;
    }

    stop();
    void playLocalSoundEffect(
      {
        id: liveEvent.effectId || liveEvent.effectFileName || liveEvent.id,
        fileName: liveEvent.effectFileName || liveEvent.effectId || "",
        label: liveEvent.effectLabel || "Sound effect",
        src: liveEvent.effectSrc || "",
      },
      { userGesture: false },
    );
  }, [match?.lastLiveEvent, playLocalSoundEffect, stop]);

  const handleAnnouncedUndo = async () => {
    if (umpireAnnouncementTimerRef.current) {
      window.clearTimeout(umpireAnnouncementTimerRef.current);
      umpireAnnouncementTimerRef.current = null;
    }
    pendingUmpireAnnouncementRef.current = null;
    const undoEvent = createUndoLiveEvent(match);
    const undoSequence = buildLiveScoreAnnouncementSequence(
      undoEvent,
      match,
      umpireSettings.mode
    );
    speakImmediateUmpireSequence(undoSequence, "umpire-undo");

    await handleUndo();
  };

  const handleAnnouncedPatchUpdate = async (payload) => {
    const nextMatch = await patchAndUpdate(payload);
    if (!nextMatch) {
      return null;
    }

    if (
      payload?.innings1Score === undefined &&
      payload?.overs === undefined
    ) {
      return nextMatch;
    }

    const correctionSequence = buildLiveScoreAnnouncementSequence(
      nextMatch.lastLiveEvent,
      nextMatch,
      umpireSettings.mode
    );
    speakImmediateUmpireSequence(correctionSequence, "umpire-correction");
    return nextMatch;
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
    const link = buildShareUrl(
      `/session/${match.sessionId}/view`,
      window.location.origin
    );
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
      const prepared = await walkie.prepareToTalk?.();
      if (prepared === false) {
        return;
      }
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
                  notice={
                    umpireRemoteSpeakerState.isRemoteTalking
                      ? umpireRemoteSpeakerState.title
                      : walkie.notice
                  }
                  onDismiss={walkie.dismissNotice}
                  quickTalkEnabled={!umpireRemoteSpeakerState.isRemoteTalking}
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
                          : umpireRemoteSpeakerState.isRemoteTalking
                          ? umpireRemoteSpeakerState.shortStatus
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
                    notice={
                      umpireRemoteSpeakerState.isRemoteTalking
                        ? umpireRemoteSpeakerState.title
                        : walkie.notice
                    }
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
          {isLiveMatch ? (
            <MatchSoundEffectsPanel
              files={soundEffectFiles}
              isDisabled={controlsDisabled}
              isLoading={soundEffectLibraryStatus === "loading"}
              isOpen={soundEffectsOpen}
              error={soundEffectError}
              activeEffectId={activeSoundEffectId}
              needsUnlock={soundEffectsNeedsUnlock}
              onToggle={toggleSoundEffectsPanel}
              onMinimize={() => setSoundEffectsOpen(false)}
              onPlayEffect={handlePlaySoundEffect}
              onReorder={handleReorderSoundEffects}
            />
          ) : null}
          <MatchActionGrid
            isUpdating={isUpdating}
            historyStackLength={currentInningsHasHistory ? historyStack.length : 0}
            onEditTeams={() => setModal({ type: "editTeams" })}
            onEditOvers={() => setModal({ type: "editOvers" })}
            editOversLabel={
              match?.innings === "second" ? (
                <>
                  Edit overs
                  <br />
                  / innings
                </>
              ) : (
                "Edit overs"
              )
            }
            onUndo={handleAnnouncedUndo}
            onHistory={() => setModal({ type: "history" })}
            onImage={() => setModal({ type: "image" })}
            onCommentary={() => setModal({ type: "commentary" })}
            onCommentaryHoldStart={handleScoreFeedbackHoldStart}
            onWalkie={() => setModal({ type: "walkie" })}
            onMic={() => setModal({ type: "mic" })}
            onShare={handleCopyShareLink}
            onWalkiePressStart={
              umpireRemoteSpeakerState.isRemoteTalking ? undefined : walkie.prepareToTalk
            }
            onWalkieHoldStart={
              umpireRemoteSpeakerState.isRemoteTalking ? undefined : handleWalkieHoldStart
            }
            onWalkieHoldEnd={() => walkie.stopTalking()}
            onMicHoldStart={
              isLiveMatch ? () => micMonitor.start({ pauseMedia: true }) : undefined
            }
            onMicHoldEnd={() => micMonitor.stop({ resumeMedia: true })}
            onPressFeedback={handleUmpirePressFeedback}
            isWalkieActive={Boolean(walkie.snapshot?.enabled)}
            isWalkieTalking={Boolean(walkie.isSelfTalking)}
            isWalkieFinishing={Boolean(walkie.isFinishing)}
            isWalkieLoading={Boolean(
              walkie.claiming ||
                walkie.preparingToTalk ||
                walkie.recoveringAudio ||
                walkie.recoveringSignaling ||
                walkie.updatingEnabled
            )}
            isWalkieBusyByOther={Boolean(umpireRemoteSpeakerState.isRemoteTalking)}
            walkieBusyLabel={umpireRemoteSpeakerState.roleLabel}
            isCommentaryActive={micMonitor.isActive || micMonitor.isPaused}
            isCommentaryTalking={Boolean(micMonitor.isActive)}
            isAnnounceActive={Boolean(umpireSettings.enabled)}
          />
          <audio ref={soundEffectsAudioRef} hidden />
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
                    if (!nextEnabled) {
                      if (umpireAnnouncementTimerRef.current) {
                        window.clearTimeout(umpireAnnouncementTimerRef.current);
                        umpireAnnouncementTimerRef.current = null;
                      }
                      pendingUmpireAnnouncementRef.current = null;
                    }

                    if (nextEnabled) {
                      if (umpireSettings.mode === "silent") {
                        updateUmpireSetting("mode", "simple");
                      }
                      try {
                        prime({ userGesture: true });
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
                  claiming: walkie.claiming,
                  preparingToTalk: walkie.preparingToTalk,
                  updatingEnabled: walkie.updatingEnabled,
                  recoveringAudio: walkie.recoveringAudio,
                  recoveringSignaling: walkie.recoveringSignaling,
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
          onUpdate={handleAnnouncedPatchUpdate}
          onImageUploaded={replaceMatch}
          onScoreEvent={handleAnnouncedScoreEvent}
          onClose={() => setModal({ type: null })}
          onInfoClose={() => setInfoText(null)}
        />
      </OptionalFeatureBoundary>
    </>
  );
}
