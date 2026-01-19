import {
  ArrowTrendingDownIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { mockReports } from "../data/mockReports";
import {
  buildLast7DaysTimeline,
  buildDistrictData,
  buildIllnessData,
} from "../utils/analyticsBuilders";
import DistrictBarChartVertical from "../components/charts/DistrictBarChartVertical";
import IllnessPieChart from "../components/charts/IllnessPieChart";
import WeeklyLineChart from "../components/charts/WeeklyLineChart";
import RecentActivityCard from "../components/RecentActivityCard";
import { CHART_COLORS } from "../constants/chartColors";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const AdminDashboard = () => {
  const weeklyData = useMemo(() => buildLast7DaysTimeline(mockReports), []);
  const districtData = useMemo(() => buildDistrictData(mockReports), []);
  const illnessData = useMemo(() => buildIllnessData(mockReports), []);
  const [activity, setActivity] = useState([]);

  const token = useMemo(() => localStorage.getItem("token"), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications?limit=6`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();
        setActivity(Array.isArray(data) ? data : []);
      } catch {
        setActivity([]);
      }
    })();
  }, [token]);
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-600 mt-1">
          Monitor disease outbreaks and trends in real-time
        </p>
      </div>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-600 p-3 rounded-lg flex-shrink-0">
            <ArrowTrendingDownIcon className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="mb-2">Administrative Dashboard</h2>
            <p className="text-sm text-gray-700 mb-3">
              This web platform is designed for DOH officials, health analysts,
              and researchers to manage and analyze disease outbreak data.
              <strong className="block mt-2">For Citizens:</strong>Check out the
              mobile app version of <strong>Foodsafe Manila</strong> to view
              view the latest reports and heatmaps.
            </p>
            <a
              href=""
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm" 
            >
              <DevicePhoneMobileIcon className="w-4 h-4" />
              Mobile App Version
            </a>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                className="lucide lucide-activity w-6 h-6 text-blue-600"
                data-fg-38d31="1.27:65.415:/src/app/pages/Dashboard.tsx:120:19:4332:43:e:Icon"
              >
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
              </svg>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              className="lucide lucide-trending-up w-5 h-5 text-green-500"
              data-fg-38d33="1.27:65.415:/src/app/pages/Dashboard.tsx:122:41:4439:49:e:TrendingUp::::::D9DP"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
              <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
          </div>
          <p className="text-sm text-gray-600">Total Cases</p>
          <p className="text-2xl mt-1">180</p>
          <p className="text-sm text-gray-500 mt-2">+12.5%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-yellow-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                className="lucide lucide-triangle-alert w-6 h-6 text-yellow-600"
                data-fg-38d31="1.27:65.415:/src/app/pages/Dashboard.tsx:120:19:4332:43:e:Icon"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
              </svg>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              className="lucide lucide-trending-up w-5 h-5 text-green-500"
              data-fg-38d33="1.27:65.415:/src/app/pages/Dashboard.tsx:122:41:4439:49:e:TrendingUp::::::D9DP"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
              <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
          </div>
          <p className="text-sm text-gray-600">High Risk Districts</p>
          <p className="text-2xl mt-1">5</p>
          <p className="text-sm text-gray-500 mt-2">+2</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-purple-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                className="lucide lucide-file-text w-6 h-6 text-purple-600"
                data-fg-38d31="1.27:65.415:/src/app/pages/Dashboard.tsx:120:19:4332:43:e:Icon"
              >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
                <path d="M10 9H8"></path>
                <path d="M16 13H8"></path>
                <path d="M16 17H8"></path>
              </svg>
            </div>
          </div>
          <p className="text-sm text-gray-600">Most Common Illness</p>
          <p className="text-2xl mt-1">Food Poisoning</p>
          <p className="text-sm text-gray-500 mt-2">+34% of cases</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-green-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                className="lucide lucide-map w-6 h-6 text-green-600"
                data-fg-38d31="1.27:65.415:/src/app/pages/Dashboard.tsx:120:19:4332:43:e:Icon"
              >
                <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"></path>
                <path d="M15 5.764v15"></path>
                <path d="M9 3.236v15"></path>
              </svg>
            </div>
          </div>
          <p className="text-sm text-gray-600">Data Coverage</p>
          <p className="text-2xl mt-1">Dec 1-29, 2024</p>
          <p className="text-sm text-gray-500 mt-2">100 records</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyLineChart title="Cases (Last 7 Days)" data={weeklyData} />
        <DistrictBarChartVertical
          data={districtData}
          title="Top Districts (Cases)"
        />
        <IllnessPieChart data={illnessData} colors={CHART_COLORS} />
        <RecentActivityCard items={activity} />

      </div>
    </div>
  );
};

export default AdminDashboard;
