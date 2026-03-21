"use client";

import dynamic from "next/dynamic";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FaArrowLeft, FaDownload } from "react-icons/fa";
import useEventSource from "../live/useEventSource";
import LiquidSportText from "../home/LiquidSportText";
import MatchHeroBackdrop from "../match/MatchHeroBackdrop";
import MatchImageUploader from "../match/MatchImageUploader";
import { ModalBase } from "../match/MatchBaseModals";
import ImagePinModal from "../shared/ImagePinModal";
import SafeMatchImage, {
  GV_MATCH_FALLBACK_IMAGE,
  resolveSafeMatchImage,
} from "../shared/SafeMatchImage";
import { calculateInningsSummary } from "../../lib/match-stats";
import CongratulationsCard from "./CongratulationsCard";
import EnhancedScorecard from "./EnhancedScorecard";
import PlayerLists from "./PlayerLists";
import ResultInsightsSections from "./ResultInsightsSections";
import PlayerStatsSection from "./PlayerStatsSection";

const RunsPerOverChart = dynamic(() => import("./RunsPerOverChart"), {
  ssr: false,
});
const ScoringBreakdownCharts = dynamic(() => import("./ScoringBreakdownCharts"), {
  ssr: false,
});

export default function ResultPageClient({ matchId, initialMatch }) {
  const router = useRouter();
  const [match, setMatch] = useState(initialMatch);
  const [streamError, setStreamError] = useState("");
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [isImageActionsOpen, setIsImageActionsOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [showConfetti, setShowConfetti] = useState(true);
  const lastStreamUpdateRef = useRef(initialMatch?.updatedAt || "");
  const imageHoldTimerRef = useRef(null);
  const imageHoldTriggeredRef = useRef(false);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: `${(index * 17) % 100}%`,
        delay: `${(index % 8) * 0.18}s`,
        duration: `${4 + (index % 5) * 0.45}s`,
        rotate: `${(index % 2 === 0 ? 1 : -1) * (10 + index * 3)}deg`,
        color:
          ["#f6b400", "#fde68a", "#ffffff", "#ffdd57", "#f59e0b"][index % 5],
      })),
    []
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowConfetti(false), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    return () => {
      if (imageHoldTimerRef.current) {
        window.clearTimeout(imageHoldTimerRef.current);
        imageHoldTimerRef.current = null;
      }
    };
  }, []);

  useEventSource({
    url: matchId ? `/api/live/matches/${matchId}` : null,
    event: "match",
    enabled: Boolean(matchId) && Boolean(!match || match.isOngoing),
    onMessage: (payload) => {
      if (payload.updatedAt && payload.updatedAt === lastStreamUpdateRef.current) {
        return;
      }

      lastStreamUpdateRef.current = payload.updatedAt || "";
      startTransition(() => {
        setMatch(payload.match || null);
        setStreamError("");
      });
    },
    onError: () => {
      if (!match) {
        setStreamError("Failed to load match results.");
      }
    },
  });

  if (streamError) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-red-400">{streamError}</div>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-lg font-medium">Loading Match Results...</div>
      </main>
    );
  }

  const innings1Summary = calculateInningsSummary(match.innings1);
  const innings2Summary = calculateInningsSummary(match.innings2);
  const resolvedMatchImage = resolveSafeMatchImage(match?.matchImageUrl || "");
  const hasUploadedMatchImage =
    resolvedMatchImage !== GV_MATCH_FALLBACK_IMAGE;

  const handleRemoveImage = async (pin) => {
    const response = await fetch(`/api/matches/${matchId}/image`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Failed to remove the image.");
    }

    startTransition(() => {
      setMatch(payload);
      setRemoveError("");
      setIsRemoveModalOpen(false);
    });
  };

  const clearImageHoldTimer = () => {
    if (imageHoldTimerRef.current) {
      window.clearTimeout(imageHoldTimerRef.current);
      imageHoldTimerRef.current = null;
    }
  };

  const handleImageHoldStart = () => {
    imageHoldTriggeredRef.current = false;
    clearImageHoldTimer();
    imageHoldTimerRef.current = window.setTimeout(() => {
      imageHoldTriggeredRef.current = true;
      setRemoveError("");
      setIsImageActionsOpen(true);
    }, 520);
  };

  const handleImageHoldEnd = () => {
    clearImageHoldTimer();
    window.setTimeout(() => {
      imageHoldTriggeredRef.current = false;
    }, 0);
  };

  const handleImageClickCapture = (event) => {
    if (imageHoldTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleDownloadImage = async () => {
    const imageUrl = resolveSafeMatchImage(match?.matchImageUrl || "");
    const baseName = String(match?.name || "gv-cricket-match-image")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "gv-cricket-match-image";

    try {
      const response = await fetch(imageUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Image fetch failed.");
      }

      const blob = await response.blob();
      const extension =
        blob.type === "image/jpeg"
          ? "jpg"
          : blob.type === "image/webp"
            ? "webp"
            : "png";
      const file = new File([blob], `${baseName}.${extension}`, {
        type: blob.type || "image/png",
      });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.share &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: match?.name || "GV Cricket Match Image",
        });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-4 sm:p-8 text-zinc-300 font-sans">
      <div className="max-w-5xl mx-auto space-y-12 py-10">
        <div className="flex justify-start">
          <button
            onClick={() => router.push("/session")}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-zinc-100 backdrop-blur-sm transition-colors hover:bg-black/45"
          >
            <FaArrowLeft />
            <span>Back to Sessions</span>
          </button>
        </div>

        <MatchHeroBackdrop match={match} className="mb-2">
          <div className="px-5 py-7 sm:px-8 sm:py-8">
            {showConfetti ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[320px] overflow-hidden">
                {confettiPieces.map((piece) => (
                  <span
                    key={piece.id}
                    className="absolute top-[-10%] h-3 w-2 rounded-full opacity-80 animate-[result-confetti_var(--confetti-duration)_linear_forwards]"
                    style={{
                      left: piece.left,
                      backgroundColor: piece.color,
                      animationDelay: piece.delay,
                      ["--confetti-duration"]: piece.duration,
                      transform: `rotate(${piece.rotate})`,
                    }}
                  />
                ))}
              </div>
            ) : null}
            <header className="text-center space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/90">
                  Match Complete
                </p>
                <LiquidSportText
                  as="h1"
                  text="MATCH RESULT"
                  variant="hero-bright"
                  simplifyMotion
                  className="text-4xl font-extrabold tracking-tight sm:text-5xl"
                />
                <p className="text-sm text-zinc-300">
                  {match.innings1.team} vs {match.innings2.team}
                </p>
              </div>
            </header>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              {match.result && <CongratulationsCard result={match.result} />}
              <div className="rounded-[28px] border border-white/10 bg-black/35 p-5 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.32)]">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-400">Final score</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {match.score}
                      <span className="text-zinc-400">/{match.outs}</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-400">Overs</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {innings2Summary.overs || innings1Summary.overs || "0.0"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-center text-sm text-zinc-300">
                  Toss won by <span className="font-semibold text-white">{match.tossWinner}</span>
                </p>
              </div>
            </div>
          </div>
        </MatchHeroBackdrop>

        <section className="space-y-8">
          <EnhancedScorecard
            match={match}
            innings1Summary={innings1Summary}
            innings2Summary={innings2Summary}
          />
        </section>

        <section className="space-y-4">
          <div
            className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.94),rgba(10,10,14,0.96))] shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
            onPointerDown={handleImageHoldStart}
            onPointerUp={handleImageHoldEnd}
            onPointerLeave={handleImageHoldEnd}
            onPointerCancel={handleImageHoldEnd}
            onContextMenu={(event) => event.preventDefault()}
            onClickCapture={handleImageClickCapture}
            style={{ WebkitUserSelect: "none", userSelect: "none" }}
          >
            <div className="bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))]">
              <SafeMatchImage
                src={match?.matchImageUrl || ""}
                alt={match.name || "Match cover"}
                width={1600}
                height={900}
                className="mx-auto h-auto max-h-[70vh] w-full object-contain"
                fallbackClassName="mx-auto h-auto max-h-[56vh] w-full object-contain bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))] p-10 sm:p-14"
                sizes="(max-width: 768px) 100vw, 1200px"
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
              />
            </div>
            <button
              type="button"
              aria-label="Save image"
              onPointerDown={(event) => {
                event.stopPropagation();
                clearImageHoldTimer();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleDownloadImage();
              }}
              className="absolute bottom-4 right-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/16 bg-black/45 text-white shadow-[0_14px_40px_rgba(0,0,0,0.38)] backdrop-blur-md transition hover:scale-[1.03] hover:bg-black/55"
            >
              <FaDownload className="text-base" />
            </button>
          </div>
          {removeError ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {removeError}
            </div>
          ) : null}
        </section>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white text-center pt-8 border-t border-white/10">
            Graphical Analysis
          </h2>
          <RunsPerOverChart
            innings1Summary={innings1Summary}
            innings2Summary={innings2Summary}
            team1Name={match.innings1.team}
            team2Name={match.innings2.team}
          />
        </section>

        <ResultInsightsSections match={match} />

        <PlayerStatsSection match={match} />

        <section>
          <PlayerLists match={match} />
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-white text-center pt-8 border-t border-white/10">
            Run Source Breakdown
          </h2>
          <ScoringBreakdownCharts
            innings1Summary={innings1Summary}
            innings2Summary={innings2Summary}
            team1Name={match.innings1.team}
            team2Name={match.innings2.team}
          />
        </section>

        <footer className="text-center pt-8 border-t border-white/10">
          <button
            onClick={() => router.push("/session")}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-blue-500 transition-colors font-semibold"
          >
            View All Match History
          </button>
        </footer>
      </div>
      <ImagePinModal
        isOpen={isRemoveModalOpen}
        title="Remove picture"
        subtitle="Enter the 6-digit PIN to remove this session image."
        confirmLabel="Remove picture"
        onConfirm={handleRemoveImage}
        onClose={() => setIsRemoveModalOpen(false)}
      />
      <AnimatePresence>
        {isImageActionsOpen ? (
          <ModalBase
            title="Match Image"
            onExit={() => setIsImageActionsOpen(false)}
            panelClassName="max-w-sm"
          >
            <div className="space-y-3">
              <p className="text-sm leading-6 text-zinc-400">
                Choose what you want to do with this match image.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsImageActionsOpen(false);
                  setIsReplaceModalOpen(true);
                }}
                className="w-full rounded-2xl border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(10,16,26,0.96),rgba(8,47,73,0.78))] px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:brightness-110"
              >
                {hasUploadedMatchImage ? "Replace Image" : "Add Image"}
              </button>
              {hasUploadedMatchImage ? (
              <button
                type="button"
                onClick={() => {
                  setIsImageActionsOpen(false);
                  setRemoveError("");
                  setIsRemoveModalOpen(true);
                }}
                className="w-full rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
              >
                Delete Image
              </button>
              ) : null}
            </div>
          </ModalBase>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {isReplaceModalOpen ? (
          <ModalBase
            title={
              resolveSafeMatchImage(match?.matchImageUrl || "") ===
              GV_MATCH_FALLBACK_IMAGE
                ? "Add Match Image"
                : "Replace Match Image"
            }
            onExit={() => setIsReplaceModalOpen(false)}
            panelClassName="max-w-md"
            bodyClassName="max-h-[calc(100vh-7rem)]"
          >
            <MatchImageUploader
              matchId={String(match._id)}
              existingImageUrl={match?.matchImageUrl || ""}
              onUploaded={(updatedMatch) => {
                startTransition(() => {
                  setMatch(updatedMatch);
                  setRemoveError("");
                  setIsReplaceModalOpen(false);
                });
              }}
              title={hasUploadedMatchImage ? "Replace the current image" : "Upload a match image"}
              description={
                !hasUploadedMatchImage
                  ? "Upload a match image for this game. You can press and hold the cover any time to add, save, replace, or delete it."
                  : "Upload a fresh match image. Press and hold the cover image any time to save, replace, or delete it."
              }
              primaryLabel={hasUploadedMatchImage ? "Replace Image" : "Upload Image"}
            />
          </ModalBase>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
