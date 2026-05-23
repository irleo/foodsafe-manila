import OfficialCase from "../models/OfficialCase.js";
import Report from "../models/Report.js";
import {
  computeRiskScore,
  riskLevelFromScore,
  riskLabel,
  monthsAgoDate,
} from "../utils/riskUtils.js";

async function aggregateOfficialByBarangay(since) {
  const match = { barangayNo: { $ne: null } };
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

async function aggregateReportsByBarangay(since) {
  const match = {
    isCounted: true,
    $or: [
      { "location.barangayNo": { $ne: null } },
      { exposureBarangayNo: { $ne: null } },
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
    const riskScore = computeRiskScore(area.officialCases, area.suspectedCases);
    const riskLevel = riskLevelFromScore(riskScore);
    return {
      ...area,
      totalCases: area.officialCases + area.suspectedCases,
      riskScore,
      riskLevel,
      riskLabel: riskLabel(riskLevel),
      classification: {
        official: area.officialCases,
        suspected: area.suspectedCases,
      },
    };
  });
}

// GET /api/dashboard
export const getMobileDashboard = async (req, res) => {
  try {
    const year = new Date().getFullYear();

    const [totalCasesAgg, topDistrictAgg, topDiseaseAgg, reportCountAgg] =
      await Promise.all([
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
      ]);

    const officialByDistrict = await OfficialCase.aggregate([
      { $match: { year } },
      { $group: { _id: "$district", total: { $sum: "$cases" } } },
    ]);

    const reportsByDistrict = await Report.aggregate([
      {
        $match: {
          isCounted: true,
          reportedAt: { $gte: new Date(year, 0, 1) },
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$exposureDistrict", "$location.district"] },
          total: { $sum: "$caseCount" },
        },
      },
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
    let moderateRiskDistricts = 0;
    let lowRiskDistricts = 0;

    for (const entry of districtRisk.values()) {
      const score = computeRiskScore(entry.official, entry.suspected);
      const level = riskLevelFromScore(score);
      if (level === "high") highRiskDistricts += 1;
      else if (level === "moderate") moderateRiskDistricts += 1;
      else lowRiskDistricts += 1;
    }

    const currentYearAgg = await OfficialCase.aggregate([
      { $match: { year } },
      { $group: { _id: null, total: { $sum: "$cases" } } },
    ]);
    const previousYearAgg = await OfficialCase.aggregate([
      { $match: { year: year - 1 } },
      { $group: { _id: null, total: { $sum: "$cases" } } },
    ]);

    const currentYearTotal = currentYearAgg[0]?.total || 0;
    const previousYearTotal = previousYearAgg[0]?.total || 0;
    let growth = 0;
    if (previousYearTotal > 0) {
      growth = ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100;
    }

    return res.json({
      totalCases: totalCasesAgg[0]?.total || 0,
      suspectedReports: reportCountAgg[0]?.total || 0,
      topDistrict: topDistrictAgg[0]?._id || "N/A",
      topDisease: topDiseaseAgg[0]?._id || "N/A",
      growth: growth.toFixed(1),
      highRiskDistricts,
      moderateRiskDistricts,
      lowRiskDistricts,
      year,
    });
  } catch (error) {
    console.error("Mobile dashboard error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/risk/heatmap
export const getMobileRiskHeatmap = async (req, res) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 12));
    const since = monthsAgoDate(months);

    const [officialRows, reportRows] = await Promise.all([
      aggregateOfficialByBarangay(since),
      aggregateReportsByBarangay(since),
    ]);

    const areas = mergeAreaRows(officialRows, reportRows);
    const summary = {
      high: areas.filter((a) => a.riskLevel === "high").length,
      moderate: areas.filter((a) => a.riskLevel === "moderate").length,
      low: areas.filter((a) => a.riskLevel === "low").length,
    };

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
    const since = monthsAgoDate(months);

    const [officialRows, reportRows] = await Promise.all([
      aggregateOfficialByBarangay(since),
      aggregateReportsByBarangay(since),
    ]);

    const areas = mergeAreaRows(officialRows, reportRows);

    let area = null;
    if (barangayNo) {
      area = areas.find((a) => a.barangayNo === barangayNo) || null;
    }

    const alerts = areas
      .filter((a) => a.riskLevel === "high")
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    return res.json({
      success: true,
      area,
      isHighRisk: area?.riskLevel === "high",
      highRiskAreas: alerts,
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
