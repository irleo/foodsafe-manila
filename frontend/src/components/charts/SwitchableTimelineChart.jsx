import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";

function parseISODate(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function filterByRange(data, range) {
  if (!Array.isArray(data) || data.length === 0) return [];
  if (range === "all") return data;

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;

  // use max date in dataset as "end" (better than Date.now for historical uploads)
  const dates = data
    .map((x) => parseISODate(x.date))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (!dates.length) return data;

  const end = dates[dates.length - 1];
  const start = new Date(end.getTime() - days * 86400000);

  return data.filter((x) => {
    const d = parseISODate(x.date);
    return d && d >= start && d <= end;
  });
}

export default function SwitchableTimelineChart({ data = [] }) {
  const [chartType, setChartType] = useState("line"); // line, bar, area
  const [range, setRange] = useState("all");

  const safeData = Array.isArray(data) ? data : [];

  const filteredData = useMemo(() => {
    const out = filterByRange(safeData, range);
    // ensure chronological order for charts
    return [...out].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [safeData, range]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h2 className="font-semibold text-lg">Cases Over Time</h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>

          <div className="flex gap-1 border border-gray-300 rounded-lg p-1">
            {["line", "bar", "area"].map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1 text-sm rounded ${
                  chartType === type ? "bg-blue-500 text-white" : "text-gray-700"
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="text-sm text-gray-500">No timeline data available.</div>
      ) : (
        <div className="w-full h-100">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "line" && (
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cases" stroke="#2563eb" />
              </LineChart>
            )}

            {chartType === "bar" && (
              <BarChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cases" fill="#2563eb" />
              </BarChart>
            )}

            {chartType === "area" && (
              <AreaChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="cases" stroke="#2563eb" fill="#93c5fd" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
