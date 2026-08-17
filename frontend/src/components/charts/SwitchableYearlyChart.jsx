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

function getSeriesValue(row) {
  return Number(row?.totalCases || 0);
}

export default function SwitchableYearlyChart({
  data = [],
  title = "Cases Over Time",
  height = 380,
}) {
  const [chartType, setChartType] = useState("line");
  const [rangeMonths, setRangeMonths] = useState(6);
  const [showMa3, setShowMa3] = useState(false);
  const [showMa6, setShowMa6] = useState(false);

  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    const filtered = filterByMonthRange(safeData, rangeMonths).sort((a, b) =>
      a.date > b.date ? 1 : -1,
    );

    return filtered.map((row, index) => {
      const window3 = filtered
        .slice(Math.max(0, index - 2), index + 1)
        .map((x) => getSeriesValue(x));
      const window6 = filtered
        .slice(Math.max(0, index - 5), index + 1)
        .map((x) => getSeriesValue(x));

      const ma3 = window3.reduce((sum, v) => sum + v, 0) / window3.length;
      const ma6 = window6.reduce((sum, v) => sum + v, 0) / window6.length;

      return {
        ...row,
        ma3: Number(ma3.toFixed(2)),
        ma6: Number(ma6.toFixed(2)),
      };
    });
  }, [data, rangeMonths]);

  const commonTooltip = {
    labelFormatter: (label) => String(formatMonthLabel(label)),
    formatter: (value, name) => {
      const labels = {
        reportedCases: "Reported Cases",
        suspectedCases: "Suspected Cases",
        confirmedCases: "Validated / Confirmed Cases",
        ma3: "Total MA 3",
        ma6: "Total MA 6",
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
          <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1 self-start">
            <button
              type="button"
              onClick={() => setShowMa3((v) => !v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                showMa3 ? "bg-amber-500 text-white shadow-sm" : "text-gray-600 hover:bg-white"
              }`}
            >
              MA 3
            </button>
            <button
              type="button"
              onClick={() => setShowMa6((v) => !v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                showMa6 ? "bg-pink-600 text-white shadow-sm" : "text-gray-600 hover:bg-white"
              }`}
            >
              MA 6
            </button>
          </div>
          <div className="group relative inline-flex items-center justify-center h-6 w-6 rounded-full border border-gray-300 bg-white text-gray-500">
            <span className="text-xs font-semibold">i</span>
            <div className="pointer-events-none absolute -bottom-12 right-0 z-10 hidden w-72 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
              MA3 and MA6 show moving averages of the combined case total and are visible only in Line view.
            </div>
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
                <Line type="monotone" dataKey="reportedCases" stroke="#93c5fd" strokeWidth={2} strokeDasharray="3 3" dot={<HollowDot stroke="#93c5fd" />} activeDot={{ r: 5 }} name="Reported Submissions" />
                <Line type="monotone" dataKey="suspectedCases" stroke="#3b82f6" strokeWidth={2} strokeDasharray="7 3" dot={<HollowDot stroke="#3b82f6" />} activeDot={{ r: 5 }} name="Suspected Cases" />
                <Line type="monotone" dataKey="confirmedCases" stroke="#1d4ed8" strokeWidth={2.5} dot={<HollowDot stroke="#1d4ed8" />} activeDot={{ r: 5 }} name="Validated / Confirmed Cases" />
                {showMa3 && <Line type="monotone" dataKey="ma3" stroke="#475569" strokeWidth={2} strokeDasharray="6 4" dot={false} name="Combined MA 3" />}
                {showMa6 && <Line type="monotone" dataKey="ma6" stroke="#64748b" strokeWidth={2} strokeDasharray="2 4" dot={false} name="Combined MA 6" />}
              </LineChart>
            )}

            {chartType === "bar" && (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatMonthLabel} />
                <YAxis allowDecimals={false} />
                <Tooltip {...commonTooltip} />
                <Legend />
                <Bar dataKey="reportedCases" fill="#93c5fd" name="Reported Submissions" />
                <Bar dataKey="suspectedCases" fill="#3b82f6" name="Suspected Cases" />
                <Bar dataKey="confirmedCases" fill="#1d4ed8" name="Validated / Confirmed Cases" />
              </BarChart>
            )}

            {chartType === "area" && (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatMonthLabel} />
                <YAxis allowDecimals={false} />
                <Tooltip {...commonTooltip} />
                <Legend />
                <Area type="monotone" dataKey="reportedCases" stackId="cases" stroke="#60a5fa" fill="#bfdbfe" fillOpacity={0.7} name="Reported Submissions" />
                <Area type="monotone" dataKey="suspectedCases" stackId="cases" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.6} name="Suspected Cases" />
                <Area type="monotone" dataKey="confirmedCases" stackId="cases" stroke="#1d4ed8" fill="#2563eb" fillOpacity={0.55} name="Validated / Confirmed Cases" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
