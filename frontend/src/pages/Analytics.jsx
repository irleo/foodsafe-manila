import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar, Doughnut, Line } from "react-chartjs-2";

// Register chart components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

// Dummy data (same as Heatmap)
const reports = [
  {
    id: 1,
    location: "Quiapo Public Market",
    illness: "Salmonellosis",
    date: "2025-01-10",
    severity: "High",
  },
  {
    id: 2,
    location: "Ermita Street Food",
    illness: "E. coli Infection",
    date: "2025-01-08",
    severity: "Moderate",
  },
  {
    id: 3,
    location: "University Belt Canteen",
    illness: "Norovirus",
    date: "2025-01-05",
    severity: "Low",
  },
  {
    id: 4,
    location: "Tondo Wet Market",
    illness: "Salmonella",
    date: "2025-01-12",
    severity: "High",
  },
  {
    id: 5,
    location: "Paco Food Stalls",
    illness: "Food Poisoning",
    date: "2025-01-09",
    severity: "Moderate",
  },
];

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false, 
  layout: {
      padding: 20, 
    },
  plugins: {
    legend: { position: "top" },
    tooltip: { enabled: true },
  },
};

export default function Analytics() {
  /* ============================
     DATA TRANSFORMATIONS
  ============================= */

  // Illness frequency
  const illnessCount = reports.reduce((acc, r) => {
    acc[r.illness] = (acc[r.illness] || 0) + 1;
    return acc;
  }, {});

  // Severity distribution
  const severityCount = reports.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {});

  // Cases over time
  const dateCount = reports.reduce((acc, r) => {
    acc[r.date] = (acc[r.date] || 0) + 1;
    return acc;
  }, {});

  /* ============================
     CHART CONFIGS
  ============================= */

  const illnessChart = {
    labels: Object.keys(illnessCount),
    datasets: [
      {
        label: "Number of Cases",
        data: Object.values(illnessCount),
        backgroundColor: "#60a5fa",
      },
    ],
  };

  const severityChart = {
    labels: Object.keys(severityCount),
    datasets: [
      {
        data: Object.values(severityCount),
        backgroundColor: ["#22c55e", "#facc15", "#ef4444"],
      },
    ],
  };

  const timelineChart = {
    labels: Object.keys(dateCount),
    datasets: [
      {
        label: "Reported Cases",
        data: Object.values(dateCount),
        borderColor: "#2563eb",
        backgroundColor: "#93c5fd",
        tension: 0.3,
      },
    ],
  };

  /* ============================
     UI
  ============================= */

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="text-gray-600">
        View trends and statistics related to foodborne illness reports.
      </p>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-white p-4 rounded shadow h-74">
          <h2 className="font-semibold mb-2">Illness Frequency</h2>
          <Bar data={illnessChart} options={chartOptions} />
        </div>

        {/* Doughnut Chart */}
        <div className="bg-white p-4 rounded shadow h-74">
          <h2 className="font-semibold mb-2">Severity Distribution</h2>
          <Doughnut
            data={severityChart}
            options={chartOptions}
          />
        </div>

        {/* Line Chart */}
        <div className="bg-white p-4 rounded shadow lg:col-span-2 h-74">
          <h2 className="font-semibold mb-2">Cases Over Time</h2>
          <Line data={timelineChart} options={ chartOptions} />
        </div>
      </div>
    </div>
  );
}
