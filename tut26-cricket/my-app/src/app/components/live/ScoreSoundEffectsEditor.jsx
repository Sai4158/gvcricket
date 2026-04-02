"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  FaCheck,
  FaChevronRight,
  FaEdit,
  FaPause,
  FaPlay,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import {
  RANDOM_SCORE_EFFECT_ID,
  SCORE_SOUND_EFFECT_EVENTS,
} from "../../lib/score-sound-effects";
import { filterSoundEffectsByQuery } from "../../lib/sound-effects-client";
import {
  getScoreControlToneClasses,
  scoreControlFont,
} from "../match/score-control-theme";
import ModalGradientTitle from "../shared/ModalGradientTitle";
const KEYPAD_BUTTON_BASE =
  "press-feedback rounded-2xl font-bold shadow-[0_16px_28px_rgba(0,0,0,0.28)] transition active:scale-[0.97]";

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
  const toneClass = getScoreControlToneClasses(event.buttonTone);
  const hasAssignedSound = Boolean(selectedId) && canPreview;
  const buttonTextClassName =
    event.buttonTextClassName || "text-[1.2rem]";

  return (
    <div className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.022))] p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
      <div className="grid grid-cols-[92px_minmax(0,1fr)_46px] items-center gap-1.5 sm:grid-cols-[104px_minmax(0,1fr)_52px] sm:gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95, y: 2 }}
          onClick={onEdit}
          className={`${KEYPAD_BUTTON_BASE} ${toneClass} min-h-[50px] px-2 py-3 text-white sm:min-h-[52px] sm:px-2.5`}
          aria-label={`Edit ${event.label} sound`}
        >
          <span
            className={`${scoreControlFont.className} inline-flex origin-center scale-[1.08] items-center justify-center whitespace-nowrap font-bold leading-none ${buttonTextClassName}`}
          >
            {event.buttonLabel || event.label}
          </span>
        </motion.button>
        <motion.button
          type="button"
          whileTap={hasAssignedSound ? { scale: 0.97, y: 2 } : undefined}
          onClick={onTogglePreview}
          disabled={!hasAssignedSound}
          className={`${KEYPAD_BUTTON_BASE} flex min-w-0 items-center justify-between gap-2.5 border border-white/10 bg-[linear-gradient(180deg,rgba(30,30,34,0.98),rgba(15,15,19,1))] px-3 py-3 text-left sm:gap-3 sm:px-3.5 ${
            hasAssignedSound
              ? `text-white hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(40,40,44,1),rgba(20,20,24,1))] ${
                  isPreviewing ? "ring-2 ring-white/18" : ""
                }`
              : "cursor-not-allowed text-white/55 opacity-75"
          }`}
          aria-label={
            hasAssignedSound
              ? `${isPreviewing ? "Pause" : "Play"} ${event.label} sound`
              : `${event.label} has no sound selected`
          }
        >
          <div className="min-w-0 flex-1">
            <ScrollingSoundLabel
              text={selectedLabel || ""}
              active={isPreviewing}
            />
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/82 sm:h-10 sm:w-10">
            {isPreviewing ? (
              <FaPause className="text-sm" />
            ) : (
              <FaPlay className="text-sm" />
            )}
          </span>
        </motion.button>
        <motion.button
          type="button"
          onClick={onEdit}
          whileTap={{ scale: 0.95, y: 2 }}
          className={`${KEYPAD_BUTTON_BASE} inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(30,30,34,0.96),rgba(14,14,18,1))] text-white/74 hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(38,38,42,1),rgba(18,18,22,1))] hover:text-white sm:h-[52px] sm:w-[52px] sm:rounded-[18px]`}
          aria-label={`Edit ${event.label} sound`}
        >
          <FaEdit className="text-[14px]" />
        </motion.button>
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
  const [searchQuery, setSearchQuery] = useState("");
  const visibleOptions = useMemo(
    () => filterSoundEffectsByQuery(options, searchQuery),
    [options, searchQuery],
  );
  const hasSearchQuery = Boolean(String(searchQuery || "").trim());

  useEffect(() => {
    if (
      !isOpen ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return undefined;
    }

    const scrollY = window.scrollY;
    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousStyles = {
      htmlOverflow: htmlStyle.overflow,
      htmlOverscrollBehavior: htmlStyle.overscrollBehavior,
      bodyOverflow: bodyStyle.overflow,
      bodyPosition: bodyStyle.position,
      bodyTop: bodyStyle.top,
      bodyWidth: bodyStyle.width,
      bodyOverscrollBehavior: bodyStyle.overscrollBehavior,
    };

    htmlStyle.overflow = "hidden";
    htmlStyle.overscrollBehavior = "none";
    bodyStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = "100%";
    bodyStyle.overscrollBehavior = "none";

    return () => {
      htmlStyle.overflow = previousStyles.htmlOverflow;
      htmlStyle.overscrollBehavior = previousStyles.htmlOverscrollBehavior;
      bodyStyle.overflow = previousStyles.bodyOverflow;
      bodyStyle.position = previousStyles.bodyPosition;
      bodyStyle.top = previousStyles.bodyTop;
      bodyStyle.width = previousStyles.bodyWidth;
      bodyStyle.overscrollBehavior = previousStyles.bodyOverscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm sm:p-6"
          style={{ touchAction: "pan-y" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[calc(100dvh-12rem)] w-full max-w-[700px] min-h-0 flex-col overflow-y-auto overscroll-contain rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,15,20,0.98),rgba(6,6,10,1))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)] sm:max-h-[64vh] sm:p-5"
            style={{
              touchAction: "pan-y",
              overscrollBehavior: "contain",
              scrollbarGutter: "stable",
              WebkitOverflowScrolling: "touch",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/8 pb-3">
              <div className="min-w-0">
                <ModalGradientTitle
                  as="h4"
                  text={eventLabel}
                  className="text-lg"
                />
                <p className="mt-1 text-xs text-white/70">
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

            <div className="mt-4 min-h-0 flex-1 space-y-3">
              {options.length ? (
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45">
                    <FaSearch className="text-xs" />
                  </span>
                  <input
                    type="search"
                    inputMode="search"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search sounds"
                    className="w-full rounded-[20px] border border-white/10 bg-[rgba(18,18,24,0.96)] py-3 pl-10 pr-11 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/24 focus:bg-white/[0.05]"
                    aria-label={`Search ${eventLabel} sounds`}
                  />
                  {hasSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:bg-white/[0.1]"
                      aria-label="Clear sound search"
                    >
                      <FaTimes className="text-xs" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2 pr-1">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95, y: 2 }}
                  onClick={() => onSelect("")}
                  className={`${KEYPAD_BUTTON_BASE} flex w-full items-center justify-between border px-4 py-4 text-left ${
                    !selectedId
                      ? "border-white/16 bg-[linear-gradient(180deg,rgba(56,56,62,0.98),rgba(30,30,34,1))] text-white ring-1 ring-white/10"
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(40,40,44,0.98),rgba(24,24,28,1))] text-white hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(48,48,52,1),rgba(28,28,32,1))]"
                  }`}
                >
                  <p className="text-sm uppercase tracking-[0.16em]">None</p>
                  {!selectedId ? <FaCheck className="text-white" /> : null}
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95, y: 2 }}
                  onClick={() => onSelect(RANDOM_SCORE_EFFECT_ID)}
                  className={`${KEYPAD_BUTTON_BASE} flex w-full items-center justify-between border px-4 py-4 text-left ${
                    selectedId === RANDOM_SCORE_EFFECT_ID
                      ? "border-white/16 bg-[linear-gradient(180deg,rgba(56,56,62,0.98),rgba(30,30,34,1))] text-white ring-1 ring-white/10"
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(40,40,44,0.98),rgba(24,24,28,1))] text-white hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(48,48,52,1),rgba(28,28,32,1))]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm uppercase tracking-[0.16em]">Random</p>
                    <p className="mt-1 text-xs text-white/75">
                      Use a random sound
                    </p>
                  </div>
                  {selectedId === RANDOM_SCORE_EFFECT_ID ? (
                    <FaCheck className="text-white" />
                  ) : null}
                </motion.button>

                {visibleOptions.map((option) => {
                  const isSelected = selectedId === option.id;
                  const isPreviewing = previewingId === option.id;

                  return (
                    <div
                      key={option.id}
                      className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[52px_minmax(0,1fr)]"
                    >
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.95, y: 2 }}
                        onClick={() => onPreview(option)}
                        className={`${KEYPAD_BUTTON_BASE} inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center border sm:h-[52px] sm:w-[52px] ${
                          isPreviewing ? "ring-2 ring-white/18" : ""
                        } ${
                          isPreviewing
                            ? "border-white/16 bg-[linear-gradient(180deg,rgba(56,56,62,0.98),rgba(30,30,34,1))] text-white"
                            : "border-white/10 bg-[linear-gradient(180deg,rgba(40,40,44,0.98),rgba(24,24,28,1))] text-white hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(48,48,52,1),rgba(28,28,32,1))]"
                        }`}
                        aria-label={`${isPreviewing ? "Pause" : "Preview"} ${option.label}`}
                      >
                        {isPreviewing ? (
                          <FaPause className="text-xs" />
                        ) : (
                          <FaPlay className="text-xs" />
                        )}
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97, y: 2 }}
                        onClick={() => onSelect(option.id)}
                        className={`${KEYPAD_BUTTON_BASE} flex min-w-0 items-center justify-between gap-3 border px-4 py-4 text-left ${
                          isSelected
                            ? "border-white/16 bg-[linear-gradient(180deg,rgba(56,56,62,0.98),rgba(30,30,34,1))] text-white ring-1 ring-white/10"
                            : "border-white/10 bg-[linear-gradient(180deg,rgba(40,40,44,0.98),rgba(24,24,28,1))] text-white hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(48,48,52,1),rgba(28,28,32,1))]"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {option.label}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/65">
                            {option.fileName || option.id}
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                          {Number(option.durationSeconds) > 0 ? (
                            <span className="text-[11px] tracking-[0.14em] text-white/65">
                              {formatEffectDuration(option.durationSeconds)}
                            </span>
                          ) : null}
                          {isSelected ? (
                            <FaCheck className="text-white" />
                          ) : (
                            <FaChevronRight />
                          )}
                        </div>
                      </motion.button>
                    </div>
                  );
                })}
                {!visibleOptions.length && hasSearchQuery ? (
                  <div className="rounded-[20px] border border-white/8 bg-[rgba(18,18,24,0.96)] px-4 py-4 text-sm text-white/68">
                    No sounds match &quot;{searchQuery.trim()}&quot;.
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
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
    SCORE_SOUND_EFFECT_EVENTS.find((event) => event.key === editingEventKey) || null;
  const activeSoundAssignments = useMemo(
    () =>
      SCORE_SOUND_EFFECT_EVENTS.map((event) => {
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
  const showCompactToggleCards =
    showScoreSoundEffectsToggle &&
    showSpectatorBroadcastToggle &&
    !showBroadcastStatus;

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
      {showCompactToggleCards ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.025))] px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Umpire</p>
              <p className="mt-1 text-xs text-white/70">
                Play effects for umpire.
              </p>
            </div>
            <IosSwitch
              checked={settings.playScoreSoundEffects !== false}
              label={
                settings.playScoreSoundEffects !== false
                  ? "Turn umpire score sounds off"
                  : "Turn umpire score sounds on"
              }
              onChange={(checked) =>
                updateSetting?.("playScoreSoundEffects", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.025))] px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Spectators</p>
              <p className="mt-1 text-xs text-white/70">
                Play effects for spectators.
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
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
              Score Sounds
            </p>
            <p className="mt-1 text-xs text-white/72">
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
                onChange={(checked) =>
                  updateSetting?.("playScoreSoundEffects", checked)
                }
              />
            ) : null}
          </div>
        </div>
      )}

      {showSpectatorBroadcastToggle && !showCompactToggleCards ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.025))] px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Spectators</p>
            <p className="mt-1 text-xs text-white/70">
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
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.025))] px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              {broadcastStatusLabel}
            </p>
            <p className="mt-1 text-xs text-white/70">
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
        key={`${editingEvent?.key || "closed"}:${Boolean(editingEvent)}`}
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
