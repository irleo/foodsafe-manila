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

// One shared history load per minute, including simultaneous guest requests.
const officialAnalyticsRowsCache = createAsyncTtlCache({
  name: "mobile-official-analytics-rows", defaultTtlMs: 60_000,
});
const officialAnalyticsResponseCache = createAsyncTtlCache({
  name: "mobile-official-analytics-responses", defaultTtlMs: 60_000,
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
    const { period = "total_cumulative", district = "", disease = "" } = req.query;
    // Finite keys prevent arbitrary public query strings growing the cache.
    if (typeof period !== "string" || !["total_cumulative", "last_7_days", "last_28_days"].includes(period)
      || typeof district !== "string" || (district !== "" && !/^District [1-6]$/.test(district))
      || typeof disease !== "string" || (disease !== "" && !SURVEILLANCE_DISEASES.includes(disease))) {
      return res.status(400).json({ message: "Invalid analytics filters." });
    }
    const result = await officialAnalyticsResponseCache.getOrLoad(
      JSON.stringify([period, district, disease]), async () => {

        const now = new Date();
        let startDate = null;
        let endDate = null;

        if (period === "last_7_days" || period === "last_28_days") {
          const days = period === "last_7_days" ? 7 : 28;

          endDate = now;
          startDate = new Date(
            now.getTime() - days * 24 * 60 * 60 * 1000,
          );
        }

        const rows = await officialAnalyticsRowsCache.getOrLoad("official-history", () => getAnalyticalCaseRows({
          statuses: [
            "suspected",
            "probable",
            "confirmed",
          ],
        }));

        const filtered = rows.filter((row) => {
          if (startDate && endDate) {
            const rowDateValue = row.surveillanceDate || row.weekStartDate;
            const rowDate = new Date(rowDateValue);

            if (
              Number.isNaN(rowDate.getTime()) ||
              rowDate < startDate ||
              rowDate >= endDate
            ) {
              return false;
            }
          }

          const district = req.query.district?.toString().trim();
          const disease = req.query.disease?.toString().trim();

          if (district && row.district !== district) return false;
          if (disease && row.disease !== disease) return false;

          return true;
        });

        const allRows = rows.filter((row) => {
          const district = req.query.district?.toString().trim();
          const disease = req.query.disease?.toString().trim();

          if (district && row.district !== district) return false;
          if (disease && row.disease !== disease) return false;

          return true;
        });

        const validDates = allRows
          .map((row) => ({
            year: Number(row.year),
            month: Number(row.month),
          }))
          .filter(
            ({ year, month }) =>
              Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12,
          );

        const currentDate = new Date();
        const currentYear = currentDate.getUTCFullYear();
        const currentMonth = currentDate.getUTCMonth() + 1;

        const previousDate = new Date(
          Date.UTC(currentYear, currentMonth - 2, 1),
        );

        const currentMonthCases = allRows
          .filter(
            (row) =>
              Number(row.year) === currentYear &&
              Number(row.month) === currentMonth,
          )
          .reduce((sum, row) => sum + Number(row.cases || 0), 0);

        const previousMonthCases = allRows
          .filter(
            (row) =>
              Number(row.year) === previousDate.getUTCFullYear() &&
              Number(row.month) === previousDate.getUTCMonth() + 1,
          )
          .reduce((sum, row) => sum + Number(row.cases || 0), 0);

        const firstDate = validDates.sort(
          (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
        )[0];

        const lastDate = validDates.length
          ? validDates[validDates.length - 1]
          : null;

        const groupTotals = (items, selector) => {
          const totals = new Map();

          for (const item of items) {
            const key = selector(item);
            if (!key) continue;

            totals.set(
              key,
              (totals.get(key) || 0) + Number(item.cases || 0),
            );
          }

          return [...totals.entries()]
            .map(([name, cases]) => ({ name, cases }))
            .sort((a, b) => b.cases - a.cases);
        };

        const overviewDistricts = groupTotals(allRows, (row) => row.district);
        const overviewDiseases = groupTotals(allRows, (row) => row.disease);

        const cumulativeCases = allRows.reduce(
          (sum, row) => sum + Number(row.cases || 0),
          0,
        );

        const monthlyChange =
          previousMonthCases > 0
            ? ((currentMonthCases - previousMonthCases) / previousMonthCases) * 100
            : null;

        const group = (items, selector) => {
          const totals = new Map();

          for (const item of items) {
            const key = selector(item);
            if (!key) continue;

            totals.set(
              key,
              (totals.get(key) || 0) + Number(item.cases || 0),
            );
          }

          return totals;
        };

        const districtTotals = group(filtered, (row) => row.district);
        const diseaseTotals = group(filtered, (row) => row.disease);

        const districts = [
          "District 1",
          "District 2",
          "District 3",
          "District 4",
          "District 5",
          "District 6",
        ];

        const districtData = districts.map((district) => ({
          _id: district,
          total: districtTotals.get(district) || 0,
        }));

        const diseaseDistribution = [...diseaseTotals.entries()]
          .map(([_id, total]) => ({ _id, total }))
          .sort((a, b) => b.total - a.total);

        return {
          period,
          totalCases: filtered.reduce(
            (sum, row) => sum + Number(row.cases || 0),
            0,
          ),
          districtData,
          diseaseDistribution,
          overview: {
            currentMonthCases,
            previousMonthCases,
            monthlyChange,
            cumulativeCases,
            coverageStart: firstDate
              ? {
                  year: firstDate.year,
                  month: firstDate.month,
                }
              : null,
            coverageEnd: lastDate
              ? {
                  year: lastDate.year,
                  month: lastDate.month,
                }
              : null,
            topDistrict: overviewDistricts[0] || null,
            topDisease: overviewDiseases[0] || null,
          },
        };
    });
    return res.json(result);
  } catch (error) {
    logRequestError(error, req, "ANALYTICS_SERVICE_ERROR");

    return res.status(500).json({
      code: "ANALYTICS_SERVICE_ERROR",
      message: "Analytics data could not be loaded.",
    });
  }
};
