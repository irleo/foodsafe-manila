import DashboardSummary from "../models/DashboardSummary.js";
import OfficialCase from "../models/OfficialCase.js";
import Report from "../models/Report.js";
import { computeRiskAnalysis } from "../utils/riskUtils.js";

const GLOBAL_SCOPE = "global";

function firstTotal(rows) {
  return Number(rows?.[0]?.total) || 0;
}

export async function refreshDashboardSummary(year = new Date().getFullYear()) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [official, reports] = await Promise.all([
    OfficialCase.aggregate([
      { $match: { year: { $in: [year, year - 1] } } },
      {
        $facet: {
          currentTotal: [
            { $match: { year } },
            { $group: { _id: null, total: { $sum: "$cases" } } },
          ],
          previousTotal: [
            { $match: { year: year - 1 } },
            { $group: { _id: null, total: { $sum: "$cases" } } },
          ],
          topDistrict: [
            { $match: { year } },
            { $group: { _id: "$district", total: { $sum: "$cases" } } },
            { $sort: { total: -1, _id: 1 } },
            { $limit: 1 },
          ],
          topDisease: [
            { $match: { year } },
            { $group: { _id: "$disease", total: { $sum: "$cases" } } },
            { $sort: { total: -1, _id: 1 } },
            { $limit: 1 },
          ],
          byDistrict: [
            { $match: { year } },
            { $group: { _id: "$district", total: { $sum: "$cases" } } },
          ],
        },
      },
    ]),
    Report.aggregate([
      {
        $match: {
          isCounted: true,
          reportedAt: { $gte: start, $lt: end },
        },
      },
      {
        $facet: {
          total: [{ $group: { _id: null, total: { $sum: "$caseCount" } } }],
          byDistrict: [
            {
              $group: {
                _id: { $ifNull: ["$exposureDistrict", "$location.district"] },
                total: { $sum: "$caseCount" },
              },
            },
          ],
        },
      },
    ]),
  ]);

  const officialResult = official[0] || {};
  const reportResult = reports[0] || {};
  const districtTotals = new Map();
  for (const row of officialResult.byDistrict || []) {
    if (row._id) districtTotals.set(row._id, Number(row.total) || 0);
  }
  for (const row of reportResult.byDistrict || []) {
    if (!row._id) continue;
    districtTotals.set(
      row._id,
      (districtTotals.get(row._id) || 0) + (Number(row.total) || 0),
    );
  }

  const riskLevelCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const total of districtTotals.values()) {
    const level = computeRiskAnalysis(total).riskLevel;
    if (Object.hasOwn(riskLevelCounts, level)) riskLevelCounts[level] += 1;
  }

  const currentYearTotal = firstTotal(officialResult.currentTotal);
  const summary = {
    scope: GLOBAL_SCOPE,
    year,
    totalCases: currentYearTotal,
    currentYearTotal,
    previousYearTotal: firstTotal(officialResult.previousTotal),
    suspectedReports: firstTotal(reportResult.total),
    topDistrict: officialResult.topDistrict?.[0]?._id || null,
    topDisease: officialResult.topDisease?.[0]?._id || null,
    riskLevelCounts,
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
      "year totalCases currentYearTotal previousYearTotal suspectedReports topDistrict topDisease riskLevelCounts generatedAt",
    )
    .lean();
  return existing || refreshDashboardSummary(year);
}

export async function refreshDashboardSummaryAfterWrite() {
  try {
    await refreshDashboardSummary();
  } catch (error) {
    console.error("Failed to refresh dashboard summary:", error?.message || error);
  }
}
