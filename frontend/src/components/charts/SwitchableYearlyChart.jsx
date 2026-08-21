import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
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
}) {
  const [chartType, setChartType] = useState("line");
  const [rangeMonths, setRangeMonths] = useState(6);

  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    return filterByMonthRange(safeData, rangeMonths).sort((a, b) =>
      a.date > b.date ? 1 : -1,
    );
  }, [data, rangeMonths]);

  const commonTooltip = {
    labelFormatter: (label) => String(formatMonthLabel(label)),
    formatter: (value, name) => {
      const labels = {
        reportedCases: "Reported Cases",
        suspectedCases: "Suspected Cases",
        confirmedCases: "Confirmed Cases",
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
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No monthly data available.</div>
      ) : (
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "line" && (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatMonthLabel} />
                <YAxis allowDecimals={false} />
                <Tooltip {...commonTooltip} />
                <Legend />
                {Object.values(STATUS_SERIES).map((series) => (
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
              </LineChart>
            )}

            {chartType === "bar" && (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatMonthLabel} />
                <YAxis allowDecimals={false} />
                <Tooltip {...commonTooltip} />
                <Legend />
                {Object.values(STATUS_SERIES).map((series) => (
                  <Bar
                    key={series.dataKey}
                    dataKey={series.dataKey}
                    fill={series.fill}
                    name={series.label}
                  />
                ))}
              </BarChart>
            )}

            {chartType === "area" && (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatMonthLabel} />
                <YAxis allowDecimals={false} />
                <Tooltip {...commonTooltip} />
                <Legend />
                {Object.values(STATUS_SERIES).map((series) => (
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
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
