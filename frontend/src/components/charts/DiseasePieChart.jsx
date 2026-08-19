import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS } from "../../constants/chartColors.js";

const numberFormatter = new Intl.NumberFormat("en-PH");

function changePresentation(item) {
  if (item.previousCases === 0 && item.cases > 0) {
    return { label: "New", className: "bg-blue-50 text-blue-700", Icon: Sparkles };
  }
  if (item.changeDirection === "increase") {
    return { label: `+${item.relativeChange}%`, className: "bg-rose-50 text-rose-700", Icon: ArrowUpRight };
  }
  if (item.changeDirection === "decrease") {
    return { label: `${item.relativeChange}%`, className: "bg-emerald-50 text-emerald-700", Icon: ArrowDownRight };
  }
  return { label: "0%", className: "bg-gray-100 text-gray-600", Icon: Minus };
}

function DiseaseTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const change = changePresentation(item);

  return (
    <div className="min-w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
      <p className="font-semibold text-gray-900">{item.disease}</p>
      <div className="mt-2 space-y-1.5 text-xs text-gray-600">
        <div className="flex justify-between gap-6">
          <span>{item.currentYear ? `${item.currentYear} cases` : "Cases"}</span>
          <strong className="text-gray-900">{numberFormatter.format(item.cases)}</strong>
        </div>
        <div className="flex justify-between gap-6">
          <span>Share of total</span>
          <strong className="text-gray-900">{item.share}%</strong>
        </div>
        {item.previousYear ? (
          <div className="flex justify-between gap-6">
            <span>{item.previousYear} cases</span>
            <strong className="text-gray-900">{numberFormatter.format(item.previousCases)}</strong>
          </div>
        ) : null}
      </div>
      {item.previousYear ? (
        <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${change.className}`}>
          <change.Icon className="h-3.5 w-3.5" />
          {change.label} vs {item.previousYear}
        </div>
      ) : null}
    </div>
  );
}

export default function DiseaseDistributionChart({ data = [], title = "Disease Distribution" }) {
  const positiveData = Array.isArray(data)
    ? data.filter((item) => Number(item?.cases) > 0)
    : [];
  const totalCases = positiveData.reduce((sum, item) => sum + Number(item.cases || 0), 0);
  const chartData = positiveData.map((item) => ({
    ...item,
    share:
      Number.isFinite(Number(item.share)) && Number(item.share) > 0
        ? Number(item.share)
        : Number(((Number(item.cases) / totalCases) * 100).toFixed(1)),
  }));
  const currentYear = chartData[0]?.currentYear;
  const previousYear = chartData[0]?.previousYear;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">
          {currentYear && previousYear
            ? `${currentYear} share with relative change from ${previousYear}`
            : "Share of cases by disease"}
        </p>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500">No disease distribution data available.</p>
      ) : (
        <div className="grid grid-cols-1 items-center gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)]">
          <div className="relative h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="cases"
                  nameKey="disease"
                  innerRadius="53%"
                  outerRadius="82%"
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((item, index) => (
                    <Cell
                      key={item.disease ?? index}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<DiseaseTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{numberFormatter.format(totalCases)}</span>
              <span className="text-xs text-gray-500">total cases</span>
            </div>
          </div>

          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {chartData.map((item, index) => {
              const change = changePresentation(item);
              return (
                <div key={item.disease} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <p className="truncate text-sm font-medium text-gray-800">{item.disease}</p>
                      </div>
                      <p className="mt-1 pl-[18px] text-xs text-gray-500">
                        {numberFormatter.format(item.cases)} cases · {item.share}%
                      </p>
                    </div>
                    {item.previousYear ? (
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${change.className}`}>
                        <change.Icon className="h-3.5 w-3.5" />
                        {change.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
