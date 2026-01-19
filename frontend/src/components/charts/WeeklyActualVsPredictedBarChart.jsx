import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

// "1/19"
function formatForecastLabel(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function WeeklyActualVsPredictedBarChart({
  title = "Prediction Accuracy (7 days)",
  data = [],
  height = 350,
}) {
  const chartData = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return [...safe].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [data]);

  const PRED_COLOR = "#2563eb"; // blue
  const ACTUAL_COLOR = "#22c55e"; // green

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-lg">{title}</h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Predicted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Actual</span>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">
          No comparison data available.
        </div>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={6} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="date"
                tickFormatter={formatForecastLabel}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} />

              <Tooltip
                labelFormatter={(label) => formatForecastLabel(label)}
                itemSorter={(item) => (item.dataKey === "predicted" ? 0 : 1)}
              />

              {/* ORDER HERE CONTROLS LEGEND + BARS */}
              <Legend
                wrapperStyle={{
                  color: "#475569",
                  fontSize: "16px",
                }}
                itemSorter={(item) => (item.dataKey === "predicted" ? 0 : 1)}
              />

              {/* Predicted FIRST */}
              <Bar
                dataKey="predicted"
                name="Predicted cases"
                fill={PRED_COLOR}
                radius={[6, 6, 0, 0]}
              />

              {/* Actual SECOND */}
              <Bar
                dataKey="actual"
                name="Actual cases"
                fill={ACTUAL_COLOR}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
