"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  FaCheck,
  FaChevronRight,
  FaEdit,
  FaPause,
  FaPlay,
  FaTimes,
} from "react-icons/fa";

const SCORE_EFFECT_EVENTS = [
  { key: "out", label: "Out", accent: "rose" },
  { key: "two", label: "2 Runs", accent: "emerald" },
  { key: "three", label: "3 Runs", accent: "violet" },
  { key: "four", label: "4 Runs", accent: "sky" },
  { key: "six", label: "6 Runs", accent: "amber" },
];
const RANDOM_SCORE_EFFECT_ID = "__random__";

function formatEffectDuration(durationSeconds) {
  const totalSeconds = Math.max(0, Math.round(Number(durationSeconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ScrollingSoundLabel({ text = "", active = false }) {
  const label = String(text || "").trim();

  if (!label) {
    return <p className="text-sm font-semibold text-white">No sound</p>;
  }

  if (label.length <= 14) {
    return <p className="truncate text-sm font-semibold text-white">{label}</p>;
  }

  return (
    <div className="overflow-hidden">
      <motion.div
        className="flex min-w-max items-center gap-6 whitespace-nowrap text-sm font-semibold text-white"
        animate={active ? { x: ["0%", "-35%", "0%"] } : { x: 0 }}
        transition={{
          duration: 6,
          ease: "linear",
          repeat: active ? Number.POSITIVE_INFINITY : 0,
        }}
      >
        <span>{label}</span>
        <span aria-hidden="true">{label}</span>
      </motion.div>
    </div>
  );
}

function getAccentClasses(accent) {
  if (accent === "rose") {
    return {
      badge: "border-rose-400/20 bg-rose-400/10 text-rose-200",
      button:
        "border-rose-300/18 bg-transparent text-rose-100 hover:bg-rose-400/10",
    };
  }
  if (accent === "sky") {
    return {
      badge: "border-sky-400/20 bg-sky-400/10 text-sky-200",
      button:
        "border-sky-300/18 bg-transparent text-sky-100 hover:bg-sky-400/10",
    };
  }
  if (accent === "violet") {
    return {
      badge: "border-violet-400/20 bg-violet-400/10 text-violet-200",
      button:
        "border-violet-300/18 bg-transparent text-violet-100 hover:bg-violet-400/10",
    };
  }
  if (accent === "emerald") {
    return {
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      button:
        "border-emerald-300/18 bg-transparent text-emerald-100 hover:bg-emerald-400/10",
    };
  }
  return {
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    button:
      "border-amber-300/18 bg-transparent text-amber-100 hover:bg-amber-400/10",
  };
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

function SoundAssignmentRow({
  event,
  selectedLabel,
  selectedId,
  canPreview = true,
  isPreviewing = false,
  onTogglePreview,
  onEdit,
}) {
  const accent = getAccentClasses(event.accent);
  const hasAssignedSound = Boolean(selectedId) && canPreview;

  return (
    <div className="rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-2.5">
      <div className="relative flex items-center gap-2.5">
        <button
          type="button"
          onClick={onTogglePreview}
          disabled={!hasAssignedSound}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border px-3 py-2.5 text-left transition active:scale-[0.985] ${
            hasAssignedSound
              ? `border-white/10 bg-white/[0.04] hover:bg-white/[0.06] ${
                  isPreviewing ? "ring-2 ring-emerald-400/30" : ""
                }`
              : "cursor-not-allowed border-white/8 bg-white/[0.03] opacity-80"
          }`}
          aria-label={
            hasAssignedSound
              ? `${isPreviewing ? "Pause" : "Play"} ${event.label} sound`
              : `${event.label} has no sound selected`
          }
        >
          <div
            className={`inline-flex min-w-[84px] justify-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accent.badge}`}
          >
            {event.label}
          </div>
          <div className="min-w-0 flex-1">
            <ScrollingSoundLabel
              text={selectedLabel || ""}
              active={isPreviewing}
            />
          </div>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-white/88">
            {isPreviewing ? (
              <FaPause className="text-xs" />
            ) : (
              <FaPlay className="text-xs" />
            )}
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
          style={{ touchAction: "pan-y" }}
        >
          <div className="flex h-full min-h-0 flex-col rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,15,20,0.98),rgba(6,6,10,1))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-3 border-b border-white/8 pb-3">
              <div className="min-w-0">
                <h4 className="text-lg font-black text-white">{eventLabel}</h4>
                <p className="mt-1 text-xs text-zinc-500">
                  Select a sound
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/14 bg-[rgba(14,14,18,0.92)] text-white shadow-[0_10px_30px_rgba(0,0,0,0.32)] transition active:scale-[0.97] hover:bg-white/[0.12]"
                aria-label="Close sound picker"
              >
                <FaTimes />
              </button>
            </div>

            <div
              className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
              style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
            >
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

              <button
                type="button"
                onClick={() => onSelect(RANDOM_SCORE_EFFECT_ID)}
                className={`flex w-full items-center justify-between rounded-[20px] border px-4 py-3 text-left transition active:scale-[0.985] ${
                  selectedId === RANDOM_SCORE_EFFECT_ID
                    ? "border-fuchsia-300/32 bg-[linear-gradient(90deg,rgba(217,70,239,0.18),rgba(56,189,248,0.16))] text-white"
                    : "border-fuchsia-300/14 bg-[linear-gradient(90deg,rgba(217,70,239,0.12),rgba(56,189,248,0.08))] text-zinc-100 hover:bg-[linear-gradient(90deg,rgba(217,70,239,0.16),rgba(56,189,248,0.12))]"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Random</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/60">
                    Use a random sound
                  </p>
                </div>
                {selectedId === RANDOM_SCORE_EFFECT_ID ? (
                  <FaCheck className="text-fuchsia-100" />
                ) : null}
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
                      {isPreviewing ? (
                        <FaPause className="text-xs" />
                      ) : (
                        <FaPlay className="text-xs" />
                      )}
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
                        {Number(option.durationSeconds) > 0 ? (
                          <span className="text-[11px] tracking-[0.14em] text-zinc-500">
                            {formatEffectDuration(option.durationSeconds)}
                          </span>
                        ) : null}
                        {isSelected ? (
                          <FaCheck className="text-emerald-300" />
                        ) : (
                          <FaChevronRight />
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function ScoreSoundEffectsEditor({
  settings = {},
  updateSetting,
  showScoreSoundEffectsToggle = false,
  showSpectatorBroadcastToggle = false,
  showBroadcastStatus = false,
  showScoreEffectAssignments = false,
  scoreSoundsDescription = "Pick score sounds.",
  broadcastStatusLabel = "Umpire Relay",
  broadcastStatusText = "",
  broadcastStatusEnabled = true,
  soundEffectOptions = [],
  previewingSoundEffectId = "",
  previewingSoundEffectStatus = "idle",
  onPreviewSoundEffect,
  className = "",
  surface = "card",
  editingEventKey: controlledEditingEventKey,
  onEditingEventKeyChange,
}) {
  const [internalEditingEventKey, setInternalEditingEventKey] = useState("");
  const isEditingEventControlled =
    typeof controlledEditingEventKey === "string" &&
    typeof onEditingEventKeyChange === "function";
  const editingEventKey = isEditingEventControlled
    ? controlledEditingEventKey
    : internalEditingEventKey;
  const setEditingEventKey = isEditingEventControlled
    ? onEditingEventKeyChange
    : setInternalEditingEventKey;

  const scoreEffectMap = useMemo(
    () => settings.scoreSoundEffectMap || {},
    [settings.scoreSoundEffectMap],
  );
  const editingEvent =
    SCORE_EFFECT_EVENTS.find((event) => event.key === editingEventKey) || null;
  const activeSoundAssignments = useMemo(
    () =>
      SCORE_EFFECT_EVENTS.map((event) => {
        const selectedId = String(scoreEffectMap?.[event.key] || "").trim();
        if (selectedId === RANDOM_SCORE_EFFECT_ID) {
          return {
            ...event,
            selectedId,
            selectedEffect: null,
            selectedLabel: "Random",
            isRandom: true,
          };
        }

        const selectedEffect =
          soundEffectOptions.find((option) => option.id === selectedId) || null;
        return {
          ...event,
          selectedId,
          selectedEffect,
          selectedLabel: selectedEffect?.label || "",
          isRandom: false,
        };
      }),
    [scoreEffectMap, soundEffectOptions],
  );

  if (
    !showScoreSoundEffectsToggle &&
    !showSpectatorBroadcastToggle &&
    !showBroadcastStatus &&
    !showScoreEffectAssignments
  ) {
    return null;
  }

  const surfaceClassName =
    surface === "flat"
      ? "relative"
      : "relative rounded-[24px] border border-white/8 bg-white/[0.03] p-3 sm:p-4";

  return (
    <div className={`${surfaceClassName} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Score Sounds
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {scoreSoundsDescription}
          </p>
        </div>
        <div className="shrink-0 pt-0.5">
          {showScoreSoundEffectsToggle ? (
            <IosSwitch
              checked={settings.playScoreSoundEffects !== false}
              label={
                settings.playScoreSoundEffects !== false
                  ? "Turn score sound effects off"
                  : "Turn score sound effects on"
              }
              onChange={(checked) => updateSetting?.("playScoreSoundEffects", checked)}
            />
          ) : null}
        </div>
      </div>

      {showSpectatorBroadcastToggle ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Spectators</p>
            <p className="mt-1 text-xs text-zinc-500">
              Play score sounds live.
            </p>
          </div>
          <IosSwitch
            checked={settings.broadcastScoreSoundEffects !== false}
            label={
              settings.broadcastScoreSoundEffects !== false
                ? "Turn spectator score sounds off"
                : "Turn spectator score sounds on"
            }
            onChange={(checked) =>
              updateSetting?.("broadcastScoreSoundEffects", checked)
            }
          />
        </div>
      ) : null}

      {showBroadcastStatus ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              {broadcastStatusLabel}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {broadcastStatusText}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
              broadcastStatusEnabled
                ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                : "border-rose-300/20 bg-rose-400/10 text-rose-200"
            }`}
          >
            {broadcastStatusEnabled ? "On" : "Off"}
          </span>
        </div>
      ) : null}

      {showScoreEffectAssignments ? (
        <div className="mt-3 space-y-2.5">
          {activeSoundAssignments.map((item) => (
            <SoundAssignmentRow
              key={item.key}
              event={item}
              selectedId={item.selectedId}
              selectedLabel={item.selectedLabel}
              canPreview={!item.isRandom}
              isPreviewing={Boolean(
                item.selectedEffect?.id &&
                  previewingSoundEffectId === item.selectedEffect.id &&
                  (previewingSoundEffectStatus === "loading" ||
                    previewingSoundEffectStatus === "playing"),
              )}
              onTogglePreview={() => {
                if (!item.selectedEffect) {
                  return;
                }
                void onPreviewSoundEffect?.(item.selectedEffect);
              }}
              onEdit={() => setEditingEventKey(item.key)}
            />
          ))}
        </div>
      ) : null}

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
          if (!editingEvent?.key) {
            return;
          }

          updateSetting?.("scoreSoundEffectMap", {
            ...scoreEffectMap,
            [editingEvent.key]: nextId,
          });
          setEditingEventKey("");
        }}
      />
    </div>
  );
}
