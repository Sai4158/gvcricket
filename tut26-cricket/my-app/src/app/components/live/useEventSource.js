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
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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
      onErrorRef.current?.(error);
    };

    source.addEventListener("error", errorHandler);

    return () => {
      source.removeEventListener(event, handler);
      source.removeEventListener("error", errorHandler);
      source.close();
    };
  }, [enabled, event, url]);
}
