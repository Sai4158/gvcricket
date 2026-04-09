/**
 * File overview:
 * Purpose: Encapsulates Director browser state, effects, and runtime coordination.
 * Main exports: useDirectorSessionSelection.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DIRECTOR_SESSIONS_REFRESH_MIN_GAP_MS,
  getPreferredLiveSessionId,
  readCachedDirectorSessions,
  readStoredDirectorPreferredSessionId,
  resolveDirectorAutoManageSessionId,
  writeCachedDirectorSessions,
  writeStoredDirectorPreferredSessionId,
} from "../director-console-utils";

export default function useDirectorSessionSelection({
  initialAuthorized = false,
  initialSessions = [],
  initialPreferredSessionId = "",
  initialAutoManage = false,
  authorized,
  setAuthError,
}) {
  const rememberedPreferredSessionId =
    initialPreferredSessionId || readStoredDirectorPreferredSessionId();
  const initialTargetSessionId = getPreferredLiveSessionId(
    initialSessions,
    rememberedPreferredSessionId,
  );
  const initialManagedWalkieSession =
    initialAuthorized && initialAutoManage && initialTargetSessionId
      ? initialSessions.find(
          (item) => item.session?._id === initialTargetSessionId,
        ) || null
      : null;
  const initialDirectorWalkiePreferenceScope =
    initialManagedWalkieSession?.match?._id ||
    initialManagedWalkieSession?.session?._id ||
    initialTargetSessionId ||
    "";

  const [sessions, setSessions] = useState(initialSessions || []);
  const [selectedSessionId, setSelectedSessionId] = useState(
    initialTargetSessionId,
  );
  const [managedSessionId, setManagedSessionId] = useState(() =>
    initialAuthorized && initialAutoManage && initialTargetSessionId
      ? initialTargetSessionId
      : "",
  );
  const [showPicker, setShowPicker] = useState(false);

  const preferredSessionIdRef = useRef(rememberedPreferredSessionId || "");
  const pendingInitialManageRef = useRef(Boolean(initialAutoManage));
  const previousManagedMatchIdRef = useRef("");
  const directorSessionsRefreshPromiseRef = useRef(null);
  const lastDirectorSessionsRefreshAtRef = useRef(0);

  const selectedSession = useMemo(() => {
    return (
      sessions.find((item) => item.session?._id === selectedSessionId) ||
      sessions.find((item) => item.isLive) ||
      sessions[0] ||
      null
    );
  }, [selectedSessionId, sessions]);

  const managedSession = useMemo(() => {
    if (!managedSessionId) {
      return null;
    }
    return (
      sessions.find((item) => item.session?._id === managedSessionId) || null
    );
  }, [managedSessionId, sessions]);

  const refreshDirectorSessions = useCallback(async () => {
    if (!authorized) {
      return [];
    }
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return sessions;
    }
    if (directorSessionsRefreshPromiseRef.current) {
      return directorSessionsRefreshPromiseRef.current;
    }
    if (
      Date.now() - lastDirectorSessionsRefreshAtRef.current <
      DIRECTOR_SESSIONS_REFRESH_MIN_GAP_MS
    ) {
      return sessions;
    }

    directorSessionsRefreshPromiseRef.current = (async () => {
      try {
        const response = await fetch("/api/director/sessions", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({ sessions: [] }));
        if (!response.ok) {
          return [];
        }

        const nextSessions = Array.isArray(payload.sessions)
          ? payload.sessions
          : [];
        const hasLiveSessions = nextSessions.some((item) => item.isLive);
        const currentManagedStillLive = Boolean(
          managedSessionId &&
            nextSessions.some(
              (item) => item.session?._id === managedSessionId && item.isLive,
            ),
        );

        writeCachedDirectorSessions(nextSessions);
        setSessions(nextSessions);

        const nextLiveSessionId = getPreferredLiveSessionId(
          nextSessions,
          preferredSessionIdRef.current,
        );

        if (nextLiveSessionId) {
          setSelectedSessionId((current) => {
            if (
              current &&
              nextSessions.some(
                (item) => item.session?._id === current && item.isLive,
              )
            ) {
              return current;
            }
            return nextLiveSessionId;
          });
        } else {
          setSelectedSessionId("");
        }

        setManagedSessionId((current) => {
          if (
            current &&
            nextSessions.some(
              (item) => item.session?._id === current && item.isLive,
            )
          ) {
            return current;
          }
          return "";
        });

        if (!hasLiveSessions || (managedSessionId && !currentManagedStillLive)) {
          setShowPicker(true);
        }

        lastDirectorSessionsRefreshAtRef.current = Date.now();
        return nextSessions;
      } catch {
        return [];
      } finally {
        directorSessionsRefreshPromiseRef.current = null;
      }
    })();

    return directorSessionsRefreshPromiseRef.current;
  }, [authorized, managedSessionId, sessions]);

  const openDirectorSession = useCallback(
    (sessionId) => {
      const normalizedSessionId = String(sessionId || "").trim();
      if (!normalizedSessionId) {
        return;
      }

      preferredSessionIdRef.current = normalizedSessionId;
      writeStoredDirectorPreferredSessionId(normalizedSessionId);
      setSelectedSessionId(normalizedSessionId);
      setManagedSessionId(normalizedSessionId);
      setShowPicker(false);
      setAuthError("");
    },
    [setAuthError],
  );

  const loadAuthorizedDirectorSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/director/sessions", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({ sessions: [] }));

      if (!response.ok) {
        return [];
      }

      const nextSessions = Array.isArray(payload.sessions)
        ? payload.sessions
        : [];
      if (nextSessions.length) {
        writeCachedDirectorSessions(nextSessions);
      }
      lastDirectorSessionsRefreshAtRef.current = Date.now();
      return nextSessions;
    } catch {
      return [];
    }
  }, []);

  const handleChangeSession = useCallback(() => {
    setManagedSessionId("");
    setShowPicker(true);
    void refreshDirectorSessions();
  }, [refreshDirectorSessions]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    const cachedSessions = readCachedDirectorSessions();
    if (cachedSessions.length) {
      setSessions((current) => (current.length ? current : cachedSessions));
      const cachedLiveSessionId = getPreferredLiveSessionId(
        cachedSessions,
        preferredSessionIdRef.current,
      );
      if (cachedLiveSessionId) {
        setSelectedSessionId((current) => current || cachedLiveSessionId);
      }
    }

    let cancelled = false;
    const refreshIfActive = async () => {
      if (cancelled) {
        return;
      }
      await refreshDirectorSessions();
    };

    void refreshIfActive();

    const handleFocus = () => {
      void refreshIfActive();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshIfActive();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [authorized, managedSessionId, refreshDirectorSessions, showPicker]);

  useEffect(() => {
    if (initialSessions?.length) {
      writeCachedDirectorSessions(initialSessions);
      lastDirectorSessionsRefreshAtRef.current = Date.now();
    }
  }, [initialSessions]);

  useEffect(() => {
    const firstLive = sessions.find((item) => item.isLive);
    if (!selectedSessionId && firstLive) {
      setSelectedSessionId(firstLive.session._id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    const preferredSessionId = preferredSessionIdRef.current;
    if (!preferredSessionId) {
      return;
    }

    const preferredLive = sessions.find(
      (item) => item.session?._id === preferredSessionId && item.isLive,
    );
    if (!preferredLive) {
      return;
    }

    if (selectedSessionId !== preferredSessionId) {
      setSelectedSessionId(preferredSessionId);
    }

    const autoManageSessionId = resolveDirectorAutoManageSessionId(sessions, {
      preferredSessionId,
      selectedSessionId,
      autoManageRequested: pendingInitialManageRef.current,
    });

    if (authorized && !managedSessionId && !showPicker && autoManageSessionId) {
      preferredSessionIdRef.current = autoManageSessionId;
      writeStoredDirectorPreferredSessionId(autoManageSessionId);
      setManagedSessionId(autoManageSessionId);
      setShowPicker(false);
      setAuthError("");
      pendingInitialManageRef.current = false;
    }
  }, [
    authorized,
    managedSessionId,
    selectedSessionId,
    sessions,
    setAuthError,
    showPicker,
  ]);

  useEffect(() => {
    if (
      managedSessionId &&
      !sessions.some((item) => item.session?._id === managedSessionId)
    ) {
      setManagedSessionId("");
    }
  }, [managedSessionId, sessions]);

  return {
    handleChangeSession,
    initialDirectorWalkiePreferenceScope,
    initialTargetSessionId,
    loadAuthorizedDirectorSessions,
    managedSession,
    managedSessionId,
    openDirectorSession,
    pendingInitialManageRef,
    preferredSessionIdRef,
    previousManagedMatchIdRef,
    refreshDirectorSessions,
    selectedSession,
    selectedSessionId,
    sessions,
    setManagedSessionId,
    setSelectedSessionId,
    setSessions,
    setShowPicker,
    showPicker,
  };
}


