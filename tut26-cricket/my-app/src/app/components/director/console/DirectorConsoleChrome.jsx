"use client";

/**
 * File overview:
 * Purpose: Renders Director UI for the app's screens and flows.
 * Main exports: IosSwitch, Card, SessionHeader, HOLD_BUTTON_INTERACTION_PROPS.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaInfoCircle, FaVolumeUp } from "react-icons/fa";
import SessionCoverHero from "../../shared/SessionCoverHero";
import {
  buildDirectorScoreLine,
  getDirectorChaseSummary,
  getDirectorOversDisplay,
  getDirectorPreferredMatch,
} from "./director-console-utils";

export function IosSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-8 w-13.5 items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/35 ${
        checked
          ? "border-emerald-300/35 bg-emerald-500 shadow-[0_10px_24px_rgba(16,185,129,0.22)]"
          : "border-white/10 bg-white/8"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-6.5" : "translate-x-0.75"
        }`}
      />
    </button>
  );
}

function HelpButton({ title, body }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const [panelStyle, setPanelStyle] = useState(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const updatePanelPosition = () => {
      const buttonRect = buttonRef.current?.getBoundingClientRect();
      if (!buttonRect || typeof window === "undefined") {
        return;
      }

      const panelWidth = Math.min(288, Math.max(220, window.innerWidth - 24));
      const top = Math.min(buttonRect.bottom + 10, window.innerHeight - 24);
      const left = Math.min(
        Math.max(12, buttonRect.right - panelWidth),
        Math.max(12, window.innerWidth - panelWidth - 12),
      );

      setPanelStyle({
        top: `${top}px`,
        left: `${left}px`,
        width: `${panelWidth}px`,
      });
    };

    const handlePointerDown = (event) => {
      if (
        !containerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    updatePanelPosition();
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
        aria-label={`How ${title} works`}
      >
        <FaInfoCircle />
      </button>
      {open && panelStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="fixed z-140 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,32,0.98),rgba(11,11,16,0.98))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            >
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{body}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const DIRECTOR_CARD_THEMES = {
  slate: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(148,163,184,0.16),transparent_42%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(244,244,245,0),rgba(226,232,240,0.72)_22%,rgba(125,211,252,0.72)_62%,rgba(244,244,245,0))]",
    icon: "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.04))] text-white shadow-[0_10px_26px_rgba(15,23,42,0.22)]",
  },
  emerald: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(16,185,129,0.2),transparent_42%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(52,211,153,0.86)_18%,rgba(34,211,238,0.82)_58%,rgba(0,0,0,0))]",
    icon: "border-emerald-300/14 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(6,95,70,0.08))] text-emerald-100 shadow-[0_10px_26px_rgba(16,185,129,0.18)]",
  },
  amber: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(245,158,11,0.2),transparent_42%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(251,191,36,0.85)_18%,rgba(245,158,11,0.82)_54%,rgba(34,211,238,0.54)_82%,rgba(0,0,0,0))]",
    icon: "border-amber-300/14 bg-[linear-gradient(180deg,rgba(245,158,11,0.18),rgba(120,53,15,0.08))] text-amber-100 shadow-[0_10px_26px_rgba(245,158,11,0.18)]",
  },
  violet: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.2),transparent_42%),radial-gradient(circle_at_88%_100%,rgba(59,130,246,0.12),transparent_34%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(192,132,252,0.84)_18%,rgba(99,102,241,0.74)_54%,rgba(34,211,238,0.6)_82%,rgba(0,0,0,0))]",
    icon: "border-violet-300/14 bg-[linear-gradient(180deg,rgba(139,92,246,0.18),rgba(76,29,149,0.08))] text-violet-100 shadow-[0_10px_26px_rgba(139,92,246,0.18)]",
  },
  cyan: {
    shellGlow:
      "before:bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.2),transparent_42%)]",
    strip:
      "bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(34,211,238,0.86)_18%,rgba(59,130,246,0.74)_54%,rgba(250,204,21,0.52)_82%,rgba(0,0,0,0))]",
    icon: "border-cyan-300/14 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(8,47,73,0.08))] text-cyan-100 shadow-[0_10px_26px_rgba(34,211,238,0.18)]",
  },
};

export function Card({
  title,
  subtitle = "",
  icon,
  children,
  action = null,
  help = null,
  accent = "slate",
}) {
  const theme = DIRECTOR_CARD_THEMES[accent] || DIRECTOR_CARD_THEMES.slate;
  return (
    <section
      className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(10,10,14,0.98))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] before:pointer-events-none before:absolute before:inset-0 before:opacity-100 after:pointer-events-none after:absolute after:inset-x-5 after:top-0 after:h-px after:rounded-full ${theme.shellGlow}`}
    >
      <div
        className={`absolute inset-x-5 top-0 h-0.5 rounded-full ${theme.strip}`}
      />
      <div className="relative mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${theme.icon}`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
          {help ? <HelpButton title={help.title} body={help.body} /> : null}
          {action}
        </div>
      </div>
      <div className="relative">{children}</div>
    </section>
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

export function SessionHeader({
  selectedSession,
  liveMatch,
  onChangeSession,
  readCurrentScore,
}) {
  const session = selectedSession?.session;
  const match = getDirectorPreferredMatch(liveMatch, selectedSession?.match);
  const isLive = Boolean(match?.isOngoing && !match?.result) || Boolean(selectedSession?.isLive);
  const imageUrl = match?.matchImageUrl || session?.matchImageUrl || "";
  const teams =
    match?.teamAName && match?.teamBName
      ? `${match.teamAName} vs ${match.teamBName}`
      : session?.teamAName && session?.teamBName
        ? `${session.teamAName} vs ${session.teamBName}`
        : "Teams pending";
  const score = Number(match?.score || 0);
  const outs = Number(match?.outs || 0);
  const oversDisplay = getDirectorOversDisplay(match);
  const chaseSummary = getDirectorChaseSummary(match);

  return (
    <SessionCoverHero
      imageUrl={imageUrl}
      alt={`${session?.name || "Session"} cover`}
      className="mb-5"
      priority
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
              {isLive ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-white">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Live
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
              {session?.name || "Director Console"}
            </h1>
            <p className="mt-1 text-sm text-zinc-200/90">{teams}</p>
          </div>

          <div className="flex items-center justify-center gap-2 sm:justify-end">
            <HelpButton
              title="Director console"
              body="Use this screen to manage the live session, PA mic, music, effects, and walkie."
            />
            <button
              type="button"
              onClick={readCurrentScore}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100 transition hover:bg-white/10"
              aria-label="Read current score"
            >
              <FaVolumeUp />
            </button>
            <button
              type="button"
              onClick={onChangeSession}
              className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 max-sm:text-xs"
            >
              Change
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                Live score
              </p>
              <p className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                {buildDirectorScoreLine(match)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Overs
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{oversDisplay}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-200">
              Wickets {outs}
            </span>
            {chaseSummary ? (
              <span className="inline-flex items-center rounded-full border border-amber-300/16 bg-amber-500/10 px-3 py-1.5 text-amber-100">
                {chaseSummary}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full border border-emerald-300/16 bg-emerald-500/10 px-3 py-1.5 text-emerald-100">
              {match?.result
                ? "Match finished"
                : isLive
                  ? "Managing live"
                  : "Waiting for live updates"}
            </span>
          </div>
        </div>
      </div>
    </SessionCoverHero>
  );
}


