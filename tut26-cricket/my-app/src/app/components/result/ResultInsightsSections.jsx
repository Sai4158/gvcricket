"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: ResultInsightsSections.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import {
  FaBolt,
  FaChartBar,
  FaExchangeAlt,
  FaMedal,
  FaShareAlt,
  FaStar,
  FaTrophy,
} from "react-icons/fa";
import {
  getWinningInningsSummary,
  isTiedMatchResult,
} from "../../lib/match-result-display";
import { buildResultInsights } from "../../lib/result-insights";
import { buildShareUrl } from "../../lib/site-metadata";

function SectionBackgroundCollage({ images = [] }) {
  const collageImages = images.slice(0, 4).filter((image) => image?.url);
  if (!collageImages.length) {
    return null;
  }

  if (collageImages.length === 1) {
    return (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={collageImages[0].url}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (collageImages.length === 2) {
    return (
      <div className="absolute inset-0 grid grid-cols-2">
        {collageImages.map((image) => (
          <div key={image.id || image.url} className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  if (collageImages.length === 3) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        <div className="row-span-2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={collageImages[0].url}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        {collageImages.slice(1).map((image) => (
          <div key={image.id || image.url} className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
      {collageImages.map((image) => (
        <div key={image.id || image.url} className="overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function SectionShell({
  id,
  title,
  icon,
  children,
  backgroundImages = [],
  onHold,
}) {
  const holdTimerRef = useRef(null);
  const hasBackgroundImages = backgroundImages.length > 0;

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = (event) => {
    if (!onHold || !hasBackgroundImages || event.button > 0) {
      return;
    }

    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      onHold();
    }, 420);
  };

  return (
    <section
      id={id}
      className="relative scroll-mt-24 overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/50 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)] ring-1 ring-white/6 sm:p-6"
      onPointerDown={handlePointerDown}
      onPointerUp={clearHoldTimer}
      onPointerLeave={clearHoldTimer}
      onPointerCancel={clearHoldTimer}
      onContextMenu={
        onHold && hasBackgroundImages
          ? (event) => {
              event.preventDefault();
              clearHoldTimer();
              onHold();
            }
          : undefined
      }
    >
      {hasBackgroundImages ? (
        <>
          <SectionBackgroundCollage images={backgroundImages} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,10,0.38),rgba(7,7,10,0.62)_38%,rgba(7,7,10,0.76)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_40%)]" />
        </>
      ) : null}
      <div className="relative mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-lg text-amber-300">
            {icon}
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {title}
          </h2>
        </div>
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

function StatMiniCard({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 px-4 py-4 text-center backdrop-blur-sm lg:px-5 lg:py-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-400">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-black lg:text-3xl ${tone}`}>{value}</p>
    </div>
  );
}

function PerformerCard({ label, primary, secondary, accent = "text-white" }) {
  return (
    <div className="flex min-h-[220px] w-full basis-[280px] flex-1 flex-col items-center justify-center rounded-[24px] border border-white/8 bg-[rgba(8,8,12,0.52)] p-5 text-center backdrop-blur-sm lg:min-h-[240px] lg:max-w-[360px]">
      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-bold ${accent}`}>{primary}</p>
      {secondary ? (
        <p className="mt-3 max-w-[24ch] text-sm leading-6 text-zinc-300">
          {secondary}
        </p>
      ) : null}
    </div>
  );
}

function SplitStatRow({ label, leftValue, rightValue, leftTone, rightTone }) {
  return (
    <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white">
        {label}
      </p>
      <p className={`text-center text-lg font-black sm:text-xl ${leftTone}`}>
        {leftValue}
      </p>
      <p className={`text-center text-lg font-black sm:text-xl ${rightTone}`}>
        {rightValue}
      </p>
    </div>
  );
}

function TeamCompareColumn({ teamName, stats, accentClass }) {
  const rows = [
    ["Total runs", stats.score],
    ["Wickets lost", stats.wickets],
    ["Run rate", stats.runRate],
    ["Boundaries", stats.boundaries],
    ["Extras", stats.extras],
    ["Dot balls", stats.dotBalls],
  ];

  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <h3 className={`text-xl font-bold ${accentClass}`}>{teamName}</h3>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div
            key={`${teamName}-${label}`}
            className="flex items-center justify-between gap-4 text-sm text-zinc-300"
          >
            <span>{label}</span>
            <span className="font-semibold text-white">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SplitTeamFeed({
  leftTeamName,
  leftAccentClass,
  leftItems,
  leftEmptyText,
  renderLeftItem,
  rightTeamName,
  rightAccentClass,
  rightItems,
  rightEmptyText,
  renderRightItem,
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.03]">
      <div className="grid grid-cols-2 gap-0">
        <div className="p-3 border-r border-white/8 sm:p-4">
          <div className="mb-4 flex flex-col items-center justify-center gap-2 text-center">
            <h3
              className={`text-sm font-bold uppercase tracking-[0.08em] sm:text-xl sm:normal-case ${leftAccentClass}`}
            >
              {leftTeamName}
            </h3>
            <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300 sm:px-3 sm:text-xs">
              {leftItems.length}
            </span>
          </div>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {leftItems.length ? (
              leftItems.map(renderLeftItem)
            ) : (
              <p className="text-sm text-zinc-400">{leftEmptyText}</p>
            )}
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <div className="mb-4 flex flex-col items-center justify-center gap-2 text-center">
            <h3
              className={`text-sm font-bold uppercase tracking-[0.08em] sm:text-xl sm:normal-case ${rightAccentClass}`}
            >
              {rightTeamName}
            </h3>
            <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300 sm:px-3 sm:text-xs">
              {rightItems.length}
            </span>
          </div>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {rightItems.length ? (
              rightItems.map(renderRightItem)
            ) : (
              <p className="text-sm text-zinc-400">{rightEmptyText}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getResultDetailText(resultText) {
  const safeResult = String(resultText || "").trim();
  if (isTiedMatchResult(safeResult)) {
    return "Match tied.";
  }
  const resultSuffix = safeResult.replace(/^(.*?)\s+won by\s+/i, "").trim();
  return resultSuffix ? `Won by ${resultSuffix}` : safeResult || "Match complete.";
}

function buildAwardCards(insights) {
  const cards = [
    {
      label: "Player of the match",
      primary: insights.topPerformers.playerOfMatch,
      secondary: "Unlocked by the strongest all-round match impact.",
      accent: "text-amber-300",
    },
  ];

  if (insights.topPerformers.topScorer) {
    cards.push({
      label: "Best batter",
      primary: insights.topPerformers.topScorer.name,
      secondary: `Unlocked with ${insights.topPerformers.topScorer.runs} runs.`,
      accent: "text-sky-300",
    });
  }

  if (insights.topPerformers.bestBowler) {
    cards.push({
      label: "Best bowler",
      primary: insights.topPerformers.bestBowler.name,
      secondary: `Unlocked with ${insights.topPerformers.bestBowler.wickets} wickets at econ ${insights.topPerformers.bestBowler.economy}.`,
      accent: "text-emerald-300",
    });
  }

  if (insights.topPerformers.bestStrikeRate) {
    cards.push({
      label: "Fastest scorer",
      primary: insights.topPerformers.bestStrikeRate.name,
      secondary: `Unlocked with a strike rate of ${insights.topPerformers.bestStrikeRate.strikeRate}.`,
      accent: "text-rose-300",
    });
  }

  if (insights.topPerformers.bestEconomy) {
    cards.push({
      label: "Most economical",
      primary: insights.topPerformers.bestEconomy.name,
      secondary: `Unlocked with economy ${insights.topPerformers.bestEconomy.economy}.`,
      accent: "text-violet-300",
    });
  }

  const boundaryLeader =
    insights.innings1.boundaries >= insights.innings2.boundaries
      ? insights.innings1
      : insights.innings2;
  cards.push({
    label: "Boundary pressure",
    primary: boundaryLeader.team || "Innings leader",
    secondary: `Unlocked with ${boundaryLeader.boundaries} boundaries.`,
    accent: "text-fuchsia-300",
  });

  const dotBallLeader =
    insights.innings1.dotBalls >= insights.innings2.dotBalls
      ? insights.innings1
      : insights.innings2;
  cards.push({
    label: "Dot-ball squeeze",
    primary: dotBallLeader.team || "Innings leader",
    secondary: `Unlocked with ${dotBallLeader.dotBalls} dot balls.`,
    accent: "text-cyan-300",
  });

  return cards;
}

function getSectionBackgroundImages(match) {
  const galleryImages = Array.isArray(match?.matchImages)
    ? match.matchImages.filter((image) => image?.url)
    : [];

  if (galleryImages.length) {
    return galleryImages;
  }

  const fallbackUrl = String(match?.matchImageUrl || "").trim();
  return fallbackUrl ? [{ id: "cover", url: fallbackUrl }] : [];
}

function getTeamColorClasses(teamName, insights) {
  if (teamName === insights?.teamA?.name) {
    return {
      text: "text-sky-300",
      badge: "bg-sky-500/12 text-sky-200",
    };
  }

  if (teamName === insights?.teamB?.name) {
    return {
      text: "text-rose-300",
      badge: "bg-rose-500/12 text-rose-200",
    };
  }

  return {
    text: "text-zinc-200",
    badge: "bg-white/[0.08] text-zinc-200",
  };
}

export default function ResultInsightsSections({ match, onSectionImageHold }) {
  const [shareStatus, setShareStatus] = useState("");
  const insights = useMemo(() => buildResultInsights(match), [match]);
  const sectionBackgroundImages = useMemo(
    () => getSectionBackgroundImages(match),
    [match],
  );
  const shareCardImageUrl = String(
    match?.matchImages?.[0]?.url || match?.matchImageUrl || "",
  ).trim();
  const winningSummary = useMemo(() => getWinningInningsSummary(match), [match]);
  const resultDetailText = getResultDetailText(match?.result);
  const innings1Colors = getTeamColorClasses(insights.innings1.team, insights);
  const innings2Colors = getTeamColorClasses(insights.innings2.team, insights);

  const handleCopyLink = async () => {
    const shareUrl = buildShareUrl(
      `/result/${match?._id || ""}`,
      window.location.origin,
    );

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Match link copied.");
    } catch {
      setShareStatus("Could not copy the link.");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${insights.teamA.name} vs ${insights.teamB.name}`,
          text: match?.result || "GV Cricket result",
          url: buildShareUrl(
            `/result/${match?._id || ""}`,
            window.location.origin,
          ),
        });
        setShareStatus("");
        return;
      } catch {
        // fall through to copy
      }
    }

    await handleCopyLink();
  };

  const topPerformerCards = [
    insights.topPerformers.topScorer
      ? {
          label: "Top scorer",
          primary: insights.topPerformers.topScorer.name,
          secondary: `${insights.topPerformers.topScorer.runs} runs scored in the match.`,
          accent: "text-amber-300",
        }
      : null,
    insights.topPerformers.bestBowler
      ? {
          label: "Best bowler",
          primary: insights.topPerformers.bestBowler.name,
          secondary: `${insights.topPerformers.bestBowler.wickets} wickets with controlled bowling.`,
          accent: "text-sky-300",
        }
      : null,
    insights.topPerformers.bestStrikeRate
      ? {
          label: "Best strike rate",
          primary: insights.topPerformers.bestStrikeRate.name,
          secondary: `Strike rate ${insights.topPerformers.bestStrikeRate.strikeRate}.`,
          accent: "text-emerald-300",
        }
      : null,
    insights.topPerformers.bestEconomy
      ? {
          label: "Best economy",
          primary: insights.topPerformers.bestEconomy.name,
          secondary: `Economy ${insights.topPerformers.bestEconomy.economy}.`,
          accent: "text-violet-300",
        }
      : null,
    {
      label: "Player of the match",
      primary: insights.topPerformers.playerOfMatch,
      secondary:
        insights.tracked
          ? "Strongest impact across batting and bowling."
          : "Chosen from the final score and match result.",
      accent: "text-rose-300",
    },
  ].filter(Boolean);
  const matchAwardCards = useMemo(() => buildAwardCards(insights), [insights]);

  return (
    <div className="space-y-8">
      <SectionShell
        title="Top Performers"
        icon={<FaStar />}
        backgroundImages={sectionBackgroundImages}
        onHold={onSectionImageHold}
      >
        <div className="flex flex-wrap justify-center gap-4">
          {topPerformerCards.map((card) => (
            <PerformerCard
              key={card.label}
              label={card.label}
              primary={card.primary}
              secondary={card.secondary}
              accent={card.accent}
            />
          ))}
        </div>
      </SectionShell>

      <SectionShell title="Team Comparison" icon={<FaExchangeAlt />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TeamCompareColumn
            teamName={insights.teamA.name}
            stats={
              match?.innings1?.team === insights.teamA.name
                ? insights.innings1
                : insights.innings2
            }
            accentClass="text-sky-300"
          />
          <TeamCompareColumn
            teamName={insights.teamB.name}
            stats={
              match?.innings1?.team === insights.teamB.name
                ? insights.innings1
                : insights.innings2
            }
            accentClass="text-rose-300"
          />
        </div>
      </SectionShell>

      <SectionShell title="Over Summary" icon={<FaChartBar />}>
        <SplitTeamFeed
          leftTeamName={insights.innings1.team || "Innings 1"}
          leftAccentClass={innings1Colors.text}
          leftItems={insights.innings1.overSummaries}
          leftEmptyText="No over summary available."
          renderLeftItem={(over, index) => (
            <div
              key={`innings1-over-${over.over}-${index}`}
              className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
            >
              <p className="text-sm font-bold text-white">{over.label}</p>
              <p className="mt-2 text-sm text-zinc-300">{over.summary}</p>
            </div>
          )}
          rightTeamName={insights.innings2.team || "Innings 2"}
          rightAccentClass={innings2Colors.text}
          rightItems={insights.innings2.overSummaries}
          rightEmptyText="No over summary available."
          renderRightItem={(over, index) => (
            <div
              key={`innings2-over-${over.over}-${index}`}
              className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
            >
              <p className="text-sm font-bold text-white">{over.label}</p>
              <p className="mt-2 text-sm text-zinc-300">{over.summary}</p>
            </div>
          )}
        />
      </SectionShell>

      {insights.innings1.wicketTimeline.length ||
      insights.innings2.wicketTimeline.length ? (
        <SectionShell title="Wicket Timeline" icon={<FaBolt />}>
          <SplitTeamFeed
            leftTeamName={insights.innings1.team || "Innings 1"}
            leftAccentClass={innings1Colors.text}
            leftItems={insights.innings1.wicketTimeline}
            leftEmptyText="No wickets fell."
            renderLeftItem={(wicket, index) => (
              <div
                key={`innings1-wicket-${wicket.overBall}-${index}`}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-center"
              >
                <p className="text-sm font-semibold leading-5 text-white">
                  {wicket.detail}
                </p>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${innings1Colors.badge}`}>
                  {wicket.overBall}
                </span>
              </div>
            )}
            rightTeamName={insights.innings2.team || "Innings 2"}
            rightAccentClass={innings2Colors.text}
            rightItems={insights.innings2.wicketTimeline}
            rightEmptyText="No wickets fell."
            renderRightItem={(wicket, index) => (
              <div
                key={`innings2-wicket-${wicket.overBall}-${index}`}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-center"
              >
                <p className="text-sm font-semibold leading-5 text-white">
                  {wicket.detail}
                </p>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${innings2Colors.badge}`}>
                  {wicket.overBall}
                </span>
              </div>
            )}
          />
        </SectionShell>
      ) : null}

      <SectionShell title="Boundary and Extras Breakdown" icon={<FaBolt />}>
        <div className="overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.03]">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-white/8 px-4 py-3">
            <span className="text-[11px] uppercase tracking-[0.24em] text-white">
              Type
            </span>
            <span className={`text-center text-[11px] font-semibold uppercase tracking-[0.18em] ${innings1Colors.text}`}>
              {insights.innings1.team || "Innings 1"}
            </span>
            <span className={`text-center text-[11px] font-semibold uppercase tracking-[0.18em] ${innings2Colors.text}`}>
              {insights.innings2.team || "Innings 2"}
            </span>
          </div>
          <div className="space-y-3 p-4">
            <SplitStatRow
              label="Fours"
              leftValue={insights.innings1.fours}
              rightValue={insights.innings2.fours}
              leftTone={innings1Colors.text}
              rightTone={innings2Colors.text}
            />
            <SplitStatRow
              label="Sixes"
              leftValue={insights.innings1.sixes}
              rightValue={insights.innings2.sixes}
              leftTone={innings1Colors.text}
              rightTone={innings2Colors.text}
            />
            <SplitStatRow
              label="Wides"
              leftValue={insights.innings1.wideRuns}
              rightValue={insights.innings2.wideRuns}
              leftTone="text-amber-300"
              rightTone="text-amber-300"
            />
            <SplitStatRow
              label="No Balls"
              leftValue={insights.innings1.noBallRuns}
              rightValue={insights.innings2.noBallRuns}
              leftTone="text-amber-300"
              rightTone="text-amber-300"
            />
            <SplitStatRow
              label="Other Extras"
              leftValue={insights.innings1.otherExtras}
              rightValue={insights.innings2.otherExtras}
              leftTone="text-emerald-300"
              rightTone="text-emerald-300"
            />
            <SplitStatRow
              label="Dot Balls"
              leftValue={insights.innings1.dotBalls}
              rightValue={insights.innings2.dotBalls}
              leftTone="text-emerald-300"
              rightTone="text-emerald-300"
            />
          </div>
        </div>
      </SectionShell>

      <SectionShell
        title="Match Awards"
        icon={<FaMedal />}
        backgroundImages={sectionBackgroundImages}
        onHold={onSectionImageHold}
      >
        <div className="flex flex-wrap justify-center gap-4">
          {matchAwardCards.map((card) => (
            <PerformerCard
              key={card.label}
              label={card.label}
              primary={card.primary}
              secondary={card.secondary}
              accent={card.accent}
            />
          ))}
        </div>
      </SectionShell>

      <SectionShell title="Winning Moment / Turning Point" icon={<FaTrophy />}>
        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.02))] p-5 text-center">
          <p className="mx-auto max-w-[48rem] text-xl font-bold leading-8 text-white">
            {insights.turningPoint}
          </p>
        </div>
      </SectionShell>

      <SectionShell
        id="result-share-actions"
        title="Share Results"
        icon={<FaShareAlt />}
      >
        <div className="mx-auto max-w-[56rem] space-y-4">
          <div className="relative min-h-[280px] overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] lg:min-h-[360px]">
            {shareCardImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shareCardImageUrl}
                  alt={`${insights.teamA.name} vs ${insights.teamB.name}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,12,0.28),rgba(6,8,12,0.62)_38%,rgba(6,8,12,0.9)_100%)]" />
              </>
            ) : null}
            <div className="relative flex min-h-[280px] flex-col justify-between p-5 lg:min-h-[360px] lg:p-7">
              {!shareCardImageUrl ? (
                <div className="flex justify-center">
                  <Image
                    src="/gvLogo.png"
                    alt="GV Cricket logo"
                    width={168}
                    height={168}
                    unoptimized
                    className="h-auto w-28 object-contain sm:w-36"
                  />
                </div>
              ) : null}
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/88">
                Share Card
              </p>
              <h3 className="mt-3 text-4xl font-black text-white lg:text-5xl">
                {insights.teamA.name} vs {insights.teamB.name}
              </h3>
              <p className="mt-3 max-w-[34rem] text-xl font-semibold leading-8 text-white lg:text-2xl">
                {resultDetailText}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 lg:gap-4">
                <StatMiniCard
                  label="Winning score"
                  value={winningSummary?.scoreline || `${match?.score || 0}/${match?.outs || 0}`}
                  tone="text-white"
                />
                <StatMiniCard
                  label="Player of the match"
                  value={insights.awards.playerOfMatch}
                  tone="text-amber-300"
                />
              </div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-col items-center space-y-3">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-4 text-lg font-semibold text-white transition hover:bg-white/[0.08]"
            >
              <FaShareAlt />
              <span>Share result</span>
            </button>
            {shareStatus ? (
              <div className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-300">
                {shareStatus}
              </div>
            ) : null}
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
