"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: ScoringBreakdownCharts.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { FaChartPie } from "react-icons/fa";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import CustomTooltip from "./CustomTooltip";
import useChartWidth from "./useChartWidth";

const COLOR_BY_SOURCE = {
  Fours: "#22c55e",
  Running: "#f59e0b",
  Sixes: "#38bdf8",
};

function getBreakdownRows(data = []) {
  const total = data.reduce((sum, item) => sum + Number(item?.value || 0), 0);
  return data.map((item) => ({
    ...item,
    percent: total > 0 ? Math.round((Number(item.value || 0) / total) * 100) : 0,
    color: COLOR_BY_SOURCE[item.name] || "#a78bfa",
  }));
}

function BreakdownLegendRows({ data = [] }) {
  const rows = getBreakdownRows(data);

  return (
    <div className="mt-4 space-y-2">
      {rows.map((item) => (
        <div
          key={`${item.name}-${item.value}`}
          className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-zinc-200">{item.name}</span>
          </div>
          <span className="font-semibold text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function getChartSliceBadges({
  data = [],
  width = 0,
  height = 320,
  outerRadius = 88,
  innerRadius = 34,
}) {
  const rows = getBreakdownRows(data).filter((item) => Number(item.value || 0) > 0);
  const total = rows.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (!total || width <= 0 || height <= 0) {
    return [];
  }

  const cx = width / 2;
  const cy = height / 2;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.56;
  let currentAngle = 0;

  return rows.map((item) => {
    const sliceAngle = (Number(item.value || 0) / total) * 360;
    const midAngle = currentAngle + sliceAngle / 2;
    currentAngle += sliceAngle;

    return {
      ...item,
      x: cx + radius * Math.cos((-midAngle * Math.PI) / 180),
      y: cy + radius * Math.sin((-midAngle * Math.PI) / 180),
    };
  });
}

function BreakdownChartBadges({
  data = [],
  width = 0,
  height = 320,
  outerRadius = 88,
  innerRadius = 34,
}) {
  const badges = getChartSliceBadges({
    data,
    width,
    height,
    outerRadius,
    innerRadius,
  });

  return (
    <>
      {badges.map((item) => (
        <div
          key={`${item.name}-${item.percent}`}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)]"
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            backgroundColor: "rgba(8,8,12,0.78)",
            borderColor: item.color,
          }}
        >
          {item.percent}%
        </div>
      ))}
    </>
  );
}

export default function ScoringBreakdownCharts({
  innings1Summary,
  innings2Summary,
  team1Name,
  team2Name,
}) {
  const [team1ContainerRef, team1Width] = useChartWidth();
  const [team2ContainerRef, team2Width] = useChartWidth();
  const team1ChartHeight = team1Width >= 1024 ? 360 : 320;
  const team2ChartHeight = team2Width >= 1024 ? 360 : 320;
  const team1InnerRadius = team1Width >= 1024 ? 42 : 34;
  const team2InnerRadius = team2Width >= 1024 ? 42 : 34;
  const team1OuterRadius = team1Width >= 1024 ? 108 : 88;
  const team2OuterRadius = team2Width >= 1024 ? 108 : 88;

  return (
    <div className="rounded-[28px] border border-white/10 bg-zinc-900/50 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)] ring-1 ring-white/6">
      <h2 className="mb-2 flex items-center justify-center gap-2 text-center text-2xl font-bold text-white lg:text-3xl">
        <FaChartPie /> Run Source Breakdown
      </h2>
      <p className="mx-auto mb-6 max-w-[42rem] text-center text-sm leading-6 text-zinc-400 lg:text-base">
        This split shows how each innings was built through boundaries and runs taken between the wickets.
      </p>
      <div className="grid items-start gap-10 xl:grid-cols-2">
        <div className="rounded-[24px] border border-cyan-400/16 bg-cyan-400/6 p-4 sm:p-5">
          <h3 className="mb-4 text-center text-lg font-black uppercase text-cyan-300">
            {team1Name}
          </h3>
          <div
            ref={team1ContainerRef}
            className="relative h-[320px] w-full min-w-0 lg:h-[360px]"
          >
            {team1Width > 0 ? (
              <>
                <PieChart width={team1Width} height={team1ChartHeight}>
                  <Pie
                    data={innings1Summary.scoringBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={team1InnerRadius}
                    outerRadius={team1OuterRadius}
                  >
                    {innings1Summary.scoringBreakdown.map((entry, index) => (
                      <Cell
                        key={`team1-${index}`}
                        fill={COLOR_BY_SOURCE[entry?.name] || "#a78bfa"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "14px" }} />
                </PieChart>
                <BreakdownChartBadges
                  data={innings1Summary.scoringBreakdown}
                  width={team1Width}
                  height={team1ChartHeight}
                  innerRadius={team1InnerRadius}
                  outerRadius={team1OuterRadius}
                />
              </>
            ) : (
              <div className="h-full w-full rounded-xl bg-zinc-950/30" />
            )}
          </div>
          <div className="mt-6">
            <BreakdownLegendRows data={innings1Summary.scoringBreakdown} />
          </div>
        </div>

        <div className="rounded-[24px] border border-rose-400/16 bg-rose-400/6 p-4 sm:p-5">
          <h3 className="mb-4 text-center text-lg font-black uppercase text-rose-300">
            {team2Name}
          </h3>
          <div
            ref={team2ContainerRef}
            className="relative h-[320px] w-full min-w-0 lg:h-[360px]"
          >
            {team2Width > 0 ? (
              <>
                <PieChart width={team2Width} height={team2ChartHeight}>
                  <Pie
                    data={innings2Summary.scoringBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={team2InnerRadius}
                    outerRadius={team2OuterRadius}
                  >
                    {innings2Summary.scoringBreakdown.map((entry, index) => (
                      <Cell
                        key={`team2-${index}`}
                        fill={COLOR_BY_SOURCE[entry?.name] || "#a78bfa"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "14px" }} />
                </PieChart>
                <BreakdownChartBadges
                  data={innings2Summary.scoringBreakdown}
                  width={team2Width}
                  height={team2ChartHeight}
                  innerRadius={team2InnerRadius}
                  outerRadius={team2OuterRadius}
                />
              </>
            ) : (
              <div className="h-full w-full rounded-xl bg-zinc-950/30" />
            )}
          </div>
          <div className="mt-6">
            <BreakdownLegendRows data={innings2Summary.scoringBreakdown} />
          </div>
        </div>
      </div>
    </div>
  );
}
