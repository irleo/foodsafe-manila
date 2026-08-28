function ThresholdBadge({ status }) {
  const styles = status === "expected_epidemic"
    ? "border-red-200 bg-red-50 text-red-700"
    : status === "expected_alert"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  const label = status
    ? status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Threshold unavailable";

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
  const hasThresholdStatuses = items.some((item) => item.expectedStatus);
  const ordered = [...items]
    .sort((a, b) => {
      const rank = { expected_epidemic: 3, expected_alert: 2, below_alert: 1 };
      return (rank[b.expectedStatus] || 0) - (rank[a.expectedStatus] || 0)
        || b.predictedCases - a.predictedCases;
    })
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900">
        {hasThresholdStatuses ? "Areas Requiring Surveillance Attention" : "District Forecast Summary"}
      </h3>
      <p className="mb-4 mt-1 text-xs leading-5 text-gray-500">
        {hasThresholdStatuses
          ? "Prioritized by expected threshold status, then predicted confirmed cases. Expected labels are forecasts, not observed alerts."
          : "Ordered by predicted eligible cases for the selected disease and forecast month. Monthly thresholds are shown separately in Threshold Overview."}
      </p>

      <div className="space-y-3">
        {ordered.length ? ordered.map((item) => (
          <div key={item.districtKey} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">{item.district}</span>
              {hasThresholdStatuses && <ThresholdBadge status={item.expectedStatus} />}
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Forecast: {item.predictedCases} confirmed cases
            </p>
            <p className="mt-1 text-[11px] text-gray-500">Model: {modelName(item.model)}</p>
          </div>
        )) : (
          <p className="text-sm text-gray-500">No district forecast is available.</p>
        )}
      </div>
    </div>
  );
}
