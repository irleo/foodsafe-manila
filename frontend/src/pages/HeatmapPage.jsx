import { useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";

import {
  buildConcentrationStats,
  getConcentrationColor,
  buildTopDistrictsFromPoints,
} from "../utils/heatmapCaseBuilders";
import {
  buildForecastComparison,
  buildForecastDistrictPoints,
  formatForecastPeriod,
} from "../utils/heatmapForecastBuilders";

import { useAuth } from "../context/AuthContext";
import { useLatestDatasetId } from "../hooks/useLatestDatasetId";
import { useHeatmapPoints } from "../hooks/useHeatmapPoints";
import { useLatestPredictionRun } from "../hooks/useLatestPredictionRun";
import DataCoverageNotice from "../components/DataCoverageNotice";

import HeatmapStatsRow from "../components/heatmap/HeatmapStatsRow";
import HeatmapMapCard from "../components/heatmap/HeatmapMapCard";
import LegendCard from "../components/heatmap/LegendCard";
import TopDistrictsCard from "../components/heatmap/TopDistrictsCard";
import TopDiseaseCard from "../components/heatmap/TopDiseaseCard";
import SurveillanceAttentionCard from "../components/heatmap/SurveillanceAttentionCard";

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

const VIEW_MODES = [
  { value: "actual", label: "Actual" },
  { value: "forecast", label: "Forecast" },
];

function displayNumber(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-PH", { maximumFractionDigits: 1 })
    : "—";
}

export default function Heatmap() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const { datasetId, dataset } = useLatestDatasetId(token);
  const { predictionRun, loading: forecastLoading, errorMsg: forecastError } =
    useLatestPredictionRun(token);

  const [viewMode, setViewMode] = useState("actual");
  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedDisease, setSelectedDisease] = useState("All");
  const [selectedCaseClassification, setSelectedCaseClassification] =
    useState("confirmed");

  const selectedForecastPayload = useMemo(
    () => {
      const globalPayload = predictionRun?.payload || {};
      if (!Array.isArray(globalPayload.diseases)) return globalPayload;
      return globalPayload.diseases.find((item) => item.disease === selectedDisease)
        || globalPayload.diseases[0]
        || {};
    },
    [predictionRun, selectedDisease],
  );
  const selectedPredictionRun = useMemo(() => (
    predictionRun ? { ...predictionRun, payload: selectedForecastPayload } : null
  ), [predictionRun, selectedForecastPayload]);

  const forecastDistrictPoints = useMemo(
    () => buildForecastDistrictPoints(selectedPredictionRun),
    [selectedPredictionRun],
  );
  const forecastAvailable = forecastDistrictPoints.length > 0;
  const forecastMatchesDataset = !predictionRun?.basisDatasetId
    || !datasetId
    || String(predictionRun.basisDatasetId) === String(datasetId);
  const canUseForecast = forecastAvailable && forecastMatchesDataset;

  const changeViewMode = (nextMode) => {
    if (nextMode !== "actual") {
      if (!canUseForecast) return;
    }
    if (nextMode === "forecast") {
      const forecastDiseases = predictionRun?.payload?.diseases?.map((item) => item.disease).filter(Boolean) || [];
      if (!forecastDiseases.includes(selectedDisease) && forecastDiseases[0]) {
        setSelectedDisease(forecastDiseases[0]);
      }
    }
    setViewMode(nextMode);
  };

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
      ? filterOptions.years.filter((year) => Number.isFinite(Number(year)))
      : [];
    if (predictionRun?.basisYear) years.push(Number(predictionRun.basisYear));
    return ["All", ...[...new Set(years.map(Number))].sort((a, b) => a - b)];
  }, [filterOptions, predictionRun]);

  const districtPoints = useMemo(() => (Array.isArray(points) ? points : []), [points]);
  const actualStats = useMemo(
    () => buildConcentrationStats(districtStats, points, selectedCaseClassification),
    [districtStats, points, selectedCaseClassification],
  );
  const comparisonPoints = useMemo(
    () => buildForecastComparison(districtStats, forecastDistrictPoints),
    [districtStats, forecastDistrictPoints],
  );

  const diseaseOptions = useMemo(() => {
    const diseases = Array.isArray(filterOptions?.diseases)
      ? filterOptions.diseases.filter(Boolean)
      : [];
    const forecastDiseases = Array.isArray(predictionRun?.payload?.diseases)
      ? predictionRun.payload.diseases.map((item) => item.disease).filter(Boolean)
      : [];
    const combined = [...new Set([...diseases, ...forecastDiseases])].sort((a, b) => a.localeCompare(b));
    return viewMode === "forecast" ? combined : ["All", ...combined];
  }, [filterOptions, predictionRun, viewMode]);

  const classificationOptions = useMemo(() => {
    const classes = Array.isArray(filterOptions?.caseClassifications)
      ? filterOptions.caseClassifications.filter(Boolean)
      : [];
    return [...new Set([selectedCaseClassification, ...classes])]
      .sort((a, b) => a.localeCompare(b));
  }, [filterOptions, selectedCaseClassification]);

  const basisLabel = formatForecastPeriod(
    predictionRun?.basisYear,
    predictionRun?.basisMonth,
  );
  const forecastLabel = formatForecastPeriod(
    predictionRun?.forecastTargetYear,
    predictionRun?.forecastTargetMonth,
  );
  const predictedTotal = forecastDistrictPoints.reduce(
    (sum, point) => sum + Number(point.predictedCases || 0),
    0,
  );
  const forecastCoverage = selectedForecastPayload?.wholeManila?.coverage
    || selectedForecastPayload?.coverage
    || {};
  const totalForecastDistricts = Number(forecastCoverage.totalDistricts || forecastDistrictPoints.length);
  const completeCityForecast = forecastCoverage.completeCityForecast !== false
    && forecastDistrictPoints.length === totalForecastDistricts;

  const statCards = viewMode === "forecast"
    ? [
        { title: completeCityForecast ? "Predicted Cases" : "Predicted Cases (Available Districts)", value: displayNumber(predictedTotal) },
        { title: "Districts Forecasted", value: forecastDistrictPoints.length },
        { title: "Forecast Period", value: forecastLabel },
      ]
    : null;

  const topDistricts = useMemo(() => {
    if (viewMode === "actual") return buildTopDistrictsFromPoints(districtStats, 5);
    return forecastDistrictPoints.slice(0, 5).map((point) => ({
      name: point.district,
      cases: displayNumber(point.predictedCases),
      concentrationShare: point.concentrationShare,
    }));
  }, [districtStats, forecastDistrictPoints, viewMode]);

  const topDiseases = useMemo(
    () => [...(Array.isArray(diseaseStats) ? diseaseStats : [])]
      .sort((a, b) => (b.cases ?? 0) - (a.cases ?? 0))
      .slice(0, 5),
    [diseaseStats],
  );

  const title = viewMode === "forecast"
    ? `Confirmed-Case Forecast Concentration — ${forecastLabel}`
    : "Manila Case Concentration Map";
  const showNoData = viewMode === "actual"
    ? districtPoints.length === 0
    : !canUseForecast;
  const loadingOverlay = loading || (viewMode !== "actual" && forecastLoading) ? (
    <div className="absolute inset-0 z-[950] flex items-center justify-center bg-white/60 text-sm text-gray-700">
      Loading map data…
    </div>
  ) : null;

  const selectClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";
  const forecastDisabledReason = !forecastMatchesDataset
    ? "The saved forecast belongs to a different dataset. Refresh it in Predictions."
    : forecastError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Case Concentration and Forecast Map</h1>
        <p className="mt-1 max-w-4xl text-gray-600">
          Explore actual case concentration or the same district-level Best Model forecast saved by the Predictions module. Forecast values are displayed separately from observed cases.
        </p>
      </div>

      <DataCoverageNotice dataset={dataset} />

      {errorMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {errorMsg}
        </div>
      )}
      {!forecastLoading && forecastDisabledReason && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Forecast view unavailable: {forecastDisabledReason}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2" aria-label="Map view">
          {VIEW_MODES.map((mode) => {
            const isDisabled = mode.value !== "actual" && !canUseForecast;
            const isActive = viewMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                disabled={isDisabled}
                onClick={() => changeViewMode(mode.value)}
                className={`min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${isActive ? "bg-blue-700 text-white shadow-sm" : "text-gray-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"}`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {viewMode !== "actual" && predictionRun && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p>
              <strong>Forecast—not actual cases.</strong> Showing {selectedDisease} for {forecastLabel}, based on monthly records through {basisLabel}. Each district uses the forecasting method that performed better on recent historical months.
            </p>
            <p className="shrink-0 text-xs text-blue-700">
              Prediction run {predictionRun.predictionRunId?.slice(-8)} · {predictionRun.generatedAt ? new Date(predictionRun.generatedAt).toLocaleString("en-PH") : "date unavailable"}
            </p>
          </div>
        </div>
      )}
      {viewMode !== "actual" && predictionRun && !completeCityForecast && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Forecast coverage is incomplete: {forecastDistrictPoints.length} of {totalForecastDistricts} districts have a usable forecast. Totals shown here include available districts only, matching the district results in Predictions.
        </div>
      )}

      <HeatmapStatsRow
        stats={actualStats}
        cards={statCards}
        status={selectedCaseClassification}
        statusOptions={classificationOptions}
        onStatusChange={setSelectedCaseClassification}
        statusDisabled={viewMode !== "actual"}
      />

      <div className="grid grid-cols-12 gap-6">
        <HeatmapMapCard
          title={title}
          controls={(
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {viewMode === "actual" ? "Year" : "Forecast basis year"}
                  <select
                    className={selectClass}
                    value={selectedYear}
                    disabled={viewMode !== "actual"}
                    onChange={(event) => setSelectedYear(event.target.value === "All" ? "All" : Number(event.target.value))}
                  >
                    {yearOptions.map((option) => (
                      <option key={option} value={option}>{option === "All" ? "All Years" : option}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {viewMode === "actual" ? "Month" : "Forecast basis month"}
                  <select
                    className={selectClass}
                    value={viewMode === "actual" ? selectedMonth : predictionRun?.basisMonth || "All"}
                    disabled={viewMode !== "actual"}
                    onChange={(event) => setSelectedMonth(event.target.value === "All" ? "All" : Number(event.target.value))}
                  >
                    {viewMode === "actual" ? (
                      <>
                        <option value="All">All Months</option>
                        {MONTH_OPTIONS.map((month) => (
                          <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                      </>
                    ) : <option value={predictionRun?.basisMonth || "All"}>{basisLabel}</option>}
                  </select>
                </label>

                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Disease
                  <select
                    className={selectClass}
                    value={viewMode === "actual" ? selectedDisease : "confirmed_all"}
                    disabled={viewMode !== "actual"}
                    onChange={(event) => setSelectedDisease(event.target.value)}
                  >
                    {viewMode === "actual"
                      ? diseaseOptions.map((option) => (
                          <option key={option} value={option}>{option === "All" ? "All Diseases" : option}</option>
                        ))
                      : <option value="confirmed_all">All Confirmed Diseases</option>}
                  </select>
                </label>
              </div>
              {viewMode !== "actual" && (
                <p className="mt-3 text-xs text-gray-500">
                  The saved forecast shows eligible case totals by district for the selected disease and month.
                </p>
              )}
            </div>
          )}
          districtPoints={districtPoints}
          forecastDistrictPoints={forecastDistrictPoints}
          comparisonPoints={comparisonPoints}
          viewMode={viewMode}
          basisLabel={basisLabel}
          forecastLabel={forecastLabel}
          showNoData={showNoData}
          loadingOverlay={loadingOverlay}
          MANILA_CENTER={MANILA_CENTER}
          MANILA_CITY_BOUNDS={MANILA_CITY_BOUNDS}
          getConcentrationColor={getConcentrationColor}
        />

        <div className="col-span-12 space-y-4 lg:col-span-3">
          <LegendCard mode={viewMode} />
          <TopDistrictsCard
            items={topDistricts}
            title={viewMode === "actual" ? undefined : "Areas with Highest Forecast Concentration"}
            subtitle={viewMode === "actual" ? undefined : `Predicted share for ${forecastLabel}; not actual cases.`}
          />
          {viewMode === "actual"
            ? <TopDiseaseCard items={topDiseases} />
            : <SurveillanceAttentionCard items={forecastDistrictPoints} />}
        </div>
      </div>
    </div>
  );
}
