import { useEffect, useMemo, useState } from "react";
import Spinner from "../Spinner.jsx";
import {
  RefreshCw,
  MapPin,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  User,
  Clock3,
  Activity,
} from "lucide-react";

const PAGE_SIZE = 8;

function formatDistrictKey(value) {
  if (!value) return "—";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSymptoms(symptoms = []) {
  if (!Array.isArray(symptoms) || symptoms.length === 0) return [];
  return symptoms.map((s) =>
    s
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  );
}

function formatReportedAt(value) {
  if (!value) return { date: "—", time: "" };

  const date = new Date(value);

  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export default function ReportsLogList({ reports, loading, onRefresh }) {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [reports]);

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));

  const paginatedReports = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return reports.slice(start, start + PAGE_SIZE);
  }, [reports, page]);

  const rangeStart = reports.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, reports.length);

  const toggleExpanded = (reportId) => {
    setExpandedId((prev) => (prev === reportId ? null : reportId));
  };

  const renderExpandedDetails = (report) => (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Reporter district
          </p>
          <p className="text-sm text-gray-800">
            {formatDistrictKey(report.location?.district)}
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Exposure district
          </p>
          <p className="text-sm text-gray-800">
            {formatDistrictKey(report.exposureDistrict)}
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Food source
          </p>
          <p className="text-sm text-gray-800">{report.foodSource || "—"}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Case count
          </p>
          <p className="text-sm text-gray-800">{report.caseCount ?? 1}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Source
          </p>
          <p className="text-sm text-gray-800">{report.source || "citizen_app"}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Submitted by
          </p>
          <p className="text-sm text-gray-800">
            {report.reportedBy?.username ||
              report.reportedBy?.email ||
              report.reportedBy?._id ||
              "—"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent reports</h3>
          <p className="mt-1 text-sm text-gray-500">
            {loading
              ? "Loading latest citizen-submitted reports..."
              : `${reports.length} report${reports.length === 1 ? "" : "s"} found`}
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center px-6 py-10">
          <div className="h-7 w-7">
            <Spinner />
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-3 rounded-full bg-gray-100 p-3">
            <TriangleAlert className="h-5 w-5 text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-700">No reports found</p>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting the selected district filter.
          </p>
        </div>
      ) : (
        <>
          

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr className="border-y border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">Reported at</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Symptoms</th>
                  <th className="px-6 py-3">Case count</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {paginatedReports.map((report) => {
                  const reportedAt = formatReportedAt(report.reportedAt);
                  const symptoms = formatSymptoms(report.symptoms);
                  const isExpanded = expandedId === report._id;

                  return (
                    <>
                      <tr
                        key={report._id}
                        className="align-top transition hover:bg-gray-50/70"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {reportedAt.date}
                          </div>
                          <div className="text-sm text-gray-500">
                            {reportedAt.time}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                                Reporter district
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                <MapPin className="h-3 w-3" />
                                {formatDistrictKey(report.location?.district)}
                              </span>
                            </div>

                            <div>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                                Exposure district
                              </div>
                              <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                {formatDistrictKey(report.exposureDistrict)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {symptoms.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {symptoms.slice(0, 3).map((symptom) => (
                                <span
                                  key={`${report._id}-${symptom}`}
                                  className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                                >
                                  {symptom}
                                </span>
                              ))}
                              {symptoms.length > 3 && (
                                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                  +{symptoms.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="inline-flex min-w-10 justify-center rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800">
                            {report.caseCount ?? 1}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleExpanded(report._id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                View details
                              </>
                            )}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-white">
                          <td colSpan={5} className="px-6 pb-4">
                            {renderExpandedDetails(report)}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / small screen cards */}
          <div className="space-y-4 px-4 pb-4 md:hidden">
            {paginatedReports.map((report) => {
              const reportedAt = formatReportedAt(report.reportedAt);
              const symptoms = formatSymptoms(report.symptoms);
              const isExpanded = expandedId === report._id;

              return (
                <div
                  key={report._id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <Clock3 className="h-4 w-4 text-gray-500" />
                        {reportedAt.date}
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{reportedAt.time}</p>
                    </div>

                    <div className="inline-flex min-w-10 justify-center rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800">
                      {report.caseCount ?? 1}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Reporter district
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        <MapPin className="h-3 w-3" />
                        {formatDistrictKey(report.location?.district)}
                      </span>
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Exposure district
                      </p>
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {formatDistrictKey(report.exposureDistrict)}
                      </span>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Symptoms
                      </p>
                      {symptoms.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {symptoms.map((symptom) => (
                            <span
                              key={`${report._id}-${symptom}`}
                              className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                            >
                              {symptom}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleExpanded(report._id)}
                    className="mt-4 inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        View details
                      </>
                    )}
                  </button>

                  {isExpanded && <div className="mt-4">{renderExpandedDetails(report)}</div>}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing {rangeStart}-{rangeEnd} of {reports.length} reports
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => prev - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>

              <span className="px-2 text-sm text-gray-600">
                Page {page} / {totalPages}
              </span>

              <button
                onClick={() => setPage((prev) => prev + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}