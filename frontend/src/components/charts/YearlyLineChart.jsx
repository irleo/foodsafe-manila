import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const numberFormatter = new Intl.NumberFormat("en-PH");

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

function YearlyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-xl">
      <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
        {formatYearLabel(label)}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Confirmed cases: <strong className="text-gray-900">{numberFormatter.format(payload[0]?.value || 0)}</strong>
      </p>
    </div>
  );
}

export default function YearlyLineChart({
  title = "Cases (Last 5 Years)",
  data = [],
  height = 300,
}) {
  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return [...safe].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [data]);
  const latest = chartData[chartData.length - 1];
  const total = chartData.reduce(
    (sum, row) => sum + Number(row?.officialCases || 0),
    0,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-blue-50/80 to-white p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-xs text-gray-500">Annual confirmed-case totals across the available five-year view</p>
        </div>
        {chartData.length > 0 && (
          <div className="flex gap-2 text-xs">
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 shadow-sm">
              <p className="text-gray-500">Latest year</p>
              <p className="mt-0.5 font-semibold text-blue-800">{formatYearLabel(latest.date)} · {numberFormatter.format(latest.officialCases)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <p className="text-gray-500">Period total</p>
              <p className="mt-0.5 font-semibold text-gray-800">{numberFormatter.format(total)}</p>
            </div>
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="p-6 text-sm text-gray-500">No yearly data available.</div>
      ) : (
        <div style={{ height }} className="w-full p-4 sm:p-5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="confirmedCasesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatYearLabel}
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
              <Tooltip cursor={{ stroke: "#93c5fd", strokeDasharray: "4 4" }} content={<YearlyTooltip />} />
              <Area
                type="monotone"
                dataKey="officialCases"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#confirmedCasesGradient)"
                dot={<HollowDot stroke="#2563eb" />}
                activeDot={{ r: 5 }}
                name="Confirmed Cases"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
