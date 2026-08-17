import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import legislativeDistricts from "../../data/manila-barangays-with-legislative-districts.json";

export default function HeatmapMapCard({
  title,
  controls,
  districtPoints,
  showNoData,
  loadingOverlay,
  MANILA_CENTER,
  MANILA_CITY_BOUNDS,
  getConcentrationColor,
}) {
  const casesByBarangay = Object.fromEntries(
    (districtPoints || []).map((p) => [Number(p.barangayNo), p]),
  );
  const maximumCases = Math.max(1, ...(districtPoints || []).map((p) => Number(p.cases || 0)));

  const heatmapLayerKey = districtPoints
    .map(
      (p) =>
        `${p.barangayNo}:${p.cases}`,
    )
    .join("|");

  return (
    <div className="col-span-12 lg:col-span-9 self-start bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
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
            <b>Color</b> = relative case concentration
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
              const hasCaseData = Boolean(point);
              const color = hasCaseData
                ? getConcentrationColor(point.cases, maximumCases)
                : "#cbd5e1";

              return {
                color: "#334166", // border color
                weight: hasCaseData ? 0.5 : 0.35,
                opacity: hasCaseData ? 0.7 : 0.35,
                fillColor: color,
                fillOpacity: hasCaseData ? 0.75 : 0.12,
              };
            }}
            onEachFeature={(feature, layer) => {
              const barangayNo = Number(feature.properties.barangayNo);
              const barangay =
                feature.properties.barangay || `Barangay ${barangayNo}`;
              const district = feature.properties.district;
              const point = casesByBarangay[barangayNo];
              if (!point) return;

              const cases = point?.cases ?? 0;
              const districtTotalCases = point?.districtTotalCases ?? 0;
              const concentrationShare = point?.districtConcentrationShare ?? 0;
              const color = getConcentrationColor(cases, maximumCases);
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
                  <p>District cases for selected status: <strong>${districtTotalCases}</strong></p>
                  <p>District share of selected cases: <strong>${concentrationShare}%</strong></p>
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
          The map groups records into <b>barangay-number areas</b>. Colors show
          relative concentration within the current selection and are not an
          official DOH/CESU risk classification or alert threshold.
        </p>
      </div>
    </div>
  );
}
