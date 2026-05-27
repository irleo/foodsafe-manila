import { useMemo } from "react";
// import { useAuth } from "../context/AuthContext";
// import { mockReports } from "../data/mockReports";

import { useAuth } from "../context/AuthContext";
import { useLatestDatasetId } from "../hooks/useLatestDatasetId";
import { useOfficialCases } from "../hooks/useOfficialCases";
import { buildAnalyticsCasesViewModel } from "../utils/analyticsCasesViewModel";

// import { useReports } from "../hooks/useReports";
// import { buildAnalyticsViewModel } from "../utils/analyticsViewModel";

import AnalyticsStats from "../components/analytics/AnalyticsStats";
import AnalyticsGrid from "../components/analytics/AnalyticsGrid";

const COLORS = ["#ef4444", "#facc15", "#22c55e"];

export default function Analytics() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const { datasetId } = useLatestDatasetId(token);
  const {
    items: officialItems,
    loading,
    errorMsg,
  } = useOfficialCases({
    token,
    datasetId,
    limit: 5000,
  });

  // // Reports Version
  // const { reports, loading, errorMsg } = useReports(token);
  // const finalReports = reports.length ? reports : mockReports;
  //  const vm = useMemo(
  //   () => buildAnalyticsViewModel(finalReports),
  //   [finalReports],
  // );

  const caseRows = useMemo(() => {
    const safe = Array.isArray(officialItems) ? officialItems : [];
    return safe.map((r) => ({
      city: r.city ?? "Manila",
      district: r.district,
      disease: r.disease,
      year: Number(r.year),
      cases: Number(r.cases),
    }));
  }, [officialItems]);

  const vm = useMemo(() => buildAnalyticsCasesViewModel(caseRows), [caseRows]);

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 analytics-print-root">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-gray-600">
            Analysis of historical foodborne disease trends and patterns
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

      {errorMsg && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {errorMsg} (Showing sample data.)
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Loading analytics...</p>
        </div>
      ) : (
        <>
          <AnalyticsStats
            thisYearCases={vm.thisYearCases}
            totalCases={vm.totalCases}
            topDistrict={vm.topDistrict}
            topDisease={vm.topDisease}
            districtsCovered={vm.districtsCovered}
            yoyPct={vm.yoyPct}
          />

          <AnalyticsGrid
            yearlyTimelineData={vm.yearlyTimelineData}
            diseaseData={vm.diseaseData}
            districtData={vm.districtData}
            districtStats={vm.districtStats}
            riskLevelData={vm.riskLevelData}
            diseaseTrendData={vm.diseaseTrendData}
            diseaseTrendKeys={vm.diseaseTrendKeys}
            colors={COLORS}
          />
        </>
      )}

    </div>
  );
}
