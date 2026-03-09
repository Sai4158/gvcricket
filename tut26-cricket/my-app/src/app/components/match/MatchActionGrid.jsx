"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import {
  FaBookOpen,
  FaImage,
  FaRegClock,
  FaShareAlt,
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

function ActionIconButton({
  onClick,
  onHoldStart,
  onHoldEnd,
  icon,
  label,
  colorClass,
  disabled = false,
  active = false,
  badge,
  badgeClass = "",
  compact = false,
}) {
  const holdTimerRef = useRef(null);
  const holdStartedRef = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const beginPress = () => {
    if (disabled || !onHoldStart) {
      return;
    }

    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdStartedRef.current = true;
      void onHoldStart();
    }, 220);
  };

  const endPress = () => {
    clearHoldTimer();
    if (!holdStartedRef.current) {
      return;
    }
    holdStartedRef.current = false;
    void onHoldEnd?.();
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        if (holdStartedRef.current) {
          holdStartedRef.current = false;
          return;
        }
        onClick?.();
      }}
      disabled={disabled}
      onPointerDown={beginPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      className={`relative flex flex-col items-center justify-center text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? "w-24 gap-2 p-2" : "w-24 gap-2 p-2"
      }`}
    >
      {badge ? (
        <span className={`absolute right-2 top-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ${badgeClass}`}>
          {badge}
        </span>
      ) : null}
      <div
        className={`relative ${compact ? "text-4xl" : "text-[2.35rem]"} ${colorClass} ${
          active ? "drop-shadow-[0_0_16px_currentColor]" : ""
        }`}
      >
        {icon}
      </div>
      <span
        className={`text-center text-zinc-100 ${
          compact ? "text-[12px] font-medium tracking-[0.08em]" : "text-[12px] font-medium tracking-[0.08em]"
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}

export default function MatchActionGrid({
  isUpdating,
  historyStackLength,
  onEditTeams,
  onEditOvers,
  onUndo,
  onHistory,
  onImage,
  onCommentary,
  onWalkie,
  onMic,
  onShare,
  onWalkieHoldStart,
  onWalkieHoldEnd,
  onMicHoldStart,
  onMicHoldEnd,
  isWalkieActive = false,
  isCommentaryActive = false,
  isAnnounceActive = false,
}) {
  return (
    <div className="mt-8 flex justify-center border-t border-zinc-700 pt-6">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          <ActionIconButton
            onClick={onWalkie}
            onHoldStart={onWalkieHoldStart}
            onHoldEnd={onWalkieHoldEnd}
            icon={<WalkieIcon />}
            label="Walkietalkie"
            colorClass="text-emerald-300"
            active={isWalkieActive}
            badge={isWalkieActive ? "On" : "Off"}
            badgeClass={
              isWalkieActive
                ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
                : "border-rose-400/20 bg-rose-500/10 text-rose-200"
            }
          />
          <ActionIconButton
            onClick={onMic}
            onHoldStart={onMicHoldStart}
            onHoldEnd={onMicHoldEnd}
            icon={<CommentaryIcon />}
            label="Speaker mic"
            colorClass="text-amber-300"
            active={isCommentaryActive}
            badge={isCommentaryActive ? "On" : "Off"}
            badgeClass={
              isCommentaryActive
                ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
                : "border-rose-400/20 bg-rose-500/10 text-rose-200"
            }
          />
          <ActionIconButton
            onClick={onUndo}
            icon={<LuUndo2 />}
            label="Undo"
            colorClass="text-zinc-400"
            disabled={isUpdating || historyStackLength === 0}
            compact
          />
          <ActionIconButton
            onClick={onCommentary}
            icon={<AnnounceIcon />}
            label="Score feedback"
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
            onClick={onEditTeams}
            icon={<FaUserEdit />}
            label="Edit teams"
            colorClass="text-sky-400"
            disabled={isUpdating}
            compact
          />
          <ActionIconButton
            onClick={onEditOvers}
            icon={<FaRegClock />}
            label="Edit overs"
            colorClass="text-amber-400"
            disabled={isUpdating}
            compact
          />
          <ActionIconButton
            onClick={onHistory}
            icon={<FaBookOpen />}
            label="History"
            colorClass="text-violet-400"
            compact
          />
          <ActionIconButton
            onClick={onImage}
            icon={<FaImage />}
            label="Image"
            colorClass="text-zinc-200"
            compact
          />
          <ActionIconButton
            onClick={onShare}
            icon={<FaShareAlt />}
            label="Share"
            colorClass="text-green-400"
            compact
          />
        </div>
        <p className="text-center text-[11px] text-zinc-500">
          Hold to talk. Tap to open.
        </p>
      </div>
    </div>
  );
}
