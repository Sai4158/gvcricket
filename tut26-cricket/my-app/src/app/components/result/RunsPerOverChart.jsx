"use client";

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
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
        Runs Per Over
      </h2>
      <div ref={containerRef} className="w-full h-80 min-w-0">
        {width > 0 ? (
          <LineChart
            width={width}
            height={320}
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
            <XAxis
              dataKey="name"
              stroke="#a1a1aa"
              fontSize={14}
              tick={{ dy: 10 }}
            />
            <YAxis stroke="#a1a1aa" fontSize={14} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(113, 113, 122, 0.2)" }}
            />
            <Legend wrapperStyle={{ fontSize: "16px", paddingTop: "30px" }} />
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
