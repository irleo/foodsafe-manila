export default function TopDistrictsCard({ items }) {
  const formatForecast = (forecast) => {
    if (!forecast || forecast.predictedCases == null) return "No forecast";
    const period =
      forecast.year && forecast.month
        ? new Date(forecast.year, Number(forecast.month) - 1, 1).toLocaleString(
            undefined,
            { month: "long", year: "numeric" },
          )
        : "next month";
    return `Forecasted ${period}: ${forecast.predictedCases} cases`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="mb-4 font-semibold">Top Districts</h3>
      <p className="text-xs text-gray-500 mb-4">Ranked by number of cases.</p>

      <div className="space-y-3">
        {items?.length ? (
          items.map((d, idx) => (
            <div key={d.name} className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">#{idx + 1}</span>
                <div>
                  <span className="text-sm">{d.name}</span>
                  <p className="text-xs text-gray-500">
                    {formatForecast(d.forecast)}
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
