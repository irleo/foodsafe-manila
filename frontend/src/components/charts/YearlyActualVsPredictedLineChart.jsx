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

function monthIndex(row) {
  if (row?.year == null || row?.month == null) return null;
  const year = Number(row.year);
  const month = Number(row.month);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return year * 12 + month - 1;
}

export default function YearlyActualVsPredictedLineChart({
  title = "Actual vs Prediction",
  data = [],
  height = 350,
  defaultRangeMonths = 6,
  controls = null,
}) {
  const [rangeMonths, setRangeMonths] = useState(defaultRangeMonths);

  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];

    const rows = safe
      .map((row, index) => {
        const actual = Number(row?.actual);
        const predicted = Number(row?.predicted);

        const lowerBound = Number(row?.lowerBound ?? row?.lower);
        const upperBound = Number(row?.upperBound ?? row?.upper);

        const isForecast = Boolean(row?.isForecast || row?.isPrimaryTarget);
        const periodIndex = monthIndex(row);

        return {
          id: index,
          label: getLabel(row),
          periodIndex,
          actual: Number.isFinite(actual) ? actual : null,
          predicted: Number.isFinite(predicted) ? predicted : null,
          lowerBound: Number.isFinite(lowerBound) ? lowerBound : null,
          upperBound: Number.isFinite(upperBound) ? upperBound : null,
          isForecast,

          actualLine: !isForecast && Number.isFinite(actual) ? actual : null,

          // Show predicted values for backtest rows and forecast rows.
          predictedLine: Number.isFinite(predicted) ? predicted : null,
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
    (row) => row.lowerBound != null && row.upperBound != null,
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-lg">{title}</h2>

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
                  const labels = {
                    actualLine: "Historical confirmed",
                    predictedLine: "Predicted (not actual)",
                    lowerBound: "Lower Bound",
                    upperBound: "Upper Bound",
                  };

                  return [value, labels[name] || name];
                }}
              />

              <Legend
                formatter={(value) => {
                  const labels = {
                    actualLine: "Historical confirmed",
                    predictedLine: "Predicted (not actual)",
                    confidenceBand: "Prediction Range",
                  };

                  return labels[value] || value;
                }}
              />

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
