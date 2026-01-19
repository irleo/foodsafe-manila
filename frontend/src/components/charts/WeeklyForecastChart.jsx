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

/**
 * For weekly forecast, data items should look like:
 * { date: "2025-01-19", predicted: 18, lower: 12, upper: 26 }
 */

// "1/19"
function formatForecastLabel(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Reusable hollow dot (no "line" inside)
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

export default function WeeklyForecastChart({
  title = "Weekly Forecast",
  data = [],
  height = 350,
}) {
  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return [...safe].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [data]);

  const BOUND_COLOR = "#93c5fd";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">{title}</h2>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No forecast data available.</div>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="date"
                tickFormatter={formatForecastLabel}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} />

              <Tooltip
                labelFormatter={(label) => formatForecastLabel(label)}
                formatter={(value, _name, item) => {
                  const key = item?.dataKey; // "upper" | "lower" | "predicted"
                  const label =
                    key === "upper"
                      ? "Upper bound"
                      : key === "lower"
                      ? "Lower bound"
                      : "Predicted cases";

                  return [value, label];
                }}
              />

              {/* Upper bound */}
              <Line
                type="monotone"
                dataKey="upper"
                name="Upper bound"
                stroke={BOUND_COLOR}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={<HollowDot stroke={BOUND_COLOR} />}
                activeDot={{ r: 5 }}
              />

              {/* Predicted */}
              <Line
                type="monotone"
                dataKey="predicted"
                name="Predicted cases"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={<HollowDot stroke="#2563eb" />}
                activeDot={{ r: 5 }}
              />

              {/* Lower bound */}
              <Line
                type="monotone"
                dataKey="lower"
                name="Lower bound"
                stroke={BOUND_COLOR}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={<HollowDot stroke={BOUND_COLOR} />}
                activeDot={{ r: 5 }}
              />

              <Legend
                wrapperStyle={{
                  color: "#475569", // slate-600
                  fontSize: "16px",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
