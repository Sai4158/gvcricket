"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: RouteFeedbackProvider, useRouteFeedback.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import InlineSpinner from "./InlineSpinner";

const RouteFeedbackContext = createContext({
  startNavigation: () => {},
  stopNavigation: () => {},
  isNavigating: false,
  label: "",
});

export function useRouteFeedback() {
  return useContext(RouteFeedbackContext);
}

function RouteTransitionLoader({ visible, label }) {
  return (
    <AnimatePresence>
      {visible ? (
        <>
          <motion.div
            key="route-loader-bar"
            initial={{ opacity: 0, scaleX: 0.12 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2px] origin-left bg-[linear-gradient(90deg,rgba(56,189,248,0.18),rgba(34,211,238,0.88)_24%,rgba(16,185,129,0.82)_62%,rgba(56,189,248,0.12))] shadow-[0_0_14px_rgba(34,211,238,0.28)]"
          />
          <motion.div
            key="route-loader-pill"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed left-1/2 top-4 z-[120] -translate-x-1/2 rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(20,20,26,0.92),rgba(9,10,15,0.94))] px-3 py-2 text-xs font-semibold tracking-[0.18em] text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl"
          >
            <span className="flex items-center gap-2 uppercase">
              <InlineSpinner size="xs" />
              <span>{label || "Opening"}</span>
            </span>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export default function RouteFeedbackProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = useMemo(() => {
    const path = pathname || "";
    const query = searchParams?.toString() || "";
    return query ? `${path}?${query}` : path;
  }, [pathname, searchParams]);
  const [navigationState, setNavigationState] = useState({
    active: false,
    label: "",
    startedAt: 0,
  });
  const currentUrlRef = useRef(currentUrl);
  const clearTimerRef = useRef(null);
  const pendingScrollResetRef = useRef(false);

  const forceScrollToTop = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }, []);

  const stopNavigation = useCallback(() => {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setNavigationState((current) =>
      current.active ? { active: false, label: "", startedAt: 0 } : current
    );
  }, []);

  const startNavigation = useCallback((label = "Opening...") => {
    pendingScrollResetRef.current = true;
    setNavigationState({
      active: true,
      label,
      startedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.history) {
      return undefined;
    }

    const previousSetting = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousSetting;
    };
  }, []);

  useEffect(() => {
    if (currentUrlRef.current !== currentUrl) {
      currentUrlRef.current = currentUrl;
      if (pendingScrollResetRef.current) {
        pendingScrollResetRef.current = false;
        window.requestAnimationFrame(() => {
          forceScrollToTop();
        });
      }
      const elapsed = Date.now() - navigationState.startedAt;
      const delay = navigationState.active ? Math.max(0, 220 - elapsed) : 0;
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(() => {
        stopNavigation();
      }, delay);
      return;
    }

    if (!navigationState.active) {
      return;
    }

    const staleTimer = window.setTimeout(() => {
      stopNavigation();
    }, 8000);

    return () => window.clearTimeout(staleTimer);
  }, [currentUrl, forceScrollToTop, navigationState.active, navigationState.startedAt, stopNavigation]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      startNavigation: (label) => {
        startTransition(() => {
          startNavigation(label);
        });
      },
      stopNavigation,
      isNavigating: navigationState.active,
      label: navigationState.label,
    }),
    [navigationState.active, navigationState.label, startNavigation, stopNavigation]
  );

  return (
    <RouteFeedbackContext.Provider value={contextValue}>
      <RouteTransitionLoader
        visible={navigationState.active}
        label={navigationState.label}
      />
      {children}
    </RouteFeedbackContext.Provider>
  );
}


