import { CalendarRange, FlaskConical } from "lucide-react";
import { formatCoverageRange } from "../utils/dataCoverage";

export default function DataCoverageNotice({ dataset, fallbackText }) {
  const range = formatCoverageRange(dataset);
  const provider = dataset?.providerName || dataset?.dataSource || "CESU";
  const frequency = dataset?.reportingFrequency === "weekly" ? "Weekly" : "Monthly historical";
  const isDevelopment = dataset?.dataMode === "development";
  const uploads = Number(dataset?.cumulativeUploadCount || 0);

  if (isDevelopment) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-violet-300 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-4 py-3 text-sm text-violet-950">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
        <div>
          <p className="font-semibold">
            Development sample data{range ? `: ${range}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-violet-800">
            Synthetic test records are active in this view. Results are for system testing and must not be treated as official CESU surveillance findings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-sm text-blue-950">
      <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
      <div>
        <p className="font-semibold">
          {range ? `Cumulative surveillance history: ${range}` : "No surveillance coverage dates are available"}
        </p>
        <p className="mt-0.5 text-xs text-blue-700">
          {fallbackText || `${provider} · ${frequency} reporting${uploads ? ` · ${uploads} validated upload${uploads === 1 ? "" : "s"}` : ""}. Newly reported periods accumulate, while a newer CESU upload takes precedence over an older upload wherever their district and reporting-period coverage overlaps.`}
        </p>
      </div>
    </div>
  );
}
