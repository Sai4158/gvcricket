"use client";

/**
 * File overview:
 * Purpose: UI component for Toss screens and flows.
 * Main exports: TossPageClient.
 * Major callers: Feature routes and sibling components.
 * Side effects: reads or writes browser storage.
 * Read next: ../README.md
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaRedo } from "react-icons/fa";
import { AccessGate, Splash } from "../match/MatchStatusShell";
import useMatchAccess from "../match/useMatchAccess";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import LoadingButton from "../shared/LoadingButton";
import TossStatePanels from "./TossStatePanels";
import { getTeamBundle } from "../../lib/team-utils";
import { getStartedMatchFromPayload, getStartedMatchId } from "../../lib/match-start";
import {
  clearPendingSessionImageNotice,
  uploadStoredPendingSessionImageToMatch,
} from "../../lib/pending-session-image";
import StepFlow from "../shared/StepFlow";
import LiquidSportText from "../home/LiquidSportText";

const getDraftTokenKey = (sessionId) => `session_${sessionId}_draftToken`;
const TOSS_ANNOUNCER_SETTINGS = {
  enabled: true,
  muted: false,
  volume: 1,
  mode: "full",
};

function createActionId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

async function uploadPendingSessionImage(matchId, sessionId) {
  if (!matchId || typeof window === "undefined") {
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);

  try {
    const didUpload = await uploadStoredPendingSessionImageToMatch({
      matchId,
      signal: controller.signal,
    });
    if (didUpload && sessionId) {
      clearPendingSessionImageNotice(sessionId);
    }
  } catch {
    // Optional image upload should never block match start.
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildTossResultAnnouncement(tossResult) {
  const winnerName = String(tossResult?.winnerName || "").trim();

  if (!winnerName) {
    return "";
  }

  return `${winnerName} has won the toss. Do you want to bat or bowl?`;
}

function buildTossChoicePrompt(teamName) {
  const safeTeamName = String(teamName || "").trim();
  if (!safeTeamName) {
    return "What do you want to choose, heads or tails?";
  }

  return `${safeTeamName}, what do you want to choose, heads or tails?`;
}

export default function TossPageClient({
  matchId,
  sessionId,
  initialMatch,
  initialAuthStatus = "checking",
  hasCreatedMatch = false,
}) {
  const router = useRouter();
  const { authStatus, authError, authSubmitting, submitPin } = useMatchAccess(
    matchId,
    initialAuthStatus
  );
  const [status, setStatus] = useState("choosing");
  const [countdown, setCountdown] = useState(3);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [tossResult, setTossResult] = useState({
    side: null,
    winnerName: null,
    call: null,
  });
  const [matchDetails, setMatchDetails] = useState(initialMatch);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { speak, prime, stop } = useSpeechAnnouncer(TOSS_ANNOUNCER_SETTINGS);
  const spokenCountdownRef = useRef(null);
  const announcedResultRef = useRef("");
  const choicePromptedRef = useRef(false);

  useEffect(() => {
    if (status !== "counting" || countdown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown, status]);

  useEffect(() => {
    if (status !== "counting" || countdown !== 0 || !matchDetails || !playerChoice) {
      return undefined;
    }

    const teamA = getTeamBundle(matchDetails, "teamA");
    const teamB = getTeamBundle(matchDetails, "teamB");
    const actualSide = Math.random() < 0.5 ? "heads" : "tails";
    const winnerName = playerChoice === actualSide ? teamA.name : teamB.name;

    setStatus("flipping");
    setTossResult({ side: actualSide, winnerName, call: playerChoice });
  }, [countdown, matchDetails, playerChoice, status]);

  useEffect(() => {
    if (status !== "flipping") {
      return undefined;
    }

    const revealTimer = window.setTimeout(() => {
      setStatus("finished");
    }, 2400);

    return () => window.clearTimeout(revealTimer);
  }, [status]);

  useEffect(() => {
    if (status !== "choosing" || choicePromptedRef.current || !matchDetails) {
      return undefined;
    }

    const teamName = getTeamBundle(matchDetails, "teamA").name;
    const nextChoicePrompt = buildTossChoicePrompt(teamName);
    const promptTimer = window.setTimeout(() => {
      prime();
      choicePromptedRef.current = true;
      speak(nextChoicePrompt, {
        priority: 2,
        interrupt: true,
      });
    }, 420);

    return () => window.clearTimeout(promptTimer);
  }, [matchDetails, prime, sessionId, speak, status]);

  useEffect(() => {
    if (status !== "counting" || countdown <= 0 || spokenCountdownRef.current === countdown) {
      return;
    }

    const didSpeak = speak(String(countdown), { interrupt: true });
    if (didSpeak) {
      spokenCountdownRef.current = countdown;
    }
  }, [countdown, speak, status]);

  useEffect(() => {
    if (status !== "finished") {
      return;
    }

    const announcement = buildTossResultAnnouncement(tossResult);
    if (!announcement || announcedResultRef.current === announcement) {
      return;
    }

    announcedResultRef.current = announcement;
    speak(announcement, {
      interrupt: true,
      priority: 3,
    });
  }, [speak, status, tossResult]);

  useEffect(() => () => stop(), [stop]);

  const handleChoice = (choice) => {
    stop();
    setError("");
    spokenCountdownRef.current = null;
    announcedResultRef.current = "";
    choicePromptedRef.current = true;
    prime({ userGesture: true });
    setPlayerChoice(choice);
    setCountdown(3);
    setTossResult({ side: null, winnerName: null, call: null });
    setStatus("counting");
  };

  const startMatch = async (decision) => {
    if (isSubmitting || !tossResult.winnerName || !decision || !matchDetails) {
      return;
    }

    stop();
    setIsSubmitting(true);
    setError("");

    try {
      const teamA = getTeamBundle(matchDetails, "teamA");
      const teamB = getTeamBundle(matchDetails, "teamB");
      const requestUrl = hasCreatedMatch
        ? `/api/matches/${matchId}/actions`
        : `/api/sessions/${sessionId}/start-match`;
      const requestBody = hasCreatedMatch
        ? {
            actionId: createActionId("toss"),
            type: "set_toss",
            tossWinner: tossResult.winnerName,
            tossDecision: decision,
          }
        : {
            teamAName: teamA.name,
            teamAPlayers: teamA.players,
            teamBName: teamB.name,
            teamBPlayers: teamB.players,
            overs: Number(matchDetails.overs || 6),
            tossWinner: tossResult.winnerName,
            tossDecision: decision,
            draftToken:
              typeof window !== "undefined"
                ? window.sessionStorage.getItem(getDraftTokenKey(sessionId)) || ""
                : "",
          };

      const res = await fetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to update toss.");
      }

      const nextMatch = getStartedMatchFromPayload(payload);
      const finalMatchId = getStartedMatchId(payload);

      if (!nextMatch || !finalMatchId) {
        throw new Error("Could not start the match.");
      }

      setMatchDetails(nextMatch);

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`session_${sessionId}_teamA_v2`);
        window.sessionStorage.removeItem(`session_${sessionId}_teamB_v2`);
        window.sessionStorage.removeItem(`session_${sessionId}_overs_v2`);
        window.sessionStorage.removeItem(getDraftTokenKey(sessionId));
      }

      if (finalMatchId) {
        void uploadPendingSessionImage(finalMatchId, sessionId);
      }

      router.push(`/match/${finalMatchId}`);
    } catch (caughtError) {
      setError(caughtError.message || "Failed to update toss.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const redoToss = () => {
    stop();
    spokenCountdownRef.current = null;
    announcedResultRef.current = "";
    choicePromptedRef.current = false;
    setStatus("choosing");
    setPlayerChoice(null);
    setCountdown(3);
    setTossResult({ side: null, winnerName: null, call: null });
    setIsSubmitting(false);
    setError("");
  };

  const handleBack = () => {
    if (status === "finished") {
      redoToss();
      return;
    }

    stop();
    router.back();
  };

  if (error) {
    return (
      <main className="min-h-screen grid place-content-center bg-zinc-950 px-6">
        <div className="max-w-sm rounded-[28px] border border-rose-500/30 bg-rose-950/30 px-6 py-5 text-center text-rose-200 shadow-2xl shadow-black/40">
          <p className="text-lg font-semibold">{error}</p>
          <LoadingButton
            onClick={redoToss}
            className="mt-5 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Try Toss Again
          </LoadingButton>
        </div>
      </main>
    );
  }

  if (!matchDetails) {
    return (
      <main className="min-h-screen grid place-content-center bg-zinc-950">
        <p className="text-white text-xl animate-pulse">Loading toss...</p>
      </main>
    );
  }

  const teamA = getTeamBundle(matchDetails, "teamA");
  const teamB = getTeamBundle(matchDetails, "teamB");
  const tossChoicePrompt = buildTossChoicePrompt(teamA.name);
  const titleText = "Match Toss";
  const subtitleText = `${teamA.name} vs ${teamB.name}`;
  const currentStep = status === "finished" ? 4 : 3;

  return (
    hasCreatedMatch && authStatus !== "granted" ? (
      authStatus === "checking" ? (
        <Splash>Checking toss access...</Splash>
      ) : (
        <AccessGate
          onSubmit={submitPin}
          isSubmitting={authSubmitting}
          error={authError}
          rateLimitScope={matchId ? `match-auth:${matchId}` : "match-auth"}
        />
      )
    ) : (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_35%),linear-gradient(180deg,#050505_0%,#0b0b11_55%,#050505_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <section className="relative w-full overflow-hidden rounded-[34px] border border-amber-400/25 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(6,6,8,0.96))] px-6 py-7 shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_24%)]" />

          <div className="relative">
            <div className="mb-6 flex items-start justify-between gap-4">
              <button
                onClick={handleBack}
                className="press-feedback mt-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10"
                aria-label="Go back"
              >
                <FaArrowLeft />
              </button>

              <button
                onClick={redoToss}
                className="press-feedback mt-1 inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-200 transition hover:bg-white/10"
                aria-label="Redo Toss"
              >
                <FaRedo />
                <span>Redo</span>
              </button>
            </div>

            <div className="mb-6 text-center">
              <StepFlow currentStep={currentStep} />
            </div>

            <div className="mb-6 text-center">
              <LiquidSportText
                as="h1"
                text={titleText.toUpperCase()}
                variant="hero-bright"
                simplifyMotion
                className="text-[2.2rem] font-semibold uppercase tracking-[-0.045em] sm:text-[2.95rem]"
                lineClassName="leading-[0.94]"
              />
              <p className="mt-2 text-sm text-zinc-400">{subtitleText}</p>
            </div>

            <TossStatePanels
              status={status}
              countdown={countdown}
              teamName={teamA.name}
              tossChoicePrompt={tossChoicePrompt}
              tossResult={tossResult}
              isSubmitting={isSubmitting}
              onChoice={handleChoice}
              onDecision={startMatch}
            />
          </div>
        </section>
      </div>
    </main>
    )
  );
}
