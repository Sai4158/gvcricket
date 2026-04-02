"use client";

import { useMemo, useRef, useState } from "react";
import {
  FaCompactDisc,
  FaMicrophone,
  FaPause,
  FaPlay,
  FaTimes,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import DarkSelect from "../shared/DarkSelect";
import ScoreSoundEffectsEditor from "./ScoreSoundEffectsEditor";

const MODES = [
  { value: "full", label: "Full Commentary" },
  { value: "simple", label: "Simple Calls" },
  { value: "silent", label: "Silent" },
];
function getStatusLabel({ enabled, talkState }) {
  if (talkState === "speaking") return "Speaking";
  if (talkState === "listening") return "Listening";
  if (talkState === "busy") return "Busy";
  return enabled ? "Ready" : "Ready";
}

function IosSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-8 w-[54px] items-center rounded-full border transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-400/35 ${
        checked
          ? "border-emerald-300/35 bg-emerald-500 shadow-[0_10px_24px_rgba(16,185,129,0.22)]"
          : "border-white/10 bg-white/[0.08]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-[26px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export default function AnnouncementControls({
  title,
  settings,
  updateSetting,
  onAnnounceNow,
  onToggleEnabled,
  onClose,
  statusText = "",
  announceLabel = "Read Score",
  announceDisabled = false,
  variant = "card",
  talkState = "ready",
  talkDisabled = false,
  onTalkStart,
  onTalkEnd,
  talkError = "",
  simpleMode = false,
  showScoreSoundEffectsToggle = false,
  showSpectatorBroadcastToggle = false,
  showBroadcastStatus = false,
  showScoreEffectAssignments = false,
  scoreSoundsDescription = "Choose what sound to play on score.",
  broadcastStatusLabel = "Umpire Relay",
  broadcastStatusText = "",
  broadcastStatusEnabled = true,
  soundEffectOptions = [],
  onPreviewSoundEffect,
  onTestSequence,
  previewingSoundEffectId = "",
  previewingSoundEffectStatus = "idle",
  announceIsActive = false,
  testSequenceIsActive = false,
}) {
  const [isHolding, setIsHolding] = useState(false);
  const [editingEventKey, setEditingEventKey] = useState("");
  const holdActiveRef = useRef(false);
  const isSoundPickerOpen = Boolean(editingEventKey);
  const statusLabel = getStatusLabel({ enabled: settings.enabled, talkState });
  const isLiveSpeaking = talkState === "speaking" || talkState === "listening";
  const isModal = variant === "modal";
  const showTalkBlock = isModal && (onTalkStart || onTalkEnd);
  const showAdvancedControls = !simpleMode;
  const headerIcon = simpleMode ? <FaVolumeUp /> : <FaMicrophone />;
  const showModernCompactPanel = isModal && simpleMode;

  const statusTone = useMemo(() => {
    if (talkState === "busy") {
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
    }
    if (isLiveSpeaking) {
      return "border-emerald-400/25 bg-emerald-400/12 text-emerald-200";
    }
    return "border-white/10 bg-white/5 text-zinc-300";
  }, [isLiveSpeaking, talkState]);

  const beginHold = async () => {
    if (talkDisabled || holdActiveRef.current) {
      return;
    }

    holdActiveRef.current = true;
    setIsHolding(true);
    await onTalkStart?.();
  };

  const endHold = async () => {
    if (!holdActiveRef.current) {
      return;
    }

    holdActiveRef.current = false;
    setIsHolding(false);
    await onTalkEnd?.();
  };

  if (showModernCompactPanel) {
    return (
      <section className="relative mx-auto flex max-h-[78vh] max-w-[32rem] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.1),transparent_24%),linear-gradient(180deg,rgba(16,16,20,0.98),rgba(7,7,11,0.99))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.48)] backdrop-blur-md sm:max-h-[82vh] sm:p-5">
        {!isSoundPickerOpen ? (
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/8 pb-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg ${
                  isLiveSpeaking
                    ? "border-emerald-300/28 bg-emerald-400/15 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.18)]"
                    : "border-white/10 bg-white/[0.05] text-zinc-100"
                }`}
              >
                <FaCompactDisc />
              </div>
              <div className="min-w-0">
                <h3 className="text-[1.65rem] font-black tracking-[-0.03em] text-white">
                  {title}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Clean score commentary and sound controls.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingEventKey("");
                onClose?.();
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/14 bg-[rgba(20,20,24,0.92)] text-white transition hover:bg-white/[0.08] sm:mt-0.5"
              aria-label="Close live commentary"
            >
              <FaTimes />
            </button>
          </div>
        ) : null}
        <div
          className="min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2"
          style={{
            touchAction: "pan-y",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          <div className="grid gap-3">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Commentary
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {settings.enabled ? "On" : "Off"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Score announcer on each tap.
                  </p>
                </div>
                <IosSwitch
                  checked={settings.enabled}
                  label={
                    settings.enabled
                      ? "Turn commentary off"
                      : "Turn commentary on"
                  }
                  onChange={(checked) => {
                    onToggleEnabled?.(checked);
                    updateSetting("enabled", checked);
                  }}
                />
              </div>
            </div>
          </div>

          <ScoreSoundEffectsEditor
            settings={settings}
            updateSetting={updateSetting}
            showScoreSoundEffectsToggle={showScoreSoundEffectsToggle}
            showSpectatorBroadcastToggle={showSpectatorBroadcastToggle}
            showBroadcastStatus={showBroadcastStatus}
            showScoreEffectAssignments={showScoreEffectAssignments}
            scoreSoundsDescription={scoreSoundsDescription}
            broadcastStatusLabel={broadcastStatusLabel}
            broadcastStatusText={broadcastStatusText}
            broadcastStatusEnabled={broadcastStatusEnabled}
            soundEffectOptions={soundEffectOptions}
            previewingSoundEffectId={previewingSoundEffectId}
            previewingSoundEffectStatus={previewingSoundEffectStatus}
            onPreviewSoundEffect={onPreviewSoundEffect}
            className="mt-4"
            editingEventKey={editingEventKey}
            onEditingEventKeyChange={setEditingEventKey}
          />

          {talkError ? (
            <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {talkError}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {onAnnounceNow ? (
              <button
                type="button"
                onClick={onAnnounceNow}
                disabled={announceDisabled}
                className={`inline-flex items-center gap-3 rounded-[22px] px-4 py-3.5 text-left text-sm font-semibold transition active:scale-[0.985] ${
                  announceDisabled
                    ? "cursor-not-allowed bg-zinc-900 text-zinc-500"
                    : announceIsActive
                      ? "bg-white/[0.1] text-white ring-2 ring-white/10"
                      : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
                }`}
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                  {announceIsActive ? (
                    <FaPause className="text-xs" />
                  ) : (
                    <FaVolumeUp className="text-xs" />
                  )}
                </span>
                <span>{announceIsActive ? "Stop Audio" : announceLabel}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void onTestSequence?.(editingEventKey || "out");
              }}
              disabled={!onTestSequence}
              className={`inline-flex items-center gap-3 rounded-[22px] border px-4 py-3.5 text-left text-sm font-semibold transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 ${
                testSequenceIsActive
                  ? "border-emerald-300/24 bg-emerald-400/16 text-emerald-100 ring-2 ring-emerald-400/20"
                  : "border-emerald-300/16 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/16"
              }`}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/16 bg-emerald-950/30">
                {testSequenceIsActive ? (
                  <FaPause className="text-xs" />
                ) : (
                  <FaPlay className="text-xs" />
                )}
              </span>
              <span>{testSequenceIsActive ? "Pause Test" : "Test Sequence"}</span>
            </button>
          </div>
          <div className="h-2 shrink-0" />
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,19,24,0.96),rgba(8,8,12,0.98))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.4)] backdrop-blur-md ${
        isModal ? "mx-auto max-w-[28rem]" : ""
      }`}
    >
      <div
        className={`relative ${
          isModal
            ? "flex flex-col items-center gap-4 text-center"
            : "flex items-center justify-between gap-4"
        }`}
      >
        <div
          className={`${
            isModal ? "flex flex-col items-center gap-3" : "flex items-center gap-3"
          }`}
        >
          <div
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full border text-lg transition-all ${
              isLiveSpeaking
                ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-300 shadow-[0_0_28px_rgba(45,212,191,0.18)]"
                : "border-white/10 bg-white/[0.06] text-zinc-100"
            }`}
          >
            {headerIcon}
          </div>
          <div>
            <h3 className="text-xl font-black tracking-[-0.02em] text-white">
              {title}
            </h3>
          </div>
        </div>
        {isModal ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            aria-label="Close live commentary"
          >
            <FaTimes />
          </button>
        ) : (
          <IosSwitch
            checked={settings.enabled}
            label={settings.enabled ? "Turn commentary off" : "Turn commentary on"}
            onChange={(checked) => {
              onToggleEnabled?.(checked);
              updateSetting("enabled", checked);
            }}
          />
        )}
      </div>

      {showTalkBlock ? (
        <div className="mt-5 rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_55%),linear-gradient(180deg,rgba(10,10,14,0.96),rgba(8,8,12,1))] px-5 py-6 text-center">
          <div className="relative mx-auto flex w-full max-w-[220px] justify-center">
            <div
              className={`absolute inset-0 rounded-full blur-2xl transition-opacity ${
                isLiveSpeaking ? "bg-emerald-400/25 opacity-100" : "bg-emerald-400/10 opacity-70"
              }`}
            />
            <button
              type="button"
              disabled={talkDisabled}
              onPointerDown={() => {
                void beginHold();
              }}
              onPointerUp={() => {
                void endHold();
              }}
              onPointerLeave={() => {
                void endHold();
              }}
              onPointerCancel={() => {
                void endHold();
              }}
              onKeyDown={(event) => {
                if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                  event.preventDefault();
                  void beginHold();
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  void endHold();
                }
              }}
              className={`relative inline-flex min-h-[84px] w-full items-center justify-center gap-3 rounded-full border px-6 py-5 text-base font-black transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/45 ${
                talkDisabled
                  ? "cursor-not-allowed border-white/5 bg-white/[0.04] text-zinc-500"
                  : isHolding || isLiveSpeaking
                  ? "border-emerald-300/30 bg-[linear-gradient(135deg,#34d399,#14b8a6)] text-black shadow-[0_18px_44px_rgba(20,184,166,0.28)]"
                  : "border-white/10 bg-white/[0.06] text-white hover:-translate-y-0.5 hover:bg-white/[0.08]"
              }`}
              aria-label={isHolding || isLiveSpeaking ? "Release to stop commentary" : "Press and hold to talk"}
            >
              <span
                className={`absolute inset-[-8px] rounded-full border transition-opacity ${
                  isLiveSpeaking
                    ? "animate-pulse border-emerald-300/35 opacity-100"
                    : "border-transparent opacity-0"
                }`}
              />
              <FaMicrophone className="text-lg" />
              <span>{isHolding || isLiveSpeaking ? "Release to Stop" : "Hold to Talk"}</span>
            </button>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] ${statusTone}`}
            >
              {statusLabel}
            </span>
            {statusText ? (
              <p className="text-xs text-zinc-500">{statusText}</p>
            ) : null}
            {talkError ? (
              <p className="text-xs text-rose-300">{talkError}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className={`mt-5 flex flex-col gap-3 ${
            isModal ? "items-center text-center" : "items-start"
          }`}
        >
          {simpleMode ? (
            <p className="text-xs font-medium text-zinc-400">
              Announces each tap.
            </p>
          ) : (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] ${statusTone}`}
            >
              {statusLabel}
            </span>
          )}
          {simpleMode ? (
            <IosSwitch
              checked={settings.enabled}
              label={
                settings.enabled
                  ? "Turn score feedback off"
                  : "Turn score feedback on"
              }
              onChange={(checked) => {
                onToggleEnabled?.(checked);
                updateSetting("enabled", checked);
              }}
            />
          ) : null}
          {statusText ? (
            <p className="text-xs text-zinc-500">{statusText}</p>
          ) : null}
          {showScoreSoundEffectsToggle ? (
            <div className="flex items-center gap-3">
              <IosSwitch
                checked={settings.playScoreSoundEffects !== false}
                label={
                  settings.playScoreSoundEffects !== false
                    ? "Turn score sound effects off"
                    : "Turn score sound effects on"
                }
                onChange={(checked) =>
                  updateSetting("playScoreSoundEffects", checked)
                }
              />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Score FX
              </span>
            </div>
          ) : null}
          {talkError ? (
            <p className="text-xs text-rose-300">{talkError}</p>
          ) : null}
        </div>
      )}

      {showAdvancedControls ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Mode
            </span>
            <DarkSelect
              value={settings.mode}
              options={MODES}
              onChange={(nextValue) => updateSetting("mode", nextValue)}
              ariaLabel="Commentary mode"
            />
          </label>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Volume
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
              <button
                type="button"
                onClick={() => updateSetting("muted", !settings.muted)}
                className="text-zinc-300 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                aria-label={settings.muted ? "Unmute commentary" : "Mute commentary"}
              >
                {settings.muted ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(event) =>
                  updateSetting("volume", Number(event.target.value))
                }
                className="w-full accent-emerald-400"
                aria-label="Commentary volume"
              />
            </div>
          </div>
        </div>
      ) : null}

      {onAnnounceNow ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={onAnnounceNow}
            disabled={announceDisabled}
            className={`inline-flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-300/35 ${
              announceDisabled
                ? "cursor-not-allowed bg-zinc-900 text-zinc-500"
                : simpleMode
                ? "bg-amber-400/12 text-amber-100 hover:bg-amber-400/18"
                : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
            }`}
            aria-label={announceLabel}
          >
            <FaVolumeUp />
            {announceLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}
