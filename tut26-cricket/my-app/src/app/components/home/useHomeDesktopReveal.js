"use client";

import { useLayoutEffect, useRef, useState } from "react";

export default function useHomeDesktopReveal(
  active,
  {
    threshold = 0.12,
    rootMargin = "0px 0px -8% 0px",
    revealDelayMs = 36,
  } = {}
) {
  const ref = useRef(null);
  const [hasRevealed, setHasRevealed] = useState(false);

  useLayoutEffect(() => {
    if (!active || hasRevealed) {
      return undefined;
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    let frameOne = 0;
    let frameTwo = 0;
    let timeoutId = 0;
    let fallbackCheckId = 0;
    let observer;

    const cleanupTimers = () => {
      if (frameOne) {
        window.cancelAnimationFrame(frameOne);
      }
      if (frameTwo) {
        window.cancelAnimationFrame(frameTwo);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (fallbackCheckId) {
        window.clearTimeout(fallbackCheckId);
      }
    };

    const reveal = (instant = false) => {
      if (hasRevealed) {
        return;
      }

      cleanupTimers();
      frameOne = window.requestAnimationFrame(() => {
        const finishReveal = () => {
          frameTwo = window.requestAnimationFrame(() => {
            setHasRevealed(true);
          });
        };

        if (!instant && revealDelayMs > 0) {
          timeoutId = window.setTimeout(finishReveal, revealDelayMs);
          return;
        }

        finishReveal();
      });
    };

    const element = ref.current;
    if (!element) {
      reveal(true);
      return cleanupTimers;
    }

    const isCurrentlyVisible = () => {
      const rect = element.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 0;
      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth || 0;

      if (viewportHeight <= 0 || viewportWidth <= 0) {
        return false;
      }

      const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
      const elementArea = Math.max(rect.width * rect.height, 1);
      const visibleArea = Math.max(visibleHeight, 0) * Math.max(visibleWidth, 0);
      const minVisibleRatio = Math.max(0.08, Math.min(threshold, 0.3));

      return visibleArea / elementArea >= minVisibleRatio;
    };

    if (isCurrentlyVisible()) {
      reveal(false);
    }

    fallbackCheckId = window.setTimeout(() => {
      if (isCurrentlyVisible()) {
        reveal(true);
      }
    }, Math.max(550, revealDelayMs * 10));

    if (typeof IntersectionObserver !== "function") {
      reveal(true);
      return cleanupTimers;
    }

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        reveal();
        observer.disconnect();
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer?.disconnect();
      cleanupTimers();
    };
  }, [active, hasRevealed, revealDelayMs, rootMargin, threshold]);

  return { ref, isVisible: !active || hasRevealed };
}
