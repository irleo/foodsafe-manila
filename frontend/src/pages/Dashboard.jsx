import { useEffect, useMemo, useState } from "react";
import { ArrowTrendingDownIcon, DevicePhoneMobileIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";

import { mockReports } from "../data/mockReports";
import { buildLast7DaysTimeline, buildDistrictData, buildIllnessData } from "../utils/analyticsBuilders";

import WeeklyLineChart from "../components/charts/WeeklyLineChart";
import DistrictBarChartVertical from "../components/charts/DistrictBarChartVertical";
import IllnessPieChart from "../components/charts/IllnessPieChart";
import RecentActivityCard from "../components/RecentActivityCard";
import { CHART_COLORS } from "../constants/chartColors";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function Dashboard() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const weeklyData = useMemo(() => buildLast7DaysTimeline(mockReports), []);
  const districtData = useMemo(() => buildDistrictData(mockReports), []);
  const illnessData = useMemo(() => buildIllnessData(mockReports), []);

  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications?limit=6`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
          credentials: "include",
        });
        const data = await res.json();
        if (!isMounted) return;
        setActivity(Array.isArray(data) ? data : []);
      } catch {
        if (!isMounted) return;
        setActivity([]);
      }
    })();

    return () => {
      isMounted = false;
    };
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
            <h2 className="mb-2">
              {auth?.role === "admin" ? "Administrative Dashboard" : "User Dashboard"}
            </h2>
            <p className="text-sm text-gray-700 mb-3">
              This web platform is designed for DOH officials, health analysts,
              and researchers to manage and analyze disease outbreak data.
              <strong className="block mt-2">For Citizens:</strong> Check out the
              mobile app version of <strong>Foodsafe Manila</strong>.
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

      {/* cards + charts (same for both roles) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyLineChart title="Cases (Last 7 Days)" data={weeklyData} />
        <DistrictBarChartVertical data={districtData} title="Top Districts (Cases)" />
        <IllnessPieChart data={illnessData} colors={CHART_COLORS} />
        <RecentActivityCard items={activity} />
      </div>
    </div>
  );
}
