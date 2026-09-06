import { useEffect, useState } from "react";
import { CheckCircle2, Inbox, Search } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useReports } from "../hooks/useReports.js";
import ReportsLogList from "./ReportsLogList";

const STATUS_OPTIONS = [
  { value: "", label: "Any status in queue" },
  { value: "reported", label: "Reported" },
  { value: "suspected", label: "Suspected" },
  { value: "probable", label: "Probable" },
  { value: "ruled_out", label: "Ruled Out" },
  { value: "confirmed", label: "Confirmed" },
];

const QUEUE_OPTIONS = [
  { value: "needs_review", label: "Needs review" },
  { value: "resolved", label: "Resolved" },
  { value: "", label: "All reports" },
];

export default function ReportLogsTab() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const [status, setStatus] = useState("");
  const [queue, setQueue] = useState("needs_review");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const {
    reports,
    pagination,
    summary,
    permissions,
    loading,
    errorMsg,
    fetchReports,
  } =
    useReports(token, { autoFetch: false });

  const [onlyCounted] = useState(false);

  const loadReports = async ({ counted = onlyCounted, page = 1 } = {}) => {
    await fetchReports({
      onlyCounted: counted,
      status: status || undefined,
      queue: status ? undefined : queue || undefined,
      search: search || undefined,
      sortOrder,
      page,
      limit: 10,
    });
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setSearch(searchInput.trim()),
      300,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!token) return;
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, queue, search, sortOrder, onlyCounted]);

  return (
    <div className="space-y-5">
      <section
        aria-label="Citizen report summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {[
          ["Total Reports Received", summary.totalReports],
          ["Ongoing Reports", summary.ongoingReports],
          ["Confirmed Reports", summary.confirmedReports],
        ].map(([label, value]) => (
          <article
            key={label}
            className="rounded-xl border border-blue-200 bg-white px-5 py-4 shadow-sm"
          >
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
              {loading ? "—" : value.toLocaleString()}
            </p>
          </article>
        ))}
      </section>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between p-2">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">
              Citizen report logs
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Work from unresolved citizen reports toward documented outcomes.
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 xl:w-auto">
            {QUEUE_OPTIONS.map((option) => {
              const active = !status && queue === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setStatus("");
                    setQueue(option.value);
                  }}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${active ? "border-[#134c8c] bg-[#134c8c] text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-blue-50"}`}
                >
                  {option.value === "needs_review" ? (
                    <Inbox className="h-4 w-4" />
                  ) : null}
                  {option.value === "resolved" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : null}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2 pt-3 px-1">
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
              className="w-full rounded-lg border border-gray-300 bg-gray-100/50 px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <p className="mt-3 ms-2 text-xs text-gray-500">
          Needs review includes Reported, Suspected, and Probable cases.
          Resolved includes Confirmed and Ruled Out outcomes.
        </p>
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
        status={status}
        statusOptions={STATUS_OPTIONS}
        onStatusChange={(value) => {
          setStatus(value);
          if (value) setQueue("");
        }}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        emptyTitle={
          search || status
            ? "No reports match these filters"
            : queue === "needs_review"
              ? "Review queue is clear"
              : queue === "resolved"
                ? "No resolved reports yet"
                : "No citizen reports yet"
        }
        emptyDescription={
          search || status
            ? "Adjust the search or choose another status to broaden the results."
            : queue === "needs_review"
              ? "There are currently no Reported, Suspected, or Probable cases awaiting a decision."
              : "Reports will appear here as the surveillance workflow progresses."
        }
      />
    </div>
  );
}
