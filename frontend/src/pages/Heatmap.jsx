import { useMap, Marker, Popup, MapContainer, TileLayer } from "react-leaflet";
import "leaflet.heat";
import { useEffect } from "react";
import L from "leaflet";

// Fix marker icon issue (important)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MANILA_CITY_BOUNDS = [
  [14.53, 120.93],  // Southwest 
  [14.70, 121.05],  // Northeast 
];


const MANILA_CENTER = [14.5995, 120.9842];

const reports = [
  // Quiapo
  {
    id: 1,
    position: [14.5991, 120.9847],
    location: "Quiapo Public Market",
    illness: "Salmonellosis",
    food: "Undercooked chicken",
    date: "2025-01-10",
    severity: "High",
  },

  // Ermita
  {
    id: 2,
    position: [14.5942, 120.9721],
    location: "Ermita Street Food",
    illness: "E. coli Infection",
    food: "Contaminated ice",
    date: "2025-01-08",
    severity: "Moderate",
  },

  // Sampaloc
  {
    id: 3,
    position: [14.6094, 120.982],
    location: "University Belt Canteen",
    illness: "Norovirus",
    food: "Handled sandwiches",
    date: "2025-01-05",
    severity: "Low",
  },

  // Tondo
  {
    id: 4,
    position: [14.6215, 120.965],
    location: "Tondo Wet Market",
    illness: "Salmonella",
    food: "Raw seafood",
    date: "2025-01-12",
    severity: "High",
  },

  // Paco
  {
    id: 5,
    position: [14.5825, 120.9895],
    location: "Paco Food Stalls",
    illness: "Food Poisoning",
    food: "Expired ingredients",
    date: "2025-01-09",
    severity: "Moderate",
  },
];

const getSeverityIcon = (severity) =>
  L.divIcon({
    className: "",
    html: `
      <div style="
        width: 18px;
        height: 18px;
        background: ${
          severity === "High"
            ? "#dc2626"
            : severity === "Moderate"
            ? "#f97316"
            : "#facc15"
        };
        border-radius: 50%;
        box-shadow: 0 0 12px rgba(0,0,0,0.35);
        border: 2px solid white;
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });


function HeatAndMarkers({ reports }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Convert reports to heat points
    const heatData = reports.map((r) => {
      let intensity = 1;

      if (r.severity === "High") intensity = 8;
      if (r.severity === "Moderate") intensity = 5;
      if (r.severity === "Low") intensity = 3;

      return [r.position[0], r.position[1], intensity];
    });

    const heatLayer = L.heatLayer(heatData, {
      radius: 45,
      blur: 30,
      maxZoom: 17,
      minOpacity: 0.4,
      gradient: {
        0.2: "#ffffb2",
        0.4: "#fecc5c",
        0.6: "#fd8d3c",
        0.8: "#f03b20",
        1.0: "#bd0026",
      },
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, reports]);

  return (
    <>
      {reports.map((r) => (
        <Marker key={r.id} position={r.position} icon={getSeverityIcon(r.severity)} >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{r.location}</p>
              <p>
                <b>Illness:</b> {r.illness}
              </p>
              <p>
                <b>Food:</b> {r.food}
              </p>
              <p>
                <b>Severity:</b> {r.severity}
              </p>
              <p className="text-gray-500">{r.date}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default function Heatmap() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Heatmap</h1>
        <p className="text-gray-600">
          Be warned of the places that are marked as unsafe.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="High Risk Areas" value="5" />
        <StatCard title="Medium Risk" value="8" />
        <StatCard title="Low Risk" value="12" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-9 bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Risk Heatmap</h2>

          <div className="h-[500px] rounded overflow-hidden">
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
              <HeatAndMarkers reports={reports} />
            </MapContainer>
          </div>
        </div>

        <div className="col-span-3 space-y-4">
          <LegendCard />
          <InfoCard />
        </div>
      </div>
    </div>
  );
}

/* ---------- Components ---------- */

function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 text-center">
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function LegendCard() {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">Legend</h3>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="w-4 h-4 bg-red-600 rounded"></span> High Risk
        </li>
        <li className="flex items-center gap-2">
          <span className="w-4 h-4 bg-orange-500 rounded"></span> Medium Risk
        </li>
        <li className="flex items-center gap-2">
          <span className="w-4 h-4 bg-yellow-400 rounded"></span> Low Risk
        </li>
      </ul>
    </div>
  );
}

function InfoCard() {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-2">Notes</h3>
      <p className="text-sm text-gray-600">
        Heat intensity is based on reported incidents and historical data. This
        is currently using dummy data for visualization.
      </p>
    </div>
  );
}
