import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useReports } from "../../hooks/useReports.js";
import ReportsLogList from "../reports/ReportsLogList";

const DISTRICT_OPTIONS = [
  { value: "", label: "All districts" },
  { value: "binondo", label: "Binondo" },
  { value: "quiapo", label: "Quiapo" },
  { value: "sampaloc", label: "Sampaloc" },
  { value: "san_miguel", label: "San Miguel" },
  { value: "santa_cruz", label: "Santa Cruz" },
  { value: "tondo", label: "Tondo" },
  { value: "ermita", label: "Ermita" },
  { value: "intramuros", label: "Intramuros" },
  { value: "malate", label: "Malate" },
  { value: "paco", label: "Paco" },
  { value: "pandacan", label: "Pandacan" },
  { value: "port_area", label: "Port Area" },
  { value: "san_andres", label: "San Andres" },
  { value: "santa_ana", label: "Santa Ana" },
];

export default function ReportLogsTab() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const [onlyCounted, setOnlyCounted] = useState(true);
  const [reportDistrict, setReportDistrict] = useState("");

  const { reports, loading, fetchReports } = useReports(token);

  const loadReports = async () => {
    await fetchReports({
      onlyCounted,
      district: reportDistrict || undefined,
    });
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-semibold text-xl">Citizen report logs</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review reports submitted from the mobile application
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                District
              </label>
              <select
                value={reportDistrict}
                onChange={(e) => setReportDistrict(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {DISTRICT_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={onlyCounted}
                onChange={(e) => setOnlyCounted(e.target.checked)}
                className="rounded border-gray-300"
              />
              Counted only
            </label>

            <button
              onClick={loadReports}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh logs
            </button>
          </div>
        </div>
      </div>

      <ReportsLogList
        reports={reports}
        loading={loading}
        onRefresh={loadReports}
      />
    </div>
  );
}