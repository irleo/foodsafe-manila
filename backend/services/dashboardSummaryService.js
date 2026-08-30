import DashboardSummary from "../models/DashboardSummary.js";
import { getAnalyticalCaseRows, groupCaseRowsByStatus } from "./analyticalCaseService.js";

const GLOBAL_SCOPE = "global";
const OFFICIAL_TOTAL_DEFINITION = "Confirmed cases from authoritative CESU uploads only";

export async function refreshDashboardSummary(year = new Date().getFullYear()) {
  const [currentRows, previousRows, statusRows] = await Promise.all([
    getAnalyticalCaseRows({ year, statuses: ["confirmed"], includeReports: false }),
    getAnalyticalCaseRows({ year: year - 1, statuses: ["confirmed"], includeReports: false }),
    getAnalyticalCaseRows({
      year,
      statuses: ["reported", "suspected", "probable", "confirmed", "not_validated"],
      includeOfficial: false,
      includeReports: true,
    }),
  ]);
  const currentYearTotal = currentRows.reduce(
    (sum, row) => sum + Number(row.cases || 0),
    0,
  );
  const previousYearTotal = previousRows.reduce(
    (sum, row) => sum + Number(row.cases || 0),
    0,
  );
  const counts = groupCaseRowsByStatus(statusRows);
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
    suspectedReports: counts.suspected,
    reportedCases: counts.reported,
    suspectedCases: counts.suspected,
    probableCases: counts.probable,
    confirmedCases: currentYearTotal,
    notValidatedCases: counts.notValidated,
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
