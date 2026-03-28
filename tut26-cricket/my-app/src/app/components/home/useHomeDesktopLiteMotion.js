"use client";

import { useLayoutEffect, useState } from "react";

const HOME_DESKTOP_LITE_QUERY = "(min-width: 768px)";

export default function useHomeDesktopLiteMotion() {
  const [useDesktopLiteMotion, setUseDesktopLiteMotion] = useState(true);

  useLayoutEffect(() => {
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
