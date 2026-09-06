import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Spinner from "../../../components/common/Spinner.jsx";
import ReportWorkflowPanel from "./ReportWorkflowPanel.jsx";
import ReportAuditTrail from "./ReportAuditTrail.jsx";
import { formatStatusLabel } from "../../../utils/formatStatusLabel";
import {
  RefreshCw,
  MapPin,
  TriangleAlert,
  ChevronDown,
  Clock3,
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
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-sm font-medium text-red-700">
        {label}
      </span>
    );
  if (["ruled_out", "not_suspected"].includes(v))
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
        {label}
      </span>
    );
  if (v === "reported" || v === "not_validated" || v === "probable")
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-700">
        {label}
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700">
      {label}
    </span>
  );
}

function isResolvedStatus(value) {
  return [
    "confirmed",
    "validated_confirmed",
    "not_validated",
    "ruled_out",
    "not_suspected",
  ].includes(
    String(value || "")
      .replace(/[\s-]+/g, "_")
      .toLowerCase(),
  );
}

function workflowHint(value) {
  const status = String(value || "reported")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  if (status === "reported") return "Investigation has not started";
  if (status === "suspected") return "Needs evidence review";
  if (status === "probable") return "Needs confirmation decision";
  if (status === "confirmed") return "Confirmed outcome recorded";
  if (status === "ruled_out") return "Review completed — ruled out";
  if (status === "not_validated") return "Legacy review outcome";
  return "Open report workflow";
}

export default function ReportsLogList({
  reports,
  pagination,
  loading,
  onRefresh,
  onPageChange,
  token,
  canAccessPatientIdentity,
  status,
  statusOptions = [],
  onStatusChange,
  sortOrder,
  onSortOrderChange,
  emptyTitle = "No reports in this queue",
  emptyDescription = "New reports will appear here when they match this view.",
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
      <details
        open
        className="group overflow-hidden rounded-xl border border-blue-200 bg-white"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between bg-blue-50 px-4 py-3 font-semibold text-blue-950 marker:content-none hover:bg-blue-100/70">
          Report information
          <ChevronDown className="h-4 w-4 text-blue-700 transition group-open:rotate-180" />
        </summary>
        <dl className="grid gap-4 border-t border-blue-100 px-4 py-4 text-sm md:grid-cols-2">
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Report ID
            </dt>
            <dd className="break-all font-mono text-gray-800">{report._id}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Reported at
            </dt>
            <dd className="text-gray-800">
              {new Date(report.reportedAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Reporter location
            </dt>
            <dd className="text-gray-800">
              {formatActualLocation(report.location)}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Exposure location
            </dt>
            <dd className="text-gray-800">
              {formatActualLocation({
                barangay: report.exposureBarangay,
                district: report.exposureDistrict,
              })}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Source
            </dt>
            <dd className="text-gray-800">
              {formatSourceLabel(report.source)}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Submitted by
            </dt>
            <dd className="text-gray-800">
              {formatSubmittedBy(report.reportedBy, canAccessPatientIdentity)}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Case count
            </dt>
            <dd className="text-gray-800">{report.caseCount ?? 1}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Symptoms
            </dt>
            <dd className="text-gray-800">
              {formatSymptoms(report.symptoms).join(", ") || "—"}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Food/exposure information
            </dt>
            <dd className="text-gray-800">{report.foodSource || "—"}</dd>
          </div>
        </dl>
      </details>
      <ReportWorkflowPanel
        report={report}
        token={token}
        onUpdated={onRefresh}
      />
    </div>
  );

  return (
    <Fragment>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Recent reports
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {loading
                ? "Loading latest citizen-submitted reports..."
                : `${total} report${total === 1 ? "" : "s"} found`}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-500 me-1">
              Status
              <select
                value={status}
                onChange={(event) => onStatusChange?.(event.target.value)}
                className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-44"
              >
                {statusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium uppercase tracking-wide text-gray-500 me-2">
              Reported date
              <select
                value={sortOrder}
                onChange={(event) => onSortOrderChange?.(event.target.value)}
                className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-40"
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>
            <button
              onClick={() => onRefresh?.()}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
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
            <p className="text-sm font-semibold text-gray-800">{emptyTitle}</p>
            <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 bg-slate-50/60 p-3 sm:p-4">
              {paginatedReports.map((report) => {
                const reportedAt = formatReportedAt(report.reportedAt);
                const symptoms = formatSymptoms(report.symptoms);
                const status =
                  report.currentStatus || report.caseClassification;
                const resolved = isResolvedStatus(status);

                return (
                  <article
                    key={report._id}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 ${resolved ? "border-slate-200 bg-slate-50/80" : "border-l-4 border-slate-200 border-l-amber-400"}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="font-mono text-[14px] font-semibold text-slate-500"
                            title={report._id}
                          >
                            {formatShortReportId(report._id)}
                          </span>
                          —
                          <span className="font-medium text-slate-700 text-[14px] me-2">
                            {report.caseCount ?? 1} case
                            {Number(report.caseCount ?? 1) === 1 ? "" : "s"}
                          </span>

                          {classificationBadge(status)}
                        </div>
                        <span className="inline-flex items-center align-middle gap-1 text-[10px] text-slate-500">
                          <Clock3 className="h-3 w-3" />
                          {reportedAt.date} · {reportedAt.time}
                        </span>
                        <p
                          className={`mt-2 text-sm font-semibold ${resolved ? "text-slate-600" : "text-slate-900"}`}
                        >
                          {workflowHint(status)}
                        </p>
                        <p>
                          <span className="inline-flex max-w-full items-center gap-1 font-medium text-xs text-[#134c8c]">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            {formatActualLocation(report.location)}
                          </span>
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {symptoms.slice(0, 3).map((symptom) => (
                            <span
                              key={`${report._id}-${symptom}`}
                              className="rounded-md bg-slate-100 px-2.5 py-1.5 text-slate-600"
                            >
                              {symptom}
                            </span>
                          ))}
                          {symptoms.length > 3 ? (
                            <span className="text-slate-500">
                              +{symptoms.length - 3} symptoms
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedReportId(report._id)}
                        className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${resolved ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100" : "bg-[#134c8c] text-white hover:bg-[#0c3a6b]"}`}
                      >
                        Open report
                        <ChevronDown className="h-4 w-4 -rotate-90" />
                      </button>
                    </div>
                  </article>
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Citizen report
                      </p>
                      <h3
                        id="report-details-title"
                        className="mt-1 text-xl font-semibold text-gray-950"
                      >
                        Report details
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {classificationBadge(
                          selectedReport.currentStatus ||
                            selectedReport.caseClassification,
                        )}
                        <span
                          className="font-mono text-xs font-semibold text-gray-500"
                          title={selectedReport._id}
                        >
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
                  <ReportAuditTrail
                    reportId={selectedReport._id}
                    token={token}
                  />
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
    (value, index) =>
      parts.findIndex(
        (candidate) => candidate.toLowerCase() === value.toLowerCase(),
      ) === index,
  );
  return uniqueParts.join(", ") || "—";
}

function formatSourceLabel(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
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
  return (
    [reportedBy.username, reportedBy.email, reportedBy.phoneNumber]
      .filter(Boolean)
      .join(" · ") ||
    reportedBy._id ||
    "Citizen User"
  );
}
