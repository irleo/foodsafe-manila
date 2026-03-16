import Spinner from "../Spinner.jsx";

function formatDistrictKey(value) {
  if (!value) return "—";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSymptoms(symptoms = []) {
  if (!Array.isArray(symptoms) || symptoms.length === 0) return "—";
  return symptoms
    .map((s) =>
      s
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    )
    .join(", ");
}

export default function ReportsLogList({ reports, loading, onRefresh }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Recent reports</h3>
        <button
          onClick={onRefresh}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6">
            <Spinner />
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">
          No reports found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-3 pr-4">Reported at</th>
                <th className="py-3 pr-4">Reporter district</th>
                <th className="py-3 pr-4">Exposure district</th>
                <th className="py-3 pr-4">Symptoms</th>
                <th className="py-3 pr-4">Case count</th>
                <th className="py-3 pr-4">Counted</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id} className="border-b last:border-0 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {report.reportedAt
                      ? new Date(report.reportedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {formatDistrictKey(report.location?.district)}
                  </td>
                  <td className="py-3 pr-4">
                    {formatDistrictKey(report.exposureDistrict)}
                  </td>
                  <td className="py-3 pr-4">{formatSymptoms(report.symptoms)}</td>
                  <td className="py-3 pr-4">{report.caseCount ?? 1}</td>
                  <td className="py-3 pr-4">
                    {report.isCounted ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        No
                      </span>
                    )}
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