"use client";

import { useEffect, useState } from "react";

export default function useMatchAccess(matchId) {
  const [authStatus, setAuthStatus] = useState("checking");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    fetch(`/api/matches/${matchId}/auth`)
      .then((res) => res.json())
      .then((data) => setAuthStatus(data.authorized ? "granted" : "locked"))
      .catch(() => setAuthStatus("locked"));
  }, [matchId]);

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

      setAuthStatus("granted");
    } catch (caughtError) {
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
