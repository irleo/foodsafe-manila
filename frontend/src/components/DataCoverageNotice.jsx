import { CalendarRange } from "lucide-react";
import { formatCoverageRange } from "../utils/dataCoverage";

export default function DataCoverageNotice({ dataset, fallbackText }) {
  const range = formatCoverageRange(dataset);
  const provider = dataset?.providerName || dataset?.dataSource || "CESU";
  const frequency = dataset?.reportingFrequency === "weekly" ? "Weekly" : "Monthly historical";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-sm text-blue-950">
      <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
      <div>
        <p className="font-semibold">
          {range ? `Available ${provider} data: ${range}` : "CESU surveillance records begin in 2022"}
        </p>
        <p className="mt-0.5 text-xs text-blue-700">
          {fallbackText || `${frequency} reporting. The system does not imply complete historical coverage outside this period.`}
        </p>
      </div>
    </div>
  );
}
