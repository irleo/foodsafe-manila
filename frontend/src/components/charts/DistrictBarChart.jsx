import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CHART_COLORS } from "../../constants/chartColors.js";

export default function DistrictBarChart({ data = [] }) {
  const safeData = Array.isArray(data) ? data : [];

  // Sort by cases desc and show top 10 
  const chartData = [...safeData]
    .sort((a, b) => (b.cases || 0) - (a.cases || 0))
    .slice(0, 9);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-6">Cases by District</h2>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No district data available.</div>
      ) : (
        <div className="w-full h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={chartData} margin={{ right: 200 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="district" width={100} />
              <Tooltip />
              <Bar dataKey="cases">
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
