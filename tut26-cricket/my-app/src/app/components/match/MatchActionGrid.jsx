"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: MatchActionGrid.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
import ModalGradientTitle from "../shared/ModalGradientTitle";

function WalkieIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-9 w-9 sm:h-10 sm:w-10"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      viewBox="0 0 24 24"
      className="h-9 w-9 sm:h-10 sm:w-10"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      viewBox="0 0 24 24"
      className="h-9 w-9 sm:h-10 sm:w-10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9.5 6.25a2.25 2.25 0 1 1 0 4.5a2.25 2.25 0 0 1 0-4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 18.25a3.75 3.75 0 0 1 7.5 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 9.5a3.5 3.5 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17.75 7.5a6.5 6.5 0 0 1 0 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ACTION_HOLD_DELAY_MS = 40;

function ActionHelpItem({ icon, title, description, colorClass, rank }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-3">
      <div className={`mt-0.5 text-2xl ${colorClass}`}>{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {typeof rank === "number" ? (
            <span className="inline-flex shrink-0 rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200">
              #{rank}
            </span>
          ) : null}
          <h4 className="text-sm font-semibold text-white">{title}</h4>
        </div>
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

  const safeSetPointerCapture = (target, pointerId) => {
    if (
      pointerId === undefined ||
      !target ||
      typeof target.setPointerCapture !== "function"
    ) {
      return;
    }

    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Some mobile/browser edge cases surface a pointerdown without an active capture target.
    }
  };

  const safeReleasePointerCapture = (target, pointerId) => {
    if (
      pointerId === undefined ||
      !target ||
      typeof target.releasePointerCapture !== "function"
    ) {
      return;
    }

    try {
      if (
        typeof target.hasPointerCapture !== "function" ||
        target.hasPointerCapture(pointerId)
      ) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore stale or already-released capture handles.
    }
  };

  const hasPointerSupport =
    typeof window !== "undefined" && "PointerEvent" in window;

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const beginPress = useCallback(() => {
    feedbackTriggeredRef.current = false;
    if (disabled || !onHoldStart) {
      return;
    }

    setHoldPreviewActive(true);
    onPressFeedback?.();
    feedbackTriggeredRef.current = true;
    void onPressStart?.();
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdStartedRef.current = true;
      void onHoldStart();
    }, ACTION_HOLD_DELAY_MS);
  }, [clearHoldTimer, disabled, onHoldStart, onPressFeedback, onPressStart]);

  const endPress = useCallback(() => {
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
  }, [clearHoldTimer, onHoldEnd]);

  useEffect(() => {
    const handlePointerRelease = (event) => {
      if (
        pointerIdRef.current !== null &&
        event.pointerId !== undefined &&
        event.pointerId !== pointerIdRef.current
      ) {
        return;
      }

      pointerIdRef.current = null;
      endPress();
    };

    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);

    return () => {
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, [endPress]);

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
        safeSetPointerCapture(event.currentTarget, event.pointerId);
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
        safeReleasePointerCapture(event.currentTarget, event.pointerId);
        pointerIdRef.current = null;
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
        safeReleasePointerCapture(event.currentTarget, event.pointerId);
        pointerIdRef.current = null;
        endPress();
      }}
      onLostPointerCapture={(event) => {
        if (
          pointerIdRef.current !== null &&
          event.pointerId !== undefined &&
          event.pointerId !== pointerIdRef.current
        ) {
          return;
        }
        pointerIdRef.current = null;
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
      onTouchStart={() => {
        if (hasPointerSupport) {
          return;
        }
        beginPress();
      }}
      onTouchEnd={() => {
        if (hasPointerSupport) {
          return;
        }
        endPress();
      }}
      onTouchCancel={() => {
        if (hasPointerSupport) {
          return;
        }
        endPress();
      }}
      className={`press-feedback relative flex flex-col items-center justify-center text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? "w-24 gap-2 p-2" : "w-24 gap-2 p-2"
      }`}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
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
        className={`relative ${compact ? "text-[2.7rem]" : "text-[2.7rem] sm:text-[2.85rem]"} ${colorClass} ${
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
          className={`w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-[10px] font-semibold uppercase tracking-[0.08em] ${
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
  onWalkie,
  onMic,
  onShare,
  onWalkiePressStart,
  onWalkieHoldStart,
  onWalkieHoldEnd,
  onMicHoldStart,
  onMicHoldEnd,
  onPressFeedback,
  showLiveControls = false,
  canHoldWalkie = false,
  canHoldMic = false,
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
            <p className="max-w-[16rem] text-center text-[12px] font-medium leading-5 text-zinc-200">
              Turn live tools on, then hold to talk or read.
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
          {showLiveControls ? (
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
              badge={isCommentaryTalking ? "Live" : isCommentaryActive ? "Ready" : "Hold"}
              badgeClass={
                isCommentaryTalking
                  ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                  : isCommentaryActive
                  ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
                  : "border-amber-300/20 bg-amber-500/10 text-amber-100"
              }
              statusText={
                isCommentaryTalking
                  ? "Live on"
                  : "Tap to hold"
              }
              statusClass={
                isCommentaryTalking
                  ? "text-cyan-100"
                  : isCommentaryActive
                  ? "text-amber-200"
                  : "text-zinc-400"
              }
            />
          ) : null}
          <ActionIconButton
            onClick={onCommentary}
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
          {showLiveControls ? (
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
              badge={isWalkieTalking ? "Live" : isWalkieActive ? "On" : "Off"}
              badgeClass={
                isWalkieTalking
                  ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                  : isWalkieActive
                  ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
                  : "border-rose-400/20 bg-rose-500/10 text-rose-200"
              }
              statusText={
                isWalkieTalking
                  ? "Live on"
                  : isWalkieBusyByOther
                  ? walkieBusyLabel || "Live"
                  : isWalkieLoading
                  ? "Connecting"
                  : isWalkieFinishing
                  ? "Connected"
                  : isWalkieActive && canHoldWalkie
                  ? "Hold to talk"
                  : isWalkieActive
                  ? "Open panel"
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
                  : isWalkieActive && canHoldWalkie
                  ? "text-emerald-200"
                  : "text-zinc-400"
              }
              holdStatusText={canHoldWalkie ? "Trying" : ""}
            />
          ) : null}
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
                  <ModalGradientTitle
                    as="h3"
                    text="Action Icons"
                    className="text-lg"
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Ranked by common umpire use.
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
                {showLiveControls ? (
                  <ActionHelpItem
                    rank={1}
                    icon={<AnnounceIcon />}
                    title="Announcer / Effects"
                    description={[
                      "Read score, test voice, and play sound effects from one panel.",
                      "Search sounds and set dot, 1, 2, 3, 4, 6, out, wide 0, wide +1, and no ball.",
                      "Your score sound choices stay saved until you change them.",
                    ]}
                    colorClass="text-cyan-300"
                  />
                ) : null}
                <ActionHelpItem
                  rank={showLiveControls ? 2 : 1}
                  icon={<LuUndo2 />}
                  title="Undo"
                  description={[
                    "Remove the last ball instantly.",
                    "Fix a wrong score tap and replay that ball cleanly.",
                    "Keeps the over flow correct after the undo.",
                  ]}
                  colorClass="text-zinc-300"
                />
                {showLiveControls ? (
                  <ActionHelpItem
                    rank={3}
                    icon={<CommentaryIcon />}
                    title="Loudspeaker"
                    description={[
                      "Tap it to open the loudspeaker pop-up, then press and hold the icon to talk.",
                      "Best for quick PA calls and live voice updates on the ground.",
                      "The loudspeaker stays simple, with no separate on and off switch.",
                    ]}
                    colorClass="text-amber-300"
                  />
                ) : null}
                {showLiveControls ? (
                  <ActionHelpItem
                    rank={4}
                    icon={<WalkieIcon />}
                    title="Walkie-Talkie"
                    description={[
                      "Open the panel, then hold to talk live when the channel is ready.",
                      "Only one person can speak at a time, so live and busy states stay clear.",
                      "Works live with umpire, director, and spectators.",
                    ]}
                    colorClass="text-emerald-300"
                  />
                ) : null}
                <ActionHelpItem
                  rank={showLiveControls ? 5 : 2}
                  icon={<FaBookOpen />}
                  title="History"
                  description={[
                    "See recent balls over by over.",
                    "Check what was scored before using undo or edits.",
                    "Helpful when confirming the latest over.",
                  ]}
                  colorClass="text-violet-400"
                />
                <ActionHelpItem
                  rank={showLiveControls ? 6 : 3}
                  icon={<FaShareAlt />}
                  title="Share"
                  description={[
                    "Copy the live spectator link fast.",
                    "Open the score page on another phone right away.",
                    "Useful for players, crowd, and scorer support.",
                  ]}
                  colorClass="text-green-400"
                />
                <ActionHelpItem
                  rank={showLiveControls ? 7 : 4}
                  icon={<FaImage />}
                  title="Image"
                  description={[
                    "Add match photos for live, spectator, and result screens.",
                    "Manage uploaded pictures in one place.",
                    "Keeps the match pages looking complete.",
                  ]}
                  colorClass="text-zinc-200"
                />
                <ActionHelpItem
                  rank={showLiveControls ? 8 : 5}
                  icon={<FaUserEdit />}
                  title="Edit Teams"
                  description={[
                    "Fix team names or labels if something changes.",
                    "Update setup details without leaving the match view.",
                    "Best for admin corrections during setup or live play.",
                  ]}
                  colorClass="text-sky-400"
                />
                <ActionHelpItem
                  rank={showLiveControls ? 9 : 6}
                  icon={<FaRegClock />}
                  title="Edit Overs / Innings"
                  description={[
                    "Fix total overs or innings state.",
                    "Correct setup mistakes before or during the match.",
                    "Use this for match admin changes, not normal scoring.",
                  ]}
                  colorClass="text-amber-400"
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}


