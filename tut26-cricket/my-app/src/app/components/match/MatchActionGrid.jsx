"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaBookOpen,
  FaImage,
  FaInfoCircle,
  FaRegClock,
  FaShareAlt,
  FaTimes,
  FaUserEdit,
} from "react-icons/fa";
import { LuUndo2 } from "react-icons/lu";

function WalkieIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="M5.75 8.5H10m-3 3H9m-1.75-6 3-1.5M5 6.5h5a1.5 1.5 0 0 1 1.5 1.5V17a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 17V8a1.5 1.5 0 0 1 1-1.42Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.75" cy="15.5" r="1" fill="currentColor" />
      <path
        d="M13.75 10.25H18m-3 3h2m-1.75-6 3-1.5M13 8.25a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V16a2.25 2.25 0 0 1-2.25 2.25H15.25A2.25 2.25 0 0 1 13 16V8.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="14.75" r="0.9" fill="currentColor" />
    </svg>
  );
}

function CommentaryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="M4.5 13.5H7l5 3.5V7L7 10.5H4.5A1.5 1.5 0 0 0 3 12v0a1.5 1.5 0 0 0 1.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 9.5a4 4 0 0 1 0 5m2.5-7.5a7 7 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M11.5 5.25a2.25 2.25 0 0 1 2.25 2.25V8.5a2.25 2.25 0 1 1-4.5 0v-1A2.25 2.25 0 0 1 11.5 5.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnnounceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="M4.5 14H7l4.5 3V7L7 10H4.5A1.5 1.5 0 0 0 3 11.5v1A1.5 1.5 0 0 0 4.5 14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 9.5a4 4 0 0 1 0 5m2.5-7.5a7 7 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m17 4.75 2 2-2 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionHelpItem({ icon, title, description, colorClass }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-3">
      <div className={`mt-0.5 text-2xl ${colorClass}`}>{icon}</div>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <ul className="mt-1 space-y-1 text-xs leading-5 text-zinc-400">
          {description.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ActionIconButton({
  onClick,
  onPressStart,
  onHoldStart,
  onHoldEnd,
  onPressFeedback,
  icon,
  label,
  colorClass,
  disabled = false,
  active = false,
  talking = false,
  badge,
  badgeClass = "",
  statusText = "",
  statusClass = "",
  holdStatusText = "",
  compact = false,
}) {
  const holdTimerRef = useRef(null);
  const holdStartedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const feedbackTriggeredRef = useRef(false);
  const pointerIdRef = useRef(null);
  const [holdPreviewActive, setHoldPreviewActive] = useState(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const beginPress = () => {
    feedbackTriggeredRef.current = false;
    if (disabled || !onHoldStart) {
      return;
    }

    setHoldPreviewActive(true);
    onPressFeedback?.();
    feedbackTriggeredRef.current = true;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdStartedRef.current = true;
      void onPressStart?.();
      void onHoldStart();
    }, 140);
  };

  const endPress = () => {
    clearHoldTimer();
    setHoldPreviewActive(false);
    if (!holdStartedRef.current) {
      return;
    }
    holdStartedRef.current = false;
    suppressClickRef.current = true;
    void onHoldEnd?.();
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 180);
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={() => {
        if (holdStartedRef.current || suppressClickRef.current) {
          holdStartedRef.current = false;
          return;
        }
        if (!feedbackTriggeredRef.current) {
          onPressFeedback?.();
        }
        feedbackTriggeredRef.current = false;
        onClick?.();
      }}
      disabled={disabled}
      onPointerDown={(event) => {
        if (!event.isPrimary) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        beginPress();
      }}
      onPointerUp={(event) => {
        if (
          pointerIdRef.current !== null &&
          event.pointerId !== undefined &&
          event.pointerId !== pointerIdRef.current
        ) {
          return;
        }
        pointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        endPress();
      }}
      onPointerLeave={(event) => {
        if (
          pointerIdRef.current !== null &&
          event.pointerId !== undefined &&
          event.pointerId !== pointerIdRef.current
        ) {
          return;
        }
        endPress();
      }}
      onPointerCancel={(event) => {
        if (
          pointerIdRef.current !== null &&
          event.pointerId !== undefined &&
          event.pointerId !== pointerIdRef.current
        ) {
          return;
        }
        pointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        endPress();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onDragStart={(event) => {
        event.preventDefault();
      }}
      className={`press-feedback relative flex flex-col items-center justify-center text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? "w-24 gap-2 p-2" : "w-24 gap-2 p-2"
      }`}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      draggable={false}
    >
      {badge ? (
        <span className={`absolute right-2 top-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ${badgeClass}`}>
          {badge}
        </span>
      ) : null}
      <div
        className={`relative ${compact ? "text-4xl" : "text-[2.35rem]"} ${colorClass} ${
          active ? "drop-shadow-[0_0_16px_currentColor]" : ""
        } ${talking ? "animate-pulse drop-shadow-[0_0_22px_currentColor]" : ""}`}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {talking ? (
          <span className="absolute -inset-3 rounded-full border border-current/30" aria-hidden="true" />
        ) : null}
        {icon}
      </div>
      <span
        className={`text-center text-zinc-100 ${
          compact ? "text-[12px] font-medium tracking-[0.08em]" : "text-[12px] font-medium tracking-[0.08em]"
        }`}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {label}
      </span>
      {statusText || (holdPreviewActive && holdStatusText) ? (
        <span
          className={`w-full text-left text-[10px] font-semibold uppercase tracking-[0.16em] ${
            holdPreviewActive && holdStatusText ? "text-cyan-200" : statusClass || "text-zinc-400"
          }`}
          style={{
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {holdPreviewActive && holdStatusText ? holdStatusText : statusText}
        </span>
      ) : null}
    </motion.button>
  );
}

export default function MatchActionGrid({
  isUpdating,
  historyStackLength,
  onEditTeams,
  onEditOvers,
  editOversLabel = "Edit overs",
  onUndo,
  onHistory,
  onImage,
  onCommentary,
  onCommentaryHoldStart,
  onWalkie,
  onMic,
  onShare,
  onWalkiePressStart,
  onWalkieHoldStart,
  onWalkieHoldEnd,
  onMicHoldStart,
  onMicHoldEnd,
  onPressFeedback,
  isWalkieActive = false,
  isWalkieTalking = false,
  isWalkieFinishing = false,
  isWalkieLoading = false,
  isWalkieBusyByOther = false,
  walkieBusyLabel = "",
  isCommentaryActive = false,
  isCommentaryTalking = false,
  isAnnounceActive = false,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const closeHelp = () => setShowHelp(false);

  return (
    <>
      <div className="mt-8 flex justify-center border-t border-zinc-700 pt-6">
        <div className="space-y-5">
          <div className="flex items-center justify-center gap-2">
            <p className="text-center text-[12px] text-white">
              Hold to talk or read. Tap to open.
            </p>
            <button
              type="button"
              onClick={() => {
                onPressFeedback?.();
                setShowHelp(true);
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-cyan-300 transition hover:text-cyan-200 active:scale-95"
              aria-label="Open action help"
            >
              <FaInfoCircle className="text-sm" />
            </button>
          </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          <ActionIconButton
            onClick={onWalkie}
            onPressStart={onWalkiePressStart}
            onHoldStart={onWalkieHoldStart}
            onHoldEnd={onWalkieHoldEnd}
            onPressFeedback={onPressFeedback}
            icon={<WalkieIcon />}
            label="Walkie-Talkie"
            colorClass="text-emerald-300"
            active={isWalkieActive}
            talking={isWalkieTalking}
            statusText={
              isWalkieTalking
                ? "Live on"
                : isWalkieBusyByOther
                ? walkieBusyLabel || "Live"
                : isWalkieLoading
                ? "Connecting"
                : isWalkieFinishing
                ? "Connected"
                : isWalkieActive
                ? "Hold to talk"
                : ""
            }
            statusClass={
              isWalkieTalking
                ? "text-cyan-100"
                : isWalkieBusyByOther
                ? "text-amber-100"
                : isWalkieLoading
                ? "text-sky-100"
                : isWalkieFinishing
                ? "text-emerald-100"
                : isWalkieActive
                ? "text-emerald-200"
                : "text-zinc-500"
            }
            holdStatusText="Trying"
          />
          <ActionIconButton
            onClick={onCommentary}
            onHoldStart={onCommentaryHoldStart}
            onPressFeedback={onPressFeedback}
            icon={<AnnounceIcon />}
            label="Announcer / Effects"
            colorClass="text-cyan-300"
            active={isAnnounceActive}
            badge={isAnnounceActive ? "On" : "Off"}
            badgeClass={
              isAnnounceActive
                ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
                : "border-rose-400/20 bg-rose-500/10 text-rose-200"
            }
          />
          <ActionIconButton
            onClick={onUndo}
            onPressFeedback={onPressFeedback}
            icon={<LuUndo2 />}
            label="Undo"
            colorClass="text-zinc-400"
            disabled={isUpdating || historyStackLength === 0}
            compact
          />
          <ActionIconButton
            onClick={onMic}
            onHoldStart={onMicHoldStart}
            onHoldEnd={onMicHoldEnd}
            onPressFeedback={onPressFeedback}
            icon={<CommentaryIcon />}
            label="Loudspeaker"
            colorClass="text-amber-300"
            active={isCommentaryActive}
            talking={isCommentaryTalking}
            badge={isCommentaryTalking ? "Live" : isCommentaryActive ? "On" : "Off"}
            badgeClass={
              isCommentaryTalking
                ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                : isCommentaryActive
                ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
                : "border-rose-400/20 bg-rose-500/10 text-rose-200"
            }
          />
          <ActionIconButton
            onClick={onEditTeams}
            onPressFeedback={onPressFeedback}
            icon={<FaUserEdit />}
            label="Edit teams"
            colorClass="text-sky-400"
            disabled={isUpdating}
            compact
          />
          <ActionIconButton
            onClick={onEditOvers}
            onPressFeedback={onPressFeedback}
            icon={<FaRegClock />}
            label={editOversLabel}
            colorClass="text-amber-400"
            disabled={isUpdating}
            compact
          />
          <ActionIconButton
            onClick={onHistory}
            onPressFeedback={onPressFeedback}
            icon={<FaBookOpen />}
            label="History"
            colorClass="text-violet-400"
            compact
          />
          <ActionIconButton
            onClick={onImage}
            onPressFeedback={onPressFeedback}
            icon={<FaImage />}
            label="Image"
            colorClass="text-zinc-200"
            compact
          />
          <ActionIconButton
            onClick={onShare}
            onPressFeedback={onPressFeedback}
            icon={<FaShareAlt />}
            label="Share"
            colorClass="text-green-400"
            compact
          />
        </div>
      </div>
      </div>

      <AnimatePresence>
        {showHelp ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
            onClick={closeHelp}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(event) => event.stopPropagation()}
              className="flex max-h-[88vh] w-full max-w-[34rem] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.99))] shadow-[0_28px_90px_rgba(0,0,0,0.5)]"
              style={{
                touchAction: "auto",
              }}
            >
              <motion.div
                drag="y"
                dragDirectionLock
                dragElastic={0.12}
                dragConstraints={{ top: 0, bottom: 220 }}
                dragPropagation={false}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 120 || info.velocity.y > 800) {
                    closeHelp();
                  }
                }}
                className="flex cursor-grab justify-center pt-2 active:cursor-grabbing sm:hidden"
                style={{
                  touchAction: "none",
                }}
              >
                <span className="h-1.5 w-12 rounded-full bg-white/15" />
              </motion.div>
              <div className="flex items-start justify-between gap-4 border-b border-white/8 px-4 py-4 sm:px-5">
                <div>
                  <h3 className="text-lg font-black tracking-[-0.02em] text-white">
                    Action Icons
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Quick guide for each button.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeHelp}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.97]"
                  aria-label="Close action help"
                >
                  <FaTimes />
                </button>
              </div>

              <div
                className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5"
                style={{
                  touchAction: "pan-y",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                }}
              >
                <ActionHelpItem
                  icon={<WalkieIcon />}
                  title="Walkie-Talkie"
                  description={[
                    "Talk live with the umpire team.",
                    "Hold to speak when walkie is on.",
                    "See live status while it connects or stays busy.",
                  ]}
                  colorClass="text-emerald-300"
                />
                <ActionHelpItem
                  icon={<AnnounceIcon />}
                  title="Announcer / Effects"
                  description={[
                    "Open score voice settings.",
                    "Pick sound effects for out, 2, 3, 4 and 6.",
                    "Test the announcer and effect flow.",
                  ]}
                  colorClass="text-cyan-300"
                />
                <ActionHelpItem
                  icon={<LuUndo2 />}
                  title="Undo"
                  description={[
                    "Remove the last ball.",
                    "Fix a wrong score tap quickly.",
                    "Replay the ball after undo.",
                  ]}
                  colorClass="text-zinc-300"
                />
                <ActionHelpItem
                  icon={<CommentaryIcon />}
                  title="Loudspeaker"
                  description={[
                    "Use the speaker mic live.",
                    "Hold to talk on loudspeaker.",
                    "Good for voice updates on the ground.",
                  ]}
                  colorClass="text-amber-300"
                />
                <ActionHelpItem
                  icon={<FaUserEdit />}
                  title="Edit Teams"
                  description={[
                    "Change team names.",
                    "Fix team details if needed.",
                    "Update the match setup view.",
                  ]}
                  colorClass="text-sky-400"
                />
                <ActionHelpItem
                  icon={<FaRegClock />}
                  title="Edit Overs / Innings"
                  description={[
                    "Update over count.",
                    "Fix innings progress.",
                    "Adjust match settings if needed.",
                  ]}
                  colorClass="text-amber-400"
                />
                <ActionHelpItem
                  icon={<FaBookOpen />}
                  title="History"
                  description={[
                    "See over-by-over history.",
                    "Check past balls quickly.",
                    "Review what was scored earlier.",
                  ]}
                  colorClass="text-violet-400"
                />
                <ActionHelpItem
                  icon={<FaImage />}
                  title="Image"
                  description={[
                    "Add match images.",
                    "Manage uploaded photos.",
                    "Update the match image section.",
                  ]}
                  colorClass="text-zinc-200"
                />
                <ActionHelpItem
                  icon={<FaShareAlt />}
                  title="Share"
                  description={[
                    "Copy the live match link.",
                    "Share it with others fast.",
                    "Open the live view on another device.",
                  ]}
                  colorClass="text-green-400"
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
