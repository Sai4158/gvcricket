"use client";

/**
 * File overview:
 * Purpose: Renders Result UI for the app's screens and flows.
 * Main exports: RunsPerOverChart.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CustomTooltip from "./CustomTooltip";
import useChartWidth from "./useChartWidth";

export default function RunsPerOverChart({
  innings1Summary,
  innings2Summary,
  team1Name,
  team2Name,
}) {
  const [containerRef, width] = useChartWidth();
  const maxOvers = Math.max(
    innings1Summary.runsPerOver.length,
    innings2Summary.runsPerOver.length
  );
  const chartData = Array.from({ length: maxOvers }, (_, index) => ({
    name: `Over ${index + 1}`,
    [team1Name]: innings1Summary.runsPerOver[index]?.runs,
    [team2Name]: innings2Summary.runsPerOver[index]?.runs,
  }));

  return (
    <div className="h-full rounded-[28px] border border-white/10 bg-zinc-900/50 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)] ring-1 ring-white/6">
      <h2 className="mb-2 text-center text-2xl font-bold text-white lg:text-3xl">
        Runs Per Over
      </h2>
      <p className="mx-auto mb-6 max-w-[34rem] text-center text-sm leading-6 text-zinc-400 lg:text-base">
        Over-by-over scoring shows where pressure shifted and where the match opened up.
      </p>
      <div ref={containerRef} className="h-[360px] w-full min-w-0 lg:h-[420px]">
        {width > 0 ? (
          <LineChart
            width={width}
            height={width >= 1024 ? 420 : 360}
            data={chartData}
            margin={{ top: 12, right: 18, left: 0, bottom: 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
            <XAxis
              dataKey="name"
              stroke="#a1a1aa"
              fontSize={13}
              tick={{ dy: 10 }}
            />
            <YAxis stroke="#a1a1aa" fontSize={13} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(113, 113, 122, 0.2)" }}
            />
            <Legend wrapperStyle={{ fontSize: "15px", paddingTop: "22px" }} />
            <Line
              type="monotone"
              dataKey={team1Name}
              stroke="#60a5fa"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey={team2Name}
              stroke="#f87171"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        ) : (
          <div className="h-full w-full rounded-xl bg-zinc-950/30" />
        )}
      </div>
    </div>
  );
}


