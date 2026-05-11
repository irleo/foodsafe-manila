import { useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";

import {
  buildRiskStatsFromDistrictPoints,
  getRiskColor,
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
    useState("All");

  const { points, districtStats, filterOptions, loading, errorMsg } = useHeatmapPoints({
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

  const districtPoints = useMemo(() => {
    const safe = Array.isArray(points) ? points : [];
    return safe.map((p) => ({
      ...p,
      risk: p.risk,
    }));
  }, [points]);

  const stats = useMemo(
    () => buildRiskStatsFromDistrictPoints(districtStats),
    [districtStats],
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
    return ["All", ...classes.sort((a, b) => a.localeCompare(b))];
  }, [filterOptions]);

  const title = useMemo(() => {
    const y = selectedYear === "All" ? "All Years" : selectedYear;
    const m =
      selectedMonth === "All"
        ? "All Months"
        : MONTH_OPTIONS.find((month) => month.value === Number(selectedMonth))
            ?.label || selectedMonth;
    const d = selectedDisease === "All" ? "All Diseases" : selectedDisease;
    const c =
      selectedCaseClassification === "All"
        ? "All Classifications"
        : selectedCaseClassification;
    return `Manila Risk Map`;
  }, [
    selectedYear,
    selectedMonth,
    selectedDisease,
    selectedCaseClassification,
  ]);

  const showNoData =
    (selectedYear !== "All" ||
      selectedMonth !== "All" ||
      selectedDisease !== "All" ||
      selectedCaseClassification !== "All") &&
    districtPoints.length === 0;

  const topDistricts = useMemo(
    () => buildTopDistrictsFromPoints(districtStats, 5),
    [districtStats],
  );

  // We don't have disease breakdown from the heatmap endpoint; keep this card empty for now.
  const topDiseases = useMemo(() => [], []);

  const loadingOverlay = loading ? (
    <div className="absolute inset-0 z-[950] bg-white/60 flex items-center justify-center text-sm text-gray-700">
      Loading heatmap…
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Heatmap</h1>
        <p className="text-gray-600 mt-1">
          Barangay-level disease burden by month, colored by district average incident risk
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {errorMsg}
        </div>
      )}

      <HeatmapStatsRow stats={stats} />

      <div className="grid grid-cols-12 gap-6">
        <HeatmapMapCard
          title={title}
          controls={
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <h2 className="font-semibold text-lg">{title}</h2>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedYear(
                      e.target.value === "All" ? "All" : Number(e.target.value),
                    )
                  }
                >
                  {yearOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "All Years" : opt}
                    </option>
                  ))}
                </select>

                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={selectedMonth}
                  onChange={(e) =>
                    setSelectedMonth(
                      e.target.value === "All" ? "All" : Number(e.target.value),
                    )
                  }
                >
                  <option value="All">All Months</option>

                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>

                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={selectedDisease}
                  onChange={(e) => setSelectedDisease(e.target.value)}
                >
                  {diseaseOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "All Diseases" : opt}
                    </option>
                  ))}
                </select>

                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={selectedCaseClassification}
                  onChange={(e) =>
                    setSelectedCaseClassification(e.target.value)
                  }
                >
                  {classificationOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "All Classifications" : opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
          districtPoints={districtPoints}
          mapType="District"
          showNoData={showNoData}
          loadingOverlay={loadingOverlay}
          MANILA_CENTER={MANILA_CENTER}
          MANILA_CITY_BOUNDS={MANILA_CITY_BOUNDS}
          getRiskColor={getRiskColor}
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
