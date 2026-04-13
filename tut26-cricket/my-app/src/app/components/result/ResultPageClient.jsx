"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: ResultPageClient.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import dynamic from "next/dynamic";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { FaArrowLeft } from "react-icons/fa";
import useEventSource from "../live/useEventSource";
import LiquidSportText from "../home/LiquidSportText";
import MatchHeroBackdrop from "../match/MatchHeroBackdrop";
import MatchImageUploader from "../match/MatchImageUploader";
import { ModalBase } from "../match/MatchBaseModals";
import SafeMatchImage from "../shared/SafeMatchImage";
import MatchImageCarousel from "../shared/MatchImageCarousel";
import LoadingButton from "../shared/LoadingButton";
import { useRouteFeedback } from "../shared/RouteFeedbackProvider";
import { calculateInningsSummary } from "../../lib/match-stats";
import { getWinningInningsSummary } from "../../lib/match-result-display";
import CongratulationsCard from "./CongratulationsCard";
import EnhancedScorecard from "./EnhancedScorecard";
import PlayerLists from "./PlayerLists";
import ResultInsightsSections from "./ResultInsightsSections";
import PlayerStatsSection from "./PlayerStatsSection";
import SiteFooter from "../shared/SiteFooter";

const RunsPerOverChart = dynamic(() => import("./RunsPerOverChart"), {
  ssr: false,
});
const ScoringBreakdownCharts = dynamic(() => import("./ScoringBreakdownCharts"), {
  ssr: false,
});

export default function ResultPageClient({ matchId, initialMatch }) {
  const router = useRouter();
  const { startNavigation } = useRouteFeedback();
  const [match, setMatch] = useState(initialMatch);
  const [streamError, setStreamError] = useState("");
  const [isImageManagerOpen, setIsImageManagerOpen] = useState(false);
  const [isLeavingToSessions, setIsLeavingToSessions] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const [activeGalleryImageId, setActiveGalleryImageId] = useState("");
  const [zoomedImage, setZoomedImage] = useState(null);
  const lastStreamUpdateRef = useRef(initialMatch?.updatedAt || "");

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

  useEventSource({
    url: matchId ? `/api/live/matches/${matchId}?history=0` : null,
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

  const matchImages = Array.isArray(match?.matchImages) ? match.matchImages : [];
  const hasGalleryImages = matchImages.length > 0;
  const activeGalleryImage =
    matchImages.find((image) => image.id === activeGalleryImageId) ||
    matchImages[0] ||
    null;

  if (streamError) {
    return (
      <main id="top" className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-red-400">{streamError}</div>
      </main>
    );
  }

  if (!match) {
    return (
      <main id="top" className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-lg font-medium">Loading Match Results...</div>
      </main>
    );
  }

  const innings1Summary = calculateInningsSummary(match.innings1);
  const innings2Summary = calculateInningsSummary(match.innings2);
  const winningInningsSummary = getWinningInningsSummary(match);

  const handleOpenSessions = () => {
    setIsLeavingToSessions(true);
    startNavigation("Opening sessions...");
    router.push(`/session?refresh=${Date.now()}`);
  };

  const gallerySection = (
    <section id="match-image" className="scroll-mt-24 space-y-4">
      <div
        className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.94),rgba(10,10,14,0.96))] shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
        onContextMenu={(event) => event.preventDefault()}
        style={{ WebkitUserSelect: "none", userSelect: "none" }}
      >
        <MatchImageCarousel
          images={matchImages.length ? matchImages : [{ id: "fallback", url: "" }]}
          alt={match.name || "Match cover"}
          showFallback
          imageClassName="object-contain object-center bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))]"
          fallbackClassName="object-contain object-center bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))] p-10 sm:p-14"
          className="bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))]"
          onActiveImageChange={(image) => {
            setActiveGalleryImageId(image?.url ? image.id || "" : "");
          }}
          onImageTap={(image) => {
            setZoomedImage(image || null);
          }}
          onImageHold={(image, _index, event) => {
            event.preventDefault();
            event.stopPropagation();
            setActiveGalleryImageId(image?.url ? image.id || "" : "");
            setIsImageManagerOpen(true);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          {matchImages.length
            ? `${matchImages.length} image${matchImages.length === 1 ? "" : "s"} in gallery`
            : "No gallery yet"}
        </p>
        <button
          type="button"
          onClick={() => setIsImageManagerOpen(true)}
          className="rounded-full border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(10,16,26,0.96),rgba(8,47,73,0.78))] px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:brightness-110"
        >
          Manage Images
        </button>
      </div>
    </section>
  );

  return (
    <main id="top" className="min-h-screen bg-zinc-950 p-4 sm:p-8 text-zinc-300 font-sans">
      <div className="max-w-5xl mx-auto space-y-12 py-10">
        <div className="flex justify-start">
          <LoadingButton
            onClick={handleOpenSessions}
            loading={isLeavingToSessions}
            pendingLabel="Opening..."
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-zinc-100 backdrop-blur-sm transition-colors hover:bg-black/45"
          >
            <FaArrowLeft />
            Back to Sessions
          </LoadingButton>
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
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-400">Winning score</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {winningInningsSummary
                        ? winningInningsSummary.score
                        : match.score}
                      <span className="text-zinc-400">
                        /
                        {winningInningsSummary
                          ? winningInningsSummary.wickets
                          : match.outs}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-400">Overs</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {winningInningsSummary?.overs ||
                        innings2Summary.overs ||
                        innings1Summary.overs ||
                        "0.0"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-center">
                  {winningInningsSummary?.teamName ? (
                    <p className="text-sm text-zinc-300">
                      Winning team{" "}
                      <span className="font-semibold text-white">
                        {winningInningsSummary.teamName}
                      </span>
                    </p>
                  ) : null}
                  {match.tossWinner ? (
                    <p className="text-sm text-zinc-400">
                      Toss won by{" "}
                      <span className="font-semibold text-white">
                        {match.tossWinner}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </MatchHeroBackdrop>

        {hasGalleryImages ? gallerySection : null}

        <section className="space-y-8">
          <EnhancedScorecard
            match={match}
            innings1Summary={innings1Summary}
            innings2Summary={innings2Summary}
          />
        </section>

        {!hasGalleryImages ? gallerySection : null}

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

      </div>
      <SiteFooter
        action={
          <LoadingButton
            onClick={handleOpenSessions}
            loading={isLeavingToSessions}
            pendingLabel="Opening..."
            className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-blue-500 transition-colors font-semibold"
          >
            View All Match History
          </LoadingButton>
        }
      />
      <AnimatePresence>
        {isImageManagerOpen ? (
          <ModalBase
            onExit={undefined}
            hideHeader
            panelClassName="max-w-md"
            bodyClassName="max-h-[calc(100vh-7rem)]"
          >
            <MatchImageUploader
              matchId={String(match._id)}
              existingImages={matchImages}
              existingImageUrl={activeGalleryImage?.url || match?.matchImageUrl || ""}
              existingImageCount={matchImages.length || (match?.matchImageUrl ? 1 : 0)}
              targetImageId={activeGalleryImage?.id || ""}
              appendOnUpload={matchImages.length > 0 || Boolean(match?.matchImageUrl)}
              onUploaded={(updatedMatch) => {
                startTransition(() => {
                  setMatch(updatedMatch);
                });
              }}
              onComplete={() => {
                setIsImageManagerOpen(false);
              }}
              onRequestClose={() => setIsImageManagerOpen(false)}
              promptForUploadPin
              title="Match Images"
              description="Manage the result gallery."
              primaryLabel="Save Images"
            />
          </ModalBase>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {zoomedImage?.url ? (
          <ModalBase
            title=""
            onExit={() => setZoomedImage(null)}
            panelClassName="max-w-5xl bg-black/95"
            bodyClassName="max-h-[calc(100vh-4rem)] p-0"
          >
            <div className="overflow-hidden rounded-[24px] bg-black">
              <SafeMatchImage
                src={zoomedImage.url}
                alt={match.name || "Match image"}
                width={2000}
                height={1400}
                className="mx-auto h-auto max-h-[82vh] w-full object-contain"
                fallbackClassName="mx-auto h-auto max-h-[82vh] w-full object-contain bg-black p-10"
                sizes="100vw"
              />
            </div>
          </ModalBase>
        ) : null}
      </AnimatePresence>
    </main>
  );
}


