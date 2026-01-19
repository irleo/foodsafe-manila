function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function HeatmapStatsRow({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard title="Low Risk Districts" value={stats?.Low ?? 0} />
      <StatCard title="Medium Risk Districts" value={stats?.Medium ?? 0} />
      <StatCard title="High Risk Districts" value={stats?.High ?? 0} />
      <StatCard title="Critical Risk Districts" value={stats?.Critical ?? 0} />
    </div>
  );
}
