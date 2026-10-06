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

export default function DistrictBarChartVertical({
  data = [],
  title = "Cases (by District)",
  headerRight = null,
}) {
  const safeData = Array.isArray(data) ? data : [];

  // Sort by case count and show all six Manila districts.
  const chartData = [...safeData]
    .sort((a, b) => (b.cases || 0) - (a.cases || 0))
    .slice(0, 6);

  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 font-semibold">{title}</h2>
        {headerRight}
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No district data available.</div>
      ) : (
        <div className="h-[300px] min-w-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
                  <Cell key={row.district ?? `cell-${index}`} fill="#2563eb" />
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
