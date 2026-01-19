function LegendItem({ color, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full" style={{ background: color }} />
      <div>
        <p className="text-sm">{title}</p>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </div>
    </div>
  );
}

export default function LegendCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="mb-4 font-semibold">Legend</h3>
      <div className="space-y-3">
        <LegendItem color="#22c55e" title="Low Risk" subtitle="1–5 cases" />
        <LegendItem color="#eab308" title="Medium Risk" subtitle="6–15 cases" />
        <LegendItem color="#f97316" title="High Risk" subtitle="16–30 cases" />
        <LegendItem color="#ef4444" title="Critical Risk" subtitle="31+ cases" />
      </div>
    </div>
  );
}
