"use client";

/**
 * File overview:
 * Purpose: Encapsulates Home browser state, effects, and runtime coordination.
 * Main exports: useHomeDesktopLiteMotion.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useEffect, useState } from "react";

const HOME_DESKTOP_LITE_QUERY = "(min-width: 768px)";

export default function useHomeDesktopLiteMotion() {
  const [useDesktopLiteMotion, setUseDesktopLiteMotion] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(HOME_DESKTOP_LITE_QUERY);
    const syncMotionMode = () => setUseDesktopLiteMotion(mediaQuery.matches);

    syncMotionMode();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncMotionMode);
      return () => mediaQuery.removeEventListener("change", syncMotionMode);
    }

    mediaQuery.addListener(syncMotionMode);
    return () => mediaQuery.removeListener(syncMotionMode);
  }, []);

  return useDesktopLiteMotion;
}


