import Dataset from "../models/Dataset.js";
import SurveillanceThresholdConfig from "../models/SurveillanceThresholdConfig.js";
import { getAnalyticalCaseRows } from "./analyticalCaseService.js";

export const FIXED_THRESHOLD_SETTINGS = Object.freeze({
  baselineYears: 5,
  alertSdMultiplier: 1,
  epidemicSdMultiplier: 2,
  condition: "all",
  geographicLevel: "city",
});

export const THRESHOLD_FORMULA =
  "Alert threshold = historical mean + (1 × population standard deviation); epidemic threshold = historical mean + (2 × population standard deviation). The baseline compares the same epidemiological week for weekly datasets, or the same month for legacy monthly datasets, across five eligible prior years.";

function monthKey(year, month) {
  return Number(year) * 12 + Number(month) - 1;
}

function isoWeekStartDate(year, week) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(januaryFourth.getUTCDate() - day + 1 + ((week - 1) * 7));
  return firstMonday;
}

function isExcluded(year, month, excludedPeriods = []) {
  const target = monthKey(year, month);
  return excludedPeriods.some((period) => {
    const start = monthKey(period.startYear, period.startMonth);
    const end = monthKey(period.endYear, period.endMonth);
    return target >= start && target <= end;
  });
}

function populationStandardDeviation(values, mean) {
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function latestPeriod(rows, periodType) {
  return rows.reduce((latest, row) => {
    const year = Number(periodType === "weekly" ? row.epidemiologicalYear : row.year);
    const period = Number(periodType === "weekly" ? row.epidemiologicalWeek : row.month);
    if (!Number.isInteger(year) || !Number.isInteger(period)) return latest;
    const key = periodType === "weekly" ? year * 100 + period : monthKey(year, period);
    if (!latest || key > latest.key) return { year, period, key };
    return latest;
  }, null);
}

function baseResult({ periodType, target, district, observedConfirmedCases = 0, baselinePeriods = [] }) {
  return {
    periodType,
    targetYear: target?.year || null,
    targetMonth: periodType === "monthly" ? target?.period || null : null,
    targetWeek: periodType === "weekly" ? target?.period || null : null,
    condition: FIXED_THRESHOLD_SETTINGS.condition,
    district: district || null,
    observedConfirmedCases,
    baselinePeriods,
    formula: THRESHOLD_FORMULA,
    caseDefinition: "Validated/confirmed cases only; uploaded official cases and confirmed surveillance reports are combined at query time without copying records.",
  };
}

export async function calculateSurveillanceThreshold({
  datasetId,
  district,
  excludedPeriods = [],
}) {
  const dataset = await Dataset.findById(datasetId)
    .select("coverageStart coverageEnd status reportingFrequency")
    .lean();
  if (!dataset) {
    const error = new Error("Dataset not found");
    error.status = 404;
    throw error;
  }
  if (dataset.status !== "validated") {
    const error = new Error("Thresholds require a validated dataset");
    error.status = 400;
    throw error;
  }

  const periodType = dataset.reportingFrequency === "weekly" ? "weekly" : "monthly";
  const allRows = await getAnalyticalCaseRows({
    datasetId,
    statuses: ["confirmed"],
    district: district || undefined,
  });
  const eligibleRows = periodType === "weekly"
    ? allRows.filter((row) => Number.isInteger(Number(row.epidemiologicalWeek)))
    : allRows;
  const target = latestPeriod(eligibleRows, periodType);
  if (!target) {
    return {
      ...baseResult({ periodType, target: null, district }),
      baselineMean: null,
      standardDeviation: null,
      alertThreshold: null,
      epidemicThreshold: null,
      outcome: "insufficient_baseline",
      insufficiencyReason: periodType === "weekly"
        ? "No epidemiological week data is available in the selected dataset."
        : "No monthly case data is available in the selected dataset.",
    };
  }

  const coverageStartYear = new Date(dataset.coverageStart).getUTCFullYear();
  const coverageStart = new Date(dataset.coverageStart);
  const coverageEnd = new Date(dataset.coverageEnd);
  const candidateYears = [];
  for (let year = target.year - 1; year >= coverageStartYear; year -= 1) {
    const periodStart = periodType === "weekly"
      ? isoWeekStartDate(year, target.period)
      : new Date(Date.UTC(year, target.period - 1, 1));
    const periodEnd = periodType === "weekly"
      ? new Date(periodStart.getTime() + (6 * 86400000))
      : new Date(Date.UTC(year, target.period, 0));
    if (periodStart < coverageStart || periodEnd > coverageEnd) continue;
    const periodMonth = periodStart.getUTCMonth() + 1;
    if (isExcluded(year, periodMonth, excludedPeriods)) continue;
    candidateYears.push(year);
    if (candidateYears.length === FIXED_THRESHOLD_SETTINGS.baselineYears) break;
  }

  const sumForPeriod = (year) => eligibleRows.reduce((sum, row) => {
    const rowYear = Number(periodType === "weekly" ? row.epidemiologicalYear : row.year);
    const rowPeriod = Number(periodType === "weekly" ? row.epidemiologicalWeek : row.month);
    return rowYear === year && rowPeriod === target.period
      ? sum + Number(row.cases || 0)
      : sum;
  }, 0);
  const baselinePeriods = candidateYears
    .map((year) => ({
      year,
      ...(periodType === "weekly" ? { week: target.period } : { month: target.period }),
      confirmedCases: sumForPeriod(year),
    }))
    .sort((a, b) => a.year - b.year);
  const observedConfirmedCases = sumForPeriod(target.year);

  if (baselinePeriods.length < FIXED_THRESHOLD_SETTINGS.baselineYears) {
    return {
      ...baseResult({ periodType, target, district, observedConfirmedCases, baselinePeriods }),
      baselineMean: null,
      standardDeviation: null,
      alertThreshold: null,
      epidemicThreshold: null,
      outcome: "insufficient_baseline",
      insufficiencyReason: `Only ${baselinePeriods.length} of 5 eligible prior years are available.`,
    };
  }

  const values = baselinePeriods.map((period) => period.confirmedCases);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const standardDeviation = populationStandardDeviation(values, mean);
  const alertThreshold = mean + standardDeviation;
  const epidemicThreshold = mean + 2 * standardDeviation;
  let outcome = "within_expected_level";
  if (observedConfirmedCases > epidemicThreshold) outcome = "epidemic_threshold_exceeded";
  else if (observedConfirmedCases > alertThreshold) outcome = "alert_threshold_reached";

  return {
    ...baseResult({ periodType, target, district, observedConfirmedCases, baselinePeriods }),
    baselineMean: Number(mean.toFixed(2)),
    standardDeviation: Number(standardDeviation.toFixed(2)),
    alertThreshold: Number(alertThreshold.toFixed(2)),
    epidemicThreshold: Number(epidemicThreshold.toFixed(2)),
    outcome,
    insufficiencyReason: null,
  };
}

export async function calculateLatestSurveillanceThreshold({ district } = {}) {
  const dataset = await Dataset.findOne({ status: "validated" })
    .sort({ createdAt: -1 })
    .select("_id")
    .lean();
  if (!dataset) return null;
  const settings = await SurveillanceThresholdConfig.findOne({ isActive: true })
    .sort({ updatedAt: -1 })
    .select("excludedPeriods")
    .lean();
  return calculateSurveillanceThreshold({
    datasetId: dataset._id,
    district,
    excludedPeriods: settings?.excludedPeriods || [],
  });
}
