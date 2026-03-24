"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaArrowRight } from "react-icons/fa";
import PendingLink from "../shared/PendingLink";
import SafeMatchImage from "../shared/SafeMatchImage";

const LIVE_NOW_BANNER_CACHE_TTL_MS = 15_000;
const LIVE_NOW_BANNER_CACHE_KEY = "gv-home-live-banner-v1";
const liveNowBannerMemoryCache = globalThis.__gvHomeLiveBannerClientCache || {
  liveMatch: null,
  expiresAt: 0,
};

if (!globalThis.__gvHomeLiveBannerClientCache) {
  globalThis.__gvHomeLiveBannerClientCache = liveNowBannerMemoryCache;
}

function readCachedLiveBanner() {
  const now = Date.now();
  if (liveNowBannerMemoryCache.liveMatch && liveNowBannerMemoryCache.expiresAt > now) {
    return liveNowBannerMemoryCache.liveMatch;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(LIVE_NOW_BANNER_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (Number(parsed?.expiresAt || 0) <= now) {
      window.sessionStorage.removeItem(LIVE_NOW_BANNER_CACHE_KEY);
      return null;
    }

    liveNowBannerMemoryCache.liveMatch = parsed?.liveMatch || null;
    liveNowBannerMemoryCache.expiresAt = Number(parsed?.expiresAt || 0);
    return liveNowBannerMemoryCache.liveMatch;
  } catch {
    return null;
  }
}

function writeCachedLiveBanner(liveMatch) {
  const nextEntry = {
    liveMatch: liveMatch || null,
    expiresAt: Date.now() + LIVE_NOW_BANNER_CACHE_TTL_MS,
  };

  liveNowBannerMemoryCache.liveMatch = nextEntry.liveMatch;
  liveNowBannerMemoryCache.expiresAt = nextEntry.expiresAt;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(LIVE_NOW_BANNER_CACHE_KEY, JSON.stringify(nextEntry));
  } catch {
    // Ignore cache write failures and keep the in-memory cache.
  }
}

export default function LiveNowBanner({ liveMatch }) {
  const [fetchedLiveMatch, setFetchedLiveMatch] = useState(() =>
    liveMatch ? null : readCachedLiveBanner()
  );
  const currentLiveMatch = liveMatch || fetchedLiveMatch;

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    let cancelled = false;

    const loadLiveMatch = async () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const cachedLiveMatch = readCachedLiveBanner();
      if (cachedLiveMatch) {
        if (!cancelled) {
          setFetchedLiveMatch(cachedLiveMatch);
        }
        return;
      }

      try {
        const response = await fetch("/api/home/live-banner", {
          cache: "default",
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
          writeCachedLiveBanner(nextLiveMatch);
          setFetchedLiveMatch(nextLiveMatch);
        }
      } catch (_error) {
        // Ignore banner refresh failures and keep the last known live match.
      }
    };

    if (!liveMatch) {
      void loadLiveMatch();
    }

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
  }, [liveMatch]);

  if (!currentLiveMatch) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -28, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 24,
        mass: 0.8,
        delay: 0.08,
      }}
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-start px-4 pr-20 pt-5 md:justify-center md:px-6 md:pr-6 md:pt-7"
    >
      <PendingLink
        href={`/session/${currentLiveMatch.sessionId}/view`}
        pendingLabel="Opening live score..."
        pendingClassName="pending-shimmer"
        primeAudioOnClick
        className="liquid-glass pointer-events-auto flex w-full max-w-[calc(100vw-5rem)] items-center justify-between gap-3 rounded-[26px] px-3.5 py-2.5 text-white shadow-[0_18px_34px_rgba(0,0,0,0.2)] transition hover:border-white/28 md:max-w-md md:gap-4 md:px-4 md:py-3"
      >
        {({ pending, spinner }) => (
          <>
            <div className="absolute inset-0 rounded-[26px] bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.1),transparent_40%)]" />
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
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300 md:text-[11px] md:tracking-[0.34em]">
                  Live Now
                </div>
                <div className="truncate text-[14px] font-semibold leading-tight text-white md:text-[15px]">
                  {currentLiveMatch.teamAName} vs {currentLiveMatch.teamBName}
                </div>
                <div className="text-[11px] text-white/74 md:text-xs">
                  {pending
                    ? "Opening live score..."
                    : `${currentLiveMatch.score}/${currentLiveMatch.outs} - View score now`}
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
