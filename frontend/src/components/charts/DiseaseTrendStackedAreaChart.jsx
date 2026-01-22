import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function DiseaseTrendStackedAreaChart({
  data = [],
  keys = [],
  title = "Disease Trends Over Time",
  height = 350,
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeKeys = Array.isArray(keys) ? keys : [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-6">{title}</h2>

      {safeData.length === 0 || safeKeys.length === 0 ? (
        <div className="text-sm text-gray-500">No disease trend data available.</div>
      ) : (
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={safeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {safeKeys.map((k) => (
                <Area key={k} type="monotone" dataKey={k} stackId="1" />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
