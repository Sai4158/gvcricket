/**
 * File overview:
 * Purpose: Encapsulates Director browser state, effects, and runtime coordination.
 * Main exports: useDirectorAuth.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useCallback, useEffect } from "react";
import {
  buildPinRequestError,
  clearClientPinRateLimit,
  registerClientPinFailure,
  useClientPinRateLimit,
} from "../../../../lib/pin-attempt-client";
import {
  getPreferredLiveSessionId,
  readCachedDirectorSessions,
  resolveDirectorAutoManageSessionId,
  writeCachedDirectorSessions,
  writeStoredDirectorPreferredSessionId,
} from "../director-console-utils";

export default function useDirectorAuth({
  authorized,
  authError,
  isSubmittingPin,
  pin,
  router,
  sessionSelection,
  setAuthError,
  setAuthorized,
  setConsoleError,
  setIsSubmittingPin,
  setPin,
  setShowDirectorPinStep,
}) {
  const directorPinRateLimit = useClientPinRateLimit(
    "director-auth",
    !authorized,
  );
  const directorPinError = directorPinRateLimit.isBlocked
    ? directorPinRateLimit.message
    : authError;

  const submitDirectorPin = useCallback(async () => {
    if (isSubmittingPin) {
      return;
    }

    if (directorPinRateLimit.isBlocked) {
      setAuthError(directorPinRateLimit.message);
      return;
    }

    setIsSubmittingPin(true);
    setAuthError("");

    try {
      const response = await fetch("/api/director/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const payload = await response
        .json()
        .catch(() => ({ message: "Could not verify PIN." }));

      if (!response.ok) {
        throw buildPinRequestError(response, payload, "Could not verify PIN.");
      }

      clearClientPinRateLimit("director-auth");
      directorPinRateLimit.sync();
      setConsoleError("");
      setAuthorized(true);
      setPin("");

      const fetchedSessions =
        await sessionSelection.loadAuthorizedDirectorSessions();
      const nextSessions = fetchedSessions.length
        ? fetchedSessions
        : sessionSelection.sessions.length
          ? sessionSelection.sessions
          : readCachedDirectorSessions();

      if (nextSessions.length) {
        writeCachedDirectorSessions(nextSessions);
        sessionSelection.setSessions(nextSessions);

        const nextLive = nextSessions.find((item) => item.isLive);
        const autoManageSessionId = resolveDirectorAutoManageSessionId(
          nextSessions,
          {
            preferredSessionId:
              sessionSelection.preferredSessionIdRef.current,
            selectedSessionId: sessionSelection.selectedSessionId,
            autoManageRequested:
              sessionSelection.pendingInitialManageRef.current,
          },
        );
        const nextSelectedSessionId =
          autoManageSessionId ||
          getPreferredLiveSessionId(
            nextSessions,
            sessionSelection.preferredSessionIdRef.current ||
              sessionSelection.selectedSessionId,
          ) ||
          nextLive?.session?._id ||
          nextSessions?.[0]?.session?._id ||
          "";

        sessionSelection.setSelectedSessionId(nextSelectedSessionId);
        if (autoManageSessionId) {
          sessionSelection.preferredSessionIdRef.current = autoManageSessionId;
          writeStoredDirectorPreferredSessionId(autoManageSessionId);
          sessionSelection.setManagedSessionId(autoManageSessionId);
          sessionSelection.setShowPicker(false);
          sessionSelection.pendingInitialManageRef.current = false;
        } else {
          sessionSelection.setManagedSessionId("");
          sessionSelection.setShowPicker(true);
        }
      }

      setShowDirectorPinStep(false);
    } catch (caughtError) {
      registerClientPinFailure("director-auth", {
        retryAfterMs: Number(caughtError?.retryAfterMs || 0),
      });
      directorPinRateLimit.sync();
      setAuthError(caughtError?.message || "Could not verify PIN.");
    } finally {
      setIsSubmittingPin(false);
    }
  }, [
    directorPinRateLimit,
    isSubmittingPin,
    pin,
    sessionSelection,
    setConsoleError,
  ]);

  const logout = useCallback(async () => {
    await fetch("/api/director/auth", {
      method: "DELETE",
    }).catch(() => {});
    setAuthorized(false);
    sessionSelection.setManagedSessionId("");
    sessionSelection.setShowPicker(false);
    setShowDirectorPinStep(false);
    setPin("");
    setAuthError("");
  }, [sessionSelection]);

  const leaveDirectorMode = useCallback(async () => {
    await logout();
    router.push("/");
  }, [logout, router]);

  useEffect(() => {
    if (authorized) {
      setConsoleError("");
    }
  }, [authorized, setConsoleError]);

  return {
    directorPinError,
    directorPinRateLimit,
    leaveDirectorMode,
    logout,
    submitDirectorPin,
  };
}


