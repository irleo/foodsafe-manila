import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

function formatYearLabel(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return String(d.getFullYear());
}

const HollowDot = ({ cx, cy, stroke }) => {
  if (cx === undefined || cy === undefined) return null;

  return (
    <>
      {/* Inner fill */}
      <circle cx={cx} cy={cy} r={4} fill="#ffffff" />

      {/* Outline */}
      <circle
        cx={cx}
        cy={cy}
        r={3}
        fill="transparent"
        stroke={stroke}
        strokeWidth={1.5}
      />
    </>
  );
};

export default function YearlyLineChart({
  title = "Cases (Last 5 Years)",
  data = [],
  height = 300,
}) {
  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return [...safe].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [data]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-4">{title}</h2>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No weekly data available.</div>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatYearLabel}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} />
              <Tooltip
                labelFormatter={(label) => formatYearLabel(label)}
                formatter={(value) => [`${value}`, "Cases"]}
              />
              <Line
                type="monotone"
                dataKey="cases"
                stroke="#2563eb"
                strokeWidth={2}
                dot={<HollowDot stroke="#2563eb" />}
                activeDot={{r : 5}}
              />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
