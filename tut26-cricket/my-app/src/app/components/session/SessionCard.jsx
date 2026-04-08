"use client";


/**
 * File overview:
 * Purpose: UI component for Session screens and flows.
 * Main exports: default export.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowUpRightFromSquare,
  FaCheck,
  FaEye,
  FaLock,
  FaRadio,
  FaTowerBroadcast,
  FaYoutube,
} from "react-icons/fa6";
import { formatRelativeTime } from "./formatRelativeTime";
import PendingLink from "../shared/PendingLink";
import { useRouteFeedback } from "../shared/RouteFeedbackProvider";
import {
  GV_MATCH_FALLBACK_IMAGE,
  resolveSafeMatchImage,
} from "../shared/SafeMatchImage";
import MatchImageCarousel from "../shared/MatchImageCarousel";
import { primeUiAudio } from "../../lib/page-audio";

function buildStatusMeta(session) {
  const isLive = Boolean(session.isLive);
  const hasSavedScore = Boolean(session.match);
  const referenceDate = session.updatedAt || session.createdAt;

  if (isLive) {
    return {
      badge: "Live now",
      tone: "live",
      title: "Live scoring is on.",
      summary: "Open live score, umpire mode, or director mode.",
    };
  }

  const relative = formatRelativeTime(referenceDate);
  const badge = relative.startsWith("on ")
    ? `Ended ${relative}`
    : `Ended ${relative}`;

  return {
    badge,
    tone: "ended",
    title: hasSavedScore ? "Match complete." : "No score yet.",
    summary: hasSavedScore
      ? session.result || "Final score is ready to open."
      : "Open this session when scoring starts.",
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

function SessionCard({
  session,
  onUmpireClick,
  onDirectorClick,
  shouldBlockCardOpen,
  onImageHold,
  selectionMode = false,
  selected = false,
  onSelectToggle,
}) {
  const router = useRouter();
  const { startNavigation } = useRouteFeedback();
  const cardRef = useRef(null);
  const [shouldLoadGallery, setShouldLoadGallery] = useState(false);
  const isLive = session.isLive;
  const statusMeta = buildStatusMeta(session);
  const matchImages = Array.isArray(session.matchImages) ? session.matchImages : [];
  const cardImage = matchImages[0]?.url || session.matchImageUrl || "";
  const hasUploadedCardImage =
    resolveSafeMatchImage(cardImage) !== GV_MATCH_FALLBACK_IMAGE;
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
  const canOpenCard = Boolean(scoreHref);
  const hasScoreCard = Boolean(
    session.match &&
      (isLive ||
        Number(session.score || 0) > 0 ||
        Number(session.outs || 0) > 0 ||
        session.result)
  );
  const displayScore = Number.isFinite(Number(session.score))
    ? Number(session.score)
    : 0;
  const displayOuts = Number.isFinite(Number(session.outs))
    ? Number(session.outs)
    : 0;
  const scoreMetaLabel = isLive ? "Runs" : "Final";
  const scoreDetailLabel =
    displayOuts > 0
      ? `${displayOuts} ${displayOuts === 1 ? "WKT" : "WKTS"}`
      : !isLive && session.result
      ? "RESULT"
      : "";

  useEffect(() => {
    if (!hasUploadedCardImage || shouldLoadGallery) {
      return undefined;
    }

    const element = cardRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      const frameId = window.requestAnimationFrame(() => {
        setShouldLoadGallery(true);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadGallery(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "320px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [hasUploadedCardImage, shouldLoadGallery]);

  const handleCardOpen = () => {
    if (!scoreHref || shouldBlockCardOpen?.()) {
      return;
    }

    void primeUiAudio().catch(() => {});
    startNavigation(isLive ? "Opening live score..." : "Opening final score...");
    router.push(scoreHref);
  };

  return (
    <div
      ref={cardRef}
      role={selectionMode ? "button" : canOpenCard ? "link" : undefined}
      tabIndex={selectionMode || canOpenCard ? 0 : undefined}
      aria-label={
        selectionMode
          ? `${selected ? "Deselect" : "Select"} ${session.name || "session"}`
          : canOpenCard
          ? `Open ${session.name || "session"}`
          : undefined
      }
      onClick={(event) => {
        if (
          (!canOpenCard && !selectionMode) ||
          (event.target instanceof Element &&
            event.target.closest("button,a,input,textarea,select,label"))
        ) {
          return;
        }
        if (selectionMode) {
          onSelectToggle?.(session._id);
          return;
        }
        handleCardOpen();
      }}
      onKeyDown={(event) => {
        if (!selectionMode && !canOpenCard) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (selectionMode) {
            onSelectToggle?.(session._id);
            return;
          }
          handleCardOpen();
        }
      }}
      className={`group relative overflow-hidden rounded-[24px] border p-6 shadow-[0_22px_70px_rgba(0,0,0,0.28)] transition-all select-none [touch-action:pan-y] hover:-translate-y-1 hover:border-white/18 ${
        isLive
          ? "border-rose-300/18 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(190,24,93,0.08),transparent_34%),linear-gradient(180deg,rgba(24,12,16,0.98),rgba(7,10,12,0.98))]"
          : "border-emerald-300/14 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_28%),linear-gradient(180deg,rgba(12,20,16,0.98),rgba(10,10,14,0.98))]"
      } ${
        selectionMode
          ? `cursor-pointer press-feedback ${selected ? "ring-2 ring-cyan-300/45 shadow-[0_0_0_1px_rgba(103,232,249,0.28),0_24px_70px_rgba(0,0,0,0.34)]" : ""}`
          : canOpenCard
          ? "cursor-pointer press-feedback"
          : ""
      }`}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "320px",
        WebkitTouchCallout: "none",
      }}
    >
      <div
        className={`pointer-events-none absolute inset-x-5 top-0 h-[3px] rounded-b-full ${
          isLive
            ? "bg-[linear-gradient(90deg,rgba(244,63,94,0),rgba(244,63,94,0.84)_14%,rgba(225,29,72,0.88)_54%,rgba(190,24,93,0.7)_84%,rgba(244,63,94,0))]"
            : "bg-[linear-gradient(90deg,rgba(16,185,129,0),rgba(16,185,129,0.86)_14%,rgba(34,197,94,0.88)_54%,rgba(5,150,105,0.7)_84%,rgba(16,185,129,0))]"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,rgba(7,7,10,0.28),rgba(7,7,10,0.86))]" />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 opacity-70 blur-3xl ${
          isLive ? "bg-rose-400/14" : "bg-emerald-400/12"
        }`}
      />
      <div
        className={`pointer-events-none absolute bottom-0 right-0 h-32 w-32 rounded-full blur-3xl ${
          isLive ? "bg-rose-500/8" : "bg-emerald-500/8"
        }`}
      />
      {selectionMode ? (
        <div className="pointer-events-none absolute left-4 top-4 z-10">
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border text-sm shadow-[0_12px_24px_rgba(0,0,0,0.18)] ${
              selected
                ? "border-cyan-200/28 bg-cyan-300/18 text-cyan-50"
                : "border-white/10 bg-black/35 text-zinc-300"
            }`}
          >
            <FaCheck />
          </span>
        </div>
      ) : null}

      <div className="relative flex h-full flex-col">
        <div className="flex flex-col gap-3">
          <div className="relative min-w-0 pt-12">
            <span
              className={`absolute right-0 top-0 inline-flex w-fit max-w-full whitespace-nowrap items-center gap-2 self-start rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                statusMeta.tone === "live"
                  ? "border-rose-300/16 bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(76,5,25,0.26))] text-rose-100 shadow-[0_10px_24px_rgba(244,63,94,0.1)]"
                  : "border-emerald-300/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(6,95,70,0.28))] text-emerald-100 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isLive ? "animate-pulse bg-rose-400" : "bg-emerald-400"
                }`}
              />
              <span suppressHydrationWarning>{statusMeta.badge}</span>
            </span>
            {hasScoreCard ? (
              <div className="pointer-events-none absolute right-0 top-[3.1rem] text-right">
                <p className="text-[2.05rem] font-black leading-none tracking-tight text-amber-300 sm:text-[2.3rem]">
                  {displayScore.toLocaleString()}
                </p>
                <p className="mt-1 text-[0.92rem] font-black uppercase leading-none tracking-tight text-amber-300">
                  {scoreMetaLabel}
                </p>
                {scoreDetailLabel ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    {scoreDetailLabel}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div
              className={`min-w-0 min-h-[8.9rem] ${hasScoreCard ? "pr-24 sm:pr-28" : "pr-0 sm:pr-2"}`}
            >
              <h2
                className="text-[1.25rem] leading-[1.08] font-medium tracking-[-0.035em] text-white [overflow-wrap:anywhere] sm:text-[1.45rem] md:text-[1.58rem]"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 3,
                  overflow: "hidden",
                }}
              >
                {session.name || "Untitled Session"}
              </h2>
              {teamLine ? (
                <p
                  className="mt-4 text-[0.98rem] leading-snug font-semibold uppercase tracking-[0.02em] text-zinc-100 [overflow-wrap:anywhere] sm:text-[1.02rem]"
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                  }}
                >
                  {teamLine}
                </p>
              ) : null}
              <p
                className="mt-2 text-[13px] font-medium tracking-[0.01em] text-zinc-400"
                suppressHydrationWarning
              >
                {dateLabel}
              </p>
            </div>
          </div>
        </div>

        {hasUploadedCardImage ? (
          <div className="relative mt-6 overflow-hidden rounded-[20px] border border-white/8 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),rgba(0,0,0,0))] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-300/85">
                {matchImages.length > 1 ? "Match images" : "Match image"}
              </p>
            </div>
            <div
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onPointerLeave={(event) => event.stopPropagation()}
              onPointerCancel={(event) => event.stopPropagation()}
            >
              {shouldLoadGallery ? (
                <MatchImageCarousel
                  images={matchImages.length ? matchImages : [{ id: "cover", url: cardImage }]}
                  alt={`${session.name || "Session"} match image`}
                  compact
                  className="relative"
                  autoPlayDelayMs={1000}
                  autoPlayInitialDelayMs={1000}
                  transitionStyle="slide"
                  imageClassName="object-cover object-center"
                  fallbackClassName="object-cover object-center"
                  onImageHold={(image, index, event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onImageHold?.(session, image, index);
                  }}
                />
              ) : (
                <div className="aspect-[16/8.8] w-full bg-[linear-gradient(180deg,rgba(22,22,28,0.9),rgba(10,10,14,0.96))]" />
              )}
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,10,0.08),rgba(7,7,10,0.18))]" />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[20px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.32))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex aspect-[16/7.8] flex-col justify-center px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Status
              </p>
              <p className="mt-1.5 text-[14px] font-semibold leading-5 text-zinc-100">
                {statusMeta.title}
              </p>
              <p
                className="mt-1 text-[13px] leading-5 text-zinc-300"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                }}
              >
                {statusMeta.summary}
              </p>
            </div>
          </div>
        )}

        <div
          className={`mt-6 flex flex-wrap gap-3 ${
            selectionMode ? "pointer-events-none opacity-45" : ""
          }`}
        >
          {selectionMode ? (
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-medium text-zinc-300">
              <FaCheck />
              <span>{selected ? "Selected" : "Tap to select"}</span>
            </div>
          ) : isLive && session.match ? (
            <>
              <PendingLink
                href={scoreHref}
                pendingLabel="Opening live score..."
                pendingClassName="pending-shimmer"
                primeAudioOnClick
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
                  onClick={(event) => {
                    event.stopPropagation();
                    onUmpireClick(session);
                  }}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-cyan-300/16 bg-[linear-gradient(135deg,rgba(10,16,26,0.96),rgba(17,24,39,0.96)_58%,rgba(8,47,73,0.78))] px-4 py-3 text-sm font-semibold text-cyan-50 shadow-[0_16px_38px_rgba(6,24,38,0.2)] transition hover:-translate-y-0.5 hover:border-cyan-200/26 hover:brightness-110"
                >
                  <FaLock />
                  <span>Umpire Mode</span>
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDirectorClick?.(session);
                  }}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-emerald-300/16 bg-[linear-gradient(135deg,rgba(8,25,24,0.96),rgba(13,36,32,0.96)_58%,rgba(5,150,105,0.72))] px-4 py-3 text-sm font-semibold text-emerald-50 shadow-[0_16px_38px_rgba(4,120,87,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-200/26 hover:brightness-110"
                >
                  <FaTowerBroadcast />
                  <FaYoutube className="text-red-300/95" />
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
