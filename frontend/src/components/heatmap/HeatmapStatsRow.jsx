import { formatStatusLabel } from "../../utils/formatStatusLabel";

function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusCard({ value, options, onChange, disabled = false }) {
  if (disabled) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center shadow-sm sm:p-6">
        <p className="text-sm font-medium text-blue-700">Forecast Case Scope</p>
        <p className="mt-2 text-base font-semibold text-blue-950">Disease-specific eligible cases</p>
        <p className="mt-1 text-xs text-blue-600">Based on the selected disease case definition</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center shadow-sm sm:p-6">
      <label htmlFor="heatmap-status" className="block text-sm font-medium text-blue-700">
        Selected Status
      </label>
      <select
        id="heatmap-status"
        className="mt-2 w-full rounded-lg border border-blue-300 bg-white px-3 py-2.5 text-sm font-semibold text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-100/60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatStatusLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function HeatmapStatsRow({
  stats,
  status,
  statusOptions,
  onStatusChange,
  statusDisabled = false,
  cards,
}) {
  const metricCards = cards || [
    { title: "Cases in Selection", value: stats?.totalCases ?? 0 },
    { title: "Districts with Cases", value: stats?.districtsWithCases ?? 0 },
    { title: "Barangays with Cases", value: stats?.barangaysWithCases ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricCards.slice(0, 3).map((card) => (
        <StatCard key={card.title} title={card.title} value={card.value} />
      ))}
      <StatusCard
        value={status}
        options={statusOptions}
        onChange={onStatusChange}
        disabled={statusDisabled}
      />
    </div>
  );
}
