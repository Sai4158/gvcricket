"use client";

import { useEffect, useRef, useState } from "react";

const observerRegistry = new Map();

function getObserverKey(threshold, rootMargin) {
  const normalizedThreshold = Array.isArray(threshold)
    ? threshold.join(",")
    : String(threshold);
  return `${normalizedThreshold}|${rootMargin}`;
}

function getSharedObserver(threshold, rootMargin) {
  const key = getObserverKey(threshold, rootMargin);
  const existing = observerRegistry.get(key);
  if (existing) {
    return existing;
  }

  const listeners = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const listener = listeners.get(entry.target);
        if (listener) {
          listener(entry);
        }
      }
    },
    {
      threshold,
      rootMargin,
    }
  );

  const shared = { key, observer, listeners };
  observerRegistry.set(key, shared);
  return shared;
}

function releaseSharedObserver(shared) {
  if (!shared || shared.listeners.size > 0) {
    return;
  }

  shared.observer.disconnect();
  observerRegistry.delete(shared.key);
}

export default function useHomeDesktopReveal(
  active,
  {
    threshold = 0.12,
    rootMargin = "0px 0px -8% 0px",
    revealDelayMs = 36,
    resetOnExit = false,
  } = {}
) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const visibilityRef = useRef(false);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    let frameOne = 0;
    let frameTwo = 0;
    let timeoutId = 0;
    let fallbackCheckId = 0;
    let sharedObserver;

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

    const syncVisibility = (nextVisible) => {
      if (visibilityRef.current === nextVisible) {
        return;
      }

      visibilityRef.current = nextVisible;
      setIsVisible(nextVisible);
    };

    const reveal = (instant = false) => {
      if (visibilityRef.current) {
        return;
      }

      cleanupTimers();
      frameOne = window.requestAnimationFrame(() => {
        const finishReveal = () => {
          frameTwo = window.requestAnimationFrame(() => {
            syncVisibility(true);
          });
        };

        if (!instant && revealDelayMs > 0) {
          timeoutId = window.setTimeout(finishReveal, revealDelayMs);
          return;
        }

        finishReveal();
      });
    };

    const hide = () => {
      cleanupTimers();
      syncVisibility(false);
    };

    const element = ref.current;
    if (!element) {
      syncVisibility(true);
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
    } else if (resetOnExit) {
      hide();
    }

    fallbackCheckId = window.setTimeout(() => {
      if (isCurrentlyVisible()) {
        reveal(true);
      } else if (resetOnExit) {
        hide();
      }
    }, Math.max(550, revealDelayMs * 10));

    if (typeof IntersectionObserver !== "function") {
      reveal(true);
      return cleanupTimers;
    }

    sharedObserver = getSharedObserver(threshold, rootMargin);
    const handleIntersect = (entry) => {
      if (entry.isIntersecting) {
        reveal();
        if (!resetOnExit) {
          sharedObserver.observer.unobserve(element);
          sharedObserver.listeners.delete(element);
          releaseSharedObserver(sharedObserver);
        }
        return;
      }

      if (resetOnExit) {
        hide();
      }
    };
    sharedObserver.listeners.set(element, handleIntersect);
    sharedObserver.observer.observe(element);

    return () => {
      if (sharedObserver && element) {
        sharedObserver.observer.unobserve(element);
        sharedObserver.listeners.delete(element);
        releaseSharedObserver(sharedObserver);
      }
      cleanupTimers();
    };
  }, [active, revealDelayMs, resetOnExit, rootMargin, threshold]);

  return { ref, isVisible: !active || isVisible };
}
