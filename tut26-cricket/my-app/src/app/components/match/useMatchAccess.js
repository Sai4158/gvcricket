"use client";

import { useEffect, useState } from "react";

function getRememberKey(matchId) {
  return `gv-match-access-remember-${matchId}`;
}

export default function useMatchAccess(matchId, initialAuthStatus = "checking") {
  const [authStatus, setAuthStatus] = useState(initialAuthStatus);
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !matchId) {
      return;
    }

    if (authStatus === "granted") {
      window.localStorage.setItem(getRememberKey(matchId), "granted");
      return;
    }

    if (authStatus === "locked") {
      window.localStorage.removeItem(getRememberKey(matchId));
    }
  }, [authStatus, matchId]);

  useEffect(() => {
    if (!matchId) return;

    const shouldCheck =
      initialAuthStatus === "checking" ||
      (typeof window !== "undefined" &&
        window.localStorage.getItem(getRememberKey(matchId)) === "granted");

    if (!shouldCheck) return;

    const controller = new AbortController();

    fetch(`/api/matches/${matchId}/auth`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        if (data.authorized) {
          window.localStorage.setItem(getRememberKey(matchId), "granted");
          setAuthStatus("granted");
          return;
        }

        window.localStorage.removeItem(getRememberKey(matchId));
        setAuthStatus("locked");
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }
        setAuthStatus("locked");
      });

    return () => controller.abort();
  }, [initialAuthStatus, matchId]);

  const submitPin = async (pin) => {
    setAuthSubmitting(true);
    setAuthError("");

    try {
      const response = await fetch(`/api/matches/${matchId}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Incorrect PIN." }));
        throw new Error(body.message || "Incorrect PIN.");
      }

      if (typeof window !== "undefined" && matchId) {
        window.localStorage.setItem(getRememberKey(matchId), "granted");
      }
      setAuthStatus("granted");
    } catch (caughtError) {
      if (typeof window !== "undefined" && matchId) {
        window.localStorage.removeItem(getRememberKey(matchId));
      }
      setAuthError(caughtError.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  return {
    authStatus,
    authError,
    authSubmitting,
    submitPin,
  };
}
