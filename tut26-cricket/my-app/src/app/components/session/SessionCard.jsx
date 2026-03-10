"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowUpRightFromSquare, FaEye, FaLock, FaRadio } from "react-icons/fa6";
import { formatRelativeTime } from "./formatRelativeTime";

function buildStatusMeta(session) {
  const isLive = Boolean(session.isLive);
  const referenceDate = session.updatedAt || session.createdAt;

  if (isLive) {
    return {
      badge: "Live now",
      tone: "live",
      summary: "Live scoreboard active",
    };
  }

  const relative = formatRelativeTime(referenceDate);
  const badge = relative.startsWith("on ")
    ? `Ended ${relative}`
    : `Ended ${relative}`;

  return {
    badge,
    tone: "ended",
    summary: "Final score available",
  };
}

export default function SessionCard({ session, onUmpireClick }) {
  const isLive = session.isLive;
  const statusMeta = buildStatusMeta(session);
  const scoreHref =
    session.match && !isLive
      ? `/result/${session.match}`
      : session.match
      ? `/session/${session._id}/view`
      : "";
  const teamLine =
    session.teamAName && session.teamBName
      ? `${session.teamAName} vs ${session.teamBName}`
      : "";
  const dateLabel = session.date || new Date(session.createdAt).toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative overflow-hidden rounded-[24px] border p-6 shadow-[0_22px_70px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-1 hover:border-white/18 ${
        isLive
          ? "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(12,18,18,0.98),rgba(8,10,12,0.98))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))]"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 opacity-70 blur-3xl ${
          isLive ? "bg-emerald-500/12" : "bg-rose-500/8"
        }`}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-[-0.03em] text-white">
              {session.name || "Untitled Session"}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">{dateLabel}</p>
            {teamLine ? (
              <p className="mt-1 truncate text-sm text-zinc-500">{teamLine}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] ${
              statusMeta.tone === "live"
                ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
                : "border-rose-400/15 bg-rose-500/10 text-rose-200"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isLive ? "animate-pulse bg-emerald-400" : "bg-rose-400"
              }`}
            />
            {statusMeta.badge}
          </span>
        </div>

        <div className="mt-6 rounded-[20px] border border-white/8 bg-black/20 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Session state
          </p>
          <p className="mt-2 text-sm text-zinc-200">
            {statusMeta.summary}
            {isLive && session.match ? " Jump in now or open umpire mode." : ""}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {isLive && session.match ? (
            <>
              <button
                onClick={() => onUmpireClick(session)}
                className="inline-flex flex-1 min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(37,99,235,0.22)] transition hover:bg-blue-500"
              >
                <FaLock />
                <span>Umpire Mode</span>
              </button>
              <Link
                href={scoreHref}
                prefetch={false}
                className="inline-flex flex-1 min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-semibold text-black shadow-[0_16px_30px_rgba(245,158,11,0.2)] transition hover:brightness-110"
              >
                <FaEye />
                <span>View Live Score</span>
              </Link>
            </>
          ) : session.match ? (
            <Link
              href={scoreHref}
              prefetch={false}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(5,150,105,0.2)] transition hover:bg-emerald-500"
            >
              <FaArrowUpRightFromSquare />
              <span>See Final Score</span>
            </Link>
          ) : (
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-medium text-zinc-400">
              <FaRadio />
              <span>No saved score</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
