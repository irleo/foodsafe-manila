import ReportLogsTab from "../components/data/ReportLogsTab";
import DataCoverageNotice from "../components/DataCoverageNotice";

export default function ReportLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Report Logs</h1>
        <p className="mt-1 text-gray-600">
          Investigate citizen reports, classify suspected cases, and record validation outcomes.
        </p>
      </div>
      <DataCoverageNotice fallbackText="Citizen report logs show submissions received by FoodSafe Manila. They are not a complete historical case record before CESU surveillance began in 2022." />
      <ReportLogsTab />
    </div>
  );
}
