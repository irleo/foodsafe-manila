import { useEffect, useState } from "react";
import { MapPin, Info } from "lucide-react";
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

  const [reportDistrict, setReportDistrict] = useState("");
  const { reports, loading, fetchReports } = useReports(token);

  const [onlyCounted, setOnlyCounted] = useState(false);

  const loadReports = async ({
    district = reportDistrict,
    counted = onlyCounted,
  } = {}) => {
    await fetchReports({
      district: district || undefined,
      onlyCounted: counted,
    });
  };

  useEffect(() => {
    if (!token) return;
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reportDistrict, onlyCounted]);

  useEffect(() => {
    if (!token) return;
    loadReports(reportDistrict);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDistrict]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">
              Citizen report logs
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Review reports submitted from the mobile application.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap xl:items-end xl:justify-end">
            <div className="min-w-[220px]">
              <label className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                <MapPin className="h-3.5 w-3.5" />
                District
              </label>
              <select
                value={reportDistrict}
                onChange={(e) => setReportDistrict(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DISTRICT_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 flex items-center gap-4  text-xs font-medium uppercase tracking-wide text-gray-500">
                Visibility
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 cursor-help text-gray-500" />
                  <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-xs normal-case tracking-normal text-gray-600 shadow-lg group-hover:block">
                    <b>"Counted"</b> means reports currently counted in dashboard
                    totals, maps, and risk calculations.
                  </div>
                </div>
              </div>

              <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setOnlyCounted(false)}
                  className={`rounded-md px-4 py-1 text-sm font-medium transition ${
                    !onlyCounted
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  All 
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyCounted(true)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    onlyCounted
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  Counted
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ReportsLogList reports={reports} loading={loading} />
    </div>
  );
}
