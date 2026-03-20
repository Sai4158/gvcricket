"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyMatchAction, MatchEngineError } from "../../lib/match-engine";
import useEventSource from "../live/useEventSource";

function triggerHapticFeedback() {
  if (
    typeof window !== "undefined" &&
    navigator.vibrate &&
    (navigator.userActivation?.isActive || navigator.userActivation?.hasBeenActive)
  ) {
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

function normalizeOptimisticMatch(nextMatch) {
  if (!nextMatch) {
    return null;
  }

  return {
    ...nextMatch,
    actionHistory: Array.isArray(nextMatch.actionHistory) ? nextMatch.actionHistory : [],
    undoCount: Array.isArray(nextMatch.actionHistory)
      ? nextMatch.actionHistory.length
      : Number(nextMatch.undoCount || 0),
    updatedAt: new Date().toISOString(),
  };
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
  const previousMatchIdRef = useRef(matchId);
  const matchRef = useRef(initialMatch);
  const actionQueueRef = useRef([]);
  const processingQueueRef = useRef(false);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const refreshMatch = async () => {
    if (!matchId || !hasAccess) {
      return null;
    }

    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        cache: "no-store",
      });
      const body = await response
        .json()
        .catch(() => null);

      if (!response.ok || !body) {
        return null;
      }

      startTransition(() => {
        setMatch(body);
        setLastUpdatedAt(new Date().toISOString());
        setError(null);
      });

      return body;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const matchChanged = previousMatchIdRef.current !== matchId;
    previousMatchIdRef.current = matchId;

    if (matchChanged) {
      processingQueueRef.current = false;
      actionQueueRef.current = [];
      lastStreamUpdateRef.current = initialMatch?.updatedAt || "";
      setMatch(initialMatch || null);
      setError(null);
      setLastUpdatedAt(initialMatch?.updatedAt || "");
      setIsUpdating(false);
    }

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
  const activeInningsKey = match?.innings === "second" ? "innings2" : "innings1";
  const currentInningsHasHistory = Boolean(
    match?.[activeInningsKey]?.history?.some((over) => Array.isArray(over?.balls) && over.balls.length > 0)
  );

  const refreshMatchFromServer = async () => {
    const refreshedMatch = await refreshMatch();
    if (refreshedMatch) {
      matchRef.current = refreshedMatch;
    }
    return refreshedMatch;
  };

  const processQueuedActions = async () => {
    if (processingQueueRef.current) {
      return;
    }

    processingQueueRef.current = true;

    while (actionQueueRef.current.length > 0) {
      const currentEntry = actionQueueRef.current[0];
      setIsUpdating(true);

      try {
        const response = await fetch(`/api/matches/${matchId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentEntry.action),
        });

        const body = await response
          .json()
          .catch(() => ({ message: "Failed to update match." }));

        if (!response.ok) {
          if (body.message === "Set the toss before scoring starts.") {
            const refreshedMatch = await refreshMatchFromServer();

            if (refreshedMatch?.tossReady && currentEntry.allowOneRetry) {
              currentEntry.allowOneRetry = false;
              continue;
            }

            setError(null);
            router.replace(`/toss/${matchId}`);
            break;
          }

          if (
            body.message === "The current innings is not complete yet." ||
            body.message === "The current innings is already complete."
          ) {
            await refreshMatchFromServer();
            setError(null);
            actionQueueRef.current.shift();
            continue;
          }

          throw new Error(body.message || "Failed to update match.");
        }

        if (body.match) {
          matchRef.current = body.match;
          startTransition(() => {
            setMatch(body.match);
            setLastUpdatedAt(new Date().toISOString());
          });
        }

        setError(null);
        actionQueueRef.current.shift();
      } catch (caughtError) {
        console.error("Failed to update match:", caughtError);
        await refreshMatchFromServer();
        setError(caughtError);
        actionQueueRef.current.shift();
      }
    }

    processingQueueRef.current = false;
    setIsUpdating(false);
  };

  const sendAction = async (action, allowOneRetry = true) => {
    if (!matchId || !hasAccess) return null;

    const baseMatch = matchRef.current;
    if (!baseMatch) {
      return null;
    }

    try {
      const optimisticMatch = applyMatchAction(baseMatch, action);
      const nextOptimisticMatch = normalizeOptimisticMatch(optimisticMatch);
      matchRef.current = nextOptimisticMatch;
      startTransition(() => {
        setMatch(nextOptimisticMatch);
        setLastUpdatedAt(nextOptimisticMatch.updatedAt || new Date().toISOString());
        setError(null);
      });
    } catch (caughtError) {
      if (caughtError instanceof MatchEngineError) {
        setError(caughtError);
        return null;
      }
      console.error("Failed to update match:", caughtError);
      setError(caughtError);
      return null;
    }

    actionQueueRef.current.push({
      action,
      allowOneRetry,
    });
    void processQueuedActions();

    return matchRef.current;
  };

  const patchAndUpdate = async (payload) => {
    if (!matchId || !hasAccess || processingQueueRef.current) return null;

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
        if (
          body.message === "The current innings is already complete." ||
          body.message === "The current innings is not complete yet."
        ) {
          await refreshMatchFromServer();
          setError(null);
          return null;
        }
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
    if (!match?.undoCount || !currentInningsHasHistory) return;

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
    currentInningsHasHistory,
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
