/**
 * File overview:
 * Purpose: Renders Director UI for the app's screens and flows.
 * Main exports: DirectorWalkiePanel.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { FaBroadcastTower, FaHeadphones } from "react-icons/fa";
import { WalkieNotice, WalkieTalkButton } from "../../../live/WalkiePanel";
import { Card, IosSwitch } from "../DirectorConsoleChrome";



export default function DirectorWalkiePanel({
  canManageSession,
  walkieControls,
}) {
  const {
    directorRemoteSpeakerState,
    directorWalkieChannelEnabled,
    directorWalkieLoading,
    directorWalkieOn,
    directorWalkiePending,
    directorWalkieUi,
    handleDirectorWalkieSwitchChange,
    setDirectorWalkieNotice,
    showDirectorWalkieNotice,
    surfacedDirectorWalkieNotice,
    walkie,
    walkieStatus,
  } = walkieControls;

  return (
    <Card
      title="Walkie with umpire"
      subtitle="Shared live channel"
      icon={<FaBroadcastTower />}
      accent="emerald"
      help={{
        title: "Walkie with umpire",
        body: "Request walkie when it is off. Once it is on, you can talk with the umpire or spectators. Only one person can hold the channel at a time.",
      }}
      action={
        <div className="flex items-center gap-2">
          {walkieStatus !== "Off" ? (
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                walkieStatus.includes("Live")
                  ? "bg-emerald-500/14 text-emerald-200"
                  : "bg-white/6 text-zinc-300"
              }`}
            >
              {walkieStatus}
            </span>
          ) : null}
          <IosSwitch
            checked={directorWalkieOn}
            label="Walkie state"
            onChange={(nextChecked) => {
              void handleDirectorWalkieSwitchChange(nextChecked);
            }}
            disabled={
              !canManageSession ||
              walkie.requestState === "pending" ||
              walkie.updatingEnabled
            }
          />
        </div>
      }
    >
      <div className="space-y-3">
        {showDirectorWalkieNotice ? (
          <WalkieNotice
            embedded
            notice={surfacedDirectorWalkieNotice}
            attention={directorWalkieUi.attentionMode}
            onDismiss={() => {
              setDirectorWalkieNotice("");
              walkie.dismissNotice();
            }}
          />
        ) : null}
        <div
          className={
            directorWalkieChannelEnabled && directorWalkieOn
              ? "grid gap-4 md:grid-cols-[1fr_auto] md:items-center"
              : "space-y-3"
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-500/8 px-3 py-1 text-sm text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <FaBroadcastTower className="text-sky-300" />
                {walkie.snapshot?.umpireCount || 0} umpire
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/8 px-3 py-1 text-sm text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <FaHeadphones className="text-emerald-300" />
                {walkie.snapshot?.directorCount || 0} director
              </span>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(4,20,18,0.68),rgba(10,10,14,0.5))] px-4 py-3 text-center text-sm text-zinc-300">
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(52,211,153,0.8)_22%,rgba(34,211,238,0.46)_72%,rgba(0,0,0,0))]" />
              {!canManageSession
                ? "Select a live match first to use walkie."
                : directorWalkieLoading
                  ? walkie.recoveringAudio || walkie.recoveringSignaling
                    ? "Reconnecting walkie..."
                    : "Connecting walkie..."
                  : directorRemoteSpeakerState.isRemoteTalking
                    ? directorRemoteSpeakerState.detail
                    : walkie.snapshot?.enabled && !directorWalkieOn
                      ? "Turn on walkie to listen and respond."
                      : walkie.snapshot?.enabled
                        ? "Hold to talk with the live channel."
                        : directorWalkiePending
                          ? "Requested umpire access. Waiting for approval."
                          : directorWalkieOn
                            ? "Walkie is on. Requesting umpire access."
                            : walkie.requestState === "dismissed"
                              ? "Umpire dismissed the request."
                              : "Turn on this device to request access."}
            </div>
            {walkie.error ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {walkie.error}
              </div>
            ) : null}
            {walkie.needsAudioUnlock ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                <p>Safari needs one tap to enable walkie audio on this device.</p>
                <button
                  type="button"
                  onClick={() => void walkie.unlockAudio()}
                  className="mt-3 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-300"
                >
                  Enable Audio
                </button>
              </div>
            ) : null}
          </div>
          {directorWalkieChannelEnabled && directorWalkieOn ? (
            <div className="flex flex-col items-center gap-4">
              {directorRemoteSpeakerState.isRemoteTalking ? (
                <div className="w-full max-w-[320px] rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,18,26,0.92),rgba(8,10,16,0.98))] px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                  <div className="mb-2 inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                    {directorRemoteSpeakerState.capsuleLabel}
                  </div>
                  <p className="text-sm font-medium text-white">
                    {directorRemoteSpeakerState.title}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">
                    {directorRemoteSpeakerState.detail}
                  </p>
                </div>
              ) : (
                <WalkieTalkButton
                  active={walkie.isSelfTalking}
                  finishing={walkie.isFinishing}
                  pending={directorWalkieLoading}
                  disabled={
                    !walkie.canTalk ||
                    walkie.recoveringAudio ||
                    walkie.recoveringSignaling
                  }
                  countdown={walkie.countdown}
                  finishDelayLeft={walkie.finishDelayLeft}
                  onPrepare={walkie.prepareToTalk}
                  onStart={walkie.startTalking}
                  onStop={walkie.stopTalking}
                  label="Hold to talk to umpire"
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}


