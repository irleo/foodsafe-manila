import ReportLogsTab from "./components/ReportLogsTab";

export default function ReportLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Report Logs</h1>
        <p className="mt-1 text-gray-600">
          Investigate citizen reports, classify suspected cases, and record confirmation outcomes.
        </p>
      </div>
      <ReportLogsTab />
    </div>
  );
}
