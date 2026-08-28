import { useEffect, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useReports } from "../../hooks/useReports.js";
import ReportsLogList from "../reports/ReportsLogList";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "reported", label: "Reported" },
  { value: "suspected", label: "Suspected" },
  { value: "probable", label: "Probable" },
  { value: "not_validated", label: "Not Confirmed" },
  { value: "ruled_out", label: "Ruled Out" },
  { value: "confirmed", label: "Confirmed" },
];

export default function ReportLogsTab() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const { reports, pagination, permissions, loading, errorMsg, fetchReports } =
    useReports(token, { autoFetch: false });

  const [onlyCounted] = useState(false);

  const loadReports = async ({
    counted = onlyCounted,
    page = 1,
  } = {}) => {
    await fetchReports({
      onlyCounted: counted,
      status: status || undefined,
      search: search || undefined,
      sortOrder,
      page,
      limit: 10,
    });
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!token) return;
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, search, sortOrder, onlyCounted]);

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

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[minmax(260px,1fr)_190px_190px]">
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                <Search className="h-3.5 w-3.5" />
                Search
              </label>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Report ID or location"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                Status
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Reported date
              </label>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>

            {/* Visibility */}
            {/* <div>
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
            </div> */}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Reports requiring review appear first. Date order is applied within each status, while Confirmed reports remain at the end.
        </p>
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      ) : null}

      <ReportsLogList
        reports={reports}
        pagination={pagination}
        loading={loading}
        onRefresh={loadReports}
        onPageChange={(page) => loadReports({ page })}
        token={token}
        canAccessPatientIdentity={permissions.canAccessPatientIdentity}
      />
    </div>
  );
}
