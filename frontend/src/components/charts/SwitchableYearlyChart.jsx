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

function yearFromDateKey(dateKey) {
  // expects "YYYY-01-01" or "YYYY-MM-DD"
  if (!dateKey || typeof dateKey !== "string") return null;
  const y = Number(dateKey.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function filterByYearRange(data, range) {
  const safe = Array.isArray(data) ? data : [];
  if (!safe.length) return [];
  if (range === "all") return safe;

  const yearsToKeep =
    range === "3y" ? 3 : range === "5y" ? 5 : range === "10y" ? 10 : null;

  if (!yearsToKeep) return safe;

  const years = safe
    .map((x) => yearFromDateKey(x?.date))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);

  if (!years.length) return safe;

  const endYear = years[years.length - 1];
  const startYear = endYear - (yearsToKeep - 1);

  return safe.filter((x) => {
    const y = yearFromDateKey(x?.date);
    return Number.isFinite(y) && y >= startYear && y <= endYear;
  });
}

export default function SwitchableYearlyChart({
  data = [],
  title = "Cases Over Time",
  height = 380,
}) {
  const [chartType, setChartType] = useState("line"); // line, bar, area
  const [range, setRange] = useState("all"); // all, 3y, 5y, 10y

  const safeData = Array.isArray(data) ? data : [];

  const chartData = useMemo(() => {
    const filtered = filterByYearRange(safeData, range);
    return [...filtered].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [safeData, range]);

  const xTickFormatter = (dateKey) => {
    const y = yearFromDateKey(dateKey);
    return y ?? dateKey;
  };

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
          r={3.5}
          fill="transparent"
          stroke={stroke}
          strokeWidth={1.5}
        />
      </>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h2 className="font-semibold text-lg">{title}</h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All years</option>
            <option value="3y">Last 3 years</option>
            <option value="5y">Last 5 years</option>
            <option value="10y">Last 10 years</option>
          </select>

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
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No yearly data available.</div>
      ) : (
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "line" && (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={xTickFormatter} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(label) =>
                    String(yearFromDateKey(label) ?? label)
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cases"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={<HollowDot stroke="#2563eb" />}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            )}

            {chartType === "bar" && (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={xTickFormatter} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(label) =>
                    String(yearFromDateKey(label) ?? label)
                  }
                />
                <Legend />
                <Bar dataKey="cases" fill="#2563eb" />
              </BarChart>
            )}

            {chartType === "area" && (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={xTickFormatter} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(label) =>
                    String(yearFromDateKey(label) ?? label)
                  }
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="cases"
                  stroke="#2563eb"
                  fill="#93c5fd"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
