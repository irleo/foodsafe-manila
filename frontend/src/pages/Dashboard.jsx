import { useEffect, useMemo, useState } from "react";
import {
  ArrowTrendingDownIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";

import { mockOfficialCases } from "../data/mockOfficialCases";
import { normalizeToCaseRows } from "../utils/normalizeCases";
// import { casesByYear, casesByDistrict, casesByDisease } from "../utils/caseAggregations";
import {
  buildYearlyTimelineData,
  buildDistrictCaseData,
  buildDiseaseData,
} from "../utils/dashboardBuilders";

import YearlyLineChart from "../components/charts/YearlyLineChart";
import DistrictBarChartVertical from "../components/charts/DistrictBarChartVertical";
import DiseasePieChart from "../components/charts/DiseasePieChart";
import RecentActivityCard from "../components/RecentActivityCard";
import { CHART_COLORS } from "../constants/chartColors";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function Dashboard() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const caseRows = useMemo(() => normalizeToCaseRows(mockOfficialCases), []);

  const availableYears = useMemo(() => {
    const set = new Set(
      caseRows.map((r) => r.year).filter((y) => Number.isFinite(y)),
    );
    return Array.from(set).sort((a, b) => b - a); // newest first
  }, [caseRows]);

  const [selectedYear, setSelectedYear] = useState("all");

  const districtRows = useMemo(() => {
    if (selectedYear === "all") return caseRows;
    const y = Number(selectedYear);
    return caseRows.filter((r) => r.year === y);
  }, [caseRows, selectedYear]);

  const yearlyData = useMemo(
    () => buildYearlyTimelineData(caseRows, 5),
    [caseRows],
  );

  const districtData = useMemo(
    () => buildDistrictCaseData(districtRows),
    [districtRows],
  );

  const diseaseData = useMemo(() => buildDiseaseData(caseRows), [caseRows]);

  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications?limit=6`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
          credentials: "include",
        });
        const data = await res.json();
        if (!isMounted) return;
        setActivity(Array.isArray(data) ? data : []);
      } catch {
        if (!isMounted) return;
        setActivity([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-600 mt-1">
          Monitor disease outbreaks and trends in real-time
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-600 p-3 rounded-lg flex-shrink-0">
            <ArrowTrendingDownIcon className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="mb-2">
              {auth?.role === "admin"
                ? "Administrative Dashboard"
                : "User Dashboard"}
            </h2>
            <p className="text-sm text-gray-700 mb-3">
              This web platform is designed for DOH officials, health analysts,
              and researchers to manage and analyze disease outbreak data.
              <strong className="block mt-2">For Citizens:</strong> Check out
              the mobile app version of <strong>Foodsafe Manila</strong>.
            </p>
            <a
              href=""
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <DevicePhoneMobileIcon className="w-4 h-4" />
              Mobile App Version
            </a>
          </div>
        </div>
      </div>

      {/* cards + charts (same for both roles) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <YearlyLineChart
          title="Cases from the past 5 years"
          data={yearlyData}
        />

        <DistrictBarChartVertical
          title={
            selectedYear === "all"
              ? "Top Districts (All Years)"
              : `Top Districts (${selectedYear})`
          }
          data={districtData}
          headerRight={
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All years</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          }
        />

        <DiseasePieChart data={diseaseData} colors={CHART_COLORS} />
        <RecentActivityCard items={activity} />
      </div>
    </div>
  );
}
