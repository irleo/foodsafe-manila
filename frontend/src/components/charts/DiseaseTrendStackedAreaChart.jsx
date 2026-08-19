import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "../../constants/chartColors.js";

const numberFormatter = new Intl.NumberFormat("en-PH");

function formatMonthLabel(dateKey) {
  if (typeof dateKey !== "string") return dateKey || "";
  const [year, month] = dateKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return dateKey;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function TrendTooltip({ active, label, payload }) {
  if (!active || !payload?.length) return null;
  const ranked = [...payload].sort((a, b) => Number(b.value) - Number(a.value));

  return (
    <div className="min-w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
      <p className="text-sm font-semibold text-gray-900">{formatMonthLabel(label)}</p>
      <div className="mt-2 space-y-2">
        {ranked.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-gray-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="truncate">{entry.dataKey}</span>
            </span>
            <strong className="text-gray-900">{numberFormatter.format(entry.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function changeMetric(current, previous) {
  const difference = current - previous;
  if (previous === 0) {
    return difference > 0
      ? { label: "New", className: "text-blue-700", Icon: ArrowUpRight }
      : { label: "0%", className: "text-gray-500", Icon: Minus };
  }

  const percentage = Number(((difference / previous) * 100).toFixed(1));
  if (percentage > 0) {
    return { label: `+${percentage}%`, className: "text-rose-700", Icon: ArrowUpRight };
  }
  if (percentage < 0) {
    return { label: `${percentage}%`, className: "text-emerald-700", Icon: ArrowDownRight };
  }
  return { label: "0%", className: "text-gray-500", Icon: Minus };
}

export default function DiseaseTrendStackedAreaChart({
  data = [],
  keys = [],
  title = "Disease Trends Over Time",
  height = 390,
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeKeys = Array.isArray(keys) ? keys : [];
  const hasTrendData = safeData.some((item) =>
    safeKeys.some((key) => Number(item?.[key]) > 0),
  );
  const latest = safeData.at(-1) || {};
  const previous = safeData.at(-2) || {};
  const latestMovements = safeKeys
    .map((key) => ({
      disease: key,
      current: Number(latest[key]) || 0,
      previous: Number(previous[key]) || 0,
      color: CHART_COLORS[safeKeys.indexOf(key) % CHART_COLORS.length],
    }))
    .sort((a, b) => b.current - a.current)
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">
          Compare monthly disease trajectories; drag the range selector to inspect a shorter period
        </p>
      </div>

      {!hasTrendData ? (
        <p className="text-sm text-gray-500">No disease trend data available.</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {latestMovements.map((item) => {
              const change = changeMetric(item.current, item.previous);
              return (
                <div key={item.disease} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="truncate text-xs font-medium text-gray-600">{item.disease}</p>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{numberFormatter.format(item.current)}</p>
                      <p className="text-[11px] text-gray-500">
                        cases in {formatMonthLabel(latest.date)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${change.className}`}>
                      <change.Icon className="h-3.5 w-3.5" />
                      {change.label}
                    </span>
                  </div>
                  <p className="mt-1 text-right text-[10px] text-gray-400">
                    vs {previous.date ? formatMonthLabel(previous.date) : "prior month"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={safeData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatMonthLabel}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <Tooltip content={<TrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                {safeKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
                {safeData.length > 2 ? (
                  <Brush
                    dataKey="date"
                    tickFormatter={formatMonthLabel}
                    height={24}
                    stroke="#2563eb"
                    fill="#eff6ff"
                    travellerWidth={8}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
