export default function DistrictStatisticsTable({ data = [] }) {
  const safeData = Array.isArray(data) ? data : [];

  const tableData = [...safeData].sort(
    (a, b) => (b.totalCases || 0) - (a.totalCases || 0)
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-4">District Statistics Summary</h2>

      {tableData.length === 0 ? (
        <div className="text-sm text-gray-500">No district statistics available.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left p-3">District</th>
                <th className="text-left p-3">Total Cases</th>
                <th className="text-left p-3">Incidents</th>
                <th className="text-left p-3">Avg / Incident</th>
                <th className="text-left p-3">Risk Level</th>
              </tr>
            </thead>

            <tbody>
              {tableData.map((row) => (
                <tr key={row.district} className="border-b border-gray-100">
                  <td className="p-3">{row.district}</td>
                  <td className="p-3">{row.totalCases}</td>
                  <td className="p-3">{row.incidents}</td>
                  <td className="p-3">{row.avgCasesPerEntry}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        row.riskLevel === "High"
                          ? "bg-red-100 text-red-700"
                          : row.riskLevel === "Moderate"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {row.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
