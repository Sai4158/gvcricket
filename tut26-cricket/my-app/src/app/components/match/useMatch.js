"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useEventSource from "../live/useEventSource";

function triggerHapticFeedback() {
  if (typeof window !== "undefined" && navigator.vibrate) {
    navigator.vibrate(50);
  }
}

function createActionId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function triggerMatchHapticFeedback() {
  triggerHapticFeedback();
}

export default function useMatch(matchId, hasAccess, initialMatch = null) {
  const router = useRouter();
  const [match, setMatch] = useState(initialMatch);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(
    Boolean(matchId && hasAccess && !initialMatch)
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const lastStreamUpdateRef = useRef(initialMatch?.updatedAt || "");
  const updateInFlightRef = useRef(false);

  useEffect(() => {
    if (!matchId || !hasAccess) {
      setMatch(initialMatch);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!initialMatch) {
      setIsLoading(true);
    }
  }, [hasAccess, initialMatch, matchId]);

  useEventSource({
    url: matchId && hasAccess ? `/api/live/matches/${matchId}` : null,
    event: "match",
    enabled: Boolean(matchId && hasAccess),
    onMessage: (payload) => {
      if (payload.updatedAt && payload.updatedAt === lastStreamUpdateRef.current) {
        return;
      }

      lastStreamUpdateRef.current = payload.updatedAt || "";
      startTransition(() => {
        setMatch(payload.match || null);
        setLastUpdatedAt(payload.updatedAt || "");
        setError(null);
        setIsLoading(false);
      });
    },
    onError: () => {
      if (!match) {
        setError(new Error("Could not open live match stream."));
        setIsLoading(false);
      }
    },
  });

  const historyStack = useMemo(
    () => new Array(Number(match?.undoCount || 0)).fill(null),
    [match?.undoCount]
  );
  const tossPending = Boolean(match && !match.tossReady);

  const sendAction = async (action) => {
    if (!matchId || !hasAccess || updateInFlightRef.current) return null;

    updateInFlightRef.current = true;
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/matches/${matchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });

      const body = await response
        .json()
        .catch(() => ({ message: "Failed to update match." }));

      if (!response.ok) {
        if (body.message === "Set the toss before scoring starts.") {
          setError(null);
          router.replace(`/toss/${matchId}`);
          return null;
        }
        throw new Error(body.message || "Failed to update match.");
      }

      if (body.match) {
        startTransition(() => {
          setMatch(body.match);
          setLastUpdatedAt(new Date().toISOString());
        });
      }

      setError(null);

      return body.match || null;
    } catch (caughtError) {
      console.error("Failed to update match:", caughtError);
      setError(caughtError);
      return null;
    } finally {
      updateInFlightRef.current = false;
      setIsUpdating(false);
    }
  };

  const patchAndUpdate = async (payload) => {
    if (!matchId || !hasAccess || updateInFlightRef.current) return null;

    updateInFlightRef.current = true;
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response
        .json()
        .catch(() => ({ message: "Failed to update match." }));

      if (!response.ok) {
        throw new Error(body.message || "Failed to update match.");
      }

      startTransition(() => {
        setMatch(body);
        setLastUpdatedAt(new Date().toISOString());
      });
      setError(null);
      return body;
    } catch (caughtError) {
      console.error("Failed to update match:", caughtError);
      setError(caughtError);
      return null;
    } finally {
      updateInFlightRef.current = false;
      setIsUpdating(false);
    }
  };

  const handleScoreEvent = (runs, isOut = false, extraType = null) => {
    if (!match || match.result || !hasAccess) return;
    if (tossPending) {
      setError(null);
      router.replace(`/toss/${matchId}`);
      return;
    }

    triggerHapticFeedback();
    sendAction({
      actionId: createActionId("score"),
      type: "score_ball",
      runs,
      isOut,
      extraType,
    });
  };

  const handleUndo = async () => {
    triggerHapticFeedback();
    if (tossPending) {
      setError(null);
      router.replace(`/toss/${matchId}`);
      return;
    }
    if (!match?.undoCount) return;

    await sendAction({
      actionId: createActionId("undo"),
      type: "undo_last",
    });
  };

  const handleNextInningsOrEnd = async () => {
    if (!match || !hasAccess) return;
    if (tossPending) {
      setError(null);
      router.replace(`/toss/${matchId}`);
      return;
    }

    if (match.result && !match.isOngoing) {
      router.push(`/result/${matchId}`);
      return;
    }

    const updatedMatch = await sendAction({
      actionId: createActionId("advance"),
      type: "complete_innings",
    });

    if (updatedMatch?.result && !updatedMatch?.isOngoing) {
      router.push(`/result/${matchId}`);
    }
  };

  return {
    match,
    error,
    isLoading,
    isUpdating,
    lastUpdatedAt,
    historyStack,
    replaceMatch: (nextMatch) => {
      startTransition(() => {
        setMatch(nextMatch);
        setLastUpdatedAt(new Date().toISOString());
      });
    },
    handleScoreEvent,
    handleUndo,
    handleNextInningsOrEnd,
    patchAndUpdate,
  };
}
