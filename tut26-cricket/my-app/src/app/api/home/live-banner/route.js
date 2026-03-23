import { NextResponse } from "next/server";
import { loadHomeLiveBannerData } from "../../../lib/server-data";

const CACHE_TTL_MS = 15_000;
const globalHomeLiveBannerCache = globalThis.__gvHomeLiveBannerCache || {
  value: null,
  expiresAt: 0,
  pending: null,
};
globalThis.__gvHomeLiveBannerCache = globalHomeLiveBannerCache;

async function getCachedHomeLiveBannerData() {
  if (globalHomeLiveBannerCache.expiresAt > Date.now()) {
    return globalHomeLiveBannerCache.value;
  }

  if (globalHomeLiveBannerCache.pending) {
    return globalHomeLiveBannerCache.pending;
  }

  globalHomeLiveBannerCache.pending = (async () => {
    try {
      const liveMatch = await loadHomeLiveBannerData();
      globalHomeLiveBannerCache.value = liveMatch;
      globalHomeLiveBannerCache.expiresAt = Date.now() + CACHE_TTL_MS;
      return liveMatch;
    } finally {
      globalHomeLiveBannerCache.pending = null;
    }
  })();

  return globalHomeLiveBannerCache.pending;
}

export async function GET() {
  try {
    const liveMatch = await getCachedHomeLiveBannerData();
    return NextResponse.json(
      { liveMatch },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=45",
        },
      }
    );
  } catch (error) {
    console.error("Home live-banner API failed:", error);
    return NextResponse.json(
      { liveMatch: null },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=45",
        },
      }
    );
  }
}
