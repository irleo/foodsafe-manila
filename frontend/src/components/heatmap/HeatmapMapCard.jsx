import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import legislativeDistricts from "../../data/manila-barangays-with-legislative-districts.json";
import { normalizeDistrictKey } from "../../constants/manilaDistrictCoords";

function formatForecastMonth(forecast) {
  if (!forecast?.year || !forecast?.month) return "next month";
  return new Date(forecast.year, Number(forecast.month) - 1, 1).toLocaleString(
    undefined,
    { month: "long", year: "numeric" },
  );
}

export default function HeatmapMapCard({
  controls,
  districtPoints,
  showNoData,
  loadingOverlay,
  MANILA_CENTER,
  MANILA_CITY_BOUNDS,
  getRiskColor,
}) {
  const casesByBarangay = Object.fromEntries(
    (districtPoints || []).map((p) => [Number(p.barangayNo), p]),
  );
  const pointsByDistrict = Object.fromEntries(
    (districtPoints || []).map((p) => [
      p.districtKey || normalizeDistrictKey(p.district),
      p,
    ]),
  );

  const heatmapLayerKey = districtPoints
    .map(
      (p) =>
        `${p.barangayNo}:${p.cases}:${p.forecast?.predictedCases ?? ""}:${p.forecastRisk?.riskLevel ?? ""}`,
    )
    .join("|");

  return (
    <div className="col-span-12 lg:col-span-9 self-start bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {controls}

      <div className="h-[644px] min-h-[644px] rounded overflow-hidden relative">
        {loadingOverlay}

        {showNoData && (
          <div className="absolute z-[999] top-3 left-3 bg-white/95 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 shadow-sm">
            No matching data for the selected filter.
          </div>
        )}

        <div className="absolute z-[900] bottom-3 left-3 bg-white/95 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 shadow-sm">
          <div>
            <b>Area</b> = barangay
          </div>
          <div>
            <b>Color</b> = forecasted district risk
          </div>
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
            style={(feature) => {
              const barangayNo = Number(feature.properties.barangayNo);
              const point = casesByBarangay[barangayNo];
              const districtKey = normalizeDistrictKey(feature.properties.district);
              const districtPoint = pointsByDistrict[districtKey] || point;

              const hasRiskData = Boolean(districtPoint);
              const color = hasRiskData
                ? getRiskColor(
                    districtPoint.forecastRisk?.riskLevel ??
                      districtPoint.riskLevel ??
                      districtPoint.districtTotalCases ??
                      0,
                  )
                : "#cbd5e1";

              return {
                color: "#334166", // border color
                weight: hasRiskData ? 0.5 : 0.35,
                opacity: hasRiskData ? 0.7 : 0.35,
                fillColor: color,
                fillOpacity: hasRiskData ? 0.75 : 0.12,
              };
            }}
            onEachFeature={(feature, layer) => {
              const barangayNo = Number(feature.properties.barangayNo);
              const barangay =
                feature.properties.barangay || `Barangay ${barangayNo}`;
              const district = feature.properties.district;
              const point = casesByBarangay[barangayNo];
              const districtKey = normalizeDistrictKey(district);
              const districtPoint = pointsByDistrict[districtKey] || point;

              if (!districtPoint) return;

              const cases = point?.cases ?? 0;
              const actualRisk = districtPoint?.risk ?? "No data";
              const forecastRisk = districtPoint?.forecastRisk;
              const risk = forecastRisk?.risk ?? actualRisk;
              const avgIncident = districtPoint?.districtAvgIncident ?? 0;
              const districtTotalCases = districtPoint?.districtTotalCases ?? 0;
              const forecast = districtPoint?.forecast;
              const forecastMonth = formatForecastMonth(forecast);
              const forecastCases =
                forecast?.predictedCases == null
                  ? "No forecast"
                  : `${forecast.predictedCases} cases`;
              const color = getRiskColor(
                forecastRisk?.riskLevel ??
                  districtPoint?.riskLevel ??
                  districtTotalCases,
              );
              const baseStyle = {
                color: "#334166",
                weight: 0.5,
                opacity: 0.7,
                fillColor: color,
                fillOpacity: 0.75,
              };

              layer.bindPopup(`
                <div class="text-sm">
                  <p><strong>${barangay}</strong></p>
                  <p>Barangay No.: <strong>${barangayNo}</strong></p>
                  <p>District: <strong>${point?.district || district}</strong></p>
                  <p>Barangay cases: <strong>${cases}</strong></p>
                  <p>District total cases: <strong>${districtTotalCases}</strong></p>
                  <p>District avg incident: <strong>${Number(avgIncident).toFixed(2)}</strong></p>
                  <p>Forecasted month: <strong>${forecastMonth}</strong></p>
                  <p>Forecasted cases: <strong>${forecastCases}</strong></p>
                  <p>Forecasted risk: <strong style="color:${color}">${risk}</strong></p>
                </div>
              `);

              layer.on({
                mouseover: () => {
                  layer.setStyle({
                    color: baseStyle.color,
                    weight: 1.2,
                    opacity: 1,
                    fillColor: baseStyle.fillColor,
                    fillOpacity: 0.9,
                  });
                },
                mouseout: () => {
                  layer.setStyle(baseStyle);
                },
                popupclose: () => layer.setStyle(baseStyle),
              });
            }}
          />
        </MapContainer>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold">Note</h3>
        <p className="text-sm text-gray-600">
          The map groups official case records into <b>barangay-number areas</b>
          . Risk color reflects the forecasted district risk when saved forecast
          data is available; popups show the forecasted month, forecasted cases,
          and current selected historical totals.
        </p>
      </div>
    </div>
  );
}
