import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { CHART_COLORS } from "../../constants/chartColors.js";

export default function DistrictBarChartVertical({ data = [], title = "Cases by District" }) {
  const safeData = Array.isArray(data) ? data : [];

  // Sort by cases desc and show top 5
  const chartData = [...safeData]
    .sort((a, b) => (b.cases || 0) - (a.cases || 0))
    .slice(0, 6);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-6">{title}</h2>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No district data available.</div>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} >
              <XAxis
                dataKey="district"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="cases" fill="#2563eb">
                {chartData.map((row, index) => (
                  <Cell
                    key={row.district ?? `cell-${index}`}
                    fill="#2563eb"
                  />
                ))}
              </Bar>
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
