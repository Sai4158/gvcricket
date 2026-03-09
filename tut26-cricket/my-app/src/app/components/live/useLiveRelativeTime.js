"use client";

import { useEffect, useMemo, useState } from "react";

export default function useLiveRelativeTime(timestamp) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (!timestamp) return "Waiting for update";
    const diff = Math.max(0, now - new Date(timestamp).getTime());
    if (diff < 5000) return "Updated just now";
    if (diff < 60000) return `Updated ${Math.floor(diff / 1000)}s ago`;
    return `Updated ${Math.floor(diff / 60000)}m ago`;
  }, [now, timestamp]);
}
