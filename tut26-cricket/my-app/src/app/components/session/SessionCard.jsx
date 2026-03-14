"use client";

import { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaArrowUpRightFromSquare, FaEye, FaLock, FaRadio } from "react-icons/fa6";
import { formatRelativeTime } from "./formatRelativeTime";

function buildStatusMeta(session) {
  const isLive = Boolean(session.isLive);
  const hasSavedScore = Boolean(session.match);
  const referenceDate = session.updatedAt || session.createdAt;

  if (isLive) {
    return {
      badge: "Live now",
      tone: "live",
      summary: "Live score available",
    };
  }

  const relative = formatRelativeTime(referenceDate);
  const badge = relative.startsWith("on ")
    ? `Ended ${relative}`
    : `Ended ${relative}`;

  return {
    badge,
    tone: "ended",
    summary: hasSavedScore ? "Final score available" : "No score to view",
  };
}

function SessionCard({ session, onUmpireClick }) {
  const isLive = session.isLive;
  const statusMeta = buildStatusMeta(session);
  const cardImage = session.matchImageUrl || "/gvLogo.png";
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
    <div
      className={`group relative overflow-hidden rounded-[24px] border p-6 shadow-[0_22px_70px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-1 hover:border-white/18 ${
        isLive
          ? "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(12,18,18,0.98),rgba(8,10,12,0.98))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))]"
      }`}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "320px",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.16]">
        <Image
          src={cardImage}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover object-center"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,rgba(7,7,10,0.28),rgba(7,7,10,0.86))]" />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 opacity-70 blur-3xl ${
          isLive ? "bg-emerald-500/12" : "bg-rose-500/8"
        }`}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex flex-col gap-3">
          <div className="relative min-w-0 pt-12">
            <span
              className={`absolute right-0 top-0 inline-flex w-fit max-w-full whitespace-nowrap items-center gap-2 self-start rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
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
            <div className="min-w-0 pr-0 sm:pr-2">
              <h2 className="text-[1.25rem] leading-[1.08] font-medium tracking-[-0.035em] text-white [overflow-wrap:break-word] sm:text-[1.45rem] md:text-[1.58rem]">
                {session.name || "Untitled Session"}
              </h2>
              <p className="mt-3 text-[13px] font-medium tracking-[0.01em] text-zinc-400">
                {dateLabel}
              </p>
              {teamLine ? (
                <p className="mt-2 text-[0.98rem] leading-snug font-medium tracking-[-0.015em] text-zinc-100 [overflow-wrap:break-word] sm:text-[1.02rem]">
                  {teamLine}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[20px] border border-white/8 bg-black/20 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
            Session state
          </p>
          <p className="mt-2 text-[14px] leading-6 text-zinc-200">
            {statusMeta.summary}
            {isLive && session.match ? " Open it now or switch to Umpire Mode." : ""}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {isLive && session.match ? (
            <>
              <button
                onClick={() => onUmpireClick(session)}
                className="inline-flex min-w-[150px] flex-1 items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-[linear-gradient(180deg,rgba(37,99,235,0.2),rgba(15,23,42,0.9))] px-4 py-3 text-sm font-semibold text-sky-50 shadow-[0_16px_38px_rgba(37,99,235,0.16)] transition hover:-translate-y-0.5 hover:border-sky-300/35 hover:bg-[linear-gradient(180deg,rgba(59,130,246,0.24),rgba(15,23,42,0.94))]"
              >
                <FaLock />
                <span>Umpire Mode</span>
              </button>
              <Link
                href={scoreHref}
                prefetch={false}
                className="btn-ui btn-ui-primary inline-flex flex-1 min-w-[150px] rounded-2xl px-4 py-3 text-sm"
              >
                <FaEye />
                <span>View Live Score</span>
              </Link>
            </>
          ) : session.match ? (
            <Link
              href={scoreHref}
              prefetch={false}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(7,30,22,0.92))] px-4 py-3 text-sm font-semibold text-emerald-50 shadow-[0_16px_34px_rgba(16,185,129,0.14)] transition hover:-translate-y-0.5 hover:border-emerald-300/28 hover:bg-[linear-gradient(180deg,rgba(34,197,94,0.22),rgba(7,30,22,0.95))]"
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
    </div>
  );
}

export default memo(SessionCard);
