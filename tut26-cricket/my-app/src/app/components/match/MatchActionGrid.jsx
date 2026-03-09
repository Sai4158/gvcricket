"use client";

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
        d="M9 8.5h6M10 12h4M9.5 4.5 14.5 2M8 6.5h8a2 2 0 0 1 2 2V18a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V8.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

function CommentaryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V8A3.5 3.5 0 1 0 8.5 8v4a3.5 3.5 0 0 0 3.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9.5 21h5"
        stroke="currentColor"
        strokeWidth="1.8"
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
  icon,
  label,
  colorClass,
  disabled = false,
  active = false,
  badge,
  compact = false,
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? "w-24 gap-2 p-2" : "w-24 gap-2 p-2"
      }`}
    >
      {badge ? (
        <span className="absolute right-2 top-0 rounded-full border border-white/10 bg-white/6 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/75">
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
  isWalkieActive = false,
  isCommentaryActive = false,
  isAnnounceActive = false,
}) {
  return (
    <div className="mt-8 flex justify-center border-t border-zinc-700 pt-6">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
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
            onClick={onUndo}
            icon={<LuUndo2 />}
            label="Undo"
            colorClass="text-zinc-400"
            disabled={isUpdating || historyStackLength === 0}
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

        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          <ActionIconButton
            onClick={onWalkie}
            icon={<WalkieIcon />}
            label="Walkietalkie"
            colorClass="text-emerald-300"
            active={isWalkieActive}
            badge={isWalkieActive ? "Live" : undefined}
          />
          <ActionIconButton
            onClick={onMic}
            icon={<CommentaryIcon />}
            label="Mic"
            colorClass="text-amber-300"
            active={isCommentaryActive}
            badge={isCommentaryActive ? "On" : undefined}
          />
          <ActionIconButton
            onClick={onCommentary}
            icon={<AnnounceIcon />}
            label="Score feedback"
            colorClass="text-cyan-300"
            active={isAnnounceActive}
            badge={isAnnounceActive ? "On" : undefined}
          />
        </div>
      </div>
    </div>
  );
}
