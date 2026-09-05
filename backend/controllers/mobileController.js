import { createAsyncTtlCache } from "../utils/asyncTtlCache.js";
import { getDashboardSummary } from "../services/dashboardSummaryService.js";
import { getAnalyticalCaseRows } from "../services/analyticalCaseService.js";
import { calculateLatestSurveillanceThreshold } from "../services/surveillanceThresholdService.js";
import { SURVEILLANCE_DISEASES } from "../constants/surveillanceMethodology.js";
import { logRequestError } from "../utils/serverLogger.js";

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
  const rows = await getAnalyticalCaseRows({
    statuses: ["confirmed"],
    includeReports: false,
  });
  const sinceKey = since
    ? since.getUTCFullYear() * 12 + since.getUTCMonth()
    : null;
  const selectedBarangayNo = barangayNo == null ? null : Number(barangayNo);
  const areas = new Map();

  for (const row of rows) {
    const rowBarangayNo = Number(row.barangayNo);
    const rowYear = Number(row.year);
    const rowMonth = Number(row.month);
    if (!Number.isFinite(rowBarangayNo)) continue;
    if (selectedBarangayNo !== null && rowBarangayNo !== selectedBarangayNo) continue;
    if (!Number.isInteger(rowYear) || !Number.isInteger(rowMonth)) continue;
    const rowKey = rowYear * 12 + rowMonth - 1;
    if (sinceKey !== null && rowKey < sinceKey) continue;

    const key = String(rowBarangayNo);
    const area = areas.get(key) || {
      barangayNo: rowBarangayNo,
      barangay: row.barangay || `Barangay ${rowBarangayNo}`,
      district: row.district || null,
      officialCases: 0,
    };
    area.officialCases += Number(row.cases || 0);
    areas.set(key, area);
  }

  return [...areas.values()].map((area) => ({
    ...area,
    confirmedCases: area.officialCases,
    classification: { official: area.officialCases },
  }));
}

async function buildRiskSnapshot(months) {
  const since = monthsAgoDate(months);
  const areas = await aggregateOfficialByBarangay(since);
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
      const areas = await aggregateOfficialByBarangay(since, barangayNo);
      return areas[0] || null;
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
      probableCases: summary.probableCases,
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
    logRequestError(error, req, "DASHBOARD_DATA_ERROR");
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
    logRequestError(error, req, "HEATMAP_SERVICE_ERROR");
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
        logRequestError(error, req, "THRESHOLD_CALCULATION_ERROR");
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
    logRequestError(error, req, "HEATMAP_SERVICE_ERROR");
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/official-cases/analytics
export const getMobileOfficialAnalytics = async (req, res) => {
  try {
    const selectedYear = req.query.year && req.query.year !== "all" ? Number(req.query.year) : undefined;
    const selectedMonth = req.query.month && req.query.month !== "all" ? Number(req.query.month) : undefined;
    const rows = await getAnalyticalCaseRows({
      statuses: ["confirmed"],
      includeReports: false,
    });
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
      caseDefinition: "Confirmed cases from authoritative CESU uploads only.",
    });
  } catch (error) {
    logRequestError(error, req, "ANALYTICS_SERVICE_ERROR");
    return res.status(500).json({ message: "Server error" });
  }
};
