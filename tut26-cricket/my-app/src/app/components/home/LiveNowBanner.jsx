"use client";


/**
 * File overview:
 * Purpose: UI component for Home screens and flows.
 * Main exports: LiveNowBanner.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FaArrowRight } from "react-icons/fa";
import PendingLink from "../shared/PendingLink";
import SafeMatchImage from "../shared/SafeMatchImage";
import useHomeDesktopLiteMotion from "./useHomeDesktopLiteMotion";

function getBannerTimestamp(liveMatch) {
  return new Date(liveMatch?.updatedAt || 0).getTime();
}

function pickPreferredLiveBanner(currentBanner, nextBanner) {
  if (!currentBanner) {
    return nextBanner || null;
  }

  if (!nextBanner) {
    return null;
  }

  if (currentBanner.isLive !== nextBanner.isLive) {
    return nextBanner.isLive ? nextBanner : currentBanner;
  }

  return getBannerTimestamp(nextBanner) >= getBannerTimestamp(currentBanner)
    ? nextBanner
    : currentBanner;
}

export default function LiveNowBanner({ liveMatch }) {
  const prefersReducedMotion = useReducedMotion();
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const shouldReduceMotion = prefersReducedMotion || useDesktopLiteMotion;
  const [fetchedLiveMatch, setFetchedLiveMatch] = useState(null);
  const currentLiveMatch = pickPreferredLiveBanner(liveMatch || null, fetchedLiveMatch);
  const bannerHref = currentLiveMatch
    ? currentLiveMatch.isLive === false
      ? `/result/${currentLiveMatch.matchId}`
      : `/session/${currentLiveMatch.sessionId}/view`
    : "";
  const bannerEyebrow = currentLiveMatch?.isLive === false ? "Latest Match" : "Live Now";
  const bannerStatusText =
    currentLiveMatch?.isLive === false
      ? `${currentLiveMatch.score}/${currentLiveMatch.outs} - View latest score`
      : `${currentLiveMatch?.score}/${currentLiveMatch?.outs} - View score now`;
  const pendingLabel =
    currentLiveMatch?.isLive === false ? "Opening latest score..." : "Opening live score...";

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    let cancelled = false;

    const loadLiveMatch = async () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        const response = await fetch("/api/home/live-banner", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json().catch(() => null);
        if (!cancelled) {
          const nextLiveMatch = payload?.liveMatch || null;
          setFetchedLiveMatch(nextLiveMatch);
        }
      } catch (_error) {
        // Ignore banner refresh failures and keep the last known live match.
      }
    };

    void loadLiveMatch();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadLiveMatch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!currentLiveMatch) {
    return null;
  }

  if (useDesktopLiteMotion) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-start px-4 pr-20 pt-5 md:justify-center md:px-6 md:pr-6 md:pt-7">
        <PendingLink
          href={bannerHref}
          pendingLabel={pendingLabel}
          pendingClassName="pending-shimmer"
          primeAudioOnClick
          className="liquid-glass home-desktop-lite-card pointer-events-auto flex w-full max-w-[calc(100vw-5rem)] items-center justify-between gap-3 rounded-[26px] px-3.5 py-2.5 text-white shadow-[0_18px_34px_rgba(0,0,0,0.2)] transition hover:border-white/28 md:max-w-md md:gap-4 md:px-4 md:py-3"
        >
          {({ pending, spinner }) => (
            <>
              <div className="absolute inset-0 rounded-[26px] bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.1),transparent_40%)] md:bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />
              <div className="relative z-10 flex min-w-0 items-center gap-2.5 md:gap-3">
                <div className="relative h-[3.35rem] w-[3.35rem] shrink-0 overflow-hidden rounded-[18px] md:h-[4rem] md:w-[4rem]">
                  <SafeMatchImage
                    src={currentLiveMatch.matchImageUrl || ""}
                    alt={`${currentLiveMatch.teamAName} vs ${currentLiveMatch.teamBName}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                    fallbackClassName="object-contain p-0 opacity-100 scale-[1.38] md:scale-[1.46]"
                  />
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300 md:text-[11px] md:tracking-[0.34em] md:text-amber-100">
                    {bannerEyebrow}
                  </div>
                  <div className="truncate text-[14px] font-semibold leading-tight text-white md:text-[15px]">
                    {currentLiveMatch.teamAName} vs {currentLiveMatch.teamBName}
                  </div>
                  <div className="text-[11px] text-white/74 md:text-xs">
                    {pending ? pendingLabel : bannerStatusText}
                  </div>
                </div>
              </div>
              <div className="liquid-pill relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-white md:h-12 md:w-12">
                {pending ? spinner : <FaArrowRight className="h-4 w-4" />}
              </div>
            </>
          )}
        </PendingLink>
      </div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: -28, scale: 0.985 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={
        shouldReduceMotion
          ? undefined
          : {
              type: "spring",
              stiffness: 220,
              damping: 24,
              mass: 0.8,
              delay: 0.08,
            }
      }
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-start px-4 pr-20 pt-5 md:justify-center md:px-6 md:pr-6 md:pt-7"
    >
      <PendingLink
        href={bannerHref}
        pendingLabel={pendingLabel}
        pendingClassName="pending-shimmer"
        primeAudioOnClick
        className="liquid-glass home-desktop-lite-card pointer-events-auto flex w-full max-w-[calc(100vw-5rem)] items-center justify-between gap-3 rounded-[26px] px-3.5 py-2.5 text-white shadow-[0_18px_34px_rgba(0,0,0,0.2)] transition hover:border-white/28 md:max-w-md md:gap-4 md:px-4 md:py-3"
      >
        {({ pending, spinner }) => (
          <>
            <div className="absolute inset-0 rounded-[26px] bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.1),transparent_40%)] md:bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />
            <div className="relative z-10 flex min-w-0 items-center gap-2.5 md:gap-3">
              <div className="relative h-[3.35rem] w-[3.35rem] shrink-0 overflow-hidden rounded-[18px] md:h-[4rem] md:w-[4rem]">
                <SafeMatchImage
                  src={currentLiveMatch.matchImageUrl || ""}
                  alt={`${currentLiveMatch.teamAName} vs ${currentLiveMatch.teamBName}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                  fallbackClassName="object-contain p-0 opacity-100 scale-[1.38] md:scale-[1.46]"
                />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300 md:text-[11px] md:tracking-[0.34em] md:text-amber-100">
                  {bannerEyebrow}
                </div>
                <div className="truncate text-[14px] font-semibold leading-tight text-white md:text-[15px]">
                  {currentLiveMatch.teamAName} vs {currentLiveMatch.teamBName}
                </div>
                <div className="text-[11px] text-white/74 md:text-xs">
                  {pending ? pendingLabel : bannerStatusText}
                </div>
              </div>
            </div>
            <div className="liquid-pill relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-white md:h-12 md:w-12">
              {pending ? spinner : <FaArrowRight className="h-4 w-4" />}
            </div>
          </>
        )}
      </PendingLink>
    </motion.div>
  );
}
