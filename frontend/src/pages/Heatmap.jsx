import { useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";

import { mockOfficialCases } from "../data/mockOfficialCases";

import {
  filterOfficialCases,
  buildDistrictHeatmapPointsFromCases,
  buildRiskStatsFromDistrictPoints,
  getRiskColor,
  getRadius,
  getUniqueDiseasesFromCases,
  getUniqueYearsFromCases,
  buildTopDistrictsFromPoints,
  buildTopDiseasesFromCases,
} from "../utils/heatmapCaseBuilders";

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

export default function Heatmap() {
  const caseRows = mockOfficialCases;

  // Options
  const yearOptions = useMemo(
    () => ["All", ...getUniqueYearsFromCases(caseRows)],
    [caseRows]
  );

  const diseaseOptions = useMemo(
    () => ["All", ...getUniqueDiseasesFromCases(caseRows)],
    [caseRows]
  );

  // Defaults: latest year (more meaningful than "All")
  const defaultYear = useMemo(() => {
    const years = getUniqueYearsFromCases(caseRows);
    return years.length ? years[years.length - 1] : "All";
  }, [caseRows]);

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedDisease, setSelectedDisease] = useState("All");

  // Filter official cases
  const filteredCases = useMemo(() => {
    return filterOfficialCases(caseRows, {
      year: selectedYear,
      disease: selectedDisease,
    });
  }, [caseRows, selectedYear, selectedDisease]);

  // Build district points for map
  const districtPoints = useMemo(
    () => buildDistrictHeatmapPointsFromCases(filteredCases),
    [filteredCases]
  );

  const stats = useMemo(
    () => buildRiskStatsFromDistrictPoints(districtPoints),
    [districtPoints]
  );

  const title = useMemo(() => {
    const y = selectedYear === "All" ? "All Years" : selectedYear;
    const d = selectedDisease === "All" ? "All Diseases" : selectedDisease;
    return `Risk Map (${y} • ${d})`;
  }, [selectedYear, selectedDisease]);

  const showNoData =
    (selectedYear !== "All" || selectedDisease !== "All") &&
    districtPoints.length === 0;

  const topDistricts = useMemo(
    () => buildTopDistrictsFromPoints(districtPoints, 5),
    [districtPoints]
  );

  const topDiseases = useMemo(
    () => buildTopDiseasesFromCases(filteredCases, 5),
    [filteredCases]
  );

  // Mock mode
  const loadingOverlay = null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Heatmap</h1>
        <p className="text-gray-600 mt-1">
          District-level disease burden by year (centroid-weighted)
        </p>
      </div>

      <HeatmapStatsRow stats={stats} />

      <div className="grid grid-cols-12 gap-6">
        <HeatmapMapCard
          title={title}
          // New: pass controls as simple JSX
          controls={
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <h2 className="font-semibold text-lg">{title}</h2>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedYear(e.target.value === "All" ? "All" : Number(e.target.value))
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
                  value={selectedDisease}
                  onChange={(e) => setSelectedDisease(e.target.value)}
                >
                  {diseaseOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "All Diseases" : opt}
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
          getRadius={getRadius}
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
