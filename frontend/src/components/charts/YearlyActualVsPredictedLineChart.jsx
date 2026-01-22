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

const HollowDot = ({ cx, cy, stroke }) => {
  if (cx == null || cy == null) return null;
  return (
    <>
      <circle cx={cx} cy={cy} r={4} fill="#ffffff" />
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

export default function YearlyActualVsPredictedLineChart({
  title = "Actual vs Predicted (Yearly)",
  data = [], // [{year, actual, predicted}]
  height = 350,
}) {
  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return safe
      .map((r) => {
        const year = Number(r?.year);
        const actual = Number(r?.actual);
        const predicted = Number(r?.predicted);
        if (!Number.isFinite(year)) return null;
        if (!Number.isFinite(actual) || !Number.isFinite(predicted)) return null;
        return { year, actual, predicted };
      })
      .filter(Boolean)
      .sort((a, b) => a.year - b.year);
  }, [data]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">{title}</h2>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No comparison data available.</div>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip
                labelFormatter={(label) => `Year: ${label}`}
                formatter={(value, name) => [
                  value,
                  name === "Predicted" ? "Predicted" : "Actual",
                ]}
              />
              <Legend />

              {/* Predicted */}
              <Line
                type="monotone"
                dataKey="predicted"
                name="Predicted"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={<HollowDot stroke="#2563eb" />}
                activeDot={{ r: 5 }}
              />

              {/* Actual */}
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={<HollowDot stroke="#22c55e" />}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
