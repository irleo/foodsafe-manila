import { useMemo, useState, useEffect } from "react";
import "leaflet/dist/leaflet.css";

import { useAuth } from "../context/AuthContext";
import { useReports } from "../hooks/useReports";
import { mockReports } from "../data/mockReports";

import {
  buildDistrictHeatmapPoints,
  buildRiskStatsFromDistrictPoints,
  getRiskColor,
  getRadius,
  getUniqueDistricts,
  getUniqueIllnesses,
  filterReports,
} from "../utils/heatmapBuilders";

import {
  buildTopDistrictsFromPoints,
  buildTopIllnessesFromReports,
} from "../utils/heatmapInsights";

import HeatmapStatsRow from "../components/heatmap/HeatmapStatsRow";
import HeatmapControls from "../components/heatmap/HeatmapControls";
import HeatmapMapCard from "../components/heatmap/HeatmapMapCard";
import LegendCard from "../components/heatmap/LegendCard";
import TopDistrictsCard from "../components/heatmap/TopDistrictsCard";
import TopIllnessCard from "../components/heatmap/TopIllnessCard";

const MANILA_CITY_BOUNDS = [
  [14.53, 120.93],
  [14.7, 121.05],
];

const MANILA_CENTER = [14.5995, 120.9842];

export default function Heatmap() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const { reports, loading, errorMsg } = useReports(token);

  const finalReports = reports.length ? reports : mockReports;

  const [mapType, setMapType] = useState("District"); // District | Illness
  const [selectedIllness, setSelectedIllness] = useState("All");
  const [selectedDistrict, setSelectedDistrict] = useState("All");

  useEffect(() => {
    if (mapType === "District") setSelectedIllness("All");
    if (mapType === "Illness") setSelectedDistrict("All");
  }, [mapType]);

  const illnessOptions = useMemo(
    () => ["All", ...getUniqueIllnesses(finalReports)],
    [finalReports]
  );
  const districtOptions = useMemo(
    () => ["All", ...getUniqueDistricts(finalReports)],
    [finalReports]
  );

  const filteredReports = useMemo(() => {
    if (mapType === "District") {
      return filterReports(finalReports, {
        district: selectedDistrict,
        illness: "All",
      });
    }
    return filterReports(finalReports, {
      illness: selectedIllness,
      district: "All",
    });
  }, [finalReports, mapType, selectedDistrict, selectedIllness]);

  const districtPoints = useMemo(
    () => buildDistrictHeatmapPoints(filteredReports),
    [filteredReports]
  );

  const stats = useMemo(
    () => buildRiskStatsFromDistrictPoints(districtPoints),
    [districtPoints]
  );

  const title = useMemo(() => {
    if (mapType === "District") {
      return `Risk Map (${
        selectedDistrict === "All" ? "All Districts" : selectedDistrict
      })`;
    }
    return `Risk Map (${
      selectedIllness === "All" ? "All Illnesses" : selectedIllness
    })`;
  }, [mapType, selectedDistrict, selectedIllness]);

  const showNoData =
    (mapType === "District" &&
      selectedDistrict !== "All" &&
      districtPoints.length === 0) ||
    (mapType === "Illness" &&
      selectedIllness !== "All" &&
      districtPoints.length === 0);

  const dropdownValue =
    mapType === "District" ? selectedDistrict : selectedIllness;
  const dropdownOptions =
    mapType === "District" ? districtOptions : illnessOptions;

  const handleDropdownChange = (e) => {
    const value = e.target.value;
    if (mapType === "District") setSelectedDistrict(value);
    else setSelectedIllness(value);
  };

  const topDistricts = useMemo(
    () => buildTopDistrictsFromPoints(districtPoints, 5),
    [districtPoints]
  );

  const topIllnesses = useMemo(
    () => buildTopIllnessesFromReports(filteredReports, 5),
    [filteredReports]
  );

  const controls = (
    <HeatmapControls
      title={title}
      mapType={mapType}
      setMapType={setMapType}
      dropdownValue={dropdownValue}
      dropdownOptions={dropdownOptions}
      onDropdownChange={handleDropdownChange}
    />
  );

  const loadingOverlay =
    loading && !reports.length ? (
      <div className="absolute inset-0 z-[999] grid place-items-center bg-white/70">
        <p className="text-sm text-gray-700">Loading map…</p>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Heatmap</h1>
        <p className="text-gray-600">Interactive map showing illness density by location</p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {errorMsg} (Showing sample data.)
        </div>
      )}

      <HeatmapStatsRow stats={stats} />

      <div className="grid grid-cols-12 gap-6">
        <HeatmapMapCard
          title={title}
          controls={controls}
          districtPoints={districtPoints}
          mapType={mapType}
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
          <TopIllnessCard items={topIllnesses} />
        </div>
      </div>
    </div>
  );
}
