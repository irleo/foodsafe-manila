import { useEffect, useMemo, useState } from "react";
import {
  ArrowTrendingDownIcon,
  BellAlertIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";

import { useLatestDatasetId } from "../hooks/useLatestDatasetId";
import { useOfficialCases } from "../hooks/useOfficialCases";
// import { casesByYear, casesByDistrict, casesByDisease } from "../utils/caseAggregations";
import {
  buildYearlyTimelineData,
  buildDistrictCaseData,
  buildDiseaseData,
} from "../utils/dashboardBuilders";

import YearlyLineChart from "../components/charts/YearlyLineChart";
import DistrictBarChartVertical from "../components/charts/DistrictBarChartVertical";
import DiseasePieChart from "../components/charts/DiseasePieChart";
import RecentActivityCard from "../components/dashboard/RecentActivityCard";
import { CHART_COLORS } from "../constants/chartColors";
import { fetchCurrentThreshold } from "../api/thresholds";
import { formatStatusLabel } from "../utils/formatStatusLabel";
import DataCoverageNotice from "../components/DataCoverageNotice";
import { formatCoverageRange } from "../utils/dataCoverage";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function Dashboard() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const { datasetId, dataset } = useLatestDatasetId(token);
  const { items: officialItems } = useOfficialCases({ token, datasetId, limit: 5000 });

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
  const [thresholdResult, setThresholdResult] = useState(null);
  const [thresholdError, setThresholdError] = useState("");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/activity?page=1&limit=5`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
          credentials: "include",
        });
        const data = await res.json();
        if (!isMounted) return;
        setActivity(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!isMounted) return;
        setActivity([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !datasetId || !["admin", "cesu", "surveillance_team"].includes(auth?.role)) return;
    let isMounted = true;

    fetchCurrentThreshold(token, datasetId)
      .then((data) => {
        if (!isMounted) return;
        setThresholdResult(data.result || null);
        setThresholdError("");
      })
      .catch((error) => {
        if (!isMounted) return;
        setThresholdResult(null);
        setThresholdError(error.message || "Unable to calculate surveillance thresholds");
      });

    return () => {
      isMounted = false;
    };
  }, [auth?.role, datasetId, token]);

  const thresholdTone = thresholdResult?.outcome === "epidemic_threshold_exceeded"
    ? "border-red-300 bg-red-50 text-red-950"
    : thresholdResult?.outcome === "alert_threshold_reached"
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : thresholdResult?.outcome === "within_expected_level"
        ? "border-blue-300 bg-blue-50 text-blue-950"
        : "border-gray-300 bg-gray-50 text-gray-900";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-600 mt-1">
          Overview of foodborne disease burden and trends
        </p>
      </div>

      <DataCoverageNotice dataset={dataset} />

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-600 p-3 rounded-lg flex-shrink-0">
            <ArrowTrendingDownIcon className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="mb-2">
              Administrative Dashboard
            </h2>
            <p className="text-sm text-gray-700 mb-3">
              This web platform is designed for MHD officials, health analysts,
              and surveillance team to manage and analyze disease outbreak data.
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

      {["admin", "cesu", "surveillance_team"].includes(auth?.role) && (
        <section className={`rounded-xl border p-4 sm:p-5 ${thresholdTone}`}>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white/70 p-2 shadow-sm">
              <BellAlertIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Automatic {thresholdResult?.periodType || "surveillance"} threshold</p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {thresholdResult ? formatStatusLabel(thresholdResult.outcome) : "Calculating threshold status…"}
                  </h2>
                </div>
                {thresholdResult?.targetYear && (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium">
                    {thresholdResult.periodType === "weekly"
                      ? `Epidemiological Week ${thresholdResult.targetWeek}, ${thresholdResult.targetYear}`
                      : new Date(Date.UTC(thresholdResult.targetYear, thresholdResult.targetMonth - 1)).toLocaleString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" })}
                  </span>
                )}
              </div>

              {thresholdError ? (
                <p className="mt-2 text-sm text-red-700">{thresholdError}</p>
              ) : thresholdResult && (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Observed validated / confirmed", thresholdResult.observedConfirmedCases],
                      ["Historical mean", thresholdResult.baselineMean ?? "Insufficient data"],
                      ["Alert threshold", thresholdResult.alertThreshold ?? "—"],
                      ["Epidemic threshold", thresholdResult.epidemicThreshold ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white/60 px-3 py-2">
                        <p className="text-[11px] opacity-70">{label}</p>
                        <p className="mt-0.5 font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs opacity-75">
                    Confirmed official cases and confirmed surveillance reports are combined automatically at query time. Reported and suspected submissions are excluded.
                  </p>
                  {thresholdResult.insufficiencyReason && (
                    <p className="mt-2 rounded-md bg-white/70 px-3 py-2 text-xs font-medium">
                      {thresholdResult.insufficiencyReason}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* cards + charts (same for both roles) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <YearlyLineChart
          title={`Validated / Confirmed Cases${formatCoverageRange(dataset) ? ` (${formatCoverageRange(dataset)})` : " — Available Period"}`}
          data={yearlyData}
        />

        <DistrictBarChartVertical
          title={
            selectedYear === "all"
              ? "Validated / Confirmed Case Distribution by District (All Years)"
              : `Validated / Confirmed Case Distribution by District (${selectedYear})`
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
