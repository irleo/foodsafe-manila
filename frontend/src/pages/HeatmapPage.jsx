import { useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";

import {
  buildConcentrationStats,
  getConcentrationColor,
  buildTopDistrictsFromPoints,
} from "../utils/heatmapCaseBuilders";

import { useAuth } from "../context/AuthContext";
import { useLatestDatasetId } from "../hooks/useLatestDatasetId";
import { useHeatmapPoints } from "../hooks/useHeatmapPoints";

import HeatmapStatsRow from "../components/heatmap/HeatmapStatsRow";
import HeatmapMapCard from "../components/heatmap/HeatmapMapCard";
import LegendCard from "../components/heatmap/LegendCard";
import TopDistrictsCard from "../components/heatmap/TopDistrictsCard";
import TopDiseaseCard from "../components/heatmap/TopDiseaseCard";

const MANILA_CITY_BOUNDS = [
  [14.53, 120.93],
  [14.7, 121.05],
];

const MANILA_CENTER = [14.5995, 120.9842];

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

export default function Heatmap() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const { datasetId } = useLatestDatasetId(token);

  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedDisease, setSelectedDisease] = useState("All");
  const [selectedCaseClassification, setSelectedCaseClassification] =
    useState("confirmed");

  const { points, districtStats, diseaseStats, filterOptions, loading, errorMsg } =
    useHeatmapPoints({
      token,
      datasetId,
      selectedYear,
      selectedMonth,
      selectedDisease,
      selectedCaseClassification,
    });

  const yearOptions = useMemo(() => {
    const years = Array.isArray(filterOptions?.years)
      ? filterOptions.years.filter((y) => Number.isFinite(Number(y)))
      : [];
    return ["All", ...years.map(Number).sort((a, b) => a - b)];
  }, [filterOptions]);

  const districtPoints = useMemo(() => (Array.isArray(points) ? points : []), [points]);

  const stats = useMemo(
    () => buildConcentrationStats(districtStats, points, selectedCaseClassification),
    [districtStats, points, selectedCaseClassification],
  );

  const diseaseOptions = useMemo(() => {
    const diseases = Array.isArray(filterOptions?.diseases)
      ? filterOptions.diseases.filter(Boolean)
      : [];
    return ["All", ...diseases.sort((a, b) => a.localeCompare(b))];
  }, [filterOptions]);

  const classificationOptions = useMemo(() => {
    const classes = Array.isArray(filterOptions?.caseClassifications)
      ? filterOptions.caseClassifications.filter(Boolean)
      : [];
    return [...new Set([selectedCaseClassification, ...classes])]
      .sort((a, b) => a.localeCompare(b));
  }, [filterOptions, selectedCaseClassification]);

  const title = useMemo(() => {
    return `Manila Case Concentration Map`;
  }, []);

  const showNoData =
    (selectedYear !== "All" ||
      selectedMonth !== "All" ||
      selectedDisease !== "All" ||
      selectedCaseClassification !== "confirmed") &&
    districtPoints.length === 0;

  const topDistricts = useMemo(
    () => buildTopDistrictsFromPoints(districtStats, 5),
    [districtStats],
  );

  const topDiseases = useMemo(
    () =>
      (Array.isArray(diseaseStats) ? diseaseStats : [])
        .sort((a, b) => (b.cases ?? 0) - (a.cases ?? 0))
        .slice(0, 5),
    [diseaseStats],
  );

  const loadingOverlay = loading ? (
    <div className="absolute inset-0 z-[950] bg-white/60 flex items-center justify-center text-sm text-gray-700">
      Loading heatmap…
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Case Concentration Map</h1>
        <p className="text-gray-600 mt-1">
          Barangay-level distribution for one clearly selected case status. Color indicates relative concentration, not an official risk level.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {errorMsg}
        </div>
      )}

      <HeatmapStatsRow
        stats={stats}
        status={selectedCaseClassification}
        statusOptions={classificationOptions}
        onStatusChange={setSelectedCaseClassification}
      />

      <div className="grid grid-cols-12 gap-6">
        <HeatmapMapCard
          title={title}
          controls={
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Year
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-gray-800"
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(event.target.value === "All" ? "All" : Number(event.target.value))}
                  >
                    {yearOptions.map((option) => (
                      <option key={option} value={option}>{option === "All" ? "All Years" : option}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Month
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-gray-800"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value === "All" ? "All" : Number(event.target.value))}
                  >
                    <option value="All">All Months</option>
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Disease
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-gray-800"
                    value={selectedDisease}
                    onChange={(event) => setSelectedDisease(event.target.value)}
                  >
                    {diseaseOptions.map((option) => (
                      <option key={option} value={option}>{option === "All" ? "All Diseases" : option}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          }
          districtPoints={districtPoints}
          mapType="District"
          showNoData={showNoData}
          loadingOverlay={loadingOverlay}
          MANILA_CENTER={MANILA_CENTER}
          MANILA_CITY_BOUNDS={MANILA_CITY_BOUNDS}
          getConcentrationColor={getConcentrationColor}
        />

        <div className="col-span-12 lg:col-span-3 space-y-4">
          <LegendCard />
          <TopDistrictsCard items={topDistricts} />
          <TopDiseaseCard items={topDiseases} />
        </div>
      </div>
    </div>
  );
}
