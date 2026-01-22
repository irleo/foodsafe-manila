import { useMemo } from "react";
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

export default function YearlyPredictionErrorBarChart({
  title = "Prediction Error by Year (Actual - Predicted)",
  data = [],
  height = 350,
  mode = "signed", // "signed" | "absolute"
}) {
  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return safe
      .map((d) => {
        const year = Number(d?.year);
        const predicted = Number(d?.predicted ?? 0);
        const actual = Number(d?.actual ?? 0);

        if (!Number.isFinite(year)) return null;
        if (!Number.isFinite(predicted) || !Number.isFinite(actual))
          return null;

        const error = actual - predicted;
        return {
          year,
          predicted,
          actual,
          error,
          absError: Math.abs(error),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.year - b.year);
  }, [data]);

  const dataKey = mode === "absolute" ? "absError" : "error";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-lg">{title}</h2>

        <div className="text-sm text-gray-600">
          {mode === "absolute" ? "Absolute error" : "Signed error"}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No error data available.</div>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip
                labelFormatter={(label) => `Year: ${label}`}
                formatter={(value, key, item) => {
                  const row = item?.payload;
                  if (!row) return [value, key];

                  if (key === "error")
                    return [value, "Error (Actual - Predicted)"];
                  if (key === "absError") return [value, "Absolute error"];

                  return [value, key];
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload;

                  const shownValue =
                    mode === "absolute" ? row.absError : row.error;

                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm">
                      <div className="font-semibold mb-2">{`Year: ${label}`}</div>
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

              {/* Center line for signed error */}
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
                {chartData.map((row, i) => (
                  <Cell
                    key={`cell-${row.year}-${i}`}
                    radius={
                      mode === "signed"
                        ? row[dataKey] >= 0
                          ? [6, 6, 0, 0] // positive bar: round top corners
                          : [0, 0, 6, 6] // negative bar: round bottom corners
                        : [6, 6, 0, 0] // absolute mode: always positive
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
