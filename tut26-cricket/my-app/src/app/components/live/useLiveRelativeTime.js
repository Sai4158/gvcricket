"use client";

import { useEffect, useMemo, useState } from "react";

export default function useLiveRelativeTime(timestamp) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timestamp) {
      const timer = setInterval(() => setNow(Date.now()), 15000);
      return () => clearInterval(timer);
    }

    const diff = Math.max(0, Date.now() - new Date(timestamp).getTime());
    const intervalMs = diff < 60000 ? 5000 : 15000;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [timestamp]);

  return useMemo(() => {
    if (!timestamp) return "Waiting for update";
    const diff = Math.max(0, now - new Date(timestamp).getTime());
    if (diff < 5000) return "Updated just now";
    if (diff < 60000) return `Updated ${Math.floor(diff / 1000)}s ago`;
    return `Updated ${Math.floor(diff / 60000)}m ago`;
  }, [now, timestamp]);
}
