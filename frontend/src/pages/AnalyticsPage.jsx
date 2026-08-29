import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLatestDatasetId } from "../hooks/useLatestDatasetId";
import { useOfficialCases } from "../hooks/useOfficialCases";
import { buildAnalyticsCasesViewModel } from "../utils/analyticsCasesViewModel";
import AnalyticsStats from "../components/analytics/AnalyticsStats";
import AnalyticsGrid from "../components/analytics/AnalyticsGrid";
import DataCoverageNotice from "../components/DataCoverageNotice";
import { buildMonthlyTimelineData } from "../utils/analyticsCaseBuilders";
import { formatStatusLabel } from "../utils/formatStatusLabel";

const ALL_ANALYTICS_STATUSES = "all";
const CASE_STATUS_OPTIONS = [
  ALL_ANALYTICS_STATUSES,
  "reported",
  "suspected",
  "probable",
  "confirmed",
];

export default function Analytics() {
  const [selectedCaseStatus, setSelectedCaseStatus] = useState("confirmed");
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const { datasetId, dataset } = useLatestDatasetId(token);
  const {
    items: officialItems,
    loading,
    errorMsg,
  } = useOfficialCases({
    token,
    datasetId,
    caseClassification: ["reported", "suspected", "probable", "confirmed"],
    limit: 5000,
  });

  const caseRows = useMemo(() => {
    const safe = Array.isArray(officialItems) ? officialItems : [];
    return safe.map((r) => ({
      city: r.city ?? "Manila",
      district: r.district,
      disease: r.disease,
      year: Number(r.year),
      month: Number(r.month),
      caseClassification: r.caseClassification,
      cases: Number(r.cases),
    }));
  }, [officialItems]);

  const selectedRows = useMemo(
    () =>
      selectedCaseStatus === ALL_ANALYTICS_STATUSES
        ? caseRows
        : caseRows.filter(
            (row) => row.caseClassification === selectedCaseStatus,
          ),
    [caseRows, selectedCaseStatus],
  );

  const vm = useMemo(
    () => buildAnalyticsCasesViewModel(selectedRows),
    [selectedRows],
  );
  const allStatusTimelineData = useMemo(
    () => buildMonthlyTimelineData(caseRows),
    [caseRows],
  );

  const selectedStatusLabel =
    selectedCaseStatus === ALL_ANALYTICS_STATUSES
      ? "All Included"
      : formatStatusLabel(selectedCaseStatus);

  const handleExportPdf = async () => {
    const originalTitle = document.title;
    document.title = `FoodSafe Manila - Analytics - ${selectedStatusLabel}`;

    try {
      await document.fonts?.ready;
      window.requestAnimationFrame(() => window.print());
    } finally {
      window.setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }
  };

  return (
    <div className="space-y-6 analytics-print-root">
      <div className="print-only analytics-print-heading">
        <p className="text-sm font-semibold text-blue-700">FoodSafe Manila</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-950">Analytics Report</h1>
        <p className="mt-1 text-sm text-gray-600">
          Case status: {selectedStatusLabel}
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-gray-600">
            Explore status-specific case patterns across all analytics views
          </p>
        </div>
        {/* EXPORT */}

        <button
          type="button"
          onClick={handleExportPdf}
          className="no-print inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 sm:self-auto"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-download h-4 w-4"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" x2="12" y1="15" y2="3"></line>
          </svg>
          Export as PDF
        </button>
      </div>

      <DataCoverageNotice dataset={dataset} />

      <section className="no-print rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label
              htmlFor="analytics-case-status"
              className="text-sm font-semibold text-gray-900"
            >
              Case Status
            </label>
            <p className="mt-1 text-sm text-gray-600">
              This selection updates every statistic, chart, and district summary below.
              {selectedCaseStatus === ALL_ANALYTICS_STATUSES && (
                <span className="mt-1 block text-amber-700">
                  All statuses is a descriptive sum of reported, suspected,
                  probable, and confirmed records—not a formal epidemiological
                  case definition.
                </span>
              )}
            </p>
          </div>
          <select
            id="analytics-case-status"
            value={selectedCaseStatus}
            onChange={(event) => setSelectedCaseStatus(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-blue-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:w-64"
          >
            {CASE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === ALL_ANALYTICS_STATUSES
                  ? "All statuses (descriptive total)"
                  : formatStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Loading analytics...</p>
        </div>
      ) : (
        <>
          <AnalyticsStats
            caseStatusLabel={selectedStatusLabel}
            latestYear={vm.latestYear}
            latestYearCases={vm.latestYearCases}
            previousYear={vm.previousYear}
            topDistrict={vm.topDistrict}
            topDisease={vm.topDisease}
            districtsCovered={vm.districtsCovered}
            yoyPct={vm.yoyPct}
          />

          <AnalyticsGrid
            caseStatusLabel={selectedStatusLabel}
            caseStatus={selectedCaseStatus}
            monthlyTimelineData={allStatusTimelineData}
            diseaseData={vm.diseaseData}
            districtData={vm.districtData}
            diseaseTrendData={vm.diseaseTrendData}
            diseaseTrendKeys={vm.diseaseTrendKeys}
            token={token}
            datasetId={datasetId}
          />
        </>
      )}

    </div>
  );
}
