"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  FaBolt,
  FaChartBar,
  FaClipboard,
  FaDownload,
  FaExchangeAlt,
  FaMedal,
  FaShareAlt,
  FaStar,
  FaTrophy,
} from "react-icons/fa";
import { buildResultInsights } from "../../lib/result-insights";

function SectionShell({ title, icon, children }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-zinc-900/50 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)] ring-1 ring-white/6 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-lg text-amber-300">
          {icon}
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatMiniCard({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className={`mt-2 text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function PerformerCard({ label, primary, secondary, accent = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className={`mt-3 text-xl font-bold ${accent}`}>{primary}</p>
      {secondary ? <p className="mt-2 text-sm text-zinc-400">{secondary}</p> : null}
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

export default function ResultInsightsSections({ match }) {
  const [shareStatus, setShareStatus] = useState("");
  const exportRef = useRef(null);
  const insights = useMemo(() => buildResultInsights(match), [match]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
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
          url: window.location.href,
        });
        setShareStatus("");
        return;
      } catch {
        // fall through to copy
      }
    }

    await handleCopyLink();
  };

  const handleDownloadImage = async () => {
    if (!exportRef.current) return;

    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#09090b",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${match?.name || "gv-cricket-result"}.png`;
      link.click();
      setShareStatus("");
    } catch {
      setShareStatus("Could not download the result image.");
    }
  };

  const allTimeline = [
    ...insights.innings1.ballTimeline.map((ball) => ({
      ...ball,
      inningsLabel: insights.innings1.team || "Innings 1",
    })),
    ...insights.innings2.ballTimeline.map((ball) => ({
      ...ball,
      inningsLabel: insights.innings2.team || "Innings 2",
    })),
  ];

  const allOverSummaries = [
    ...insights.innings1.overSummaries.map((over) => ({
      ...over,
      inningsLabel: insights.innings1.team || "Innings 1",
    })),
    ...insights.innings2.overSummaries.map((over) => ({
      ...over,
      inningsLabel: insights.innings2.team || "Innings 2",
    })),
  ];

  const allWickets = [
    ...insights.innings1.wicketTimeline.map((wicket) => ({
      ...wicket,
      inningsLabel: insights.innings1.team || "Innings 1",
    })),
    ...insights.innings2.wicketTimeline.map((wicket) => ({
      ...wicket,
      inningsLabel: insights.innings2.team || "Innings 2",
    })),
  ];

  return (
    <div className="space-y-8">
      <SectionShell title="Top Performers" icon={<FaStar />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <PerformerCard
            label="Top scorer"
            primary={insights.topPerformers.topScorer?.name || "Quick mode"}
            secondary={
              insights.topPerformers.topScorer
                ? `${insights.topPerformers.topScorer.runs} runs`
                : "Player stats not fully tracked."
            }
            accent="text-amber-300"
          />
          <PerformerCard
            label="Best bowler"
            primary={insights.topPerformers.bestBowler?.name || "Quick mode"}
            secondary={
              insights.topPerformers.bestBowler
                ? `${insights.topPerformers.bestBowler.wickets} wickets`
                : "Bowling figures not fully tracked."
            }
            accent="text-sky-300"
          />
          <PerformerCard
            label="Best strike rate"
            primary={insights.topPerformers.bestStrikeRate?.name || "Quick mode"}
            secondary={
              insights.topPerformers.bestStrikeRate
                ? `SR ${insights.topPerformers.bestStrikeRate.strikeRate}`
                : "Strike rate not available."
            }
            accent="text-emerald-300"
          />
          <PerformerCard
            label="Best economy"
            primary={insights.topPerformers.bestEconomy?.name || "Quick mode"}
            secondary={
              insights.topPerformers.bestEconomy
                ? `Econ ${insights.topPerformers.bestEconomy.economy}`
                : "Economy not available."
            }
            accent="text-violet-300"
          />
          <PerformerCard
            label="Player of the match"
            primary={insights.topPerformers.playerOfMatch}
            secondary={match?.result || "Key impact across the match."}
            accent="text-rose-300"
          />
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
        <div className="grid gap-3 md:grid-cols-2">
          {allOverSummaries.length ? (
            allOverSummaries.map((over) => (
              <div
                key={`${over.inningsLabel}-${over.over}`}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-bold text-white">
                    {over.label}
                  </p>
                  <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
                    {over.inningsLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{over.summary}</p>
              </div>
            ))
          ) : (
            <p className="text-zinc-400">No over summary available.</p>
          )}
        </div>
      </SectionShell>

      {allWickets.length ? (
        <SectionShell title="Wicket Timeline" icon={<FaBolt />}>
          <div className="space-y-3">
            {allWickets.map((wicket) => (
              <div
                key={`${wicket.inningsLabel}-${wicket.overBall}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{wicket.detail}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-zinc-500">
                    {wicket.inningsLabel}
                  </p>
                </div>
                <span className="rounded-full bg-rose-500/12 px-3 py-1 text-sm font-semibold text-rose-200">
                  {wicket.overBall}
                </span>
              </div>
            ))}
          </div>
        </SectionShell>
      ) : null}

      <SectionShell title="Boundary and Extras Breakdown" icon={<FaBolt />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatMiniCard
            label={`${insights.innings1.team} 4s / 6s`}
            value={`${insights.innings1.fours} / ${insights.innings1.sixes}`}
            tone="text-sky-300"
          />
          <StatMiniCard
            label={`${insights.innings2.team} 4s / 6s`}
            value={`${insights.innings2.fours} / ${insights.innings2.sixes}`}
            tone="text-rose-300"
          />
          <StatMiniCard
            label="Wide / No ball"
            value={`${insights.innings1.wideRuns + insights.innings2.wideRuns} / ${insights.innings1.noBallRuns + insights.innings2.noBallRuns}`}
            tone="text-amber-300"
          />
          <StatMiniCard
            label="Other extras / dots"
            value={`${insights.innings1.otherExtras + insights.innings2.otherExtras} / ${insights.innings1.dotBalls + insights.innings2.dotBalls}`}
            tone="text-emerald-300"
          />
        </div>
      </SectionShell>

      <SectionShell title="Match Awards" icon={<FaMedal />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PerformerCard
            label="Player of the match"
            primary={insights.awards.playerOfMatch}
            secondary={match?.result || ""}
            accent="text-amber-300"
          />
          <PerformerCard
            label="Best batter"
            primary={insights.awards.bestBatter}
            secondary={
              insights.topPerformers.topScorer
                ? `${insights.topPerformers.topScorer.runs} runs`
                : "Quick scoring mode"
            }
            accent="text-sky-300"
          />
          <PerformerCard
            label="Best bowler"
            primary={insights.awards.bestBowler}
            secondary={
              insights.topPerformers.bestBowler
                ? `${insights.topPerformers.bestBowler.wickets} wickets`
                : "Quick scoring mode"
            }
            accent="text-emerald-300"
          />
          <PerformerCard
            label="Best moment"
            primary={insights.awards.bestMoment}
            secondary="Match-defining highlight"
            accent="text-rose-300"
          />
        </div>
      </SectionShell>

      <SectionShell title="Winning Moment / Turning Point" icon={<FaTrophy />}>
        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.02))] p-5">
          <p className="text-xl font-bold text-white">{insights.turningPoint}</p>
        </div>
      </SectionShell>

      <SectionShell title="Share / Export Actions" icon={<FaShareAlt />}>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div
            ref={exportRef}
            className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] p-5"
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/85">
              Share Card
            </p>
            <h3 className="mt-3 text-3xl font-black text-white">
              {insights.teamA.name} vs {insights.teamB.name}
            </h3>
            <p className="mt-2 text-lg text-zinc-300">{match?.result || "Match complete"}</p>
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

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3.5 font-semibold text-white transition hover:bg-white/[0.08]"
            >
              <FaShareAlt />
              <span>Share result</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3.5 font-semibold text-white transition hover:bg-white/[0.08]"
            >
              <FaClipboard />
              <span>Copy match link</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadImage}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(90deg,#facc15_0%,#f59e0b_54%,#fb7185_100%)] px-4 py-3.5 font-semibold text-black shadow-[0_16px_36px_rgba(245,158,11,0.18)] transition hover:brightness-105"
            >
              <FaDownload />
              <span>Download result image</span>
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
