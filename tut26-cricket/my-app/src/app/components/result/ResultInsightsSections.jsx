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
  FaClipboard,
  FaExchangeAlt,
  FaMedal,
  FaShareAlt,
  FaStar,
  FaTrophy,
} from "react-icons/fa";
import { buildResultInsights } from "../../lib/result-insights";
import { buildShareUrl } from "../../lib/site-metadata";

function SectionShell({ id, title, icon, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-[28px] border border-white/10 bg-zinc-900/50 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)] ring-1 ring-white/6 sm:p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-lg text-amber-300">
          {icon}
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function StatMiniCard({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function PerformerCard({ label, primary, secondary, accent = "text-white" }) {
  return (
    <div className="flex min-h-[220px] w-full max-w-[320px] flex-col items-center justify-center rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-center">
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

export default function ResultInsightsSections({ match }) {
  const [shareStatus, setShareStatus] = useState("");
  const insights = useMemo(() => buildResultInsights(match), [match]);
  const statsFallback =
    "Detailed player stats were not recorded for this match.";
  const shareCardImageUrl = String(
    match?.matchImages?.[0]?.url || match?.matchImageUrl || "",
  ).trim();

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

  const handleCopyResultSectionLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.hash = "result-share-actions";
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Result section link copied.");
    } catch {
      setShareStatus("Could not copy the result section link.");
    }
  };

  const topPerformerCards = [
    insights.topPerformers.topScorer
      ? {
          label: "Top scorer",
          primary: insights.topPerformers.topScorer.name,
          secondary: `${insights.topPerformers.topScorer.runs} runs`,
          accent: "text-amber-300",
        }
      : null,
    insights.topPerformers.bestBowler
      ? {
          label: "Best bowler",
          primary: insights.topPerformers.bestBowler.name,
          secondary: `${insights.topPerformers.bestBowler.wickets} wickets`,
          accent: "text-sky-300",
        }
      : null,
    insights.topPerformers.bestStrikeRate
      ? {
          label: "Best strike rate",
          primary: insights.topPerformers.bestStrikeRate.name,
          secondary: `SR ${insights.topPerformers.bestStrikeRate.strikeRate}`,
          accent: "text-emerald-300",
        }
      : null,
    insights.topPerformers.bestEconomy
      ? {
          label: "Best economy",
          primary: insights.topPerformers.bestEconomy.name,
          secondary: `Econ ${insights.topPerformers.bestEconomy.economy}`,
          accent: "text-violet-300",
        }
      : null,
    {
      label: "Player of the match",
      primary: insights.topPerformers.playerOfMatch,
      secondary:
        match?.result
          ? `${match.result} Final result standout.`
          : 
        (insights.tracked
          ? "Key impact across the match."
          : "Picked from the final result."),
      accent: "text-rose-300",
    },
  ].filter(Boolean);
  const matchAwardCards = [
    {
      label: "Player of the match",
      primary: insights.awards.playerOfMatch,
      secondary: match?.result || "",
      accent: "text-amber-300",
    },
    insights.topPerformers.topScorer
      ? {
          label: "Best batter",
          primary: insights.awards.bestBatter,
          secondary: `${insights.topPerformers.topScorer.runs} runs`,
          accent: "text-sky-300",
        }
      : null,
    insights.topPerformers.bestBowler
      ? {
          label: "Best bowler",
          primary: insights.awards.bestBowler,
          secondary: `${insights.topPerformers.bestBowler.wickets} wickets`,
          accent: "text-emerald-300",
        }
      : null,
    {
      label: "Best moment",
      primary: insights.awards.bestMoment,
      secondary: "Match-defining highlight",
      accent: "text-rose-300",
    },
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <SectionShell title="Top Performers" icon={<FaStar />}>
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
          leftAccentClass="text-sky-300"
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
          rightAccentClass="text-rose-300"
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
            leftAccentClass="text-sky-300"
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
                <span className="rounded-full bg-sky-500/12 px-3 py-1 text-sm font-semibold text-sky-200">
                  {wicket.overBall}
                </span>
              </div>
            )}
            rightTeamName={insights.innings2.team || "Innings 2"}
            rightAccentClass="text-rose-300"
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
                <span className="rounded-full bg-rose-500/12 px-3 py-1 text-sm font-semibold text-rose-200">
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
            <span className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
              {insights.innings1.team || "Innings 1"}
            </span>
            <span className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">
              {insights.innings2.team || "Innings 2"}
            </span>
          </div>
          <div className="space-y-3 p-4">
            <SplitStatRow
              label="Fours"
              leftValue={insights.innings1.fours}
              rightValue={insights.innings2.fours}
              leftTone="text-sky-300"
              rightTone="text-rose-300"
            />
            <SplitStatRow
              label="Sixes"
              leftValue={insights.innings1.sixes}
              rightValue={insights.innings2.sixes}
              leftTone="text-sky-300"
              rightTone="text-rose-300"
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

      <SectionShell title="Match Awards" icon={<FaMedal />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.02))] p-5">
          <p className="text-xl font-bold text-white">
            {insights.turningPoint}
          </p>
        </div>
      </SectionShell>

      <SectionShell
        id="result-share-actions"
        title="Share Results"
        icon={<FaShareAlt />}
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))]">
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
            <div className="relative p-5">
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
              <h3 className="mt-3 text-3xl font-black text-white">
                {insights.teamA.name} vs {insights.teamB.name}
              </h3>
              <p className="mt-2 text-lg font-semibold text-white">
                {match?.result || "Match complete"}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatMiniCard
                  label="Final score"
                  value={`${match?.score || 0}/${match?.outs || 0}`}
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

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3.5 font-semibold text-white transition hover:bg-white/[0.08]"
            >
              <FaShareAlt />
              <span>Share result</span>
            </button>
            {shareStatus ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                {shareStatus}
              </div>
            ) : null}
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
