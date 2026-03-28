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

    const element = ref.current;
    if (!element) {
      return undefined;
    }

    let frameOne = 0;
    let frameTwo = 0;
    let timeoutId = 0;

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
    };

    const reveal = () => {
      cleanupTimers();
      frameOne = window.requestAnimationFrame(() => {
        const finishReveal = () => {
          frameTwo = window.requestAnimationFrame(() => {
            setHasRevealed(true);
          });
        };

        if (revealDelayMs > 0) {
          timeoutId = window.setTimeout(finishReveal, revealDelayMs);
          return;
        }

        finishReveal();
      });
    };

    if (typeof IntersectionObserver !== "function") {
      reveal();
      return cleanupTimers;
    }

    const observer = new IntersectionObserver(
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

    const rect = element.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 0;
    const isAlreadyInView = rect.top < viewportHeight * 0.94 && rect.bottom > 0;

    if (isAlreadyInView) {
      reveal();
      observer.disconnect();
    }

    return () => {
      observer.disconnect();
      cleanupTimers();
    };
  }, [active, hasRevealed, revealDelayMs, rootMargin, threshold]);

  return { ref, isVisible: !active || hasRevealed };
}
