import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Area,
} from "recharts";

const HollowDot = ({ cx, cy, stroke, fill = "#ffffff" }) => {
  if (cx == null || cy == null) return null;
  return (
    <>
      <circle cx={cx} cy={cy} r={4} fill={fill} />
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

export default function PredictiveLineChart({
  title = "Actual vs Prediction",
  monthlyData = [],
  yearlyData = [],
  defaultView = "yearly",
  height = 350,
}) {
  const [view, setView] = useState(defaultView);

  const chartData = useMemo(() => {
    const source = view === "monthly" ? monthlyData : yearlyData;
    const safe = Array.isArray(source) ? source : [];

    return safe
      .map((r, index) => {
        const actual = Number(r?.actual);
        const predicted = Number(r?.predicted);
        const lowerBound = Number(r?.lowerBound);
        const upperBound = Number(r?.upperBound);

        const isForecast = Boolean(r?.isForecast);

        return {
          id: index,
          label: r?.label ?? "",
          actual: Number.isFinite(actual) ? actual : null,
          predicted: Number.isFinite(predicted) ? predicted : null,
          lowerBound: Number.isFinite(lowerBound) ? lowerBound : null,
          upperBound: Number.isFinite(upperBound) ? upperBound : null,
          isForecast,

          // split actual / prediction into separate visible segments
          actualLine: !isForecast && Number.isFinite(actual) ? actual : null,
          predictedLine: isForecast && Number.isFinite(predicted) ? predicted : null,

          // optional bridge point so forecast starts smoothly from last actual
          forecastBridge:
            Number.isFinite(predicted) && isForecast ? predicted : null,
        };
      })
      .filter((row) => row.label);
  }, [monthlyData, yearlyData, view]);

  const hasBounds = chartData.some(
    (d) => d.lowerBound != null && d.upperBound != null
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-lg">{title}</h2>

        <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1 self-start">
          <button
            type="button"
            onClick={() => setView("monthly")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === "monthly"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-white"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setView("yearly")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === "yearly"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-white"
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No predictive data available.</div>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                minTickGap={20}
              />

              <YAxis allowDecimals={false} />

              <Tooltip
                formatter={(value, name) => {
                  const labels = {
                    actualLine: "Actual",
                    predictedLine: "Predicted",
                    lowerBound: "Lower Bound",
                    upperBound: "Upper Bound",
                  };
                  return [value, labels[name] || name];
                }}
              />

              <Legend
                formatter={(value) => {
                  const labels = {
                    actualLine: "Actual",
                    predictedLine: "Prediction",
                    confidenceBand: "Prediction Range",
                  };
                  return labels[value] || value;
                }}
              />

              {/* Shaded upper/lower prediction band */}
              {hasBounds && (
                <>
                  <Area
                    type="monotone"
                    dataKey="upperBound"
                    stroke="none"
                    fill="transparent"
                    activeDot={false}
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="lowerBound"
                    stroke="none"
                    fill="#2563eb"
                    fillOpacity={0.12}
                    activeDot={false}
                    name="confidenceBand"
                    legendType="rect"
                    baseLine={(x) => x.upperBound}
                  />
                </>
              )}

              {/* Actual solid line */}
              <Line
                type="monotone"
                dataKey="actualLine"
                name="actualLine"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={<HollowDot stroke="#22c55e" />}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />

              {/* Predicted dashed line */}
              <Line
                type="monotone"
                dataKey="predictedLine"
                name="predictedLine"
                stroke="#2563eb"
                strokeWidth={2.5}
                strokeDasharray="6 6"
                dot={<HollowDot stroke="#2563eb" />}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}