"use client";

import { FaChartPie } from "react-icons/fa";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import CustomTooltip from "./CustomTooltip";
import useChartWidth from "./useChartWidth";

export default function ScoringBreakdownCharts({
  innings1Summary,
  innings2Summary,
  team1Name,
  team2Name,
}) {
  const team1Chart = useChartWidth();
  const team2Chart = useChartWidth();
  const colors = ["#38bdf8", "#8b5cf6", "#f87171"];
  const radian = Math.PI / 180;

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * radian);
    const y = cy + radius * Math.sin(-midAngle * radian);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight="bold"
      >{`${(percent * 100).toFixed(0)}%`}</text>
    );
  };

  return (
    <div className="bg-zinc-900/50 rounded-2xl shadow-lg p-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2 mb-6">
        <FaChartPie /> Run Source Breakdown
      </h2>
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div ref={team1Chart.containerRef} className="w-full h-80 min-w-0">
          <h3 className="font-bold text-center text-blue-400 text-lg">
            {team1Name}
          </h3>
          {team1Chart.width > 0 ? (
            <PieChart width={team1Chart.width} height={320}>
              <Pie
                data={innings1Summary.scoringBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {innings1Summary.scoringBreakdown.map((_, index) => (
                  <Cell key={`team1-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "16px" }} />
            </PieChart>
          ) : (
            <div className="h-full w-full rounded-xl bg-zinc-950/30" />
          )}
        </div>
        <div ref={team2Chart.containerRef} className="w-full h-80 min-w-0">
          <h3 className="font-bold text-center text-red-400 text-lg">
            {team2Name}
          </h3>
          {team2Chart.width > 0 ? (
            <PieChart width={team2Chart.width} height={320}>
              <Pie
                data={innings2Summary.scoringBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {innings2Summary.scoringBreakdown.map((_, index) => (
                  <Cell key={`team2-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "16px" }} />
            </PieChart>
          ) : (
            <div className="h-full w-full rounded-xl bg-zinc-950/30" />
          )}
        </div>
      </div>
    </div>
  );
}
