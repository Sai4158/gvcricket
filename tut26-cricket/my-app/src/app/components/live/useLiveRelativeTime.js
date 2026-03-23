"use client";

import { useEffect, useMemo, useState } from "react";

function readPageVisibility() {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState !== "hidden";
}

export default function useLiveRelativeTime(timestamp) {
  const [now, setNow] = useState(null);
  const [isPageVisible, setIsPageVisible] = useState(readPageVisibility);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleVisibilityChange = () => {
      setIsPageVisible(readPageVisibility());
      if (document.visibilityState !== "hidden") {
        setNow(Date.now());
      }
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const initialTimer = window.setTimeout(refresh, 0);

    if (!isPageVisible) {
      return () => {
        window.clearTimeout(initialTimer);
      };
    }

    if (!timestamp) {
      const timer = window.setInterval(refresh, 15000);
      return () => {
        window.clearTimeout(initialTimer);
        window.clearInterval(timer);
      };
    }

    const diff = Math.max(0, Date.now() - new Date(timestamp).getTime());
    const intervalMs = diff < 60000 ? 5000 : 15000;
    const timer = window.setInterval(refresh, intervalMs);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [isPageVisible, timestamp]);

  return useMemo(() => {
    if (!timestamp) return "Waiting for update";
    if (now === null) return "Updated just now";
    const diff = Math.max(0, now - new Date(timestamp).getTime());
    if (diff < 5000) return "Updated just now";
    if (diff < 60000) return `Updated ${Math.floor(diff / 1000)}s ago`;
    return `Updated ${Math.floor(diff / 60000)}m ago`;
  }, [now, timestamp]);
}
