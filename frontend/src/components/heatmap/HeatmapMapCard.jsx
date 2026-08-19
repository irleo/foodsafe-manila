import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import legislativeDistricts from "../../data/manila-barangays-with-legislative-districts.json";
import { normalizeDistrictKey } from "../../constants/manilaDistrictCoords";

function toLookup(rows, keyBuilder) {
  return Object.fromEntries((Array.isArray(rows) ? rows : []).map((row) => [keyBuilder(row), row]));
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-PH", { maximumFractionDigits: 1 }) : "—";
}

function formatModel(value) {
  return value === "seasonal_naive" ? "Seasonal Naïve" : "Prophet";
}

export default function HeatmapMapCard({
  title,
  controls,
  districtPoints = [],
  forecastDistrictPoints = [],
  comparisonPoints = [],
  viewMode = "actual",
  basisLabel,
  forecastLabel,
  showNoData,
  loadingOverlay,
  MANILA_CENTER,
  MANILA_CITY_BOUNDS,
  getConcentrationColor,
}) {
  const casesByBarangay = toLookup(districtPoints, (point) => Number(point.barangayNo));
  const forecastsByDistrict = toLookup(forecastDistrictPoints, (point) => point.districtKey);
  const comparisonsByDistrict = toLookup(comparisonPoints, (point) => point.districtKey);
  const maximumBarangayCases = Math.max(1, ...districtPoints.map((point) => Number(point.cases || 0)));
  const maximumForecastCases = Math.max(1, ...forecastDistrictPoints.map((point) => Number(point.predictedCases || 0)));
  const maximumActualDistrictCases = Math.max(1, ...comparisonPoints.map((point) => Number(point.actualCases || 0)));

  const heatmapLayerKey = [
    viewMode,
    ...districtPoints.map((point) => `${point.barangayNo}:${point.cases}`),
    ...forecastDistrictPoints.map((point) => `${point.districtKey}:${point.predictedCases}`),
  ].join("|");

  const getFeatureData = (feature) => {
    const barangayNo = Number(feature.properties.barangayNo);
    const district = feature.properties.district;
    const districtKey = normalizeDistrictKey(district);
    return {
      barangayNo,
      district,
      actual: casesByBarangay[barangayNo],
      forecast: forecastsByDistrict[districtKey],
      comparison: comparisonsByDistrict[districtKey],
    };
  };

  const featureStyle = (feature) => {
    const { actual, forecast, comparison } = getFeatureData(feature);

    if (viewMode === "forecast") {
      const hasForecast = Boolean(forecast);
      return {
        color: hasForecast ? "#1e40af" : "#64748b",
        weight: hasForecast ? 1.5 : 0.4,
        opacity: hasForecast ? 0.9 : 0.35,
        dashArray: hasForecast ? "6 4" : undefined,
        fillColor: hasForecast
          ? getConcentrationColor(forecast.predictedCases, maximumForecastCases)
          : "#e2e8f0",
        fillOpacity: hasForecast ? 0.66 : 0.12,
      };
    }

    if (viewMode === "comparison") {
      const hasComparison = Boolean(comparison);
      return {
        color: hasComparison
          ? getConcentrationColor(comparison.predictedCases, maximumForecastCases)
          : "#64748b",
        weight: hasComparison ? 2.2 : 0.4,
        opacity: hasComparison ? 1 : 0.35,
        dashArray: hasComparison ? "6 4" : undefined,
        fillColor: hasComparison
          ? getConcentrationColor(comparison.actualCases, maximumActualDistrictCases)
          : "#e2e8f0",
        fillOpacity: hasComparison ? 0.64 : 0.12,
      };
    }

    const hasActual = Boolean(actual);
    return {
      color: "#334166",
      weight: hasActual ? 0.5 : 0.35,
      opacity: hasActual ? 0.7 : 0.35,
      fillColor: hasActual
        ? getConcentrationColor(actual.cases, maximumBarangayCases)
        : "#cbd5e1",
      fillOpacity: hasActual ? 0.75 : 0.12,
    };
  };

  const popupHtml = (feature) => {
    const barangay = feature.properties.barangay || `Barangay ${feature.properties.barangayNo}`;
    const { barangayNo, district, actual, forecast, comparison } = getFeatureData(feature);

    if (viewMode === "forecast" && forecast) {
      return `
        <div class="text-sm">
          <p><strong>${district}</strong></p>
          <p>Forecast target: <strong>${forecastLabel}</strong></p>
          <p>Predicted confirmed cases: <strong>${formatNumber(forecast.predictedCases)}</strong></p>
          <p>Selected district model: <strong>${formatModel(forecast.model)}</strong></p>
          <p>95% prediction interval: <strong>${formatNumber(forecast.lowerBound)} – ${formatNumber(forecast.upperBound)}</strong></p>
          <p style="margin-top:6px;color:#475569;font-size:12px">District-level forecast repeated across district polygons. This is not a barangay prediction or an actual case count.</p>
        </div>
      `;
    }

    if (viewMode === "comparison" && comparison) {
      const difference = comparison.difference > 0
        ? `+${formatNumber(comparison.difference)}`
        : formatNumber(comparison.difference);
      return `
        <div class="text-sm">
          <p><strong>${district}</strong></p>
          <p>Actual confirmed (${basisLabel}): <strong>${formatNumber(comparison.actualCases)}</strong></p>
          <p>Forecast (${forecastLabel}): <strong>${formatNumber(comparison.predictedCases)}</strong></p>
          <p>Selected district model: <strong>${formatModel(comparison.model)}</strong></p>
          <p>Change: <strong>${difference}</strong></p>
          <p>95% prediction interval: <strong>${formatNumber(comparison.lowerBound)} – ${formatNumber(comparison.upperBound)}</strong></p>
          <p style="margin-top:6px;color:#475569;font-size:12px">Forecast values are analytical estimates, not actual confirmed cases.</p>
        </div>
      `;
    }

    if (!actual) return null;
    return `
      <div class="text-sm">
        <p><strong>${barangay}</strong></p>
        <p>Barangay No.: <strong>${barangayNo}</strong></p>
        <p>District: <strong>${actual.district || district}</strong></p>
        <p>Barangay cases: <strong>${formatNumber(actual.cases)}</strong></p>
        <p>District cases for selected status: <strong>${formatNumber(actual.districtTotalCases)}</strong></p>
        <p>District share of selected cases: <strong>${formatNumber(actual.districtConcentrationShare)}%</strong></p>
      </div>
    `;
  };

  return (
    <div className="col-span-12 self-start rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:col-span-9">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      {controls}

      <div className="relative h-[644px] min-h-[644px] overflow-hidden rounded">
        {loadingOverlay}

        {showNoData && (
          <div className="absolute left-3 top-3 z-[999] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-sm">
            No matching data is available for this view.
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-[900] max-w-xs rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-sm">
          {viewMode === "actual" ? (
            <><div><b>Area</b> = barangay</div><div><b>Color</b> = actual relative case concentration</div></>
          ) : viewMode === "forecast" ? (
            <><div><b>Area</b> = district</div><div><b>Color</b> = predicted relative concentration</div></>
          ) : (
            <><div><b>Fill</b> = latest actual district concentration</div><div><b>Dashed outline</b> = forecast district concentration</div></>
          )}
        </div>

        <MapContainer
          center={MANILA_CENTER}
          zoom={13}
          minZoom={13}
          maxZoom={14.5}
          maxBounds={MANILA_CITY_BOUNDS}
          maxBoundsViscosity={0.6}
          className="h-full w-full"
        >
          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <GeoJSON
            key={heatmapLayerKey}
            data={legislativeDistricts}
            style={featureStyle}
            onEachFeature={(feature, layer) => {
              const html = popupHtml(feature);
              if (!html) return;
              const baseStyle = featureStyle(feature);
              layer.bindPopup(html);
              layer.on({
                mouseover: () => layer.setStyle({ ...baseStyle, weight: Math.max(1.4, Number(baseStyle.weight || 0)), fillOpacity: 0.88 }),
                mouseout: () => layer.setStyle(baseStyle),
                popupclose: () => layer.setStyle(baseStyle),
              });
            }}
          />
        </MapContainer>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold">Interpretation</h3>
        <p className="text-sm text-gray-600">
          {viewMode === "actual"
            ? "Actual colors show relative concentration within the selected status and period. They are not an official DOH/CESU risk classification."
            : "Forecast values come from the same saved monthly district prediction run displayed by the Predictions module. They are estimates for the stated period and must not be presented as observed cases."}
        </p>
      </div>
    </div>
  );
}
