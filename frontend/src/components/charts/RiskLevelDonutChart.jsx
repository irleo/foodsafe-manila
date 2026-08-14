import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function RiskLevelDonutChart({ data, colors = [], title="Risk Level Analysis" }) {
  const chartData = Array.isArray(data)
    ? data.filter((item) => Number(item?.percentage) > 0)
    : [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-6">{title}</h2>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500">
          No risk level data available.
        </p>
      ) : (
        <div className="w-full h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="percentage"
                nameKey="risk"
                innerRadius={80}
                label={(e) => `${e.risk}: ${e.percentage}%`}
              >
                {" "}
                {chartData.map((item, i) => (
                  <Cell
                    key={item.risk ?? i}
                    fill={colors[i % (colors.length || 1)]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
