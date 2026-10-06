import { useEffect, useMemo, useState } from "react";
import { BellAlertIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage, logClientError } from "../../utils/errors";
import { useLatestDatasetId } from "../../hooks/useLatestDatasetId";
import { useOfficialCases } from "../../hooks/useOfficialCases";
import {
  buildYearlyTimelineData,
  buildDistrictCaseData,
  buildDiseaseData,
} from "./utils/dashboardBuilders";
import YearlyLineChart from "./components/YearlyLineChart";
import DistrictBarChartVertical from "./components/DistrictBarChartVertical";
import DiseasePieChart from "./components/DiseasePieChart";
import RecentActivityCard from "./components/RecentActivityCard";
import { CHART_COLORS } from "../../constants/chartColors";
import { fetchCurrentThreshold } from "../../api/thresholds";
import DataCoverageNotice from "../../components/common/DataCoverageNotice";
import { formatCoverageRange } from "../../utils/dataCoverage";
import { SURVEILLANCE_DISEASES } from "../../constants/surveillanceMethodology.js";
import { formatThresholdValue } from "../../utils/formatThresholdValue.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const MANILA_DISTRICTS = Array.from({ length: 6 }, (_, index) => `District ${index + 1}`);
const THRESHOLD_SCOPE_ALL = "whole_manila";

function formatThresholdPeriod(result) {
  if (!result?.targetYear) return "Not available";
  if (!result.targetMonth) return String(result.targetYear);
  return new Date(Date.UTC(result.targetYear, result.targetMonth - 1)).toLocaleString(
    "en-PH",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusPresentation(outcome) {
  if (outcome === "epidemic_threshold_exceeded") {
    return {
      shell: "border-[#b23a2e] bg-[#f8e2df]",
      icon: "bg-white/70 text-[#b23a2e]",
      text: "text-[#b23a2e]",
      accent: "#b23a2e",
      label: "Epidemic threshold exceeded",
    };
  }
  if (outcome === "alert_threshold_exceeded") {
    return {
      shell: "border-[#c97a2b] bg-[#f7e7d2]",
      icon: "bg-white/70 text-[#9c5c1e]",
      text: "text-[#9c5c1e]",
      accent: "#9c5c1e",
      label: "Alert threshold exceeded",
    };
  }
  if (outcome === "within_expected_level") {
    return {
      shell: "border-[#134c8c] bg-[#e1ebf7]",
      icon: "bg-white/70 text-[#134c8c]",
      text: "text-[#0c3a6b]",
      accent: "#134c8c",
      label: "Within expected level",
    };
  }
  if (outcome === "no_data") {
    return {
      shell: "border-[#d7e1ec] bg-[#edf0f3]",
      icon: "bg-white/70 text-[#6b7684]",
      text: "text-[#6b7684]",
      accent: "#6b7684",
      label: "No data available",
    };
  }
  return {
    shell: "border-[#d7e1ec] bg-[#edf0f3]",
    icon: "bg-white/70 text-[#6b7684]",
    text: "text-[#6b7684]",
    accent: "#6b7684",
    label: "Threshold unavailable",
  };
}

function ThresholdGauge({ result, accent }) {
  const observed = finiteNumber(result?.observedCases);
  const alert = finiteNumber(result?.alertThreshold);
  const epidemic = finiteNumber(result?.epidemicThreshold);
  if (observed === null || alert === null || epidemic === null) return null;

  const scaleMax = Math.max(observed, alert, epidemic, 1) * 1.15;
  const percent = (value) => Math.max(0, Math.min(100, (value / scaleMax) * 100));
  const alertPercent = percent(alert);
  const epidemicPercent = percent(epidemic);
  const observedPercent = Math.max(5, Math.min(95, percent(observed)));

  return (
    <div className="mt-5 border-t border-white/70 pt-8">
      <div className="relative">
        <span
          className="absolute bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
          style={{ left: `clamp(3.5rem, ${observedPercent}%, calc(100% - 3.5rem))`, backgroundColor: accent }}
        >
          Observed: {formatThresholdValue(observed)}
        </span>
        <div
          role="meter"
          aria-label="Observed cases relative to alert and epidemic thresholds"
          aria-valuemin={0}
          aria-valuemax={scaleMax}
          aria-valuenow={observed}
          className="flex h-2.5 overflow-hidden rounded-full ring-1 ring-inset ring-black/5"
        >
          <span className="bg-[#134c8c]" style={{ width: `${alertPercent}%` }} />
          <span className="bg-[#c97a2b]" style={{ width: `${Math.max(0, epidemicPercent - alertPercent)}%` }} />
          <span className="flex-1 bg-[#b23a2e]" />
        </div>
        <span
          className="absolute top-0 h-2.5 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.55)]"
          style={{ left: `${percent(observed)}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-medium text-slate-600">
        <span>0</span>
        <span>
          Alert: {formatThresholdValue(alert)}
        </span>
        <span>Epidemic: {formatThresholdValue(epidemic)}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const canViewThreshold = ["admin", "cesu", "surveillance_team"].includes(auth?.role);
  const { datasetId, dataset } = useLatestDatasetId(token);
  const { items: officialItems } = useOfficialCases({ token, datasetId, limit: 5000 });

  const caseRows = useMemo(() => {
    const safe = Array.isArray(officialItems) ? officialItems : [];
    return safe.map((row) => ({
      city: row.city ?? "Manila",
      district: row.district,
      disease: row.disease,
      year: Number(row.year),
      cases: Number(row.cases),
    }));
  }, [officialItems]);

  const availableYears = useMemo(() => {
    const years = new Set(caseRows.map((row) => row.year).filter(Number.isFinite));
    return Array.from(years).sort((a, b) => b - a);
  }, [caseRows]);
  const [selectedYear, setSelectedYear] = useState("all");
  const districtRows = useMemo(
    () => selectedYear === "all"
      ? caseRows
      : caseRows.filter((row) => row.year === Number(selectedYear)),
    [caseRows, selectedYear],
  );
  const yearlyData = useMemo(() => buildYearlyTimelineData(caseRows, 5), [caseRows]);
  const districtData = useMemo(() => buildDistrictCaseData(districtRows), [districtRows]);
  const diseaseData = useMemo(() => buildDiseaseData(caseRows), [caseRows]);

  const [activity, setActivity] = useState([]);
  const [thresholdScope, setThresholdScope] = useState(THRESHOLD_SCOPE_ALL);
  const [thresholdDisease, setThresholdDisease] = useState(SURVEILLANCE_DISEASES[0]);
  const [thresholdResult, setThresholdResult] = useState(null);
  const [thresholdLoading, setThresholdLoading] = useState(false);
  const [thresholdError, setThresholdError] = useState("");

  useEffect(() => {
    let isMounted = true;
    if (!token) {
      setActivity([]);
      return () => { isMounted = false; };
    }

    const fetchActivity = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/activity?page=1&limit=4`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!response.ok) throw new Error(`Activity request failed (${response.status})`);
        const data = await response.json();
        if (isMounted) setActivity(Array.isArray(data?.items) ? data.items : []);
      } catch (error) {
        if (!isMounted) return;
        logClientError("Failed to load recent activity", error);
        setActivity([]);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchActivity();
    };
    void fetchActivity();
    const intervalId = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !datasetId || !canViewThreshold) return undefined;
    let isMounted = true;

    const loadThreshold = async () => {
      setThresholdLoading(true);
      setThresholdResult(null);
      setThresholdError("");
      try {
        const district = thresholdScope === THRESHOLD_SCOPE_ALL ? undefined : thresholdScope;
        const response = await fetchCurrentThreshold(token, datasetId, {
          disease: thresholdDisease,
          district,
        });
        if (isMounted) setThresholdResult(response?.result || null);
      } catch (error) {
        if (!isMounted) return;
        setThresholdError(getErrorMessage(error, "Threshold data is currently unavailable."));
      } finally {
        if (isMounted) setThresholdLoading(false);
      }
    };

    void loadThreshold();
    return () => { isMounted = false; };
  }, [canViewThreshold, datasetId, thresholdDisease, thresholdScope, token]);

  const tone = statusPresentation(thresholdResult?.outcome);
  const scopeLabel = thresholdScope === THRESHOLD_SCOPE_ALL ? "Manila-Wide" : thresholdScope;
  const coverageRange = formatCoverageRange(dataset);

  return (
    <div className="min-w-0 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-950">Dashboard Overview</h1>
        <p className="mt-1 text-slate-600">Overview of foodborne disease burden and trends</p>
      </header>

      {canViewThreshold && (
        <section className={`rounded-xl border p-4 shadow-sm sm:p-5 ${tone.shell}`}>
          <div className="flex items-start gap-3">
            <span className={`rounded-lg p-2 shadow-sm ${tone.icon}`}>
              <BellAlertIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${tone.text}`}>
                      {scopeLabel} Risk Status
                    </p>
                    <div className="group relative">
                      <button type="button" aria-label="About threshold methodology" className="rounded-full opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                        <InformationCircleIcon className="h-4 w-4" />
                      </button>
                      <div role="tooltip" className="pointer-events-none invisible absolute left-0 top-6 z-20 w-[min(20rem,calc(100vw-6rem))] rounded-lg bg-slate-950 px-3 py-2 text-xs font-normal normal-case leading-5 tracking-normal text-white opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                        The latest complete month is compared with the same calendar month from exactly five eligible previous years. A count must be higher than a threshold to cross it.
                      </div>
                    </div>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">
                    {thresholdLoading ? "Calculating threshold status…" : tone.label}
                  </h2>
                  {thresholdResult?.targetYear && (
                    <span className="mt-2 inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
                      Cases checked: {formatThresholdPeriod(thresholdResult)} (latest complete month)
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <select aria-label="Threshold disease" value={thresholdDisease} onChange={(event) => setThresholdDisease(event.target.value)} className="min-h-11 min-w-0 w-full rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-blue-300 sm:w-auto">
                    {SURVEILLANCE_DISEASES.map((disease) => <option key={disease} value={disease}>{disease}</option>)}
                  </select>
                  <select aria-label="Threshold geographic scope" value={thresholdScope} onChange={(event) => setThresholdScope(event.target.value)} className="min-h-11 min-w-0 w-full rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-blue-300 sm:w-auto">
                    <option value={THRESHOLD_SCOPE_ALL}>Whole Manila</option>
                    {MANILA_DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
                  </select>
                </div>
              </div>

              {thresholdError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-white/80 px-3 py-3 text-sm text-red-700">
                  <p className="font-semibold">The current threshold status could not be calculated.</p>
                  <p className="mt-1">{thresholdError}</p>
                </div>
              ) : thresholdResult?.insufficiencyReason ? (
                <div className="mt-4 rounded-xl border border-white/80 bg-white/80 px-4 py-4">
                  <p className="font-semibold text-slate-950">
                    {thresholdResult.outcome === "no_data"
                      ? "No verified data for this scope."
                      : "Insufficient historical data to establish a baseline."}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{thresholdResult.insufficiencyReason}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-full bg-[#edf0f3] px-2.5 py-1 text-[#6b7684]">
                      Available: {thresholdResult.baselinePeriods?.length || 0} of 5 required years
                    </span>
                    <span className="rounded-full bg-[#edf0f3] px-2.5 py-1 text-[#6b7684]">
                      No alert or epidemic status assigned
                    </span>
                  </div>
                </div>
              ) : thresholdResult ? (
                <>
                  <ThresholdGauge result={thresholdResult} accent={tone.accent} />
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Observed eligible cases", thresholdResult.observedCases],
                      ["Historical mean", thresholdResult.baselineMean],
                      ["Alert threshold", thresholdResult.alertThreshold],
                      ["Epidemic threshold", thresholdResult.epidemicThreshold],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white/65 px-3 py-2">
                        <p className="text-[11px] text-slate-600">{label}</p>
                        <p className="mt-0.5 font-semibold text-slate-950">{formatThresholdValue(value)}</p>
                      </div>
                    ))}
                  </div>
                  {thresholdResult.caseDefinition && (
                    <p className="mt-3 text-xs leading-5 text-slate-600">{thresholdResult.caseDefinition}</p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </section>
      )}

      <DataCoverageNotice dataset={dataset} />

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <YearlyLineChart
          title={`Confirmed Cases${coverageRange ? ` (${coverageRange})` : " — Available Period"}`}
          data={yearlyData}
        />
        <DistrictBarChartVertical
          title={selectedYear === "all"
            ? "Confirmed Case Distribution by District (All Years)"
            : `Confirmed Case Distribution by District (${selectedYear})`}
          data={districtData}
          headerRight={(
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
              <option value="all">All years</option>
              {availableYears.map((year) => <option key={year} value={String(year)}>{year}</option>)}
            </select>
          )}
        />
        <DiseasePieChart data={diseaseData} colors={CHART_COLORS} />
        <RecentActivityCard items={activity} />
      </div>
    </div>
  );
}
