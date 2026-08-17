export default function TopDistrictsCard({ items }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="mb-4 font-semibold">Areas with Highest Case Concentration</h3>
      <p className="text-xs text-gray-500 mb-4">Distribution within the selected status and period.</p>

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
              <span className="text-sm px-2 py-1 rounded bg-red-100 text-red-700">
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
