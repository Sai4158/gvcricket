"use client";

import { useEffect, useMemo, useState } from "react";

export default function useLiveRelativeTime(timestamp) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const initialTimer = window.setTimeout(refresh, 0);

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
  }, [timestamp]);

  return useMemo(() => {
    if (!timestamp) return "Waiting for update";
    if (now === null) return "Updated just now";
    const diff = Math.max(0, now - new Date(timestamp).getTime());
    if (diff < 5000) return "Updated just now";
    if (diff < 60000) return `Updated ${Math.floor(diff / 1000)}s ago`;
    return `Updated ${Math.floor(diff / 60000)}m ago`;
  }, [now, timestamp]);
}
