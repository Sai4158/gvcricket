"use client";

/**
 * File overview:
 * Purpose: Small presentational controls and hold-button props used by the spectator session view.
 * Main exports: spectator view icons, IosGlassSwitch, and HOLD_BUTTON_INTERACTION_PROPS.
 * Major callers: SessionViewClient.
 * Side effects: none.
 * Read next: ./session-view-helpers.js
 */

import { FaBullhorn } from "react-icons/fa";

export function DualWalkieIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.5h4a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7V5.75L9 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="14" r="0.9" fill="currentColor" />
      <path
        d="M14.5 9h4a1 1 0 0 1 1 1v5.5a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V10a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 8.5V7.25L18 6.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="14" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function LoudspeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M4.5 14H7l4.75 3.5V6.5L7 10H4.5A1.5 1.5 0 0 0 3 11.5v1A1.5 1.5 0 0 0 4.5 14Z"
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
    </svg>
  );
}

export function PaMicSpeakerIcon() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center text-[1.05rem]"
      aria-hidden="true"
    >
      <FaBullhorn />
    </span>
  );
}

export function IosGlassSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-8 w-14.5 items-center rounded-full border p-1 transition ${
        disabled
          ? "cursor-not-allowed border-white/8 bg-white/4 opacity-55"
          : checked
            ? "border-emerald-300/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.92),rgba(6,95,70,0.92))] shadow-[0_12px_28px_rgba(16,185,129,0.24)]"
            : "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
      }`}
    >
      <span
        className={`absolute inset-px rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] ${
          checked ? "opacity-30" : "opacity-100"
        }`}
        aria-hidden="true"
      />
      <span
        className={`relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(229,231,235,0.92))] shadow-[0_6px_16px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-6.5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export const HOLD_BUTTON_INTERACTION_PROPS = {
  draggable: false,
  onContextMenu: (event) => {
    event.preventDefault();
  },
  onMouseDown: (event) => {
    event.preventDefault();
  },
  onDragStart: (event) => {
    event.preventDefault();
  },
  style: {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    touchAction: "none",
    WebkitTapHighlightColor: "transparent",
  },
};
