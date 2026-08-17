export default function TopDistrictsCard({
  items,
  title = "Areas with Highest Case Concentration",
  subtitle = "Distribution within the selected status and period.",
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-4 mt-1 text-xs text-gray-500">{subtitle}</p>

      <div className="space-y-3">
        {items?.length ? (
          items.map((d) => (
            <div key={d.name} className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-sm">{d.name}</span>
                  <p className="text-xs text-gray-500">
                    {d.concentrationShare}% of selected cases
                  </p>
                </div>
              </div>
              <span className="rounded bg-blue-50 px-2 py-1 text-sm font-medium text-blue-700">
                {d.cases}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">No data available.</p>
        )}
      </div>
    </div>
  );
}
