export default function DistrictStatisticsTable({
  data = [],
  caseStatusLabel = "Validated / Confirmed",
}) {
  const safeData = Array.isArray(data) ? data : [];

  const tableData = [...safeData].sort(
    (a, b) => (b.totalCases || 0) - (a.totalCases || 0)
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold mb-4">
        {caseStatusLabel} Case Distribution Summary
      </h2>

      {tableData.length === 0 ? (
        <div className="text-sm text-gray-500">No district statistics available.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left p-3">District</th>
                <th className="text-left p-3">{caseStatusLabel} Cases</th>
                <th className="text-left p-3">Years Covered</th>
                <th className="text-left p-3">Average / Year</th>
              </tr>
            </thead>

            <tbody>
              {tableData.map((row) => (
                <tr key={row.district} className="border-b border-gray-100">
                  <td className="p-3">{row.district}</td>
                  <td className="p-3">{row.totalCases}</td>
                  <td className="p-3">{row.yearsCovered}</td>
                  <td className="p-3">{row.avgCasesPerYear}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
