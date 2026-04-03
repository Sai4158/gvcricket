"use client";

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
  onMessage,
  onError,
  enabled = true,
  disconnectWhenHidden = true,
}) {
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const [isPageVisible, setIsPageVisible] = useState(readPageVisibility);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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
    if (!enabled || !url || (disconnectWhenHidden && !isPageVisible)) {
      return undefined;
    }

    const source = new EventSource(url);
    let closed = false;
    const handler = (message) => {
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

    source.addEventListener(event, handler);
    const errorHandler = (error) => {
      if (closed || source.readyState === EventSource.CLOSED) {
        return;
      }
      onErrorRef.current?.(error);
    };

    source.addEventListener("error", errorHandler);

    return () => {
      closed = true;
      source.removeEventListener(event, handler);
      source.removeEventListener("error", errorHandler);
      source.close();
    };
  }, [disconnectWhenHidden, enabled, event, isPageVisible, url]);
}
