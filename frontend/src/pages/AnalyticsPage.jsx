import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useLatestDatasetId } from "../hooks/useLatestDatasetId";
import { useOfficialCases } from "../hooks/useOfficialCases";
import { buildAnalyticsCasesViewModel } from "../utils/analyticsCasesViewModel";
import AnalyticsStats from "../components/analytics/AnalyticsStats";
import AnalyticsGrid from "../components/analytics/AnalyticsGrid";
import DataCoverageNotice from "../components/DataCoverageNotice";
import { buildMonthlyTimelineData } from "../utils/analyticsCaseBuilders";

export default function Analytics() {
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
    caseClassification: ["reported", "suspected", "confirmed"],
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

  const confirmedRows = useMemo(
    () => caseRows.filter((row) => row.caseClassification === "confirmed"),
    [caseRows],
  );

  const vm = useMemo(
    () => ({
      ...buildAnalyticsCasesViewModel(confirmedRows),
      monthlyTimelineData: buildMonthlyTimelineData(caseRows),
    }),
    [caseRows, confirmedRows],
  );

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 analytics-print-root">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-gray-600">
            Status-separated trends with validated/confirmed cases used for official distribution summaries
          </p>
        </div>
        {/* EXPORT */}

        <button
          type="button"
          onClick={handleExportPdf}
          className="no-print flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
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
            latestYear={vm.latestYear}
            latestYearCases={vm.latestYearCases}
            previousYear={vm.previousYear}
            topDistrict={vm.topDistrict}
            topDisease={vm.topDisease}
            districtsCovered={vm.districtsCovered}
            yoyPct={vm.yoyPct}
          />

          <AnalyticsGrid
            monthlyTimelineData={vm.monthlyTimelineData}
            diseaseData={vm.diseaseData}
            districtData={vm.districtData}
            districtStats={vm.districtStats}
            diseaseTrendData={vm.diseaseTrendData}
            diseaseTrendKeys={vm.diseaseTrendKeys}
          />
        </>
      )}

    </div>
  );
}
