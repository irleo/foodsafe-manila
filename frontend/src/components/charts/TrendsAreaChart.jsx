import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function TrendsAreaChart({ data = [] }) {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = [...safeData].sort((a, b) => (a.month > b.month ? 1 : -1));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-6">Trends (Monthly)</h2>

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500">No trend data available.</div>
      ) : (
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area dataKey="cases" stroke="#2563eb" fill="#93c5fd" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
