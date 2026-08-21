import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const numberFormatter = new Intl.NumberFormat("en-PH");

function DistrictTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
      <p className="text-sm font-semibold text-gray-900">{item.district}</p>
      <p className="mt-1 text-xs text-gray-600">
        {numberFormatter.format(item.cases)} cases · {item.share}% of total
      </p>
    </div>
  );
}

export default function DistrictBarChart({
  data = [],
  title = "Case Distribution by District",
  headerRight = null,
}) {
  const safeData = Array.isArray(data) ? data : [];
  const totalCases = safeData.reduce(
    (sum, item) => sum + Math.max(0, Number(item?.cases) || 0),
    0,
  );
  const chartData = [...safeData]
    .filter((item) => Number(item?.cases) > 0)
    .sort((a, b) => (b.cases || 0) - (a.cases || 0))
    .slice(0, 6)
    .map((item) => ({
      ...item,
      share: totalCases > 0 ? Number(((Number(item.cases) / totalCases) * 100).toFixed(1)) : 0,
    }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-xs text-gray-500">District contribution to total cases</p>
        </div>
        {headerRight}
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500">No district data available.</p>
      ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 46, bottom: 8, left: 8 }}>
                <CartesianGrid horizontal={false} stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="district"
                  width={86}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#374151", fontSize: 12 }}
                />
                <Tooltip cursor={{ fill: "#eff6ff" }} content={<DistrictTooltip />} />
                <Bar dataKey="cases" fill="#2563eb" radius={[0, 6, 6, 0]} maxBarSize={30}>
                  <LabelList
                    dataKey="share"
                    position="right"
                    formatter={(value) => `${value}%`}
                    fill="#4b5563"
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
      )}
    </div>
  );
}
