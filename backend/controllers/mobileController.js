import OfficialCase from "../models/OfficialCase.js";
import Report from "../models/Report.js";
import { createAsyncTtlCache } from "../utils/asyncTtlCache.js";
import { getDashboardSummary } from "../services/dashboardSummaryService.js";
import { getAnalyticalCaseRows } from "../services/analyticalCaseService.js";
import { calculateLatestSurveillanceThreshold } from "../services/surveillanceThresholdService.js";
import { SURVEILLANCE_DISEASES } from "../constants/surveillanceMethodology.js";

const riskSnapshotCache = createAsyncTtlCache({
  name: "mobile-risk-snapshot",
  defaultTtlMs: 60_000,
});
const nearbyRiskCache = createAsyncTtlCache({
  name: "mobile-nearby-risk",
  defaultTtlMs: 60_000,
});
const surveillanceThresholdCache = createAsyncTtlCache({
  name: "mobile-surveillance-threshold",
  defaultTtlMs: 60_000,
});

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function monthsAgoDate(months) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - Number(months));
  return date;
}

function riskCacheTtlMs() {
  return positiveInteger(process.env.RISK_CACHE_TTL_MS, 60_000);
}

async function aggregateOfficialByBarangay(since, barangayNo = null) {
  const match =
    barangayNo == null
      ? { barangayNo: { $ne: null }, caseClassification: "confirmed" }
      : { barangayNo: Number(barangayNo), caseClassification: "confirmed" };
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
          caseClassification: "confirmed",
          $or: [
            { "location.barangayNo": { $ne: null } },
            { exposureBarangayNo: { $ne: null } },
          ],
        }
      : {
          isCounted: true,
          caseClassification: "confirmed",
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
        confirmedReportCases: { $sum: "$caseCount" },
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
      confirmedReportCases: 0,
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
      confirmedReportCases: 0,
    };
    existing.confirmedReportCases += row.confirmedReportCases;
    if (!existing.barangay && id.barangay) existing.barangay = id.barangay;
    if (!existing.district && id.district) existing.district = id.district;
    map.set(key, existing);
  }

  return [...map.values()].map((area) => {
    const confirmedCases = area.officialCases + area.confirmedReportCases;
    return {
      ...area,
      confirmedCases,
      classification: {
        official: area.officialCases,
        confirmedSurveillanceReports: area.confirmedReportCases,
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
    confirmedCases: areas.reduce((sum, area) => sum + area.confirmedCases, 0),
    barangaysWithConfirmedCases: areas.filter((area) => area.confirmedCases > 0).length,
  };
  const alerts = [];

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

function getLatestSurveillanceThreshold() {
  return surveillanceThresholdCache.getOrLoad(
    "latest",
    async () => {
      const thresholds = await Promise.all(SURVEILLANCE_DISEASES.map(
        (disease) => calculateLatestSurveillanceThreshold({ disease }),
      ));
      const priority = {
        epidemic_threshold_exceeded: 4,
        alert_threshold_exceeded: 3,
        within_expected_level: 2,
        insufficient_baseline: 1,
        no_data: 0,
      };
      const primary = [...thresholds].sort(
        (a, b) => (priority[b?.outcome] || 0) - (priority[a?.outcome] || 0),
      )[0] || null;
      return { primary, thresholds };
    },
    { ttlMs: riskCacheTtlMs() },
  );
}

// GET /api/dashboard
export const getMobileDashboard = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const summary = await getDashboardSummary(year);
    const growth =
      summary.previousYearTotal > 0
        ? ((summary.currentYearTotal - summary.previousYearTotal) /
            summary.previousYearTotal) *
          100
        : 0;
    const payload = {
      totalCases: summary.totalCases,
      reportedCases: summary.reportedCases,
      suspectedCases: summary.suspectedCases,
      confirmedCases: summary.confirmedCases,
      notValidatedCases: summary.notValidatedCases,
      topDistrict: summary.topDistrict || "N/A",
      topDisease: summary.topDisease || "N/A",
      growth: growth.toFixed(1),
      caseDefinition: summary.totalDefinition,
      year,
      summaryGeneratedAt: summary.generatedAt,
    };

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
    const [area, snapshot, surveillanceThreshold] = await Promise.all([
      barangayNo ? getNearbyAreaRisk(barangayNo, months) : Promise.resolve(null),
      getRiskSnapshot(months),
      getLatestSurveillanceThreshold().catch((error) => {
        console.error("Mobile surveillance threshold error:", error);
        return null;
      }),
    ]);

    const thresholdBundle = surveillanceThreshold || { primary: null, thresholds: [] };
    const primaryThreshold = thresholdBundle.primary;
    const hasThresholdSignal = [
      "alert_threshold_exceeded",
      "epidemic_threshold_exceeded",
    ].includes(primaryThreshold?.outcome);
    const thresholdMessage = primaryThreshold?.outcome === "epidemic_threshold_exceeded"
      ? `${primaryThreshold.disease} was above its epidemic threshold for the latest complete month. Follow official CESU advisories.`
      : primaryThreshold?.outcome === "alert_threshold_exceeded"
        ? `${primaryThreshold.disease} was above its alert threshold for the latest complete month. This is an early surveillance signal, not a public risk classification.`
        : primaryThreshold?.outcome === "within_expected_level"
          ? "Eligible cases were below the alert threshold for the latest complete month."
          : "There is not yet enough eligible historical data to calculate a surveillance threshold.";

    return res.json({
      success: true,
      area,
      isHighRisk: false,
      hasActiveAdvisory: false,
      hasThresholdSignal,
      surveillanceThreshold: primaryThreshold,
      surveillanceThresholds: thresholdBundle.thresholds,
      highRiskAreas: snapshot.alerts,
      message: thresholdMessage,
    });
  } catch (error) {
    console.error("Mobile nearby risk error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/official-cases/analytics
export const getMobileOfficialAnalytics = async (req, res) => {
  try {
    const selectedYear = req.query.year && req.query.year !== "all" ? Number(req.query.year) : undefined;
    const selectedMonth = req.query.month && req.query.month !== "all" ? Number(req.query.month) : undefined;
    const rows = await getAnalyticalCaseRows({ statuses: ["confirmed"] });
    const filtered = rows.filter((row) =>
      (selectedYear === undefined || row.year === selectedYear) &&
      (selectedMonth === undefined || row.month === selectedMonth),
    );
    const totalCases = filtered.reduce((sum, row) => sum + Number(row.cases || 0), 0);
    const group = (items, keySelector) => {
      const totals = new Map();
      for (const item of items) {
        const key = keySelector(item);
        if (key === undefined || key === null || key === "") continue;
        totals.set(key, (totals.get(key) || 0) + Number(item.cases || 0));
      }
      return [...totals.entries()].map(([_id, total]) => ({ _id, total }));
    };
    const districtData = group(filtered, (row) => row.district).sort((a, b) => String(a._id).localeCompare(String(b._id)));
    const diseaseDistribution = group(filtered, (row) => row.disease).sort((a, b) => b.total - a.total).slice(0, 7);
    const topDistrict = [...districtData].sort((a, b) => b.total - a.total)[0]?._id || "N/A";
    const topDisease = diseaseDistribution[0]?._id || "N/A";
    const baseYear = selectedYear ?? new Date().getFullYear();
    const currentYearTotal = rows.filter((row) => row.year === baseYear).reduce((sum, row) => sum + Number(row.cases || 0), 0);
    const previousYearTotal = rows.filter((row) => row.year === baseYear - 1).reduce((sum, row) => sum + Number(row.cases || 0), 0);
    const growth = previousYearTotal > 0 ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100 : 0;
    const trendData = group(filtered, (row) => selectedYear === undefined ? row.year : row.month).sort((a, b) => Number(a._id) - Number(b._id));

    return res.json({
      totalCases,
      topDistrict,
      topDisease,
      districtData,
      diseaseDistribution,
      trendData,
      growth: growth.toFixed(1),
      caseDefinition: "Confirmed cases only; uploaded official cases and confirmed surveillance reports are combined at query time without copying records.",
    });
  } catch (error) {
    console.error("Mobile official analytics error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
