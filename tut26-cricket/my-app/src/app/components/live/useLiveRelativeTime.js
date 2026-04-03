"use client";

import { useEffect, useMemo, useState } from "react";

const FIVE_SECONDS_MS = 5000;
const ONE_MINUTE_MS = 60000;
const ONE_HOUR_MS = 3600000;
const FIVE_MINUTES_MS = 300000;

function readPageVisibility() {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState !== "hidden";
}

export function parseLiveRelativeTimeTimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }

  const parsedTime = new Date(timestamp).getTime();
  return Number.isFinite(parsedTime) ? parsedTime : null;
}

export function getLiveRelativeTimeRefreshDelay(timestamp, now = Date.now()) {
  const timestampMs = parseLiveRelativeTimeTimestamp(timestamp);
  if (!timestampMs) {
    return null;
  }

  const diff = Math.max(0, now - timestampMs);
  if (diff < ONE_MINUTE_MS) {
    return Math.max(250, Math.min(FIVE_SECONDS_MS, ONE_MINUTE_MS - diff));
  }

  if (diff < ONE_HOUR_MS) {
    const minuteRemainder = diff % ONE_MINUTE_MS;
    return Math.max(1000, ONE_MINUTE_MS - minuteRemainder);
  }

  const fiveMinuteRemainder = diff % FIVE_MINUTES_MS;
  return Math.max(1000, FIVE_MINUTES_MS - fiveMinuteRemainder);
}

export function formatLiveRelativeTimeLabel(timestamp, now = Date.now()) {
  const timestampMs = parseLiveRelativeTimeTimestamp(timestamp);
  if (!timestampMs) {
    return "Waiting for update";
  }

  const diff = Math.max(0, now - timestampMs);
  if (diff < FIVE_SECONDS_MS) {
    return "Updated just now";
  }
  if (diff < ONE_MINUTE_MS) {
    return `Updated ${Math.floor(diff / 1000)}s ago`;
  }
  if (diff < ONE_HOUR_MS) {
    return `Updated ${Math.floor(diff / ONE_MINUTE_MS)}m ago`;
  }

  return `Updated ${Math.floor(diff / ONE_HOUR_MS)}h ago`;
}

export default function useLiveRelativeTime(timestamp) {
  const [now, setNow] = useState(() => Date.now());
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
    if (!isPageVisible) {
      return undefined;
    }

    const delayMs = getLiveRelativeTimeRefreshDelay(timestamp, now);
    if (delayMs === null) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setNow(Date.now());
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isPageVisible, now, timestamp]);

  return useMemo(() => {
    return formatLiveRelativeTimeLabel(timestamp, now);
  }, [now, timestamp]);
}
