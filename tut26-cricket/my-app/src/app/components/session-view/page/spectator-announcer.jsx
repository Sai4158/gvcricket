/**
 * File overview:
 * Purpose: Renders Session View UI for the app's screens and flows.
 * Main exports: SpectatorAudioLaunchers, SpectatorAudioModals.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { FaBullhorn, FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import AnnouncementControls from "../../live/AnnouncementControls";
import LiveMicModal from "../../live/LiveMicModal";
import { ModalBase } from "../../match/MatchBaseModals";
import OptionalFeatureBoundary from "../../shared/OptionalFeatureBoundary";
import {
  HOLD_BUTTON_INTERACTION_PROPS,
  IosGlassSwitch,
  PaMicSpeakerIcon,
} from "./SessionViewIcons";

export function SpectatorAudioLaunchers({
  launcherCardClass,
  setActivePanel,
  speakerSwitchOn,
  handleSpeakerSwitchChange,
  speakerCardDescription,
  speakerMicOn,
  speakerCardTalking,
  handleSpeakerLauncherPressStart,
  handleSpeakerLauncherPressEnd,
  suppressAnnouncerCardClickRef,
  announcerHoldStartedRef,
  handleOpenAnnouncePanel,
  handleAnnouncerCardPressStart,
  handleAnnouncerCardPressEnd,
  handleQuickAnnounce,
  announceSwitchOn,
  handleAnnounceSwitchChange,
  announcerCardDescription,
}) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setActivePanel("mic")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActivePanel("mic");
          }
        }}
        className={`${launcherCardClass} min-h-34.5 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.11),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-3.5`}
        aria-label="Open loudspeaker"
      >
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-amber-300/50 to-transparent" />
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3">
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base text-black shadow-[0_12px_26px_rgba(16,185,129,0.28)]"
              aria-hidden="true"
            >
              <PaMicSpeakerIcon />
            </span>
            <span className="shrink-0 pt-0.5">
              <IosGlassSwitch
                checked={speakerSwitchOn}
                onChange={(nextChecked) => {
                  void handleSpeakerSwitchChange(nextChecked);
                }}
                label="Toggle loudspeaker"
              />
            </span>
          </div>
          <div className="pt-4">
            <span className="block text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
              Loudspeaker
            </span>
            <span className="mt-1.5 block max-w-56 text-[13px] leading-5 text-zinc-400">
              {speakerCardDescription}
            </span>
          </div>
          {speakerMicOn ? (
            <div className="mt-auto flex justify-end pt-3">
              <button
                type="button"
                aria-label="Hold loudspeaker"
                {...HOLD_BUTTON_INTERACTION_PROPS}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  handleSpeakerLauncherPressStart();
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  void handleSpeakerLauncherPressEnd();
                }}
                onPointerCancel={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  void handleSpeakerLauncherPressEnd();
                }}
                onPointerLeave={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  void handleSpeakerLauncherPressEnd();
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                  speakerCardTalking
                    ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                    : "border-white/12 bg-white/5 text-white"
                }`}
              >
                {speakerCardTalking ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (
            suppressAnnouncerCardClickRef.current ||
            announcerHoldStartedRef.current
          ) {
            announcerHoldStartedRef.current = false;
            return;
          }
          handleOpenAnnouncePanel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpenAnnouncePanel();
          }
        }}
        onPointerDown={handleAnnouncerCardPressStart}
        onPointerUp={handleAnnouncerCardPressEnd}
        onPointerCancel={handleAnnouncerCardPressEnd}
        onPointerLeave={handleAnnouncerCardPressEnd}
        className={`${launcherCardClass} min-h-34.5 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-3.5`}
        aria-label="Open score announcer"
      >
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-violet-300/46 to-transparent" />
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleQuickAnnounce();
              }}
              aria-label="Announce current score"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-400/14 text-sm text-violet-200 transition hover:bg-violet-400/20"
            >
              <FaBullhorn />
            </button>
            <span className="shrink-0 pt-0.5">
              <IosGlassSwitch
                checked={announceSwitchOn}
                onChange={handleAnnounceSwitchChange}
                label="Toggle score announcer"
              />
            </span>
          </div>
          <div className="pt-4">
            <span className="block text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
              Score Announcer
            </span>
            <span className="mt-1.5 block max-w-56 text-[13px] leading-5 text-zinc-400">
              {announcerCardDescription}
            </span>
          </div>
          <div className="mt-auto flex justify-end pt-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400">
              <FaBullhorn className="text-sm" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpectatorAudioModals({
  activePanel,
  setActivePanel,
  micMonitor,
  settings,
  updateSetting,
  spectatorScoreSoundsDescription,
  spectatorBroadcastStatusText,
  umpireBroadcastScoreSoundsEnabled,
  onAnnouncerToggleEnabled,
  announcerStatusText,
  onAnnounceNow,
}) {
  return (
    <>
      {activePanel === "mic" ? (
        <OptionalFeatureBoundary
          fallback={
            <ModalBase title="Unavailable" onExit={() => setActivePanel(null)}>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-center text-sm text-zinc-400">
                Live mic is unavailable right now.
              </div>
            </ModalBase>
          }
        >
          <LiveMicModal
            title="Spectator Commentary Mic"
            monitor={micMonitor}
            onClose={() => setActivePanel(null)}
          />
        </OptionalFeatureBoundary>
      ) : null}
      {activePanel === "announce" ? (
        <OptionalFeatureBoundary
          fallback={
            <ModalBase title="Unavailable" onExit={() => setActivePanel(null)} hideHeader>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-center text-sm text-zinc-400">
                Score announcer is unavailable right now.
              </div>
            </ModalBase>
          }
        >
          <ModalBase title="" onExit={() => setActivePanel(null)} hideHeader>
            <AnnouncementControls
              title="Announce Score"
              settings={settings}
              updateSetting={updateSetting}
              simpleMode
              showScoreSoundEffectsToggle
              showBroadcastStatus
              scoreSoundsDescription={spectatorScoreSoundsDescription}
              broadcastStatusLabel="Umpire Relay"
              broadcastStatusText={spectatorBroadcastStatusText}
              broadcastStatusEnabled={umpireBroadcastScoreSoundsEnabled}
              variant="modal"
              onClose={() => setActivePanel(null)}
              onToggleEnabled={onAnnouncerToggleEnabled}
              statusText={announcerStatusText}
              onAnnounceNow={onAnnounceNow}
              announceLabel="Read Live Score"
            />
          </ModalBase>
        </OptionalFeatureBoundary>
      ) : null}
    </>
  );
}


