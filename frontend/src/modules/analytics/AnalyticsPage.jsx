import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLatestDatasetId } from "../../hooks/useLatestDatasetId";
import { useOfficialCases } from "../../hooks/useOfficialCases";
import { buildAnalyticsCasesViewModel } from "./utils/analyticsCasesViewModel";
import AnalyticsStats from "./components/AnalyticsStats";
import AnalyticsGrid from "./components/AnalyticsGrid";
import DataCoverageNotice from "../../components/common/DataCoverageNotice";
import { buildMonthlyTimelineData } from "./utils/analyticsCaseBuilders";
import { formatStatusLabel } from "../../utils/formatStatusLabel";
import { useReports } from "../report-logs/hooks/useReports";
import { buildReportVolumeRows } from "./utils/reportAnalyticsBuilders";
import { MANILA_DISTRICTS } from "./utils/analyticsCoverage";

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
    loading: officialLoading,
    errorMsg: officialErrorMsg,
  } = useOfficialCases({
    token,
    datasetId,
    caseClassification: ["suspected", "probable", "confirmed"],
    limit: 5000,
  });
  const {
    reports: reportRows,
    loading: reportsLoading,
    errorMsg: reportsErrorMsg,
  } = useReports(token, { fetchAll: true });

  const officialCaseRows = useMemo(() => {
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
  const reportVolumeRows = useMemo(
    () => buildReportVolumeRows(reportRows),
    [reportRows],
  );
  const officialCoverage = useMemo(() => ({
    coverageStart: dataset?.analyticalCoverageStart || dataset?.coverageStart,
    coverageEnd: dataset?.analyticalCoverageEnd || dataset?.coverageEnd,
    coveredDistricts: MANILA_DISTRICTS,
  }), [dataset]);

  const selectedRows = useMemo(
    () => {
      if (selectedCaseStatus === "reported") return reportVolumeRows;
      if (selectedCaseStatus === ALL_ANALYTICS_STATUSES) return officialCaseRows;
      return officialCaseRows.filter(
        (row) => row.caseClassification === selectedCaseStatus,
      );
    },
    [officialCaseRows, reportVolumeRows, selectedCaseStatus],
  );

  const vm = useMemo(
    () => buildAnalyticsCasesViewModel(
      selectedRows,
      selectedCaseStatus === "reported" ? {} : officialCoverage,
    ),
    [officialCoverage, selectedCaseStatus, selectedRows],
  );
  const allStatusTimelineData = useMemo(
    () => buildMonthlyTimelineData(
      selectedCaseStatus === "reported" ? reportVolumeRows : officialCaseRows,
      selectedCaseStatus === "reported" ? {} : officialCoverage,
    ),
    [officialCaseRows, officialCoverage, reportVolumeRows, selectedCaseStatus],
  );
  const selectedStatusLabel =
    selectedCaseStatus === ALL_ANALYTICS_STATUSES
      ? "All Included"
      : formatStatusLabel(selectedCaseStatus);
  const isReportView = selectedCaseStatus === "reported";
  const analyticsLoading = isReportView ? reportsLoading : officialLoading;
  const analyticsErrorMsg = isReportView ? reportsErrorMsg : officialErrorMsg;

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 analytics-print-root">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-gray-600">
            Explore official CESU cases and citizen reports as separate data sources
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
              {isReportView && (
                <span className="mt-1 block text-emerald-700">
                  Reported shows citizen-report volume. Reports remain reported here even after they are reviewed, validated, or assigned a workflow classification.
                </span>
              )}
              {selectedCaseStatus === ALL_ANALYTICS_STATUSES && (
                <span className="mt-1 block text-amber-700">
                  All statuses is a descriptive sum of suspected, probable,
                  and confirmed official records—not a formal epidemiological
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

      {analyticsErrorMsg && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {isReportView ? "Citizen reports" : "Official CESU cases"} could not be loaded: {analyticsErrorMsg}
        </div>
      )}

      {analyticsLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">
            Loading {isReportView ? "citizen report" : "official CESU"} analytics...
          </p>
        </div>
      ) : (
        <>
          <AnalyticsStats
            caseStatusLabel={selectedStatusLabel}
            dataIdentity={isReportView ? "report" : "official"}
            latestYear={vm.latestYear}
            latestYearCases={vm.latestYearCases}
            previousYear={vm.previousYear}
            previousYearCases={vm.previousYearCases}
            topDistrict={vm.topDistrict}
            topDisease={vm.topDisease}
            districtsCovered={vm.districtsCovered}
            yoyPct={vm.yoyPct}
            hasComparablePeriod={vm.hasComparablePeriod}
            comparisonIsPartial={vm.comparisonIsPartial}
          />

          <AnalyticsGrid
            caseStatusLabel={selectedStatusLabel}
            caseStatus={selectedCaseStatus}
            dataIdentity={isReportView ? "report" : "official"}
            monthlyTimelineData={allStatusTimelineData}
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
