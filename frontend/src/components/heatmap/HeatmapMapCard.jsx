import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

export default function HeatmapMapCard({
  controls,
  districtPoints,
  showNoData,
  loadingOverlay,
  MANILA_CENTER,
  MANILA_CITY_BOUNDS,
  getRiskColor,
  getRadius,
}) {
  const sortedPoints = [...(districtPoints || [])].sort(
    (a, b) => (b.cases ?? 0) - (a.cases ?? 0)
  );

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
          <div><b>Size</b> = total cases</div>
          <div><b>Color</b> = risk level</div>
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

          {sortedPoints.map((p) => {
            const color = getRiskColor(p.cases);
            const radius = getRadius(p.cases);

            return (
              <CircleMarker
                key={p.district}
                center={[p.lat, p.lng]}
                radius={radius}
                pathOptions={{
                  color: color,
                  weight: 2,
                  fillColor: color,
                  fillOpacity: 0.55,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">{p.district}</p>

                    <p className="flex justify-between gap-6">
                      <span className="text-gray-600">Cases</span>
                      <span className="font-medium tabular-nums">{p.cases}</span>
                    </p>

                    <p className="flex justify-between gap-6">
                      <span className="text-gray-600">Risk</span>
                      <span className="font-medium" style={{ color }}>
                        {p.risk}
                      </span>
                    </p>
                  </div>
                  
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold">Note</h3>
        <p className="text-sm text-gray-600">
          The map groups official case records into <b>total cases per district</b>.
          Totals reflect the selected year and disease filters.
        </p>
      </div>
    </div>
  );
}
