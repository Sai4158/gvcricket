"use client";

/**
 * File overview:
 * Purpose: Renders the shared YouTube live stream embed card for spectator and result views.
 * Main exports: YouTubeLiveStreamCard.
 * Major callers: Spectator and result pages.
 * Side effects: uses browser timers for hold-to-remove interactions.
 * Read next: ../result/ResultPageClient.jsx
 */

import { useCallback, useRef, useState } from "react";
import { FaExternalLinkAlt, FaTrashAlt, FaYoutube } from "react-icons/fa";

const HOLD_TO_REMOVE_DELAY_MS = 650;

export default function YouTubeLiveStreamCard({
  stream,
  title = "YouTube Match Stream",
  subtitle = "Watch the match here or open it directly in YouTube.",
  className = "",
  showOpenButton = true,
  holdToRemoveEnabled = false,
  onHoldRemove,
}) {
  const holdTimerRef = useRef(null);
  const [isHoldingRemove, setIsHoldingRemove] = useState(false);

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

  if (!stream?.embedUrl || !stream?.watchUrl) {
    return null;
  }

  return (
    <section
      className={`overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,0,0,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,9,12,0.99))] shadow-[0_30px_90px_rgba(0,0,0,0.42)] ${className}`}
    >
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

      <div className="px-4 py-5 sm:px-7 sm:py-6">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.34)]">
          <div className="aspect-video bg-black">
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

        {showOpenButton ? (
          <div className="mt-5 flex justify-end">
            <a
              href={stream.watchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Open in YouTube
              <FaExternalLinkAlt className="text-xs" />
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
