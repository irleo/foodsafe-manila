import { Fragment, useEffect, useState } from "react";
import Spinner from "../Spinner.jsx";
import ReportWorkflowPanel from "./ReportWorkflowPanel.jsx";
import { formatStatusLabel } from "../../utils/formatStatusLabel";
import {
  RefreshCw,
  MapPin,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  CircleX,
  Clock3,
  Flag,
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
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedId(null);
  }, [reports]);

  const page = pagination?.page || 1;
  const limit = pagination?.limit || 10;
  const total = pagination?.total || 0;
  const totalPages = pagination?.totalPages || 1;
  const paginatedReports = reports;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  const toggleExpanded = (reportId) => {
    setExpandedId((prev) => (prev === reportId ? null : reportId));
  };

  const renderExpandedDetails = (report) => (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h4 className="mb-4 font-semibold text-gray-900">Additional report information</h4>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Report ID</p>
          <p className="break-all font-mono text-sm text-gray-800">{report._id}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Food/exposure information</p>
          <p className="text-sm text-gray-800">{report.foodSource || "—"}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Source
          </p>
          <p className="text-sm text-gray-800">{formatSourceLabel(report.source)}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Submitted by
          </p>
          <p className="text-sm text-gray-800">
            {formatSubmittedBy(report.reportedBy, canAccessPatientIdentity)}
          </p>
        </div>
      </div>
      <ReportWorkflowPanel report={report} token={token} onUpdated={onRefresh} />
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
                  <th className="px-6 py-3">Current status</th>
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
                    <Fragment key={report._id}>
                      <tr
                        className="align-top transition hover:bg-gray-50/70"
                      >
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

                        <td className="px-6 py-4">
                          {classificationBadge(report.currentStatus || report.caseClassification)}
                          {decisionIndicator(report)}
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                                Reporter location
                              </div>
                              <span className="inline-flex max-w-72 items-center gap-1 whitespace-normal rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {formatActualLocation({
                                  barangay: report.location?.barangay,
                                  district: report.location?.district,
                                })}
                              </span>
                            </div>

                            <div>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                                Exposure location
                              </div>
                              <span className="inline-flex max-w-72 items-center gap-1 whitespace-normal rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {formatActualLocation({
                                  barangay: report.exposureBarangay,
                                  district: report.exposureDistrict,
                                })}
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
                          <td colSpan={6} className="px-6 pb-4">
                            {renderExpandedDetails(report)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
                        {formatActualLocation({
                          name: report.location?.name,
                          barangay: report.location?.barangay,
                          district: report.location?.district,
                        })}
                      </span>
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Exposure location
                      </p>
                      <span className="inline-flex max-w-full items-center gap-1 whitespace-normal rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {formatActualLocation({
                          barangay: report.exposureBarangay,
                          district: report.exposureDistrict,
                        })}
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
  );
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

