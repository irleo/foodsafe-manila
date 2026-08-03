import OfficialCase from "../models/OfficialCase.js";
import Report from "../models/Report.js";
import {
  computeRiskAnalysis,
  monthsAgoDate,
} from "../utils/riskUtils.js";
import { createAsyncTtlCache } from "../utils/asyncTtlCache.js";

const riskSnapshotCache = createAsyncTtlCache({
  name: "mobile-risk-snapshot",
  defaultTtlMs: 60_000,
});
const nearbyRiskCache = createAsyncTtlCache({
  name: "mobile-nearby-risk",
  defaultTtlMs: 60_000,
});
const mobileDashboardCache = createAsyncTtlCache({
  name: "mobile-dashboard",
  defaultTtlMs: 120_000,
});

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function riskCacheTtlMs() {
  return positiveInteger(process.env.RISK_CACHE_TTL_MS, 60_000);
}

function dashboardCacheTtlMs() {
  return positiveInteger(process.env.DASHBOARD_CACHE_TTL_MS, 120_000);
}

async function aggregateOfficialByBarangay(since, barangayNo = null) {
  const match =
    barangayNo == null
      ? { barangayNo: { $ne: null } }
      : { barangayNo: Number(barangayNo) };
  if (since) {
    const startYear = since.getFullYear();
    const startMonth = since.getMonth() + 1;
    match.$or = [
      { year: { $gt: startYear } },
      { year: startYear, month: { $gte: startMonth } },
    ];
  }

  return OfficialCase.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          barangayNo: "$barangayNo",
          barangay: "$barangay",
          district: "$district",
        },
        officialCases: { $sum: "$cases" },
      },
    },
  ]);
}

async function aggregateReportsByBarangay(since, barangayNo = null) {
  const match =
    barangayNo == null
      ? {
          isCounted: true,
          $or: [
            { "location.barangayNo": { $ne: null } },
            { exposureBarangayNo: { $ne: null } },
          ],
        }
      : {
          isCounted: true,
          $or: [
            { exposureBarangayNo: Number(barangayNo) },
            {
              exposureBarangayNo: null,
              "location.barangayNo": Number(barangayNo),
            },
          ],
        };
  if (since) match.reportedAt = { $gte: since };

  return Report.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          barangayNo: { $ifNull: ["$exposureBarangayNo", "$location.barangayNo"] },
          barangay: { $ifNull: ["$exposureBarangay", "$location.barangay"] },
          district: { $ifNull: ["$exposureDistrict", "$location.district"] },
        },
        suspectedCases: { $sum: "$caseCount" },
      },
    },
  ]);
}

function mergeAreaRows(officialRows, reportRows) {
  const map = new Map();

  for (const row of officialRows) {
    const id = row._id;
    const key = String(id.barangayNo);
    map.set(key, {
      barangayNo: id.barangayNo,
      barangay: id.barangay,
      district: id.district,
      officialCases: row.officialCases,
      suspectedCases: 0,
    });
  }

  for (const row of reportRows) {
    const id = row._id;
    const key = String(id.barangayNo);
    const existing = map.get(key) || {
      barangayNo: id.barangayNo,
      barangay: id.barangay,
      district: id.district,
      officialCases: 0,
      suspectedCases: 0,
    };
    existing.suspectedCases += row.suspectedCases;
    if (!existing.barangay && id.barangay) existing.barangay = id.barangay;
    if (!existing.district && id.district) existing.district = id.district;
    map.set(key, existing);
  }

  return [...map.values()].map((area) => {
    const totalCases = area.officialCases + area.suspectedCases;
    const risk = computeRiskAnalysis(totalCases);
    return {
      ...area,
      totalCases,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      risk: risk.risk,
      riskLabel: risk.riskLabel,
      classification: {
        official: area.officialCases,
        suspected: area.suspectedCases,
      },
    };
  });
}

async function buildRiskSnapshot(months) {
  const since = monthsAgoDate(months);
  const [officialRows, reportRows] = await Promise.all([
    aggregateOfficialByBarangay(since),
    aggregateReportsByBarangay(since),
  ]);
  const areas = mergeAreaRows(officialRows, reportRows);
  const summary = {
    critical: areas.filter((a) => a.riskLevel === "critical").length,
    high: areas.filter((a) => a.riskLevel === "high").length,
    medium: areas.filter((a) => a.riskLevel === "medium").length,
    moderate: areas.filter((a) => a.riskLevel === "medium").length,
    low: areas.filter((a) => a.riskLevel === "low").length,
  };
  const alerts = areas
    .filter((a) => a.riskLevel === "high" || a.riskLevel === "critical")
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);

  return { areas, summary, alerts };
}

function getRiskSnapshot(months) {
  return riskSnapshotCache.getOrLoad(
    `months:${months}`,
    () => buildRiskSnapshot(months),
    { ttlMs: riskCacheTtlMs() },
  );
}

function getNearbyAreaRisk(barangayNo, months) {
  return nearbyRiskCache.getOrLoad(
    `barangay:${barangayNo}:months:${months}`,
    async () => {
      const since = monthsAgoDate(months);
      const [officialRows, reportRows] = await Promise.all([
        aggregateOfficialByBarangay(since, barangayNo),
        aggregateReportsByBarangay(since, barangayNo),
      ]);
      return mergeAreaRows(officialRows, reportRows)[0] || null;
    },
    { ttlMs: riskCacheTtlMs() },
  );
}

// GET /api/dashboard
export const getMobileDashboard = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const payload = await mobileDashboardCache.getOrLoad(
      `year:${year}`,
      async () => {
        const [
          totalCasesAgg,
          topDistrictAgg,
          topDiseaseAgg,
          reportCountAgg,
          officialByDistrict,
          reportsByDistrict,
          previousYearAgg,
        ] = await Promise.all([
          OfficialCase.aggregate([
            { $match: { year } },
            { $group: { _id: null, total: { $sum: "$cases" } } },
          ]),
          OfficialCase.aggregate([
            { $match: { year } },
            { $group: { _id: "$district", total: { $sum: "$cases" } } },
            { $sort: { total: -1 } },
            { $limit: 1 },
          ]),
          OfficialCase.aggregate([
            { $match: { year } },
            { $group: { _id: "$disease", total: { $sum: "$cases" } } },
            { $sort: { total: -1 } },
            { $limit: 1 },
          ]),
          Report.aggregate([
            {
              $match: {
                isCounted: true,
                reportedAt: { $gte: new Date(year, 0, 1) },
              },
            },
            { $group: { _id: null, total: { $sum: "$caseCount" } } },
          ]),
          OfficialCase.aggregate([
            { $match: { year } },
            { $group: { _id: "$district", total: { $sum: "$cases" } } },
          ]),
          Report.aggregate([
            {
              $match: {
                isCounted: true,
                reportedAt: { $gte: new Date(year, 0, 1) },
              },
            },
            {
              $group: {
                _id: {
                  $ifNull: ["$exposureDistrict", "$location.district"],
                },
                total: { $sum: "$caseCount" },
              },
            },
          ]),
          OfficialCase.aggregate([
            { $match: { year: year - 1 } },
            { $group: { _id: null, total: { $sum: "$cases" } } },
          ]),
        ]);

        const districtRisk = new Map();
        for (const row of officialByDistrict) {
          districtRisk.set(row._id, {
            district: row._id,
            official: row.total,
            suspected: 0,
          });
        }
        for (const row of reportsByDistrict) {
          const key = row._id;
          if (!key) continue;
          const existing = districtRisk.get(key) || {
            district: key,
            official: 0,
            suspected: 0,
          };
          existing.suspected = row.total;
          districtRisk.set(key, existing);
        }

        let highRiskDistricts = 0;
        let criticalRiskDistricts = 0;
        let mediumRiskDistricts = 0;
        let lowRiskDistricts = 0;

        for (const entry of districtRisk.values()) {
          const level = computeRiskAnalysis(
            entry.official + entry.suspected,
          ).riskLevel;
          if (level === "critical") criticalRiskDistricts += 1;
          else if (level === "high") highRiskDistricts += 1;
          else if (level === "medium") mediumRiskDistricts += 1;
          else lowRiskDistricts += 1;
        }

        const currentYearTotal = totalCasesAgg[0]?.total || 0;
        const previousYearTotal = previousYearAgg[0]?.total || 0;
        const growth =
          previousYearTotal > 0
            ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100
            : 0;

        return {
          totalCases: currentYearTotal,
          suspectedReports: reportCountAgg[0]?.total || 0,
          topDistrict: topDistrictAgg[0]?._id || "N/A",
          topDisease: topDiseaseAgg[0]?._id || "N/A",
          growth: growth.toFixed(1),
          criticalRiskDistricts,
          highRiskDistricts,
          mediumRiskDistricts,
          moderateRiskDistricts: mediumRiskDistricts,
          lowRiskDistricts,
          year,
        };
      },
      { ttlMs: dashboardCacheTtlMs() },
    );

    return res.json(payload);
  } catch (error) {
    console.error("Mobile dashboard error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/risk/heatmap
export const getMobileRiskHeatmap = async (req, res) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 12));
    const { areas, summary } = await getRiskSnapshot(months);

    return res.json({ success: true, months, areas, summary });
  } catch (error) {
    console.error("Mobile risk heatmap error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/risk/nearby
export const getMobileNearbyRisk = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const barangayNo = parseInt(req.query.barangayNo, 10);

    if (!barangayNo && (Number.isNaN(lat) || Number.isNaN(lng))) {
      return res.status(400).json({ message: "barangayNo or lat/lng required" });
    }

    const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
    const [area, snapshot] = await Promise.all([
      barangayNo ? getNearbyAreaRisk(barangayNo, months) : Promise.resolve(null),
      getRiskSnapshot(months),
    ]);

    return res.json({
      success: true,
      area,
      isHighRisk: area?.riskLevel === "high" || area?.riskLevel === "critical",
      highRiskAreas: snapshot.alerts,
    });
  } catch (error) {
    console.error("Mobile nearby risk error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/official-cases/analytics
export const getMobileOfficialAnalytics = async (req, res) => {
  try {
    const { year, month, caseClassification } = req.query;
    const match = {};

    if (year && year !== "all") match.year = parseInt(year, 10);
    if (month && month !== "all") match.month = parseInt(month, 10);
    if (caseClassification && caseClassification !== "all") {
      match.caseClassification = caseClassification;
    }

    const totalCasesAgg = await OfficialCase.aggregate([
      { $group: { _id: null, totalCases: { $sum: "$cases" } } },
    ]);
    const totalCases = totalCasesAgg.length > 0 ? totalCasesAgg[0].totalCases : 0;

    const topDistrictAgg = await OfficialCase.aggregate([
      { $group: { _id: "$district", total: { $sum: "$cases" } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]);
    const topDistrict = topDistrictAgg.length > 0 ? topDistrictAgg[0]._id : "N/A";

    const baseYear =
      year && year !== "all" ? parseInt(year, 10) : new Date().getFullYear();

    const currentYearAgg = await OfficialCase.aggregate([
      { $match: { year: baseYear } },
      { $group: { _id: null, total: { $sum: "$cases" } } },
    ]);
    const previousYearAgg = await OfficialCase.aggregate([
      { $match: { year: baseYear - 1 } },
      { $group: { _id: null, total: { $sum: "$cases" } } },
    ]);

    const currentYearTotal = currentYearAgg[0]?.total || 0;
    const previousYearTotal = previousYearAgg[0]?.total || 0;
    let growth = 0;
    if (previousYearTotal > 0) {
      growth = ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100;
    }

    const topDiseaseAgg = await OfficialCase.aggregate([
      { $group: { _id: "$disease", total: { $sum: "$cases" } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]);
    const topDisease = topDiseaseAgg.length > 0 ? topDiseaseAgg[0]._id : "N/A";

    const districtData = await OfficialCase.aggregate([
      { $match: match },
      { $group: { _id: "$district", total: { $sum: "$cases" } } },
      { $sort: { _id: 1 } },
    ]);

    const diseaseDistribution = await OfficialCase.aggregate([
      { $match: match },
      { $group: { _id: "$disease", total: { $sum: "$cases" } } },
      { $sort: { total: -1 } },
      { $limit: 7 },
    ]);

    let trendGroup;
    let trendSort;

    if (!year || year === "all") {
      trendGroup = { _id: "$year", total: { $sum: "$cases" } };
      trendSort = { _id: 1 };
    } else {
      trendGroup = { _id: "$month", total: { $sum: "$cases" } };
      trendSort = { _id: 1 };
    }

    const trendData = await OfficialCase.aggregate([
      { $match: match },
      { $group: trendGroup },
      { $sort: trendSort },
    ]);

    return res.json({
      totalCases,
      topDistrict,
      topDisease,
      districtData,
      diseaseDistribution,
      trendData,
      growth: growth.toFixed(1),
    });
  } catch (error) {
    console.error("Mobile official analytics error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
