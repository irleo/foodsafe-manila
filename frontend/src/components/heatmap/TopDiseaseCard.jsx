export default function TopDiseaseCard({ items }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="mb-4 font-semibold">Top Diseases</h3>

      <div className="space-y-3">
        {items?.length ? (
          items.map((x, idx) => (
            <div key={x.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">#{idx + 1}</span>
                <span className="text-sm">{x.name}</span>
              </div>
              <span className="text-sm px-2 py-1 text-gray-600">{x.cases}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">No data available.</p>
        )}
      </div>
    </div>
  );
}
