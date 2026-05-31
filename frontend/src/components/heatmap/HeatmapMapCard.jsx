import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import legislativeDistricts from "../../data/manila-barangays-with-legislative-districts.json";

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

  const heatmapLayerKey = districtPoints
    .map((p) => `${p.barangayNo}:${p.cases}`)
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
            <b>Color</b> = district avg incident risk
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

              const cases = point?.cases ?? 0;
              const hasCases = cases > 0;
              const color = hasCases
                ? getRiskColor(point.districtAvgIncident ?? 0)
                : "#cbd5e1";

              return {
                color: "#334166", // border color
                weight: hasCases ? 0.5 : 0.35,
                opacity: hasCases ? 0.7 : 0.35,
                fillColor: color,
                fillOpacity: hasCases ? 0.75 : 0.12,
              };
            }}
            onEachFeature={(feature, layer) => {
              const barangayNo = Number(feature.properties.barangayNo);
              const barangay =
                feature.properties.barangay || `Barangay ${barangayNo}`;
              const district = feature.properties.district;
              const point = casesByBarangay[barangayNo];

              const cases = point?.cases ?? 0;
              if (cases <= 0) return;

              const risk = point?.risk ?? "No data";
              const avgIncident = point?.districtAvgIncident ?? 0;
              const districtTotalCases = point?.districtTotalCases ?? 0;
              const color = getRiskColor(avgIncident);
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
                  <p>Risk: <strong style="color:${color}">${risk}</strong></p>
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
          . Risk color reflects average incident per district for the selected
          filters; popups show barangay number and cases.
        </p>
      </div>
    </div>
  );
}
