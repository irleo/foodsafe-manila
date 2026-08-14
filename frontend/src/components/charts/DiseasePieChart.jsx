import { CHART_COLORS } from "../../constants/chartColors.js";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const renderDiseaseLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  payload,
}) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-s"
    >
      {payload.disease}
    </text>
  );
};


export default function DiseaseDistributionChart({
  data = [],
  title = "Disease Distribution",
}) {
  const chartData = Array.isArray(data)
    ? data.filter((item) => Number(item?.cases) > 0)
    : [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-6">{title}</h2>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500">
          No disease distribution data available.
        </p>
      ) : (
        <div className="w-full h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="cases"
                nameKey="disease"
                label={renderDiseaseLabel}
                labelLine={false}
              >
                {chartData.map((item, index) => (
                  <Cell
                    key={item.disease ?? index}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
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
