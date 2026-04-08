/**
 * File overview:
 * Purpose: Spectator walkie launcher and modal sections for the live-view screen.
 * Main exports: SpectatorWalkieSection, SpectatorWalkieModal.
 * Major callers: SessionViewScreen.
 * Side effects: uses browser pointer events and walkie callbacks.
 * Read next: README.md
 */

import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import WalkiePanel, { WalkieNotice } from "../../live/WalkiePanel";
import { ModalBase } from "../../match/MatchBaseModals";
import OptionalFeatureBoundary from "../../shared/OptionalFeatureBoundary";
import {
  DualWalkieIcon,
  HOLD_BUTTON_INTERACTION_PROPS,
  IosGlassSwitch,
} from "./SessionViewIcons";

export function SpectatorWalkieSection({
  showWalkieLauncher,
  launcherCardClass,
  walkieCardTalking,
  walkieCardDescription,
  walkieSwitchOn,
  handleWalkieSwitchChange,
  walkieNoticeText,
  walkieUi,
  localWalkieNotice,
  walkieNeedsLocalEnableNotice,
  setLocalWalkieNotice,
  walkie,
  walkieRemoteSpeakerState,
  handleWalkieLauncherPressStart,
  handleWalkieLauncherPressEnd,
  walkieLoading,
  walkieCardFinishing,
  handleWalkieSignalRefresh,
}) {
  if (!showWalkieLauncher) {
    return null;
  }

  return (
    <div
      className={`${launcherCardClass} mb-4 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_26%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-3`}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-emerald-300/50 to-transparent" />
      <div
        className="flex w-full flex-col gap-4"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg shadow-[0_12px_26px_rgba(16,185,129,0.16)] ${
              walkieCardTalking
                ? "bg-emerald-500 text-black"
                : "bg-emerald-500/14 text-emerald-300"
            }`}
          >
            {walkieCardTalking ? <FaMicrophone /> : <DualWalkieIcon />}
          </span>
          <span
            className="min-w-0 flex-1"
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            <span className="block text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
              Walkie-Talkie
            </span>
            <span className="mt-1 block text-sm leading-5 text-zinc-400">
              {walkieCardDescription}
            </span>
          </span>
          <div className="shrink-0 pt-0.5">
            <IosGlassSwitch
              checked={walkieSwitchOn}
              onChange={handleWalkieSwitchChange}
              label="Toggle walkie-talkie for this device"
              disabled={walkie.requestState === "pending" || walkie.updatingEnabled}
            />
          </div>
        </div>
        <div
          className={
            walkieSwitchOn ||
            localWalkieNotice ||
            walkie.notice ||
            walkieNeedsLocalEnableNotice
              ? "min-h-18"
              : ""
          }
        >
          <WalkieNotice
            embedded
            notice={walkieNoticeText}
            attention={walkieUi.attentionMode}
            onDismiss={() => {
              setLocalWalkieNotice("");
              walkie.dismissNotice();
            }}
          />
        </div>
        {walkieSwitchOn ? (
          <div className="flex flex-col items-center justify-center pt-1 pb-1">
            {walkieRemoteSpeakerState.isRemoteTalking ? (
              <div className="w-full max-w-[320px] rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,18,26,0.92),rgba(8,10,16,0.98))] px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                <div className="mb-2 inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                  {walkieRemoteSpeakerState.capsuleLabel}
                </div>
                <p className="text-sm font-medium text-white">
                  {walkieRemoteSpeakerState.title}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  {walkieRemoteSpeakerState.detail}
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  aria-label="Tap and hold walkie-talkie mic"
                  {...HOLD_BUTTON_INTERACTION_PROPS}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    handleWalkieLauncherPressStart();
                  }}
                  onPointerUp={(event) => {
                    event.preventDefault();
                    void handleWalkieLauncherPressEnd();
                  }}
                  onPointerCancel={(event) => {
                    event.preventDefault();
                    void handleWalkieLauncherPressEnd();
                  }}
                  onPointerLeave={(event) => {
                    event.preventDefault();
                    void handleWalkieLauncherPressEnd();
                  }}
                  className={`inline-flex h-24 w-24 items-center justify-center rounded-full border transition ${
                    walkieCardTalking
                      ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_28px_rgba(16,185,129,0.38)]"
                      : walkieLoading
                        ? "border-cyan-300/40 bg-cyan-500/12 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.16)]"
                        : walkieCardFinishing
                          ? "border-amber-300/40 bg-amber-500/12 text-amber-100 shadow-[0_0_22px_rgba(245,158,11,0.18)]"
                          : "border-white/12 bg-white/5 text-white"
                  }`}
                >
                  {walkieCardTalking ? (
                    <FaMicrophone className="text-[2rem]" />
                  ) : walkieLoading ? (
                    <FaMicrophone className="animate-pulse text-[2rem]" />
                  ) : (
                    <FaMicrophoneSlash className="text-[2rem]" />
                  )}
                </button>
                <span
                  className="mt-3 text-xs font-medium tracking-[0.18em] text-zinc-400 uppercase"
                  style={{
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "none",
                  }}
                >
                  {walkieCardTalking
                    ? "Release to stop"
                    : walkieLoading
                      ? "Connecting..."
                      : walkieCardFinishing
                        ? "Finishing..."
                        : "Tap and hold to talk"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void handleWalkieSignalRefresh();
                  }}
                  disabled={walkieLoading}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(8,18,24,0.82))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_16px_32px_rgba(8,145,178,0.18)] transition hover:border-cyan-200/30 hover:bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(10,18,24,0.86))] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {walkieLoading ? "Refreshing..." : "Refresh signal"}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SpectatorWalkieModal({
  activePanel,
  setActivePanel,
  showWalkieLauncher,
  walkieNoticeText,
  walkie,
}) {
  if (activePanel !== "walkie" || !showWalkieLauncher) {
    return null;
  }

  return (
    <OptionalFeatureBoundary
      fallback={
        <ModalBase title="Unavailable" onExit={() => setActivePanel(null)}>
          <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-center text-sm text-zinc-400">
            Walkie is unavailable right now.
          </div>
        </ModalBase>
      }
    >
      <ModalBase title="Walkie-Talkie" onExit={() => setActivePanel(null)}>
        <WalkiePanel
          role="spectator"
          snapshot={walkie.snapshot}
          notice={walkieNoticeText}
          error={walkie.error}
          canEnable={false}
          canRequestEnable={walkie.canRequestEnable}
          canTalk={walkie.canTalk}
          talkPathPrimed={walkie.talkPathPrimed}
          claiming={walkie.claiming}
          preparingToTalk={walkie.preparingToTalk}
          updatingEnabled={walkie.updatingEnabled}
          recoveringAudio={walkie.recoveringAudio}
          recoveringSignaling={walkie.recoveringSignaling}
          isSelfTalking={walkie.isSelfTalking}
          isFinishing={walkie.isFinishing}
          countdown={walkie.countdown}
          finishDelayLeft={walkie.finishDelayLeft}
          needsAudioUnlock={walkie.needsAudioUnlock}
          requestCooldownLeft={walkie.requestCooldownLeft}
          requestState={walkie.requestState}
          pendingRequests={walkie.pendingRequests}
          onRequestEnable={walkie.requestEnable}
          onToggleEnabled={() => {}}
          onStartTalking={walkie.startTalking}
          onStopTalking={walkie.stopTalking}
          onUnlockAudio={walkie.unlockAudio}
          onPrepareTalking={walkie.prepareToTalk}
          onDismissNotice={walkie.dismissNotice}
          onAcceptRequest={() => {}}
          onDismissRequest={() => {}}
        />
      </ModalBase>
    </OptionalFeatureBoundary>
  );
}
