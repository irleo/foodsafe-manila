import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Spinner from "../Spinner.jsx";
import ReportWorkflowPanel from "./ReportWorkflowPanel.jsx";
import ReportAuditTrail from "./ReportAuditTrail.jsx";
import { formatStatusLabel } from "../../utils/formatStatusLabel";
import {
  RefreshCw,
  MapPin,
  TriangleAlert,
  ChevronDown,
  CircleX,
  Clock3,
  Flag,
  X,
} from "lucide-react";

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

function classificationBadge(caseClassification) {
  const rawValue = String(caseClassification || "reported");
  const v = rawValue
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  const label = formatStatusLabel(rawValue);
  if (v === "validated_confirmed" || v === "confirmed")
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        {label}
      </span>
    );
  if (["ruled_out", "not_suspected"].includes(v))
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
        {label}
      </span>
    );
  if (v === "reported" || v === "not_validated" || v === "probable")
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        {label}
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
      {label}
    </span>
  );
}

export default function ReportsLogList({
  reports,
  pagination,
  loading,
  onRefresh,
  onPageChange,
  token,
  canAccessPatientIdentity,
}) {
  const [selectedReportId, setSelectedReportId] = useState(null);

  const page = pagination?.page || 1;
  const limit = pagination?.limit || 10;
  const total = pagination?.total || 0;
  const totalPages = pagination?.totalPages || 1;
  const paginatedReports = reports;
  const selectedReport = paginatedReports.find(
    (report) => report._id === selectedReportId,
  );
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  useEffect(() => {
    if (!selectedReport) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedReportId(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedReport]);

  const renderExpandedDetails = (report) => (
    <div className="space-y-4">
      <details open className="group overflow-hidden rounded-xl border border-gray-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold text-gray-900 marker:content-none">
          Report information
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <dl className="grid gap-4 border-t border-gray-100 px-4 py-4 text-sm md:grid-cols-2">
          <div><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Report ID</dt><dd className="break-all font-mono text-gray-800">{report._id}</dd></div>
          <div><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Reported at</dt><dd className="text-gray-800">{new Date(report.reportedAt).toLocaleString()}</dd></div>
          <div><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Reporter location</dt><dd className="text-gray-800">{formatActualLocation(report.location)}</dd></div>
          <div><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Exposure location</dt><dd className="text-gray-800">{formatActualLocation({ barangay: report.exposureBarangay, district: report.exposureDistrict })}</dd></div>
          <div><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Source</dt><dd className="text-gray-800">{formatSourceLabel(report.source)}</dd></div>
          <div><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted by</dt><dd className="text-gray-800">{formatSubmittedBy(report.reportedBy, canAccessPatientIdentity)}</dd></div>
          <div><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Case count</dt><dd className="text-gray-800">{report.caseCount ?? 1}</dd></div>
          <div><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Symptoms</dt><dd className="text-gray-800">{formatSymptoms(report.symptoms).join(", ") || "—"}</dd></div>
          <div className="md:col-span-2"><dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Food/exposure information</dt><dd className="text-gray-800">{report.foodSource || "—"}</dd></div>
        </dl>
      </details>
      <ReportWorkflowPanel report={report} token={token} onUpdated={onRefresh} />
    </div>
  );

  return (
    <Fragment>
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent reports</h3>
          <p className="mt-1 text-sm text-gray-500">
            {loading
              ? "Loading latest citizen-submitted reports..."
              : `${total} report${total === 1 ? "" : "s"} found`}
          </p>
        </div>

        <button
          onClick={() => onRefresh?.()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-60 items-center justify-center px-6 py-10">
          <div className="h-7 w-7">
            <Spinner />
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex min-h-55 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-3 rounded-full bg-gray-100 p-3">
            <TriangleAlert className="h-5 w-5 text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-700">No reports found</p>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting the search or status filter.
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
                  <th className="px-6 py-3">Report ID</th>
                  <th className="px-6 py-3">Current status</th>
                  <th className="px-6 py-3">Reporter location</th>
                  <th className="px-6 py-3">Symptoms</th>
                  <th className="px-6 py-3">Case count</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {paginatedReports.map((report) => {
                  const reportedAt = formatReportedAt(report.reportedAt);
                  const symptoms = formatSymptoms(report.symptoms);

                  return (
                      <tr key={report._id} className="align-top transition hover:bg-gray-50/70">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {reportedAt.date}
                          </div>
                          <div className="text-sm text-gray-500">
                            {reportedAt.time}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Submitted
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-gray-700" title={report._id}>
                            {formatShortReportId(report._id)}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {classificationBadge(report.currentStatus || report.caseClassification)}
                          {decisionIndicator(report)}
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex max-w-72 items-center gap-1 whitespace-normal rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {formatActualLocation(report.location)}
                          </span>
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
                            type="button"
                            onClick={() => setSelectedReportId(report._id)}
                            aria-label={`View details for report ${report._id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            <ChevronDown className="h-4 w-4 -rotate-90" />
                            View details
                          </button>
                        </td>
                      </tr>
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
                      <p className="mt-1 font-mono text-xs font-semibold text-gray-600" title={report._id}>
                        {formatShortReportId(report._id)}
                      </p>
                      <div className="mt-2">
                        {classificationBadge(report.currentStatus || report.caseClassification)}
                        {decisionIndicator(report)}
                      </div>
                    </div>

                    <div className="inline-flex min-w-10 justify-center rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800">
                      {report.caseCount ?? 1}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Reporter location
                      </p>
                      <span className="inline-flex max-w-full items-center gap-1 whitespace-normal rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {formatActualLocation(report.location)}
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
                    type="button"
                    onClick={() => setSelectedReportId(report._id)}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    <ChevronDown className="h-4 w-4 -rotate-90" />
                    View details
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing {rangeStart}-{rangeEnd} of {total} reports
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange?.(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>

              <span className="px-2 text-sm text-gray-600">
                Page {page} / {totalPages}
              </span>

              <button
                onClick={() => onPageChange?.(page + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    {selectedReport && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50" role="presentation">
            <button
              type="button"
              aria-label="Close report details"
              className="absolute inset-0 h-full w-full cursor-default bg-gray-950/40 backdrop-blur-[1px]"
              onClick={() => setSelectedReportId(null)}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-details-title"
              className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl sm:max-w-2xl"
            >
              <header className="shrink-0 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Citizen report</p>
                    <h3 id="report-details-title" className="mt-1 text-xl font-semibold text-gray-950">Report details</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {classificationBadge(selectedReport.currentStatus || selectedReport.caseClassification)}
                      <span className="font-mono text-xs font-semibold text-gray-500" title={selectedReport._id}>
                        {formatShortReportId(selectedReport._id)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReportId(null)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label="Close report details"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <ReportAuditTrail reportId={selectedReport._id} token={token} />
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/70 p-4 sm:p-6">
                {renderExpandedDetails(selectedReport)}
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null}
    </Fragment>
  );
}

function formatShortReportId(value) {
  const normalized = String(value || "");
  return normalized ? `#${normalized.slice(-8).toUpperCase()}` : "—";
}

function decisionIndicator(report) {
  if (!report.suspectedDecision?.markedAt) return null;

  const isRuledOut = ["ruled_out", "not_suspected"].includes(
    report.suspectedDecision.outcome,
  );
  const DecisionIcon = isRuledOut ? CircleX : Flag;

  return (
    <div
      className={`mt-2 flex max-w-64 items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px] leading-tight ${
        isRuledOut
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <DecisionIcon
        aria-hidden="true"
        className={`mt-px h-3 w-3 shrink-0 ${isRuledOut ? "text-red-600" : "fill-amber-200 text-amber-600"}`}
      />
      <span>
        {isRuledOut ? "Ruled Out" : "Marked as Suspected"} by{" "}
        <strong>{report.suspectedDecision.markedBy?.username || "authorized personnel"}</strong>
      </span>
    </div>
  );
}

function formatActualLocation({ name, barangay, district } = {}) {
  const barangayText = String(barangay || "").trim();
  const parts = [
    String(name || "").trim(),
    barangayText && !/^barangay\b/i.test(barangayText)
      ? `Barangay ${barangayText}`
      : barangayText,
    formatDistrictKey(district),
  ].filter((value) => value && value !== "—");
  const uniqueParts = parts.filter(
    (value, index) => parts.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
  );
  return uniqueParts.join(", ") || "—";
}

function formatSourceLabel(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "Citizen App";
  if (v === "citizen_app") return "Citizen App";
  if (v === "health_official") return "Health Official";
  return v
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSubmittedBy(reportedBy, canAccessPatientIdentity) {
  if (!canAccessPatientIdentity) return "Restricted";
  if (!reportedBy) return "Citizen User";
  if (typeof reportedBy === "string") return "Citizen User";
  return [reportedBy.username, reportedBy.email, reportedBy.phone_number]
    .filter(Boolean)
    .join(" · ") || reportedBy._id || "Citizen User";
}

