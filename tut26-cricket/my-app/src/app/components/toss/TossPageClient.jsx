"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaHandSparkles, FaRedo } from "react-icons/fa";
import MatchImageUploader from "../match/MatchImageUploader";
import { AccessGate, Splash } from "../match/MatchStatusShell";
import useMatchAccess from "../match/useMatchAccess";
import TossStatePanels from "./TossStatePanels";
import { getTeamBundle } from "../../lib/team-utils";

function createActionId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export default function TossPageClient({
  matchId,
  initialMatch,
  initialAuthStatus = "checking",
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
  const [showImageStep, setShowImageStep] = useState(false);

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

  const handleChoice = (choice) => {
    setError("");
    setPlayerChoice(choice);
    setCountdown(3);
    setTossResult({ side: null, winnerName: null, call: null });
    setStatus("counting");
  };

  const startMatch = async (decision) => {
    if (isSubmitting || !tossResult.winnerName || !decision || !matchDetails) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/matches/${matchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: createActionId("toss"),
          type: "set_toss",
          tossWinner: tossResult.winnerName,
          tossDecision: decision,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to update toss.");
      }

      setMatchDetails(payload.match);
      setShowImageStep(true);
    } catch (caughtError) {
      setError(caughtError.message || "Failed to update toss.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const redoToss = () => {
    setStatus("choosing");
    setPlayerChoice(null);
    setCountdown(3);
    setTossResult({ side: null, winnerName: null, call: null });
    setIsSubmitting(false);
    setShowImageStep(false);
    setError("");
  };

  if (error) {
    return (
      <main className="min-h-screen grid place-content-center bg-zinc-950 px-6">
        <div className="max-w-sm rounded-[28px] border border-rose-500/30 bg-rose-950/30 px-6 py-5 text-center text-rose-200 shadow-2xl shadow-black/40">
          <p className="text-lg font-semibold">{error}</p>
          <button
            onClick={redoToss}
            className="mt-5 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Try Toss Again
          </button>
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
  const titleText = showImageStep ? "Ready to Start" : "Match Toss";
  const subtitleText = showImageStep
    ? "Add a cover, or skip."
    : `${teamA.name} vs ${teamB.name}`;
  const stageLabel =
    showImageStep ? "Step 3" : status === "finished" ? "Step 2" : "Step 1";

  return (
    authStatus !== "granted" ? (
      authStatus === "checking" ? (
        <Splash>Checking toss access...</Splash>
      ) : (
        <AccessGate
          onSubmit={submitPin}
          isSubmitting={authSubmitting}
          error={authError}
        />
      )
    ) : (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_35%),linear-gradient(180deg,#050505_0%,#0b0b11_55%,#050505_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <section className="relative w-full overflow-hidden rounded-[34px] border border-amber-400/25 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(6,6,8,0.96))] px-6 py-7 shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_24%)]" />

          <div className="relative">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
                  <FaHandSparkles className="text-[10px]" />
                  {stageLabel}
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-amber-300">
                  {titleText}
                </h1>
                <p className="mt-2 text-sm text-zinc-400">{subtitleText}</p>
              </div>

              <button
                onClick={redoToss}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10"
                aria-label="Redo Toss"
              >
                <FaRedo />
              </button>
            </div>

            {showImageStep ? (
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
                  <p className="text-base font-semibold text-white">
                    Toss complete. {tossResult.winnerName} chose to {matchDetails.tossDecision}.
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">Add an image or go live.</p>
                </div>

                <MatchImageUploader
                  matchId={String(matchDetails._id)}
                  existingImageUrl={matchDetails.matchImageUrl || ""}
                  onUploaded={() => {
                    router.push(`/match/${matchId}`);
                  }}
                  onSkip={() => router.push(`/match/${matchId}`)}
                  title="Optional match image"
                  description="Poster, ground photo, or team image. You can also add it later."
                  primaryLabel="Start Match"
                  secondaryLabel="Skip for now"
                />
              </div>
            ) : (
              <TossStatePanels
                status={status}
                countdown={countdown}
                teamName={teamA.name}
                tossResult={tossResult}
                isSubmitting={isSubmitting}
                onChoice={handleChoice}
                onDecision={startMatch}
              />
            )}
          </div>
        </section>
      </div>
    </main>
    )
  );
}
