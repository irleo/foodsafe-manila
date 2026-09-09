import Report from "../models/Report.js";

const REPORT_STATUSES = new Set([
  "reported",
  "suspected",
  "probable",
  "confirmed",
  "ruled_out",
]);
const MAX_REPORT_ROWS = 100_000;

/**
 * Report.isCounted is a report-workflow eligibility flag only. It never makes
 * a Report an OfficialCase or eligible for epidemiological or prediction input.
 */
export async function getReportAnalyticsRows({ year, statuses, counted } = {}) {
  const query = {};
  const selectedStatuses = (Array.isArray(statuses) ? statuses : [statuses])
    .map((status) => String(status || "").trim().toLowerCase())
    .filter((status) => REPORT_STATUSES.has(status));
  if (selectedStatuses.length) query.currentStatus = { $in: [...new Set(selectedStatuses)] };
  if (typeof counted === "boolean") query.isCounted = counted;
  if (Number.isInteger(Number(year))) {
    query.reportedAt = {
      $gte: new Date(Date.UTC(Number(year), 0, 1)),
      $lt: new Date(Date.UTC(Number(year) + 1, 0, 1)),
    };
  }

  const rows = await Report.find(query)
    .select("reportedAt caseCount currentStatus caseClassification isCounted")
    .limit(MAX_REPORT_ROWS + 1)
    .lean();
  if (rows.length > MAX_REPORT_ROWS) {
    const error = new Error(`Report analytics exceeds the ${MAX_REPORT_ROWS}-row limit`);
    error.status = 413;
    throw error;
  }
  return rows;
}

export async function getReportLogSummary() {
  const [totalReports, ongoingReports, confirmedReports] = await Promise.all([
    Report.countDocuments({}),
    Report.countDocuments({
      $or: [
        { currentStatus: { $in: ["reported", "suspected", "probable"] } },
        { currentStatus: { $exists: false } },
      ],
    }),
    Report.countDocuments({ currentStatus: "confirmed" }),
  ]);

  return { totalReports, ongoingReports, confirmedReports };
}

export function groupReportRowsByStatus(rows = []) {
  const counts = {
    reported: 0,
    suspected: 0,
    probable: 0,
    confirmed: 0,
    ruledOut: 0,
  };
  for (const row of rows) {
    const count = Math.max(0, Number(row?.caseCount || 1));
    const status = row?.currentStatus || row?.caseClassification;
    if (status === "reported") counts.reported += count;
    if (status === "suspected") counts.suspected += count;
    if (status === "probable") counts.probable += count;
    if (status === "confirmed") counts.confirmed += count;
    if (status === "ruled_out") counts.ruledOut += count;
  }
  return counts;
}
