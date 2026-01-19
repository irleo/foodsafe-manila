import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function SeverityDonutChart({ data, colors }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-6">Case Severity Analysis</h2>

      <div className="w-full h-[350px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="percentage"
              nameKey="severity"
              innerRadius={80}
              label={e => `${e.severity}: ${e.percentage}%`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
