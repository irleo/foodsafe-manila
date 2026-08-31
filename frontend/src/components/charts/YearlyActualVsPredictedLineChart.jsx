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

const RANGE_OPTIONS = [
  { label: "3M", value: 3 },
  { label: "6M", value: 6 },
  { label: "1Y", value: 12 },
];

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

function formatMonth(value) {
  if (value == null) return "—";

  const monthNumber = Number(value);

  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return String(value);
  }

  return new Date(2026, monthNumber - 1, 1).toLocaleString(undefined, {
    month: "short",
  });
}

function getLabel(row) {
  if (!row) return "";

  if (row.label) return row.label;

  if (row.year != null && row.month != null) {
    return `${formatMonth(row.month)} ${row.year}`;
  }

  if (row.targetYear != null && row.targetMonth != null) {
    return `${formatMonth(row.targetMonth)} ${row.targetYear}`;
  }

  if (row.period) return row.period;
  if (row.date) return row.date;
  if (row.ds) return row.ds;
  if (row.year != null) return String(row.year);

  return "";
}

function periodIndex(row) {
  if (row?.year == null) return null;
  const year = Number(row.year);
  const period = Number(row.week ?? row.month);
  if (!Number.isFinite(year) || !Number.isFinite(period)) return null;
  return year * 12 + period - 1;
}

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function YearlyActualVsPredictedLineChart({
  title = "Actual vs Prediction",
  data = [],
  height = 350,
  defaultRangeMonths = 6,
  controls = null,
  description = null,
}) {
  const [rangeMonths, setRangeMonths] = useState(defaultRangeMonths);

  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];

    const rows = safe
      .map((row, index) => {
        const actual = finiteNumber(row?.actual);
        const predicted = finiteNumber(row?.predicted);
        const lowerBound = finiteNumber(row?.lowerBound ?? row?.lower);
        const upperBound = finiteNumber(row?.upperBound ?? row?.upper);
        const confidenceBand = lowerBound != null && upperBound != null
          ? [lowerBound, upperBound]
          : null;

        const isForecast = Boolean(row?.isForecast || row?.isPrimaryTarget);
        const rowPeriodIndex = periodIndex(row);

        return {
          id: index,
          label: getLabel(row),
          periodIndex: rowPeriodIndex,
          actual,
          predicted,
          lowerBound,
          upperBound,
          confidenceBand,
          isForecast,

          actualLine: !isForecast ? actual : null,

          // Show predicted values for backtest rows and forecast rows.
          predictedLine: predicted,
        };
      })
      .filter((row) => row.label);

    const target = rows.find((row) => row.isForecast && row.periodIndex != null);
    const latestHistoricalIndex = Math.max(
      ...rows
        .filter((row) => !row.isForecast && row.periodIndex != null)
        .map((row) => row.periodIndex),
    );
    const endIndex = target?.periodIndex ?? latestHistoricalIndex;

    if (!Number.isFinite(endIndex)) return rows;

    const startIndex = endIndex - Number(rangeMonths);
    return rows.filter(
      (row) =>
        row.periodIndex == null ||
        (row.periodIndex >= startIndex && row.periodIndex <= endIndex),
    );
  }, [data, rangeMonths]);

  const hasBounds = chartData.some(
    (row) => row.confidenceBand != null,
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-lg">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">{description}</p>}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {controls}

          <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1 self-start">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRangeMonths(option.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  rangeMonths === option.value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No predictive data available.</div>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={20} />

              <YAxis allowDecimals={false} />

              <Tooltip
                formatter={(value, name) => {
                  if (name === "confidenceBand" && Array.isArray(value)) {
                    return [`${value[0]}–${value[1]} cases`, "95% prediction interval"];
                  }

                  const labels = {
                    actualLine: "Historical eligible cases",
                    predictedLine: "Predicted (not actual)",
                  };

                  return [value, labels[name] || name];
                }}
              />

              <Legend
                formatter={(value) => {
                  const labels = {
                    actualLine: "Historical eligible cases",
                    predictedLine: "Predicted (not actual)",
                    confidenceBand: "95% prediction interval",
                  };

                  return labels[value] || value;
                }}
              />

              {hasBounds && (
                <Area
                  type="monotone"
                  dataKey="confidenceBand"
                  stroke="none"
                  fill="#2563eb"
                  fillOpacity={0.12}
                  activeDot={false}
                  name="confidenceBand"
                  legendType="rect"
                  connectNulls={false}
                />
              )}

              <Line
                type="monotone"
                dataKey="actualLine"
                name="actualLine"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={<HollowDot stroke="#60a5fa" />}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />

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
