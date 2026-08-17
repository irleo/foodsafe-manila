function TrendBadge({ trend }) {
  const styles = trend === "increasing"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
  const label = trend === "increasing"
    ? "Forecast increase"
    : trend === "declining"
      ? "Forecast decline"
      : "No change";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {label}
    </span>
  );
}

function modelName(value) {
  return value === "seasonal_naive" ? "Seasonal Naïve" : "Prophet";
}

export default function SurveillanceAttentionCard({ items = [] }) {
  const ordered = [...items]
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900">Areas Requiring Surveillance Attention</h3>
      <p className="mb-4 mt-1 text-xs leading-5 text-gray-500">
        Prioritized by the change from the latest actual month to the shared forecast target. This is not an official risk classification.
      </p>

      <div className="space-y-3">
        {ordered.length ? ordered.map((item) => (
          <div key={item.districtKey} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">{item.district}</span>
              <TrendBadge trend={item.trend} />
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Actual {item.actualCases} → Forecast {item.predictedCases}
              {item.difference !== 0 ? ` (${item.difference > 0 ? "+" : ""}${item.difference})` : ""}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">Model: {modelName(item.model)}</p>
          </div>
        )) : (
          <p className="text-sm text-gray-500">No comparable district forecast is available.</p>
        )}
      </div>
    </div>
  );
}
