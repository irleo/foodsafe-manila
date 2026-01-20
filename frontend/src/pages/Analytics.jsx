// src/pages/Analytics.jsx
import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { mockReports } from "../data/mockReports";

import { useReports } from "../hooks/useReports";
import { buildAnalyticsViewModel } from "../utils/analyticsViewModel";

import AnalyticsStats from "../components/analytics/AnalyticsStats";
import AnalyticsGrid from "../components/analytics/AnalyticsGrid";

const COLORS = ["#ef4444", "#facc15", "#22c55e"];

export default function Analytics() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const { reports, loading, errorMsg } = useReports(token);

  // Fallback to mock data if API fails or empty
  const finalReports = reports.length ? reports : mockReports;

  const vm = useMemo(
    () => buildAnalyticsViewModel(finalReports),
    [finalReports]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive analysis of foodborne disease trends and patterns in Manila City
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-download w-4 h-4">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" x2="12" y1="15" y2="3"></line>
              </svg>Export CSV
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-download w-4 h-4" >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" x2="12" y1="15" y2="3"></line>
              </svg>Export PNG
            </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {errorMsg} (Showing sample data.)
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Loading analytics…</p>
        </div>
      ) : (
        <>
          <AnalyticsStats
            thisYearCases={vm.thisYearCases}
            totalCases={vm.totalCases}
            topDistrict={vm.topDistrict}
            topIllness={vm.topIllness}
            districtsCovered={vm.districtsCovered}
          />

          <AnalyticsGrid
            dailyTimelineData={vm.dailyTimelineData}
            monthlyTrendData={vm.monthlyTrendData}
            illnessData={vm.illnessData}
            severityData={vm.severityData}
            districtData={vm.districtData}
            districtStats={vm.districtStats}
            colors={COLORS}
          />
        </>
      )}
    </div>
  );
}
