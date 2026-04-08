/**
 * File overview:
 * Purpose: Layout-only sections for the spectator top shell and innings grid.
 * Main exports: SessionViewTopShell, SessionViewInningsGrid.
 * Major callers: SessionViewScreen.
 * Side effects: none.
 * Read next: README.md
 */

import { FaArrowLeft, FaCheck, FaShareAlt } from "react-icons/fa";
import MatchHeroBackdrop from "../../match/MatchHeroBackdrop";
import { BallTracker } from "../../match/MatchBallHistory";
import LoadingButton from "../../shared/LoadingButton";
import LiquidSportText from "../../home/LiquidSportText";
import TeamInningsDetail from "../TeamInningsDetail";
import LiveScoreCard from "../LiveScoreCard";

export function SessionViewTopShell({
  handleBackToSessions,
  isLeavingToSessions,
  handleShare,
  copied,
  sessionName,
  match,
  trackerHistory,
}) {
  return (
    <>
      <div className="w-full max-w-4xl mt-4 mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1">
        <LoadingButton
          onClick={handleBackToSessions}
          loading={isLeavingToSessions}
          pendingLabel="Opening..."
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          aria-label="Back to Sessions"
        >
          <FaArrowLeft size={15} />
          Back
        </LoadingButton>
        <div className="flex min-w-0 items-center justify-center justify-self-center text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="truncate">Live Spectator View</span>
          </span>
        </div>
        <button
          onClick={handleShare}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center justify-self-end rounded-full border border-white/10 bg-white/4 text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          aria-label="Share Link"
        >
          {copied ? (
            <FaCheck className="text-green-500" size={18} />
          ) : (
            <FaShareAlt size={18} />
          )}
        </button>
      </div>

      <MatchHeroBackdrop match={match} className="w-full max-w-4xl mt-5 mb-2">
        <div className="px-5 py-7 sm:px-7">
          <header className="w-full text-center">
            <div>
              <LiquidSportText
                as="h1"
                text={sessionName}
                variant="hero-bright"
                simplifyMotion
                className="text-3xl font-semibold tracking-tight sm:text-[2.15rem]"
                lineClassName="leading-[0.94]"
              />
            </div>
          </header>

          <div className="mt-7 flex justify-center">
            <LiveScoreCard match={match} />
          </div>
          <div className="mt-3 flex justify-center">
            <div className="w-full max-w-xl">
              <BallTracker history={trackerHistory} />
            </div>
          </div>
        </div>
      </MatchHeroBackdrop>
    </>
  );
}

export function SessionViewInningsGrid({ inningsCards, teamBName }) {
  return (
    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
      {inningsCards.map((inningsCard) => (
        <TeamInningsDetail
          key={inningsCard.key}
          title={inningsCard.title}
          inningsData={inningsCard.inningsData}
          statusLabel={inningsCard.statusLabel}
          targetSummary={inningsCard.targetSummary}
          teamSide={
            inningsCard.title === teamBName || inningsCard.inningsData?.team === teamBName
              ? "red"
              : "blue"
          }
        />
      ))}
    </div>
  );
}
