import { useEffect, useMemo, useState } from "react";
import {
  ArrowTrendingDownIcon,
  BellAlertIcon,
  DevicePhoneMobileIcon,
  InformationCircleIcon,
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
import { SURVEILLANCE_DISEASES } from "../constants/surveillanceMethodology.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const MANILA_DISTRICTS = Array.from(
  { length: 6 },
  (_, index) => `District ${index + 1}`,
);
const THRESHOLD_SCOPE_ALL = "whole_manila";

function formatThresholdPeriod(result) {
  if (!result?.targetYear) return "Not available";
  if (!result.targetMonth) return String(result.targetYear);
  return new Date(Date.UTC(result.targetYear, result.targetMonth - 1)).toLocaleString(
    "en-PH",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
}

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
  const [thresholdScope, setThresholdScope] = useState(THRESHOLD_SCOPE_ALL);
  const [thresholdDisease, setThresholdDisease] = useState(SURVEILLANCE_DISEASES[0]);
  const [thresholdResult, setThresholdResult] = useState(null);
  const [thresholdLoading, setThresholdLoading] = useState(false);
  const [thresholdError, setThresholdError] = useState("");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/activity?page=1&limit=4`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
          credentials: "include",
        });
        const data = await res.json();
        if (!isMounted) return;
        setActivity(Array.isArray(data?.items) ? data.items : []);
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to load recent activity", error);
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

    (async () => {
      setThresholdLoading(true);
      setThresholdResult(null);
      setThresholdError("");

      try {
        const district = thresholdScope === THRESHOLD_SCOPE_ALL ? undefined : thresholdScope;
        const response = await fetchCurrentThreshold(token, datasetId, {
          disease: thresholdDisease,
          district,
        });
        if (!isMounted) return;
        setThresholdResult(response?.result || null);
      } catch (error) {
        if (!isMounted) return;
        setThresholdError(error.message || "Unable to calculate threshold");
      } finally {
        if (isMounted) setThresholdLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [auth?.role, datasetId, thresholdDisease, thresholdScope, token]);

  const thresholdTone = thresholdResult?.outcome === "epidemic_threshold_exceeded"
    ? "border-red-300 bg-red-50 text-red-950"
    : thresholdResult?.outcome === "alert_threshold_exceeded"
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

      {["admin", "cesu", "surveillance_team"].includes(auth?.role) && (
        <section className={`rounded-xl border p-4 sm:p-5 ${thresholdTone}`}>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white/70 p-2 shadow-sm">
              <BellAlertIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Latest observed monthly threshold status</p>
                    <div className="group relative">
                      <button type="button" aria-label="About threshold methodology" className="rounded-full opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                        <InformationCircleIcon className="h-4 w-4" />
                      </button>
                      <div role="tooltip" className="pointer-events-none invisible absolute left-0 top-6 z-20 w-80 rounded-lg bg-gray-950 px-3 py-2 text-xs font-normal normal-case leading-5 tracking-normal text-white opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                        This checks recorded cases from the latest complete month. The comparison uses the same calendar month from exactly five eligible previous years. A count must be higher than a threshold to cross it.
                      </div>
                    </div>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold">
                    {thresholdLoading
                      ? "Calculating threshold status…"
                      : thresholdResult
                        ? formatStatusLabel(thresholdResult.outcome)
                        : "Threshold unavailable"}
                  </h2>
                  <div className="">
                    {thresholdResult?.targetYear && (
                      <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium">
                        Cases checked: {formatThresholdPeriod(thresholdResult)} (latest complete month)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-row items-stretch gap-2 sm:items-end">
                  <select
                    aria-label="Threshold disease"
                    value={thresholdDisease}
                    onChange={(event) => setThresholdDisease(event.target.value)}
                    className="min-h-10 rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {SURVEILLANCE_DISEASES.map((disease) => (
                      <option key={disease} value={disease}>{disease}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Threshold geographic scope"
                    value={thresholdScope}
                    onChange={(event) => setThresholdScope(event.target.value)}
                    className="min-h-10 rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value={THRESHOLD_SCOPE_ALL}>Whole Manila</option>
                    {MANILA_DISTRICTS.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>

              {thresholdError ? (
                <p className="mt-2 text-sm text-red-700">{thresholdError}</p>
              ) : thresholdResult && (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Observed eligible cases", thresholdResult.observedCases],
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
                    {thresholdResult.caseDefinition}
                  </p>
                  {thresholdResult.insufficiencyReason && (
                    <div className="mt-3 rounded-lg border border-gray-200/80 bg-white/80 px-3 py-3">
                      <p className="text-sm font-semibold">{thresholdResult.outcome === "no_data" ? "No verified data for this scope." : "Insufficient historical data to establish a baseline."}</p>
                      <p className="mt-1 text-xs opacity-75">{thresholdResult.insufficiencyReason}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                          Available: {thresholdResult.baselinePeriods?.length || 0} of 5 required years
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                          No alert or epidemic status assigned
                        </span>
                      </div>
                    </div>
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
          title={`Confirmed Cases${formatCoverageRange(dataset) ? ` (${formatCoverageRange(dataset)})` : " — Available Period"}`}
          data={yearlyData}
        />

        <DistrictBarChartVertical
          title={
            selectedYear === "all"
              ? "Confirmed Case Distribution by District (All Years)"
              : `Confirmed Case Distribution by District (${selectedYear})`
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
