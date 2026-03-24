"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import {
  FaCheck,
  FaChevronRight,
  FaCompactDisc,
  FaEdit,
  FaMicrophone,
  FaPause,
  FaPlay,
  FaTimes,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import DarkSelect from "../shared/DarkSelect";

const MODES = [
  { value: "full", label: "Full Commentary" },
  { value: "simple", label: "Simple Calls" },
  { value: "silent", label: "Silent" },
];
const SCORE_EFFECT_EVENTS = [
  { key: "out", label: "Out", accent: "rose" },
  { key: "four", label: "4 Runs", accent: "sky" },
  { key: "six", label: "6 Runs", accent: "amber" },
  { key: "three", label: "3 Runs", accent: "violet" },
];

function getAccentClasses(accent) {
  if (accent === "rose") {
    return {
      badge: "border-rose-400/20 bg-rose-400/10 text-rose-200",
      button: "border-rose-300/18 bg-transparent text-rose-100 hover:bg-rose-400/10",
    };
  }
  if (accent === "sky") {
    return {
      badge: "border-sky-400/20 bg-sky-400/10 text-sky-200",
      button: "border-sky-300/18 bg-transparent text-sky-100 hover:bg-sky-400/10",
    };
  }
  if (accent === "violet") {
    return {
      badge: "border-violet-400/20 bg-violet-400/10 text-violet-200",
      button: "border-violet-300/18 bg-transparent text-violet-100 hover:bg-violet-400/10",
    };
  }
  return {
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    button: "border-amber-300/18 bg-transparent text-amber-100 hover:bg-amber-400/10",
  };
}

function SoundAssignmentRow({
  event,
  selectedLabel,
  selectedId,
  isPreviewing = false,
  onTogglePreview,
  onEdit,
}) {
  const accent = getAccentClasses(event.accent);
  const hasAssignedSound = Boolean(selectedId);

  return (
    <div className="rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-2.5">
      <div className="relative flex items-center gap-2.5">
        <button
          type="button"
          onClick={onTogglePreview}
          disabled={!hasAssignedSound}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border px-3 py-2.5 text-left transition active:scale-[0.985] ${
            hasAssignedSound
              ? `border-white/10 bg-white/[0.04] hover:bg-white/[0.06] ${isPreviewing ? "ring-2 ring-emerald-400/30" : ""}`
              : "cursor-not-allowed border-white/8 bg-white/[0.03] opacity-80"
          }`}
          aria-label={
            hasAssignedSound
              ? `${isPreviewing ? "Pause" : "Play"} ${event.label} sound`
              : `${event.label} has no sound selected`
          }
        >
          <div className={`inline-flex min-w-[84px] justify-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accent.badge}`}>
            {event.label}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {selectedLabel || "No sound"}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              {hasAssignedSound
                ? isPreviewing
                  ? "Playing"
                  : "Assigned"
                : "Silent"}
            </p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white">
            {isPreviewing ? <FaPause className="text-xs" /> : <FaPlay className="text-xs" />}
          </span>
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition active:scale-[0.97] ${accent.button}`}
          aria-label={`Edit ${event.label} sound`}
        >
          <FaEdit className="text-[11px]" />
        </button>
      </div>
    </div>
  );
}

function SoundPickerSheet({
  isOpen,
  eventLabel,
  options,
  selectedId,
  previewingId = "",
  onClose,
  onPreview,
  onSelect,
}) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 rounded-[28px] bg-[linear-gradient(180deg,rgba(10,10,14,0.96),rgba(4,4,8,0.98))] p-4 backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-black text-white">{eventLabel}</h4>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-300 transition active:scale-[0.97] hover:bg-white/[0.08] hover:text-white"
              aria-label="Close sound picker"
            >
              <FaTimes />
            </button>
          </div>

          <div className="mt-4 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => onSelect("")}
              className={`flex w-full items-center justify-between rounded-[20px] border px-4 py-3 text-left transition active:scale-[0.985] ${
                !selectedId
                  ? "border-emerald-300/28 bg-emerald-400/12 text-white"
                  : "border-white/8 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
              }`}
            >
              <p className="text-sm font-semibold">None</p>
              {!selectedId ? <FaCheck className="text-emerald-300" /> : null}
            </button>

            {options.map((option) => {
              const isSelected = selectedId === option.id;
              const isPreviewing = previewingId === option.id;

              return (
                <div
                  key={option.id}
                  className={`flex items-center gap-3 rounded-[20px] border px-4 py-3 transition ${
                    isSelected
                      ? "border-emerald-300/28 bg-emerald-400/12"
                      : "border-white/8 bg-white/[0.03]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onPreview(option)}
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white transition active:scale-[0.97] hover:bg-white/[0.08] ${
                      isPreviewing ? "ring-2 ring-emerald-400/35" : ""
                    }`}
                    aria-label={`${isPreviewing ? "Pause" : "Preview"} ${option.label}`}
                  >
                    {isPreviewing ? <FaPause className="text-xs" /> : <FaPlay className="text-xs" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelect(option.id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left active:scale-[0.995]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {option.label}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        {option.fileName || option.id}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      {isSelected ? <FaCheck className="text-emerald-300" /> : <FaChevronRight />}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

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
  showScoreEffectAssignments = false,
  soundEffectOptions = [],
  onPreviewSoundEffect,
  onTestSequence,
  previewingSoundEffectId = "",
  announceIsActive = false,
  testSequenceIsActive = false,
}) {
  const [isHolding, setIsHolding] = useState(false);
  const [editingEventKey, setEditingEventKey] = useState("");
  const holdActiveRef = useRef(false);
  const statusLabel = getStatusLabel({ enabled: settings.enabled, talkState });
  const isLiveSpeaking = talkState === "speaking" || talkState === "listening";
  const isModal = variant === "modal";
  const showTalkBlock = isModal && (onTalkStart || onTalkEnd);
  const showAdvancedControls = !simpleMode;
  const headerIcon = simpleMode ? <FaVolumeUp /> : <FaMicrophone />;
  const showModernCompactPanel = isModal && simpleMode;
  const scoreEffectMap = useMemo(
    () => settings.scoreSoundEffectMap || {},
    [settings.scoreSoundEffectMap]
  );
  const editingEvent =
    SCORE_EFFECT_EVENTS.find((event) => event.key === editingEventKey) || null;

  const statusTone = useMemo(() => {
    if (talkState === "busy") {
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
    }
    if (isLiveSpeaking) {
      return "border-emerald-400/25 bg-emerald-400/12 text-emerald-200";
    }
    return "border-white/10 bg-white/5 text-zinc-300";
  }, [isLiveSpeaking, talkState]);

  const activeSoundAssignments = useMemo(
    () =>
      SCORE_EFFECT_EVENTS.map((event) => {
        const selectedId = String(scoreEffectMap?.[event.key] || "").trim();
        const selectedEffect =
          soundEffectOptions.find((option) => option.id === selectedId) || null;
        return {
          ...event,
          selectedId,
          selectedLabel: selectedEffect?.label || "",
        };
      }),
    [scoreEffectMap, soundEffectOptions]
  );

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
      <section className="relative mx-auto max-h-[88vh] max-w-[32rem] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.1),transparent_24%),linear-gradient(180deg,rgba(16,16,20,0.98),rgba(7,7,11,0.99))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.48)] backdrop-blur-md sm:p-5">
        <div className="max-h-[calc(88vh-2rem)] overflow-y-auto pr-1 sm:pr-2">
        <div className="relative">
          <div className="flex items-start gap-3">
            <div
              className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg ${
                isLiveSpeaking
                  ? "border-emerald-300/28 bg-emerald-400/15 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.18)]"
                  : "border-white/10 bg-white/[0.05] text-zinc-100"
              }`}
            >
              <FaCompactDisc />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[1.65rem] font-black tracking-[-0.03em] text-white">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingEventKey("");
              onClose?.();
            }}
            className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Close live commentary"
          >
            <FaTimes />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
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
                label={settings.enabled ? "Turn commentary off" : "Turn commentary on"}
                onChange={(checked) => {
                  onToggleEnabled?.(checked);
                  updateSetting("enabled", checked);
                }}
              />
            </div>
          </div>

          <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Effects
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {settings.playScoreSoundEffects !== false ? "On" : "Off"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Sound effects after runs and outs.
                </p>
              </div>
              <IosSwitch
                checked={settings.playScoreSoundEffects !== false}
                label={
                  settings.playScoreSoundEffects !== false
                    ? "Turn score sound effects off"
                    : "Turn score sound effects on"
                }
                onChange={(checked) => updateSetting("playScoreSoundEffects", checked)}
              />
            </div>
          </div>
        </div>

        {showScoreEffectAssignments ? (
          <div className="relative mt-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Event Sounds
                </p>
              </div>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                {activeSoundAssignments.filter((item) => item.selectedId).length}/4 set
              </span>
            </div>

            <div className="space-y-2.5">
              {activeSoundAssignments.map((item) => (
                <SoundAssignmentRow
                  key={item.key}
                  event={item}
                  selectedId={item.selectedId}
                  selectedLabel={item.selectedLabel}
                  isPreviewing={Boolean(item.selectedId && previewingSoundEffectId === item.selectedId)}
                  onTogglePreview={() => {
                    if (!item.selectedId) {
                      return;
                    }
                    void onPreviewSoundEffect?.(
                      soundEffectOptions.find((option) => option.id === item.selectedId) || null
                    );
                  }}
                  onEdit={() => setEditingEventKey(item.key)}
                />
              ))}
            </div>

          </div>
        ) : null}

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
              className={`inline-flex flex-col items-start justify-center gap-1 rounded-[22px] px-4 py-3.5 text-left text-sm font-semibold transition active:scale-[0.985] ${
                announceDisabled
                  ? "cursor-not-allowed bg-zinc-900 text-zinc-500"
                  : announceIsActive
                  ? "bg-white/[0.1] text-white ring-2 ring-white/10"
                  : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {announceIsActive ? <FaPause /> : <FaVolumeUp />}
                {announceIsActive ? "Pause Score" : announceLabel}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void onTestSequence?.(editingEventKey || "six");
            }}
            disabled={!onTestSequence}
            className={`inline-flex flex-col items-start justify-center gap-1 rounded-[22px] border px-4 py-3.5 text-left text-sm font-semibold transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 ${
              testSequenceIsActive
                ? "border-emerald-300/24 bg-emerald-400/16 text-emerald-100 ring-2 ring-emerald-400/20"
                : "border-emerald-300/16 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/16"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {testSequenceIsActive ? <FaPause className="text-xs" /> : <FaPlay className="text-xs" />}
              {testSequenceIsActive ? "Pause Test" : "Test Sequence"}
            </span>
          </button>
        </div>
        </div>
        <SoundPickerSheet
          isOpen={Boolean(editingEvent)}
          eventLabel={editingEvent?.label || "Sound"}
          options={soundEffectOptions}
          selectedId={String(scoreEffectMap?.[editingEvent?.key] || "")}
          previewingId={previewingSoundEffectId}
          onClose={() => setEditingEventKey("")}
          onPreview={(option) => {
            void onPreviewSoundEffect?.(option);
          }}
          onSelect={(nextId) => {
            updateSetting("scoreSoundEffectMap", {
              ...scoreEffectMap,
              [editingEvent?.key || ""]: nextId,
            });
            setEditingEventKey("");
          }}
        />
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
                4/6 sound FX
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
