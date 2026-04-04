"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { applyMatchAction, MatchEngineError } from "../../lib/match-engine";
import useEventSource from "../live/useEventSource";
import { useRouteFeedback } from "../shared/RouteFeedbackProvider";

const ACTION_QUEUE_RETRY_DELAY_MS = 2500;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

export function isMatchNetworkError(error) {
  if (!error) {
    return false;
  }

  const name = String(error?.name || "");
  const message = String(error?.message || "");
  return (
    name === "TypeError" &&
    (
      /Failed to fetch/i.test(message) ||
      /NetworkError/i.test(message) ||
      /Load failed/i.test(message)
    )
  );
}

function buildMatchNetworkRetryError() {
  const error = new Error("Live match connection dropped. Saved locally and retrying.");
  error.network = true;
  return error;
}

async function fetchWithNetworkRetry(url, init, retryDelays = [0, 180, 520]) {
  let lastError = null;

  for (const delayMs of retryDelays) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (!isMatchNetworkError(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    lastError.network = true;
    throw lastError;
  }

  throw new Error("Failed to update match.");
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

function getActionQueueStorageKey(matchId) {
  return `gv-match-pending-actions-${matchId}`;
}

function normalizeQueuedActionEntry(entry) {
  if (
    !entry ||
    typeof entry !== "object" ||
    typeof entry.action !== "object" ||
    typeof entry.action?.type !== "string" ||
    typeof entry.action?.actionId !== "string"
  ) {
    return null;
  }

  return {
    action: entry.action,
    allowOneRetry: entry.allowOneRetry !== false,
  };
}

function getAppliedActionIds(match) {
  const history = Array.isArray(match?.actionHistory) ? match.actionHistory : [];

  return new Set(
    history
      .map((entry) =>
        typeof entry?.actionId === "string" ? entry.actionId : ""
      )
      .filter(Boolean),
  );
}

function filterQueuedActionsAlreadyApplied(match, queuedEntries = []) {
  if (!queuedEntries.length) {
    return [];
  }

  const appliedActionIds = getAppliedActionIds(match);
  if (!appliedActionIds.size) {
    return queuedEntries;
  }

  return queuedEntries.filter(
    (entry) => !appliedActionIds.has(entry?.action?.actionId),
  );
}

function removeQueuedActionById(queuedEntries = [], actionId = "") {
  if (!actionId) {
    return queuedEntries;
  }

  return queuedEntries.filter((entry) => entry?.action?.actionId !== actionId);
}

function updateQueuedActionRetryFlag(
  queuedEntries = [],
  actionId = "",
  allowOneRetry = true,
) {
  if (!actionId) {
    return queuedEntries;
  }

  let changed = false;
  const nextEntries = queuedEntries.map((entry) => {
    if (entry?.action?.actionId !== actionId) {
      return entry;
    }

    if (entry.allowOneRetry === allowOneRetry) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      allowOneRetry,
    };
  });

  return changed ? nextEntries : queuedEntries;
}

function readStoredActionQueue(matchId) {
  if (typeof window === "undefined" || !matchId) {
    return [];
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      getActionQueueStorageKey(matchId)
    );
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeQueuedActionEntry)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeStoredActionQueue(matchId, entries) {
  if (typeof window === "undefined" || !matchId) {
    return;
  }

  try {
    if (!entries.length) {
      window.sessionStorage.removeItem(getActionQueueStorageKey(matchId));
      return;
    }

    window.sessionStorage.setItem(
      getActionQueueStorageKey(matchId),
      JSON.stringify(entries),
    );
  } catch {
    // Ignore storage failures and continue with in-memory queueing.
  }
}

export function replayQueuedMatchActions(baseMatch, queuedEntries = []) {
  return (queuedEntries || []).reduce((nextMatch, entry) => {
    return applyMatchAction(nextMatch, entry.action);
  }, baseMatch);
}

export {
  filterQueuedActionsAlreadyApplied,
  removeQueuedActionById,
  updateQueuedActionRetryFlag,
};

function isRetryableActionFailure(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export default function useMatch(matchId, hasAccess, initialMatch = null) {
  const router = useRouter();
  const { startNavigation } = useRouteFeedback();
  const [match, setMatch] = useState(initialMatch);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(
    Boolean(matchId && hasAccess && !initialMatch)
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialMatch?.updatedAt || "");
  const lastStreamUpdateRef = useRef(initialMatch?.updatedAt || "");
  const previousMatchIdRef = useRef(matchId);
  const matchRef = useRef(initialMatch);
  const actionQueueRef = useRef([]);
  const processingQueueRef = useRef(false);
  const retryTimerRef = useRef(null);
  const processQueuedActionsRef = useRef(async () => {});

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const updateQueuedActions = useCallback((nextQueue) => {
    actionQueueRef.current = nextQueue;
    writeStoredActionQueue(matchId, nextQueue);
  }, [matchId]);

  const applyQueuedFallbackState = useCallback((baseMatch) => {
    if (!baseMatch) {
      return null;
    }

    const syncedQueue = filterQueuedActionsAlreadyApplied(
      baseMatch,
      actionQueueRef.current,
    );

    if (syncedQueue.length !== actionQueueRef.current.length) {
      updateQueuedActions(syncedQueue);
    }

    if (!syncedQueue.length) {
      return baseMatch;
    }

    try {
      return normalizeOptimisticMatch(
        replayQueuedMatchActions(baseMatch, syncedQueue),
      );
    } catch {
      updateQueuedActions([]);
      setError(
        new Error(
          "Saved local scoring was cleared because the live match changed.",
        ),
      );
      return baseMatch;
    }
  }, [updateQueuedActions]);

  const scheduleQueuedActionRetry = useCallback(
    (delayMs = ACTION_QUEUE_RETRY_DELAY_MS) => {
      if (
        typeof window === "undefined" ||
        retryTimerRef.current ||
        !matchId ||
        !hasAccess ||
        !actionQueueRef.current.length
      ) {
        return;
      }

      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;

        if (
          typeof document !== "undefined" &&
          document.visibilityState === "hidden"
        ) {
          scheduleQueuedActionRetry(
            Math.max(delayMs, ACTION_QUEUE_RETRY_DELAY_MS),
          );
          return;
        }

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          scheduleQueuedActionRetry(
            Math.max(delayMs, ACTION_QUEUE_RETRY_DELAY_MS * 2),
          );
          return;
        }

        void processQueuedActionsRef.current();
      }, delayMs);
    },
    [hasAccess, matchId],
  );

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const refreshMatch = useCallback(async () => {
    if (!matchId || !hasAccess) {
      return null;
    }

    try {
      const response = await fetchWithNetworkRetry(`/api/matches/${matchId}`, {
        cache: "no-store",
      });
      const body = await response
        .json()
        .catch(() => null);

      if (!response.ok || !body) {
        return null;
      }

      const nextMatch = applyQueuedFallbackState(body);
      matchRef.current = nextMatch;
      lastStreamUpdateRef.current = body.updatedAt || lastStreamUpdateRef.current;
      setMatch(nextMatch);
      setLastUpdatedAt(
        nextMatch?.updatedAt || body.updatedAt || new Date().toISOString(),
      );
      setError(null);

      return body;
    } catch {
      return null;
    }
  }, [applyQueuedFallbackState, hasAccess, matchId]);

  useEffect(() => {
    const matchChanged = previousMatchIdRef.current !== matchId;
    previousMatchIdRef.current = matchId;

    if (matchChanged) {
      clearRetryTimer();
      processingQueueRef.current = false;
      updateQueuedActions([]);
      lastStreamUpdateRef.current = initialMatch?.updatedAt || "";
      matchRef.current = initialMatch || null;
      setMatch(initialMatch || null);
      setError(null);
      setLastUpdatedAt(initialMatch?.updatedAt || "");
      setIsUpdating(false);
    }

    if (!matchId || !hasAccess) {
      clearRetryTimer();
      lastStreamUpdateRef.current = initialMatch?.updatedAt || "";
      matchRef.current = initialMatch || null;
      setMatch(initialMatch);
      setError(null);
      setLastUpdatedAt(initialMatch?.updatedAt || "");
      setIsLoading(false);
      return;
    }

    if (!initialMatch) {
      setIsLoading(true);
    }
  }, [clearRetryTimer, hasAccess, initialMatch, matchId, updateQueuedActions]);

  useEffect(() => {
    if (!matchId) {
      clearRetryTimer();
      actionQueueRef.current = [];
      return;
    }

    clearRetryTimer();
    const storedQueue = readStoredActionQueue(matchId);
    updateQueuedActions(storedQueue);

    if (!storedQueue.length || !initialMatch) {
      return;
    }

    const replayedMatch = applyQueuedFallbackState(initialMatch);
    matchRef.current = replayedMatch;
    setMatch(replayedMatch);
    setLastUpdatedAt(replayedMatch?.updatedAt || initialMatch.updatedAt || "");

    if (hasAccess) {
      scheduleQueuedActionRetry(250);
    }
  }, [
    applyQueuedFallbackState,
    clearRetryTimer,
    hasAccess,
    initialMatch,
    matchId,
    scheduleQueuedActionRetry,
    updateQueuedActions,
  ]);

  useEventSource({
    url: matchId && hasAccess ? `/api/live/matches/${matchId}` : null,
    event: "match",
    enabled: Boolean(matchId && hasAccess),
    onMessage: (payload) => {
      if (payload.updatedAt && payload.updatedAt === lastStreamUpdateRef.current) {
        return;
      }

      lastStreamUpdateRef.current = payload.updatedAt || "";
      const nextMatch = applyQueuedFallbackState(payload.match || null);
      matchRef.current = nextMatch;
      setMatch(nextMatch);
      setLastUpdatedAt(nextMatch?.updatedAt || payload.updatedAt || "");
      setError(null);
      setIsLoading(false);
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

  const refreshMatchFromServer = useCallback(async () => {
    const refreshedMatch = await refreshMatch();
    if (refreshedMatch) {
      matchRef.current = refreshedMatch;
    }
    return refreshedMatch;
  }, [refreshMatch]);

  const processQueuedActions = useCallback(async () => {
    if (processingQueueRef.current) {
      return;
    }

    clearRetryTimer();
    processingQueueRef.current = true;

    while (actionQueueRef.current.length > 0) {
      const currentEntry = actionQueueRef.current[0];
      setIsUpdating(true);

      try {
        const response = await fetchWithNetworkRetry(`/api/matches/${matchId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentEntry.action),
        });

        const body = await response
          .json()
          .catch(() => ({ message: "Failed to update match." }));

        if (!response.ok) {
          if (isRetryableActionFailure(response.status)) {
            setError(
              new Error(
                `${body.message || "Could not update match."} Saved locally and retrying.`,
              ),
            );
            scheduleQueuedActionRetry();
            break;
          }

          if (body.message === "Set the toss before scoring starts.") {
            const refreshedMatch = await refreshMatchFromServer();

            if (refreshedMatch?.tossReady && currentEntry.allowOneRetry) {
              updateQueuedActions(
                updateQueuedActionRetryFlag(
                  actionQueueRef.current,
                  currentEntry.action.actionId,
                  false,
                ),
              );
              continue;
            }

            setError(null);
            startNavigation("Opening toss...");
            router.replace(`/toss/${matchId}`);
            break;
          }

          if (
            body.message === "The current innings is not complete yet." ||
            body.message === "The current innings is already complete."
          ) {
            await refreshMatchFromServer();
            setError(null);
            updateQueuedActions(
              removeQueuedActionById(
                actionQueueRef.current,
                currentEntry.action.actionId,
              ),
            );
            continue;
          }

          throw new Error(body.message || "Failed to update match.");
        }

        if (body.match) {
          const remainingQueue = removeQueuedActionById(
            actionQueueRef.current,
            currentEntry.action.actionId,
          );
          updateQueuedActions(remainingQueue);
          const nextMatch = applyQueuedFallbackState(body.match);
          matchRef.current = nextMatch;
          lastStreamUpdateRef.current =
            body.match.updatedAt || lastStreamUpdateRef.current;
          setMatch(nextMatch);
          setLastUpdatedAt(
            nextMatch?.updatedAt || body.match.updatedAt || new Date().toISOString(),
          );
        } else {
          updateQueuedActions(
            removeQueuedActionById(
              actionQueueRef.current,
              currentEntry.action.actionId,
            ),
          );
        }

        setError(null);
      } catch (caughtError) {
        if (isMatchNetworkError(caughtError) || caughtError?.network) {
          console.warn("Live match update delayed:", caughtError);
          setError(buildMatchNetworkRetryError());
        } else {
          console.error("Failed to update match:", caughtError);
          setError(caughtError);
        }
        scheduleQueuedActionRetry();
        break;
      }
    }

    processingQueueRef.current = false;
    setIsUpdating(false);
  }, [
    applyQueuedFallbackState,
    clearRetryTimer,
    matchId,
    refreshMatchFromServer,
    router,
    scheduleQueuedActionRetry,
    startNavigation,
    updateQueuedActions,
  ]);

  processQueuedActionsRef.current = processQueuedActions;

  const sendAction = useCallback(async (action, allowOneRetry = true) => {
    if (!matchId || !hasAccess) return null;

    const baseMatch = matchRef.current;
    if (!baseMatch) {
      return null;
    }

    try {
      const optimisticMatch = applyMatchAction(baseMatch, action);
      const nextOptimisticMatch = normalizeOptimisticMatch(optimisticMatch);
      matchRef.current = nextOptimisticMatch;
      setMatch(nextOptimisticMatch);
      setLastUpdatedAt(nextOptimisticMatch.updatedAt || new Date().toISOString());
      setError(null);
    } catch (caughtError) {
      if (caughtError instanceof MatchEngineError) {
        setError(caughtError);
        return null;
      }
      console.error("Failed to update match:", caughtError);
      setError(caughtError);
      return null;
    }

    updateQueuedActions([
      ...actionQueueRef.current,
      {
        action,
        allowOneRetry,
      },
    ]);
    void processQueuedActions();

    return matchRef.current;
  }, [hasAccess, matchId, processQueuedActions, updateQueuedActions]);

  const patchAndUpdate = useCallback(async (payload) => {
    if (!matchId || !hasAccess || processingQueueRef.current) return null;

    setIsUpdating(true);

    try {
      const response = await fetchWithNetworkRetry(`/api/matches/${matchId}`, {
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

      matchRef.current = body;
      lastStreamUpdateRef.current = body.updatedAt || lastStreamUpdateRef.current;
      setMatch(body);
      setLastUpdatedAt(body.updatedAt || new Date().toISOString());
      setError(null);
      return body;
    } catch (caughtError) {
      if (isMatchNetworkError(caughtError) || caughtError?.network) {
        console.warn("Live match update delayed:", caughtError);
        setError(new Error("Live match connection dropped. Try again."));
      } else {
        console.error("Failed to update match:", caughtError);
        setError(caughtError);
      }
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [hasAccess, matchId, refreshMatchFromServer]);

  useEffect(() => {
    if (!matchId || !hasAccess || typeof window === "undefined") {
      return undefined;
    }

    const retryPendingActions = () => {
      if (!actionQueueRef.current.length) {
        return;
      }

      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }

      clearRetryTimer();
      void processQueuedActionsRef.current();
    };

    const handleVisibility = () => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        retryPendingActions();
      }
    };

    window.addEventListener("online", retryPendingActions);
    window.addEventListener("focus", retryPendingActions);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", retryPendingActions);
      window.removeEventListener("focus", retryPendingActions);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [clearRetryTimer, hasAccess, matchId]);

  useEffect(() => {
    return () => {
      clearRetryTimer();
    };
  }, [clearRetryTimer]);

  const handleScoreEvent = useCallback((runs, isOut = false, extraType = null) => {
    if (!match || match.result || !hasAccess) return;
    if (tossPending) {
      setError(null);
      startNavigation("Opening toss...");
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
  }, [hasAccess, match, matchId, router, sendAction, startNavigation, tossPending]);

  const handleUndo = useCallback(async () => {
    triggerHapticFeedback();
    if (tossPending) {
      setError(null);
      startNavigation("Opening toss...");
      router.replace(`/toss/${matchId}`);
      return;
    }
    if (!match?.undoCount || !currentInningsHasHistory) return;

    await sendAction({
      actionId: createActionId("undo"),
      type: "undo_last",
    });
  }, [currentInningsHasHistory, match?.undoCount, matchId, router, sendAction, startNavigation, tossPending]);

  const handleNextInningsOrEnd = useCallback(async () => {
    if (!match || !hasAccess) return;
    if (tossPending) {
      setError(null);
      startNavigation("Opening toss...");
      router.replace(`/toss/${matchId}`);
      return null;
    }

    if (match.result && !match.isOngoing) {
      startNavigation("Opening result...");
      router.push(`/result/${matchId}`);
      return match;
    }

    const updatedMatch = await sendAction({
      actionId: createActionId("advance"),
      type: "complete_innings",
    });

    if (updatedMatch?.result && !updatedMatch?.isOngoing) {
      startNavigation("Opening result...");
      router.push(`/result/${matchId}`);
    }
    return updatedMatch || null;
  }, [hasAccess, match, matchId, router, sendAction, startNavigation, tossPending]);

  return {
    match,
    error,
    isLoading,
    isUpdating,
    lastUpdatedAt,
    historyStack,
    currentInningsHasHistory,
    replaceMatch: (nextMatch) => {
      matchRef.current = nextMatch;
      lastStreamUpdateRef.current =
        nextMatch?.updatedAt || lastStreamUpdateRef.current;
      setMatch(nextMatch);
      setLastUpdatedAt(nextMatch?.updatedAt || new Date().toISOString());
    },
    handleScoreEvent,
    handleUndo,
    handleNextInningsOrEnd,
    patchAndUpdate,
  };
}
