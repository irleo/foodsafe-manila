import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const RANGE_OPTIONS = [
  { label: "3M", value: 3 },
  { label: "6M", value: 6 },
  { label: "1Y", value: 12 },
];

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

export default function YearlyPredictionErrorBarChart({
  title = "Prediction Error by Period (Actual - Predicted)",
  data = [],
  height = 350,
  mode = "signed",
  defaultRangeMonths = 6,
  controls = null,
  description = null,
}) {
  const [rangeMonths, setRangeMonths] = useState(defaultRangeMonths);

  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];

    const rows = safe
      .map((row, index) => {
        const predicted = Number(row?.predicted);
        const actual = Number(row?.actual);
        const label = getLabel(row);
        const rowPeriodIndex = periodIndex(row);

        if (!label) return null;
        if (!Number.isFinite(predicted) || !Number.isFinite(actual)) return null;

        const error = actual - predicted;

        return {
          id: index,
          label,
          periodIndex: rowPeriodIndex,
          predicted,
          actual,
          error,
          absError: Math.abs(error),
        };
      })
      .filter(Boolean);

    const endIndex = Math.max(
      ...rows
        .filter((row) => row.periodIndex != null)
        .map((row) => row.periodIndex),
    );

    if (!Number.isFinite(endIndex)) return rows;

    const startIndex = endIndex - Number(rangeMonths) + 1;
    return rows.filter(
      (row) =>
        row.periodIndex == null ||
        (row.periodIndex >= startIndex && row.periodIndex <= endIndex),
    );
  }, [data, rangeMonths]);

  const dataKey = mode === "absolute" ? "absError" : "error";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-lg">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">{description}</p>}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {controls}

          <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1">
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

          <div className="text-sm text-gray-600">
            {mode === "absolute" ? "Absolute error" : "Signed error"}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No error data available.</div>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={20} />

              <YAxis allowDecimals={false} />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;

                  const row = payload[0].payload;
                  const shownValue =
                    mode === "absolute" ? row.absError : row.error;

                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm">
                      <div className="font-semibold mb-2">{label}</div>

                      <div className="flex justify-between gap-6">
                        <span className="text-gray-600">Actual</span>
                        <span className="font-medium">{row.actual}</span>
                      </div>

                      <div className="flex justify-between gap-6">
                        <span className="text-gray-600">Predicted</span>
                        <span className="font-medium">{row.predicted}</span>
                      </div>

                      <div className="flex justify-between gap-6 mt-2">
                        <span className="text-gray-600">
                          {mode === "absolute" ? "Abs error" : "Error (A - P)"}
                        </span>
                        <span className="font-semibold">{shownValue}</span>
                      </div>
                    </div>
                  );
                }}
              />

              {mode === "signed" && <ReferenceLine y={0} />}

              <Bar
                dataKey={dataKey}
                name={
                  mode === "absolute"
                    ? "Absolute error"
                    : "Error (Actual - Predicted)"
                }
                fill="#2563eb"
              >
                {chartData.map((row, index) => (
                  <Cell
                    key={`cell-${row.label}-${index}`}
                    radius={
                      mode === "signed"
                        ? row[dataKey] >= 0
                          ? [6, 6, 0, 0]
                          : [0, 0, 6, 6]
                        : [6, 6, 0, 0]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        Positive error means actual cases exceeded predicted cases. Negative
        error means predicted cases exceeded actual cases.
      </p>
    </div>
  );
}
