import { useMemo, useState } from "react";
import {
  Line,
  Bar,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const HollowDot = ({ cx, cy, stroke }) => {
  if (cx === undefined || cy === undefined) return null;
  return (
    <>
      <circle cx={cx} cy={cy} r={4} fill="#ffffff" />
      <circle cx={cx} cy={cy} r={3.5} fill="transparent" stroke={stroke} strokeWidth={1.5} />
    </>
  );
};

function monthIndexFromDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return null;
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return year * 12 + month - 1;
}

function filterByMonthRange(data, months) {
  const safe = Array.isArray(data) ? data : [];
  if (!safe.length) return [];
  if (months === "all") return safe;
  if (!Number.isFinite(months) || months <= 0) return safe;

  const indices = safe
    .map((x) => monthIndexFromDateKey(x?.date))
    .filter((idx) => Number.isFinite(idx))
    .sort((a, b) => a - b);
  if (!indices.length) return safe;

  const endIndex = indices[indices.length - 1];
  const startIndex = endIndex - (months - 1);
  return safe.filter((x) => {
    const idx = monthIndexFromDateKey(x?.date);
    return Number.isFinite(idx) && idx >= startIndex && idx <= endIndex;
  });
}

function formatMonthLabel(dateKey) {
  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

const STATUS_SERIES = {
  reported: {
    dataKey: "reportedCases",
    label: "Reported Cases",
    stroke: "#3b82f6",
    fill: "#60a5fa",
  },
  suspected: {
    dataKey: "suspectedCases",
    label: "Suspected Cases",
    stroke: "#f59e0b",
    fill: "#fbbf24",
  },
  probable: {
    dataKey: "probableCases",
    label: "Probable Cases",
    stroke: "#8b5cf6",
    fill: "#a78bfa",
  },
  confirmed: {
    dataKey: "confirmedCases",
    label: "Confirmed Cases",
    stroke: "#10b981",
    fill: "#34d399",
  },
};

export default function SwitchableYearlyChart({
  data = [],
  title = "Cases Over Time",
  height = 380,
  movingAverageStatus = "confirmed",
}) {
  const [chartType, setChartType] = useState("line");
  const [rangeMonths, setRangeMonths] = useState(6);
  const [showMovingAverage3, setShowMovingAverage3] = useState(false);
  const [showMovingAverage6, setShowMovingAverage6] = useState(false);

  const movingAverageSeries = movingAverageStatus === "all"
    ? { dataKey: "totalCases", label: "All Included Records" }
    : STATUS_SERIES[movingAverageStatus] || STATUS_SERIES.confirmed;
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? [...data] : [];
    const sorted = safeData.sort((a, b) => (a.date > b.date ? 1 : -1));
    const withMovingAverages = sorted.map((row, index) => {
      const averageFor = (windowSize) => {
        if (index + 1 < windowSize) return null;
        const window = sorted.slice(index + 1 - windowSize, index + 1);
        const total = window.reduce(
          (sum, item) => sum + Number(item?.[movingAverageSeries.dataKey] || 0),
          0,
        );
        return Number((total / windowSize).toFixed(2));
      };
      return {
        ...row,
        selectedStatusMovingAverage3: averageFor(3),
        selectedStatusMovingAverage6: averageFor(6),
      };
    });
    return filterByMonthRange(withMovingAverages, rangeMonths);
  }, [data, movingAverageSeries.dataKey, rangeMonths]);

  const commonTooltip = {
    labelFormatter: (label) => String(formatMonthLabel(label)),
    formatter: (value, name) => {
      const labels = {
        reportedCases: "Reported Cases",
        suspectedCases: "Suspected Cases",
        probableCases: "Probable Cases",
        confirmedCases: "Confirmed Cases",
        selectedStatusMovingAverage3: `${movingAverageSeries.label} — 3-Month Average`,
        selectedStatusMovingAverage6: `${movingAverageSeries.label} — 6-Month Average`,
      };
      return [Number(value || 0), labels[name] || name];
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h2 className="font-semibold text-lg">{title}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 border border-gray-300 rounded-lg p-1 bg-white">
            {["line", "bar", "area"].map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1 text-sm rounded ${
                  chartType === type
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1 self-start">
            {[3, 6, 12, "all"].map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setRangeMonths(months)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  rangeMonths === months
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white"
                }`}
              >
                {months === "all" ? "All" : months === 12 ? "1Y" : `${months}M`}
              </button>
            ))}
          </div>
          <div
            className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1 self-start"
            aria-label="Moving average visibility"
          >
            <button
              type="button"
              aria-pressed={showMovingAverage3}
              onClick={() => setShowMovingAverage3((visible) => !visible)}
              className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                showMovingAverage3
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:bg-white"
              }`}
            >
              3M MA
            </button>
            <button
              type="button"
              aria-pressed={showMovingAverage6}
              onClick={() => setShowMovingAverage6((visible) => !visible)}
              className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                showMovingAverage6
                  ? "bg-gray-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-white"
              }`}
            >
              6M MA
            </button>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No monthly data available.</div>
      ) : (
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatMonthLabel} />
                <YAxis allowDecimals={false} />
                <Tooltip {...commonTooltip} />
                <Legend />
                {chartType === "bar" && Object.values(STATUS_SERIES).map((series) => (
                  <Bar
                    key={series.dataKey}
                    dataKey={series.dataKey}
                    fill={series.fill}
                    name={series.label}
                  />
                ))}
                {chartType === "area" && Object.values(STATUS_SERIES).map((series) => (
                  <Area
                    key={series.dataKey}
                    type="monotone"
                    dataKey={series.dataKey}
                    stroke={series.stroke}
                    fill={series.fill}
                    fillOpacity={0.25}
                    name={series.label}
                  />
                ))}
                {chartType === "line" && Object.values(STATUS_SERIES).map((series) => (
                  <Line
                    key={series.dataKey}
                    type="monotone"
                    dataKey={series.dataKey}
                    stroke={series.stroke}
                    strokeWidth={2.5}
                    dot={<HollowDot stroke={series.stroke} />}
                    activeDot={{ r: 5 }}
                    name={series.label}
                  />
                ))}
                {showMovingAverage3 && (
                  <Line
                    type="monotone"
                    dataKey="selectedStatusMovingAverage3"
                    stroke="#111827"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls={false}
                    name={`${movingAverageSeries.label} — 3-Month Average`}
                  />
                )}
                {showMovingAverage6 && (
                  <Line
                    type="monotone"
                    dataKey="selectedStatusMovingAverage6"
                    stroke="#6b7280"
                    strokeWidth={2}
                    strokeDasharray="2 4"
                    dot={false}
                    connectNulls={false}
                    name={`${movingAverageSeries.label} — 6-Month Average`}
                  />
                )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
