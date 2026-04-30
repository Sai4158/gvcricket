"use client";

/**
 * File overview:
 * Purpose: Encapsulates Live browser state, effects, and runtime coordination.
 * Main exports: useEventSource.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useEffect, useRef, useState } from "react";

function readPageVisibility() {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState !== "hidden";
}

export default function useEventSource({
  url,
  event,
  heartbeatEvent = "ping",
  onMessage,
  onError,
  onOpen,
  onHeartbeat,
  enabled = true,
  disconnectWhenHidden = true,
  reconnectStaleAfterMs = 0,
}) {
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onOpenRef = useRef(onOpen);
  const onHeartbeatRef = useRef(onHeartbeat);
  const [isPageVisible, setIsPageVisible] = useState(readPageVisibility);
  const [reconnectTick, setReconnectTick] = useState(0);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    onHeartbeatRef.current = onHeartbeat;
  }, [onHeartbeat]);

  useEffect(() => {
    if (!disconnectWhenHidden || typeof document === "undefined") {
      return undefined;
    }

    const handleVisibilityChange = () => {
      setIsPageVisible((current) => {
        const next = readPageVisibility();
        return current === next ? current : next;
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [disconnectWhenHidden]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const bumpReconnect = () => {
      setReconnectTick((current) => current + 1);
    };

    const handleOnline = () => {
      bumpReconnect();
    };

    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const handleConnectionChange = () => {
      if (navigator.onLine === false) {
        return;
      }
      bumpReconnect();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleOnline);
    window.addEventListener("pageshow", handleOnline);
    connection?.addEventListener?.("change", handleConnectionChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleOnline);
      window.removeEventListener("pageshow", handleOnline);
      connection?.removeEventListener?.("change", handleConnectionChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !url || (disconnectWhenHidden && !isPageVisible)) {
      return undefined;
    }

    const source = new EventSource(url);
    let closed = false;
    let staleTimer = null;

    const resetStaleTimer = () => {
      if (!reconnectStaleAfterMs) {
        return;
      }

      if (staleTimer) {
        window.clearTimeout(staleTimer);
      }

      staleTimer = window.setTimeout(() => {
        if (closed) {
          return;
        }
        try {
          source.close();
        } catch {}
        setReconnectTick((current) => current + 1);
        onErrorRef.current?.(new Error("Live stream became stale and is reconnecting."));
      }, reconnectStaleAfterMs);
    };

    const handler = (message) => {
      resetStaleTimer();
      try {
        const data = JSON.parse(message.data);
        try {
          onMessageRef.current?.(data);
        } catch (error) {
          console.error("SSE handler failed:", error);
          onErrorRef.current?.(error);
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    const heartbeatHandler = (message) => {
      resetStaleTimer();
      try {
        const data = JSON.parse(message.data);
        onHeartbeatRef.current?.(data);
      } catch {
        onHeartbeatRef.current?.(null);
      }
    };

    source.addEventListener(event, handler);
    if (heartbeatEvent && heartbeatEvent !== event) {
      source.addEventListener(heartbeatEvent, heartbeatHandler);
    }
    source.onopen = () => {
      resetStaleTimer();
      onOpenRef.current?.();
    };
    const errorHandler = (error) => {
      if (closed || source.readyState === EventSource.CLOSED) {
        return;
      }
      onErrorRef.current?.(error);
    };

    source.addEventListener("error", errorHandler);

    return () => {
      closed = true;
      if (staleTimer) {
        window.clearTimeout(staleTimer);
        staleTimer = null;
      }
      source.removeEventListener(event, handler);
      if (heartbeatEvent && heartbeatEvent !== event) {
        source.removeEventListener(heartbeatEvent, heartbeatHandler);
      }
      source.removeEventListener("error", errorHandler);
      source.onopen = null;
      source.close();
    };
  }, [
    disconnectWhenHidden,
    enabled,
    event,
    heartbeatEvent,
    isPageVisible,
    reconnectStaleAfterMs,
    reconnectTick,
    url,
  ]);
}


