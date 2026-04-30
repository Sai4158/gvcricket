"use client";

/**
 * File overview:
 * Purpose: Renders the shared YouTube live stream embed card for spectator and result views.
 * Main exports: YouTubeLiveStreamCard.
 * Major callers: Spectator and result pages.
 * Side effects: uses browser timers for hold-to-remove interactions.
 * Read next: ../result/ResultPageClient.jsx
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaCompress,
  FaExpand,
  FaExternalLinkAlt,
  FaTrashAlt,
  FaYoutube,
} from "react-icons/fa";

const HOLD_TO_REMOVE_DELAY_MS = 650;

function formatOversFromBalls(legalBallCount) {
  const safeBalls = Math.max(0, Number(legalBallCount || 0));
  const overs = Math.floor(safeBalls / 6);
  const balls = safeBalls % 6;
  return `${overs}.${balls}`;
}

function shortenTeamName(value = "") {
  const safeValue = String(value || "").trim();
  if (!safeValue) {
    return "TEAM";
  }

  if (safeValue.length <= 10) {
    return safeValue.toUpperCase();
  }

  const firstWord = safeValue.split(/\s+/)[0] || safeValue;
  if (firstWord.length <= 10) {
    return firstWord.toUpperCase();
  }

  return safeValue.slice(0, 8).toUpperCase();
}

function buildOverlayStatus(match) {
  if (!match) {
    return "";
  }

  if (match.isOngoing) {
    return "Live";
  }

  if (match.result) {
    return String(match.result).trim();
  }

  if (match.pendingResult) {
    return String(match.pendingResult).trim();
  }

  return "";
}

function SpectatorVideoOverlay({ match }) {
  if (!match) {
    return null;
  }

  const activeTeamName =
    match?.innings === "second"
      ? match?.innings2?.team || match?.teamBName || ""
      : match?.innings1?.team || match?.teamAName || "";
  const opponentTeamName =
    match?.innings === "second"
      ? match?.innings1?.team || match?.teamAName || ""
      : match?.innings2?.team || match?.teamBName || "";
  const score = Number(match?.score || 0);
  const wickets = Number(match?.outs || 0);
  const overText = formatOversFromBalls(match?.legalBallCount);
  const statusText = buildOverlayStatus(match);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="max-w-[68%] rounded-[20px] border border-white/12 bg-black/55 px-3 py-2 shadow-[0_14px_28px_rgba(0,0,0,0.34)] backdrop-blur-md sm:px-4">
          <div className="flex items-center gap-2">
            {match?.isOngoing ? (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-pulse" />
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-300 sm:text-[11px]">
              {shortenTeamName(activeTeamName)} vs {shortenTeamName(opponentTeamName)}
            </p>
          </div>
          <div className="mt-1.5 flex items-end gap-2 sm:gap-3">
            <p className="text-2xl font-black leading-none text-white sm:text-4xl">
              <span className="text-emerald-400">{score}</span>
              <span className="text-white">/</span>
              <span className="text-rose-400">{wickets}</span>
            </p>
            <p className="pb-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300 sm:text-xs">
              Overs {overText}
            </p>
          </div>
        </div>

        {statusText ? (
          <div className="max-w-[42%] rounded-[20px] border border-white/12 bg-black/55 px-3 py-2 text-right shadow-[0_14px_28px_rgba(0,0,0,0.34)] backdrop-blur-md sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400 sm:text-[11px]">
              Match
            </p>
            <p className="mt-1 line-clamp-2 text-xs font-bold text-white sm:text-sm">
              {statusText}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3 p-3 sm:p-4">
        <div className="rounded-[18px] border border-white/10 bg-black/50 px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.28)] backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400 sm:text-[11px]">
            Batting
          </p>
          <p className="mt-1 text-sm font-bold text-white sm:text-base">
            {shortenTeamName(activeTeamName)}
          </p>
        </div>

        {match?.isOngoing ? (
          <div className="rounded-full border border-emerald-300/20 bg-emerald-400/12 px-3 py-2 shadow-[0_12px_24px_rgba(16,185,129,0.18)] backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-100 sm:text-[11px]">
              GV Theater Mode
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function YouTubeLiveStreamCard({
  stream,
  title = "YouTube Match Stream",
  subtitle = "Watch the match here or open it directly in YouTube.",
  className = "",
  showOpenButton = true,
  minimal = false,
  holdToRemoveEnabled = false,
  onHoldRemove,
  overlayMatch = null,
  allowTheaterFullscreen = false,
}) {
  const holdTimerRef = useRef(null);
  const theaterFrameRef = useRef(null);
  const [isHoldingRemove, setIsHoldingRemove] = useState(false);
  const [isTheaterFullscreen, setIsTheaterFullscreen] = useState(false);

  const showOverlay = Boolean(overlayMatch);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleFullscreenChange = () => {
      setIsTheaterFullscreen(
        document.fullscreenElement === theaterFrameRef.current,
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const beginRemoveHold = useCallback(() => {
    if (!holdToRemoveEnabled || !onHoldRemove) {
      return;
    }

    setIsHoldingRemove(true);
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setIsHoldingRemove(false);
      onHoldRemove();
    }, HOLD_TO_REMOVE_DELAY_MS);
  }, [clearHoldTimer, holdToRemoveEnabled, onHoldRemove]);

  const endRemoveHold = useCallback(() => {
    clearHoldTimer();
    setIsHoldingRemove(false);
  }, [clearHoldTimer]);

  const handleToggleTheaterFullscreen = useCallback(async () => {
    if (!allowTheaterFullscreen || !theaterFrameRef.current || typeof document === "undefined") {
      return;
    }

    try {
      if (document.fullscreenElement === theaterFrameRef.current) {
        await document.exitFullscreen();
        return;
      }

      await theaterFrameRef.current.requestFullscreen();
    } catch {
      // Ignore fullscreen failures and keep normal playback available.
    }
  }, [allowTheaterFullscreen]);

  const actionButtons = useMemo(() => {
    const items = [];

    if (allowTheaterFullscreen) {
      items.push(
        <button
          key="theater"
          type="button"
          onClick={handleToggleTheaterFullscreen}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
        >
          {isTheaterFullscreen ? <FaCompress className="text-xs" /> : <FaExpand className="text-xs" />}
          {isTheaterFullscreen ? "Exit theater" : "Fullscreen score"}
        </button>,
      );
    }

    if (showOpenButton) {
      items.push(
        <a
          key="youtube"
          href={stream.watchUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
        >
          Open in YouTube
          <FaExternalLinkAlt className="text-xs" />
        </a>,
      );
    }

    return items;
  }, [
    allowTheaterFullscreen,
    handleToggleTheaterFullscreen,
    isTheaterFullscreen,
    showOpenButton,
    stream.watchUrl,
  ]);

  if (!stream?.embedUrl || !stream?.watchUrl) {
    return null;
  }

  return (
    <section
      className={`overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,0,0,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,9,12,0.99))] shadow-[0_30px_90px_rgba(0,0,0,0.42)] ${className}`}
    >
      {!minimal ? (
        <div className="border-b border-white/8 px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-red-400/20 bg-red-500/10 text-[1.55rem] text-red-400 shadow-[0_12px_28px_rgba(239,68,68,0.12)]">
                  <FaYoutube />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                    YouTube
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-[1.65rem]">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{subtitle}</p>
                </div>
              </div>
            </div>
            {holdToRemoveEnabled ? (
              <button
                type="button"
                onPointerDown={beginRemoveHold}
                onPointerUp={endRemoveHold}
                onPointerLeave={endRemoveHold}
                onPointerCancel={endRemoveHold}
                onContextMenu={(event) => event.preventDefault()}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                  isHoldingRemove
                    ? "border-rose-300/30 bg-rose-500/12 text-rose-100"
                    : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <FaTrashAlt className="text-[10px]" />
                {isHoldingRemove ? "Release" : "Hold to remove"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`${minimal ? "px-4 py-4 sm:px-5 sm:py-5" : "px-4 py-5 sm:px-7 sm:py-6"}`}>
        {minimal ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#FF0033] text-white shadow-[0_10px_24px_rgba(255,0,51,0.22)]">
                <FaYoutube className="text-lg" />
              </span>
              <div className="min-w-0">
                <p className="text-[1.45rem] font-black leading-none tracking-[-0.04em] text-white">
                  YouTube
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
                  Live stream
                </p>
              </div>
            </div>
            {holdToRemoveEnabled ? (
              <button
                type="button"
                onPointerDown={beginRemoveHold}
                onPointerUp={endRemoveHold}
                onPointerLeave={endRemoveHold}
                onPointerCancel={endRemoveHold}
                onContextMenu={(event) => event.preventDefault()}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                  isHoldingRemove
                    ? "border-rose-300/30 bg-rose-500/12 text-rose-100"
                    : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <FaTrashAlt className="text-[10px]" />
                {isHoldingRemove ? "Release" : "Hold to remove"}
              </button>
            ) : null}
          </div>
        ) : null}
        <div
          ref={theaterFrameRef}
          className={`overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.34)] ${
            isTheaterFullscreen ? "h-screen w-screen rounded-none border-0" : ""
          }`}
        >
          <div className={`relative bg-black ${isTheaterFullscreen ? "h-full w-full" : "aspect-video"}`}>
            {showOverlay ? <SpectatorVideoOverlay match={overlayMatch} /> : null}
            <iframe
              src={stream.embedUrl}
              title={title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>

        {actionButtons.length ? (
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            {actionButtons}
          </div>
        ) : null}

      </div>
    </section>
  );
}
