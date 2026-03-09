"use client";

import { useEffect, useRef } from "react";

export default function useEventSource({
  url,
  event,
  onMessage,
  onError,
  enabled = true,
}) {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled || !url) return undefined;

    const source = new EventSource(url);
    const handler = (message) => {
      try {
        const data = JSON.parse(message.data);
        onMessageRef.current?.(data);
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    source.addEventListener(event, handler);
    const errorHandler = (error) => {
      console.error("Live stream error:", error);
      onError?.(error);
    };

    source.addEventListener("error", errorHandler);

    return () => {
      source.removeEventListener(event, handler);
      source.removeEventListener("error", errorHandler);
      source.close();
    };
  }, [enabled, event, onError, url]);
}
