"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: MatchPageLayout.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { FaBroadcastTower, FaEllipsisV } from "react-icons/fa";
import SiteFooter from "../../shared/SiteFooter";
import { WalkieNotice, WalkieRequestQueue } from "../../live/WalkiePanel";
import MatchHeroBackdrop from "../MatchHeroBackdrop";
import {
  MatchHeader,
  Scoreboard,
} from "../MatchStatusShell";
import { Controls } from "../MatchControls";
import { BallTracker } from "../MatchBallHistory";
import MatchActionGrid from "../MatchActionGrid";
import MatchModalLayer from "../MatchModalLayer";
import MatchSoundEffectsPanel from "../MatchSoundEffectsPanel";
import OptionalFeatureBoundary from "../../shared/OptionalFeatureBoundary";
import { ENTRY_SCORE_SOUND_EFFECTS_MODAL } from "./match-page-helpers";

export default function MatchPageLayout({
  activeSoundEffectCurrentTime,
  activeSoundEffectId,
  activeSoundEffectStatus,
  canGridHoldMic,
  canGridHoldWalkie,
  commentarySoundEffectOptions,
  contentStartRef,
  controlsDisabled,
  currentInningsHasHistory,
  currentOverNumber,
  entryScoreAnnouncementsEnabled,
  entryScoreSoundEffectsEnabled,
  error,
  firstInningsOversPlayed,
  handleAnnouncedPatchUpdate,
  handleAnnouncedScoreEvent,
  handleAnnouncedUndo,
  handleCommentaryReadScoreAction,
  handleCommentaryTestSequenceAction,
  handleCopyShareLink,
  handleEntryScoreSoundPromptSave,
  handleForceContinuePastSpeech,
  handleHeroMenuScroll,
  handleHeroReadScoreAction,
  handleMicHoldEnd,
  handleMicHoldStart,
  handlePlaySoundEffect,
  handlePreviewCommentarySoundEffect,
  handleProtectedNextInningsOrEnd,
  handleReorderSoundEffects,
  handleStageCardUndo,
  handleStopLiveSoundEffect,
  handleUmpirePressFeedback,
  handleWalkieHoldStart,
  historyStack,
  infoText,
  isLiveMatch,
  isReadScoreActionActive,
  isStageCardUndoPending,
  isTestSequenceActionActive,
  isUndoCoolingDown,
  isUpdating,
  liveUpdatedLabel,
  loadSoundEffectsLibrary,
  match,
  micMonitor,
  modal,
  oversHistory,
  openModalWithFeedback,
  pendingStageCardCountdownLabel,
  pendingUmpireAnnouncementRef,
  previewingCommentarySoundEffectId,
  prime,
  replaceMatch,
  setEntryScoreAnnouncementsEnabled,
  setEntryScoreSoundEffectsEnabled,
  setInfoText,
  setModal,
  scoreControlDisabledKeys,
  setSoundEffectsOpen,
  setStageContinuePrompt,
  showCompactUmpireWalkie,
  showPendingMatchOverCountdown,
  showVisibleInningsEndCard,
  soundEffectDurations,
  soundEffectError,
  soundEffectFiles,
  soundEffectLibraryStatus,
  soundEffectsAudioRef,
  soundEffectsNeedsUnlock,
  soundEffectsOpen,
  stageContinuePrompt,
  status,
  stop,
  speakWithAnnouncementDuck,
  toggleSoundEffectsPanel,
  umpireAnnouncementTimerRef,
  umpireRemoteSpeakerState,
  umpireSettings,
  updateUmpireScoreSoundSettings,
  updateUmpireSetting,
  voiceName,
  walkie,
} = {}) {
  const hasPendingWalkieRequests = Boolean(walkie.pendingRequests?.length);
  const displayResult = String(match?.pendingResult || match?.result || "").trim();

  return (
    <>
      <main id="top" className="min-h-screen font-sans bg-zinc-950 text-white p-4">
        <div className="max-w-md mx-auto pt-8 pb-24">
          <MatchHeroBackdrop match={match} className="mb-5">
            <div className="relative px-5 pt-6 pb-5">
              <button
                type="button"
                onClick={handleHeroMenuScroll}
                aria-label="Scroll to match controls"
                className="absolute right-5 top-5 inline-flex h-12 w-12 items-center justify-center text-white transition hover:scale-105 hover:text-white/85"
              >
                <FaEllipsisV className="text-[1.45rem]" />
              </button>
              <div className="mb-3 flex items-center justify-center gap-3 text-[12px] font-semibold text-zinc-400">
                <span className="inline-flex items-center gap-2 uppercase tracking-[0.14em] text-zinc-300">
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-red-500/35 animate-ping" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <span>Live</span>
                </span>
                <span className="h-3 w-px bg-white/12" />
                <span
                  suppressHydrationWarning
                  className="normal-case tracking-normal text-zinc-400"
                >
                  {liveUpdatedLabel}
                </span>
              </div>
              {displayResult ? (
                <div className="bg-green-900/50 text-green-300 p-4 rounded-xl text-center mb-4 ring-1 ring-green-500">
                  <h3 className="font-bold text-xl">Match Over</h3>
                  <p>{displayResult}</p>
                  {showPendingMatchOverCountdown &&
                  pendingStageCardCountdownLabel ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-green-200/80">
                      {pendingStageCardCountdownLabel}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <MatchHeader
                match={match}
                onAnnounceScore={handleHeroReadScoreAction}
                announceIsActive={isReadScoreActionActive}
              />
              <Scoreboard
                match={match}
                legalBallCount={match?.legalBallCount}
              />
            </div>
          </MatchHeroBackdrop>
          <div ref={contentStartRef} />
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
                  quickTalkEnabled={Boolean(
                    !umpireRemoteSpeakerState.isRemoteTalking &&
                      (walkie.snapshot?.enabled ||
                        walkie.claiming ||
                        walkie.preparingToTalk ||
                        walkie.isSelfTalking ||
                        walkie.isFinishing),
                  )}
                  quickTalkActive={walkie.isSelfTalking}
                  quickTalkPending={Boolean(
                    walkie.updatingEnabled ||
                      walkie.recoveringAudio ||
                      walkie.recoveringSignaling ||
                      (!walkie.talkPathPrimed &&
                        (walkie.claiming || walkie.preparingToTalk)),
                  )}
                  quickTalkFinishing={walkie.isFinishing}
                  quickTalkCountdown={walkie.countdown}
                  quickTalkFinishDelayLeft={walkie.finishDelayLeft}
                  onQuickTalkPrepare={walkie.prepareToTalk}
                  onQuickTalkStart={walkie.startTalking}
                  onQuickTalkStop={walkie.stopTalking}
                />
              </div>
            ) : !hasPendingWalkieRequests &&
              walkie.notice &&
              walkie.snapshot?.enabled ? (
              <section className="mb-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(10,10,14,0.98))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/14 text-emerald-300">
                      <FaBroadcastTower />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        Walkie-Talkie
                      </h3>
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
          <BallTracker
            activeOverBalls={match?.activeOverBalls}
            activeOverNumber={match?.activeOverNumber || currentOverNumber}
            disabledKeys={scoreControlDisabledKeys}
          />
          <Controls
            onScore={handleAnnouncedScoreEvent}
            onOut={() => openModalWithFeedback("out")}
            onNoBall={() => openModalWithFeedback("noball")}
            onWide={() => openModalWithFeedback("wide")}
            setInfoText={setInfoText}
            disabled={controlsDisabled}
            disabledKeys={scoreControlDisabledKeys}
          />
          {isLiveMatch ? (
            <MatchSoundEffectsPanel
              files={soundEffectFiles}
              isDisabled={controlsDisabled}
              isLoading={soundEffectLibraryStatus === "loading"}
              isOpen={soundEffectsOpen}
              error={soundEffectError}
              activeEffectId={activeSoundEffectId}
              activeEffectStatus={activeSoundEffectStatus}
              activeEffectCurrentTime={activeSoundEffectCurrentTime}
              effectDurations={soundEffectDurations}
              needsUnlock={soundEffectsNeedsUnlock}
              onToggle={toggleSoundEffectsPanel}
              onMinimize={() => setSoundEffectsOpen(false)}
              onPlayEffect={handlePlaySoundEffect}
              onStopEffect={handleStopLiveSoundEffect}
              onReorder={handleReorderSoundEffects}
              scoreSoundSettings={{
                settings: umpireSettings,
                updateSetting: updateUmpireScoreSoundSettings,
                showScoreSoundEffectsToggle: true,
                showSpectatorBroadcastToggle: true,
                showScoreEffectAssignments: true,
                soundEffectOptions: commentarySoundEffectOptions,
                previewingSoundEffectId: previewingCommentarySoundEffectId,
                previewingSoundEffectStatus: activeSoundEffectStatus,
                onPreviewSoundEffect: handlePreviewCommentarySoundEffect,
              }}
              onOpenScoreSoundSettings={() => {
                if (!soundEffectFiles.length) {
                  void loadSoundEffectsLibrary();
                }
              }}
            />
          ) : null}
          <MatchActionGrid
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
            undoDisabled={isUndoCoolingDown}
            onHistory={() => setModal({ type: "history" })}
            onImage={() => setModal({ type: "image" })}
            onCommentary={() => {
              void prime({ userGesture: true });
              void loadSoundEffectsLibrary();
              setModal({ type: "commentary" });
            }}
            onWalkie={() => setModal({ type: "walkie" })}
            onMic={() => setModal({ type: "mic" })}
            onShare={handleCopyShareLink}
            onWalkiePressStart={undefined}
            onWalkieHoldStart={undefined}
            onWalkieHoldEnd={undefined}
            onMicHoldStart={canGridHoldMic ? handleMicHoldStart : undefined}
            onMicHoldEnd={canGridHoldMic ? handleMicHoldEnd : undefined}
            onPressFeedback={handleUmpirePressFeedback}
            showLiveControls={Boolean(isLiveMatch)}
            canHoldWalkie={false}
            canHoldMic={canGridHoldMic}
            isWalkieActive={Boolean(walkie.snapshot?.enabled)}
            isWalkieTalking={Boolean(walkie.isSelfTalking)}
            isWalkieFinishing={Boolean(walkie.isFinishing)}
            isWalkieLoading={Boolean(
              walkie.recoveringAudio ||
                walkie.recoveringSignaling ||
                walkie.updatingEnabled ||
                (!walkie.talkPathPrimed &&
                  (walkie.claiming || walkie.preparingToTalk)),
            )}
            isWalkieBusyByOther={Boolean(
              umpireRemoteSpeakerState.isRemoteTalking,
            )}
            walkieBusyLabel={umpireRemoteSpeakerState.roleLabel}
            isCommentaryActive={micMonitor.isActive || micMonitor.isPaused}
            isCommentaryTalking={Boolean(
              micMonitor.isActive && !micMonitor.isPaused,
            )}
            isAnnounceActive={Boolean(umpireSettings.enabled)}
          />
          <audio
            ref={soundEffectsAudioRef}
            hidden
            data-gv-umpire-effects-player="true"
          />
        </div>
        <SiteFooter />
      </main>
      <OptionalFeatureBoundary label="Optional match tools unavailable right now.">
        <MatchModalLayer
          showInningsEnd={showVisibleInningsEndCard}
          match={match}
          modalType={modal.type}
          isUpdating={isUpdating}
          isStageCardUndoPending={isStageCardUndoPending}
          micMonitor={micMonitor}
          entryScoreSoundPromptProps={
            modal.type === ENTRY_SCORE_SOUND_EFFECTS_MODAL
              ? {
                  announcerEnabled: entryScoreAnnouncementsEnabled,
                  onAnnouncerChange: setEntryScoreAnnouncementsEnabled,
                  soundEffectsEnabled: entryScoreSoundEffectsEnabled,
                  onSoundEffectsChange: setEntryScoreSoundEffectsEnabled,
                  onSave: handleEntryScoreSoundPromptSave,
                }
              : null
          }
          stageContinuePromptProps={
            stageContinuePrompt
              ? {
                  mode: stageContinuePrompt.mode,
                  onStay: () => setStageContinuePrompt(null),
                  onForceContinue: handleForceContinuePastSpeech,
                }
              : null
          }
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
                        speakWithAnnouncementDuck("Umpire voice on.", {
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
                      ? voiceName || "Tap Read Score once."
                      : voiceName || ""
                    : "",
                  onAnnounceNow: handleCommentaryReadScoreAction,
                  announceLabel: "Read Score",
                  announceDisabled: false,
                  showScoreSoundEffectsToggle: true,
                  showSpectatorBroadcastToggle: true,
                  showScoreEffectAssignments: true,
                  soundEffectOptions: commentarySoundEffectOptions,
                  previewingSoundEffectId: previewingCommentarySoundEffectId,
                  previewingSoundEffectStatus: activeSoundEffectStatus,
                  onPreviewSoundEffect: handlePreviewCommentarySoundEffect,
                  onTestSequence: handleCommentaryTestSequenceAction,
                  announceIsActive: isReadScoreActionActive,
                  testSequenceIsActive: isTestSequenceActionActive,
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
                  talkPathPrimed: walkie.talkPathPrimed,
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
          onNext={handleProtectedNextInningsOrEnd}
          onUpdate={handleAnnouncedPatchUpdate}
          onImageUploaded={replaceMatch}
          onScoreEvent={handleAnnouncedScoreEvent}
          onClose={() => setModal({ type: null })}
          onInfoClose={() => setInfoText(null)}
          onUndoStageCard={handleStageCardUndo}
        />
      </OptionalFeatureBoundary>
    </>
  );
}


