import DashboardSummary from "../models/DashboardSummary.js";
import { getAnalyticalCaseRows } from "./analyticalCaseService.js";
import { getReportAnalyticsRows, groupReportRowsByStatus } from "./reportAnalyticsService.js";

const GLOBAL_SCOPE = "global";
const OFFICIAL_TOTAL_DEFINITION = "Confirmed cases from authoritative CESU uploads only; citizen reports are tracked separately";

function groupOfficialRowsByStatus(rows = []) {
  const counts = { suspected: 0, probable: 0, confirmed: 0 };
  for (const row of rows) {
    const status = row?.caseClassification;
    if (!(status in counts)) continue;
    counts[status] += Math.max(0, Number(row?.cases || 0));
  }
  return counts;
}

export async function refreshDashboardSummary(year = new Date().getFullYear()) {
  const [currentRows, previousRows, officialStatusRows, reportRows] = await Promise.all([
    getAnalyticalCaseRows({ year, statuses: ["confirmed"] }),
    getAnalyticalCaseRows({ year: year - 1, statuses: ["confirmed"] }),
    getAnalyticalCaseRows({ year, statuses: ["suspected", "probable", "confirmed"] }),
    getReportAnalyticsRows({ year }),
  ]);
  const currentYearTotal = currentRows.reduce(
    (sum, row) => sum + Number(row.cases || 0),
    0,
  );
  const previousYearTotal = previousRows.reduce(
    (sum, row) => sum + Number(row.cases || 0),
    0,
  );
  const officialCounts = groupOfficialRowsByStatus(officialStatusRows);
  const reportWorkflowCounts = groupReportRowsByStatus(reportRows);
  const districtTotals = new Map();
  const diseaseTotals = new Map();
  for (const row of currentRows) {
    if (row.district) {
      districtTotals.set(
        row.district,
        (districtTotals.get(row.district) || 0) + Number(row.cases || 0),
      );
    }
    if (row.disease) {
      diseaseTotals.set(
        row.disease,
        (diseaseTotals.get(row.disease) || 0) + Number(row.cases || 0),
      );
    }
  }
  const mostConcentratedDistrict = [...districtTotals.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const mostFrequentCondition = [...diseaseTotals.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const summary = {
    scope: GLOBAL_SCOPE,
    year,
    totalCases: currentYearTotal,
    currentYearTotal,
    previousYearTotal,
    suspectedReports: reportWorkflowCounts.suspected,
    // Legacy field name: this is the total number of citizen report records,
    // including reports that were later reviewed, validated, or ruled out.
    reportedCases: reportRows.length,
    suspectedCases: officialCounts.suspected,
    probableCases: officialCounts.probable,
    confirmedCases: currentYearTotal,
    notValidatedCases: 0,
    totalDefinition: OFFICIAL_TOTAL_DEFINITION,
    topDistrict: mostConcentratedDistrict || null,
    topDisease: mostFrequentCondition || null,
    generatedAt: new Date(),
  };

  return DashboardSummary.findOneAndUpdate(
    { scope: GLOBAL_SCOPE, year },
    { $set: summary },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function getDashboardSummary(year = new Date().getFullYear()) {
  const existing = await DashboardSummary.findOne({ scope: GLOBAL_SCOPE, year })
    .select(
      "year totalCases currentYearTotal previousYearTotal reportedCases suspectedCases probableCases confirmedCases notValidatedCases totalDefinition topDistrict topDisease generatedAt",
    )
    .lean();
  return existing
    && Number.isFinite(Number(existing.probableCases))
    && existing.totalDefinition === OFFICIAL_TOTAL_DEFINITION
    ? existing
    : refreshDashboardSummary(year);
}

export async function refreshDashboardSummaryAfterWrite() {
  try {
    await refreshDashboardSummary();
  } catch (error) {
    console.error("Failed to refresh dashboard summary:", error?.message || error);
  }
}
