"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addBallToHistory, buildWinByWicketsText } from "../../lib/match-scoring";
import useEventSource from "../live/useEventSource";

function triggerHapticFeedback() {
  if (typeof window !== "undefined" && navigator.vibrate) {
    navigator.vibrate(50);
  }
}

export function triggerMatchHapticFeedback() {
  triggerHapticFeedback();
}

export default function useMatch(matchId, hasAccess) {
  const router = useRouter();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(matchId && hasAccess));
  const [isUpdating, setIsUpdating] = useState(false);
  const [historyStack, setHistoryStack] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  useEffect(() => {
    if (!matchId || !hasAccess) {
      setMatch(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
  }, [hasAccess, matchId]);

  useEventSource({
    url: matchId && hasAccess ? `/api/live/matches/${matchId}` : null,
    event: "match",
    enabled: Boolean(matchId && hasAccess),
    onMessage: (payload) => {
      setMatch(payload.match || null);
      setLastUpdatedAt(payload.updatedAt || "");
      setError(null);
      setIsLoading(false);
    },
  });

  const patchAndUpdate = async (payload, isUndo = false) => {
    if (!matchId || !hasAccess || isUpdating || !match) return;

    setIsUpdating(true);
    if (!isUndo) {
      setHistoryStack((prev) => [...prev, match]);
    }

    const optimisticData = { ...match, ...payload };
    setMatch(optimisticData);
    setLastUpdatedAt(new Date().toISOString());

    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Failed to update match." }));
        throw new Error(body.message || "Failed to update match.");
      }
    } catch (caughtError) {
      console.error("Failed to update match:", caughtError);
      setMatch(match);
      setError(caughtError);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleScoreEvent = (runs, isOut = false, extraType = null) => {
    if (!match || match.result || !hasAccess) return;

    triggerHapticFeedback();
    const payload = structuredClone(match);
    const activeInningsKey =
      payload.innings === "first" ? "innings1" : "innings2";

    payload[activeInningsKey].score += runs;
    payload.score = payload[activeInningsKey].score;
    if (isOut) payload.outs += 1;

    const newBall = { runs, isOut, extraType };
    if (!payload.balls) payload.balls = [];
    payload.balls.push(newBall);
    addBallToHistory(payload, newBall);

    if (payload.innings === "second" && payload.score > payload.innings1.score) {
      payload.isOngoing = false;
      payload.result = buildWinByWicketsText(payload, payload.outs);
    }

    patchAndUpdate(payload);
  };

  const handleUndo = async () => {
    triggerHapticFeedback();
    if (historyStack.length === 0) return;

    const previousState = historyStack.at(-1);
    setHistoryStack((prev) => prev.slice(0, -1));
    await patchAndUpdate(previousState, true);
  };

  const handleNextInningsOrEnd = () => {
    if (!match || !hasAccess) return;

    if (match.innings === "first") {
      patchAndUpdate({
        score: 0,
        outs: 0,
        balls: [],
        innings: "second",
      });
      return;
    }

    const firstInningsScore = match.innings1.score;
    const secondInningsScore = match.score;
    let resultText = "Match Tied";

    if (secondInningsScore > firstInningsScore) {
      resultText = buildWinByWicketsText(match, match.outs);
    } else if (firstInningsScore > secondInningsScore) {
      const runsMargin = firstInningsScore - secondInningsScore;
      resultText = `${match.innings1.team} won by ${runsMargin} ${
        runsMargin === 1 ? "run" : "runs"
      }.`;
    }

    patchAndUpdate({ isOngoing: false, result: resultText });
    router.push(`/result/${matchId}`);
  };

  return {
    match,
    error,
    isLoading,
    isUpdating,
    lastUpdatedAt,
    historyStack,
    handleScoreEvent,
    handleUndo,
    handleNextInningsOrEnd,
    patchAndUpdate,
  };
}
