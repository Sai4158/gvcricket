"use client";

import { memo } from "react";
import {
  FaArrowUpRightFromSquare,
  FaEye,
  FaLock,
  FaRadio,
  FaTowerBroadcast,
} from "react-icons/fa6";
import { formatRelativeTime } from "./formatRelativeTime";
import PendingLink from "../shared/PendingLink";
import SafeMatchImage from "../shared/SafeMatchImage";

function buildStatusMeta(session) {
  const isLive = Boolean(session.isLive);
  const hasSavedScore = Boolean(session.match);
  const referenceDate = session.updatedAt || session.createdAt;

  if (isLive) {
    return {
      badge: "Live now",
      tone: "live",
      summary: "Live score is ready.",
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

function formatSessionDateLabel(session) {
  if (session.date) {
    const parsed = new Date(session.date);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString([], {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }

    return session.date.replace(/:\d{2}(?=\s*[AP]M|\s*$)/i, "");
  }

  return new Date(session.createdAt).toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SessionCard({ session, onUmpireClick, onDirectorClick }) {
  const isLive = session.isLive;
  const statusMeta = buildStatusMeta(session);
  const cardImage = session.matchImageUrl || "";
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
  const dateLabel = formatSessionDateLabel(session);

  return (
    <div
      className={`group relative overflow-hidden rounded-[24px] border p-6 shadow-[0_22px_70px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-1 hover:border-white/18 ${
        isLive
          ? "border-emerald-300/18 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(10,20,18,0.98),rgba(7,10,12,0.98))]"
          : "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.09),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(190,24,93,0.08),transparent_28%),linear-gradient(180deg,rgba(22,22,27,0.98),rgba(10,10,14,0.98))]"
      }`}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "320px",
      }}
    >
      <div
        className={`pointer-events-none absolute inset-x-5 top-0 h-[3px] rounded-b-full ${
          isLive
            ? "bg-[linear-gradient(90deg,rgba(16,185,129,0),rgba(16,185,129,0.86)_14%,rgba(34,211,238,0.92)_52%,rgba(59,130,246,0.75)_82%,rgba(16,185,129,0))]"
            : "bg-[linear-gradient(90deg,rgba(244,63,94,0),rgba(244,63,94,0.84)_14%,rgba(225,29,72,0.88)_54%,rgba(190,24,93,0.7)_84%,rgba(244,63,94,0))]"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.16]">
        <SafeMatchImage
          src={cardImage}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover object-center"
          fallbackClassName="object-contain object-center p-8 opacity-[0.92]"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,rgba(7,7,10,0.28),rgba(7,7,10,0.86))]" />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 opacity-70 blur-3xl ${
          isLive ? "bg-emerald-400/14" : "bg-rose-400/12"
        }`}
      />
      <div
        className={`pointer-events-none absolute bottom-0 right-0 h-32 w-32 rounded-full blur-3xl ${
          isLive ? "bg-cyan-400/8" : "bg-rose-500/8"
        }`}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex flex-col gap-3">
          <div className="relative min-w-0 pt-12">
            <span
              className={`absolute right-0 top-0 inline-flex w-fit max-w-full whitespace-nowrap items-center gap-2 self-start rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                statusMeta.tone === "live"
                  ? "border-emerald-300/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(6,95,70,0.28))] text-emerald-100 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
                  : "border-rose-300/16 bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(76,5,25,0.26))] text-rose-100 shadow-[0_10px_24px_rgba(244,63,94,0.1)]"
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
              <p className="mt-4 text-[13px] font-medium tracking-[0.01em] text-zinc-400">
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

        <div className="mt-6 rounded-[20px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.32))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
            Session state
          </p>
          <p className="mt-2 text-[14px] leading-6 text-zinc-200">
            {isLive && session.match ? "Open live score or enter umpire mode." : statusMeta.summary}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {isLive && session.match ? (
            <>
              <PendingLink
                href={scoreHref}
                pendingLabel="Opening live score..."
                pendingClassName="pending-shimmer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200/16 bg-[linear-gradient(135deg,rgba(245,158,11,0.96),rgba(217,119,6,0.94)_58%,rgba(120,53,15,0.98))] px-4 py-3.5 text-[15px] font-semibold text-black shadow-[0_18px_34px_rgba(180,83,9,0.24)] transition hover:-translate-y-0.5 hover:border-amber-100/28 hover:brightness-105"
              >
                {({ pending, spinner }) => (
                  <>
                    {pending ? spinner : <FaEye />}
                    <span>{pending ? "Opening..." : "Live Score"}</span>
                  </>
                )}
              </PendingLink>
              <div className="grid w-full grid-cols-2 gap-3">
                <button
                  onClick={() => onUmpireClick(session)}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-cyan-300/16 bg-[linear-gradient(135deg,rgba(10,16,26,0.96),rgba(17,24,39,0.96)_58%,rgba(8,47,73,0.78))] px-4 py-3 text-sm font-semibold text-cyan-50 shadow-[0_16px_38px_rgba(6,24,38,0.2)] transition hover:-translate-y-0.5 hover:border-cyan-200/26 hover:brightness-110"
                >
                  <FaLock />
                  <span>Umpire Mode</span>
                </button>
                <button
                  onClick={() => onDirectorClick?.(session)}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-emerald-300/16 bg-[linear-gradient(135deg,rgba(8,25,24,0.96),rgba(13,36,32,0.96)_58%,rgba(5,150,105,0.72))] px-4 py-3 text-sm font-semibold text-emerald-50 shadow-[0_16px_38px_rgba(4,120,87,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-200/26 hover:brightness-110"
                >
                  <FaTowerBroadcast />
                  <span>Director Mode</span>
                </button>
              </div>
            </>
          ) : session.match ? (
            <PendingLink
              href={scoreHref}
              pendingLabel="Opening final score..."
              pendingClassName="pending-shimmer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/16 bg-[linear-gradient(135deg,rgba(10,18,18,0.98),rgba(9,32,28,0.96)_56%,rgba(6,95,70,0.74))] px-4 py-3 text-sm font-semibold text-emerald-50 shadow-[0_16px_34px_rgba(6,78,59,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-200/26 hover:brightness-110"
            >
              {({ pending, spinner }) => (
                <>
                  {pending ? spinner : <FaArrowUpRightFromSquare />}
                  <span>{pending ? "Opening..." : "See Final Score"}</span>
                </>
              )}
            </PendingLink>
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
