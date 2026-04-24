"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: ResultMomentumChart.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildResultInsights } from "../../lib/result-insights";
import CustomTooltip from "./CustomTooltip";
import useChartWidth from "./useChartWidth";

function toDisplayNumber(value) {
  const numericValue = Number(value || 0);
  return Number.isInteger(numericValue)
    ? numericValue
    : Number(numericValue.toFixed(2));
}

export default function ResultMomentumChart({ match }) {
  const [containerRef, width] = useChartWidth();
  const insights = useMemo(() => buildResultInsights(match), [match]);
  const isCompact = width > 0 && width < 430;
  const team1Name = insights.innings1.team || "Innings 1";
  const team2Name = insights.innings2.team || "Innings 2";
  const metricLabelMap = {
    Runs: "Runs",
    "Run rate": isCompact ? "Rate" : "Run rate",
    Boundaries: isCompact ? "Bounds" : "Boundaries",
    Extras: "Extras",
    "Dot balls": isCompact ? "Dots" : "Dot balls",
  };
  const chartData = [
    {
      metric: "Runs",
      [team1Name]: insights.innings1.score,
      [team2Name]: insights.innings2.score,
    },
    {
      metric: "Run rate",
      [team1Name]: toDisplayNumber(insights.innings1.runRate),
      [team2Name]: toDisplayNumber(insights.innings2.runRate),
    },
    {
      metric: "Boundaries",
      [team1Name]: insights.innings1.boundaries,
      [team2Name]: insights.innings2.boundaries,
    },
    {
      metric: "Extras",
      [team1Name]: insights.innings1.extras,
      [team2Name]: insights.innings2.extras,
    },
    {
      metric: "Dot balls",
      [team1Name]: insights.innings1.dotBalls,
      [team2Name]: insights.innings2.dotBalls,
    },
  ];

  return (
    <div className="rounded-[28px] border border-white/10 bg-zinc-900/50 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)] ring-1 ring-white/6">
      <div className="mx-auto max-w-[34rem] text-center">
        <h2 className="text-2xl font-bold text-white lg:text-3xl">
          Match Snapshot
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400 lg:text-base">
          This chart compares runs, run rate, boundaries, extras, and dot balls for both teams.
        </p>
      </div>
      <div ref={containerRef} className="mt-6 h-[360px] w-full min-w-0 lg:h-[420px]">
        {width > 0 ? (
          <BarChart
            width={width}
            height={width >= 1024 ? 420 : 360}
            data={chartData}
            margin={{ top: 12, right: 18, left: 0, bottom: 18 }}
            barCategoryGap={width >= 1024 ? 26 : 18}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="metric"
              stroke="#a1a1aa"
              fontSize={isCompact ? 11 : 13}
              interval={0}
              tickMargin={8}
              tickFormatter={(value) => metricLabelMap[value] || value}
            />
            <YAxis stroke="#a1a1aa" fontSize={13} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(113, 113, 122, 0.18)" }}
            />
            <Legend wrapperStyle={{ fontSize: "15px", paddingTop: "18px" }} />
            <Bar
              dataKey={team1Name}
              fill="#60a5fa"
              radius={[10, 10, 0, 0]}
              maxBarSize={34}
            />
            <Bar
              dataKey={team2Name}
              fill="#fb7185"
              radius={[10, 10, 0, 0]}
              maxBarSize={34}
            />
          </BarChart>
        ) : (
          <div className="h-full w-full rounded-[22px] bg-zinc-950/30" />
        )}
      </div>
    </div>
  );
}
