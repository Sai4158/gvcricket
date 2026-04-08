"use client";


/**
 * File overview:
 * Purpose: UI component for Director screens and flows.
 * Main exports: DirectorSessionPicker.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import { useState } from "react";
import {
  FaArrowRight,
  FaBroadcastTower,
  FaClock,
  FaInfoCircle,
  FaPlus,
} from "react-icons/fa";
import PendingLink from "../shared/PendingLink";

function formatRelativeTime(value) {
  const date = new Date(value || 0).getTime();
  if (!date) return "Just now";
  const diffMs = Math.max(0, Date.now() - date);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}

function getSessionTeams(item) {
  const match = item.match;
  const session = item.session;
  const teamA = match?.teamAName || session?.teamAName || "";
  const teamB = match?.teamBName || session?.teamBName || "";
  const hasTeams = Boolean(teamA && teamB);
  const isDefaultTeams =
    teamA.trim().toLowerCase() === "team a" &&
    teamB.trim().toLowerCase() === "team b";

  return {
    hasCustomTeams: hasTeams && !isDefaultTeams,
    teamLabel: hasTeams ? `${teamA} vs ${teamB}` : "",
  };
}

function SessionCard({ item, onSelect }) {
  const session = item.session;
  const { hasCustomTeams, teamLabel } = getSessionTeams(item);
  const primaryTitle = hasCustomTeams ? teamLabel : session?.name || "Untitled Session";
  const secondaryLabel = hasCustomTeams ? session?.name || "" : "";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      className="press-feedback group w-full rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:-translate-y-0.5 hover:border-white/15"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-white [overflow-wrap:anywhere]">
            {primaryTitle}
          </p>
          {secondaryLabel ? (
            <p className="mt-1 text-sm text-zinc-400 [overflow-wrap:anywhere]">{secondaryLabel}</p>
          ) : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
            item.isLive
              ? "bg-emerald-500/14 text-emerald-200"
              : "bg-white/[0.06] text-zinc-300"
          }`}
        >
              {item.isLive ? "Live" : "Completed"}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 text-zinc-400">
          <FaClock className="text-xs" />
          <span suppressHydrationWarning>{formatRelativeTime(item.updatedAt)}</span>
        </span>
        <span className="inline-flex items-center gap-2 text-emerald-200 transition group-hover:translate-x-0.5">
          Open
          <FaArrowRight className="text-xs" />
        </span>
      </div>
    </button>
  );
}

export default function DirectorSessionPicker({
  sessions = [],
  onSelect,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const liveSessions = sessions.filter((item) => item.isLive);

  if (!liveSessions.length) {
    return (
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.98))] p-7 text-center shadow-[0_22px_80px_rgba(0,0,0,0.4)]">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] text-zinc-200">
          <FaBroadcastTower className="text-xl" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold text-white">No live sessions</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          No live match is ready for director controls. Create a new session to start a match, then come back here.
        </p>
        <PendingLink
          href="/session/new"
          pendingLabel="Opening new session..."
          pendingClassName="pending-shimmer"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/18 bg-[linear-gradient(135deg,rgba(9,20,17,0.96),rgba(7,33,27,0.96)_58%,rgba(16,185,129,0.82))] px-5 py-3 text-sm font-semibold text-emerald-50 shadow-[0_16px_30px_rgba(6,95,70,0.22)] transition hover:-translate-y-0.5 hover:border-emerald-200/28 hover:brightness-110"
        >
          {({ pending, spinner }) => (
            <>
              {pending ? spinner : <FaPlus />}
              {pending ? "Opening..." : "Create New Match"}
            </>
          )}
        </PendingLink>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.98))] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
              Director Mode
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Choose a live session
            </h2>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setShowHelp((current) => !current)}
              className="press-feedback inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] p-0 leading-none text-zinc-200 transition hover:bg-white/[0.1]"
              aria-label="How session selection works"
            >
              <FaInfoCircle className="block text-[0.95rem]" />
            </button>
          </div>
        </div>

        {showHelp ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-zinc-300">
            Pick the live session you want to join. Director mode is shared, so multiple directors can open the same live match together.
          </div>
        ) : null}

        {liveSessions.length ? (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Live Sessions
            </p>
            <div className="space-y-3">
              {liveSessions.map((item) => (
                <SessionCard
                  key={item.session._id}
                  item={item}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
