import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

export default function HeatmapMapCard({
  controls,
  districtPoints,
  mapType,
  showNoData,
  loadingOverlay,
  MANILA_CENTER,
  MANILA_CITY_BOUNDS,
  getRiskColor,
  getRadius,
}) {
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

        <MapContainer
          center={MANILA_CENTER}
          zoom={13}
          minZoom={12}
          maxZoom={17}
          maxBounds={MANILA_CITY_BOUNDS}
          maxBoundsViscosity={0.6}
          className="h-full w-full"
        >
          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {districtPoints.map((p) => {
            const color = getRiskColor(p.cases);
            const radius = getRadius(p.cases);

            return (
              <CircleMarker
                key={p.district}
                center={[p.lat, p.lng]}
                radius={radius}
                pathOptions={{
                  color,
                  weight: 2,
                  fillColor: color,
                  fillOpacity: 0.45,
                }}
              >
                <Popup>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="font-semibold">{p.district}</p>
                      <p>
                        <b>Cases:</b> {p.cases}
                      </p>
                      <p>
                        <b>Risk:</b> {p.risk}
                      </p>
                      <p>
                        <b>Latest Case:</b> {p.latest}
                      </p>
                    </div>

                    {p.illnessBreakdown?.length > 0 &&
                      mapType === "District" && (
                        <div className="border-t pt-2">
                          <p className="font-medium mb-1">Illness Breakdown</p>
                          <div className="space-y-1">
                            {p.illnessBreakdown.slice(0, 6).map((x) => (
                              <div
                                key={x.illness}
                                className="flex items-center justify-between gap-3"
                              >
                                <span className="truncate">{x.illness}</span>
                                <span className="text-gray-600">{x.cases}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
          The map groups reports into <b>cases per district</b>. In{" "}
          <b>Illness</b> mode, the counts reflect only the selected illness.
        </p>
      </div>
    </div>
  );
}
