import Dataset from "../models/Dataset.js";
import SurveillanceThresholdConfig from "../models/SurveillanceThresholdConfig.js";
import { getAnalyticalCaseRows } from "./analyticalCaseService.js";
import { loadOfficialCaseSource } from "./officialCaseSourceReader.js";
import {
  monthWithinCoverageIntervals,
  resolveCumulativeDatasetContext,
} from "./cumulativeOfficialCaseService.js";
import { includedStatusesForDisease, normalizeSurveillanceDisease } from "../constants/surveillanceMethodology.js";

const CITY_DISTRICTS = Object.freeze(Array.from({ length: 6 }, (_, index) => `District ${index + 1}`));
export const FIXED_THRESHOLD_SETTINGS = Object.freeze({ baselineYears: 5, alertSdMultiplier: 1, epidemicSdMultiplier: 2, geographicLevels: Object.freeze(["city", "district"]) });
export const THRESHOLD_FORMULA = "For the same calendar month in the five immediately preceding eligible years: alert threshold = historical mean + (1 × population standard deviation); epidemic threshold = historical mean + (2 × population standard deviation). Comparisons use unrounded values and require the case count to be strictly greater than the threshold.";

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function monthStart(year, month) { return new Date(Date.UTC(Number(year), Number(month) - 1, 1)); }
function monthEnd(year, month) { return new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999)); }
function fullMonthWithinCoverage(year, month, coverage) {
  if (!coverage || !Number.isInteger(Number(year)) || !Number.isInteger(Number(month))
    || Number(month) < 1 || Number(month) > 12) return false;
  if (coverage.intervalsByDistrict) {
    return coverage.districts.every((district) => monthWithinCoverageIntervals(
      year,
      month,
      coverage.intervalsByDistrict.get(district) || [],
    ));
  }
  return monthStart(year, month) >= coverage.start && monthEnd(year, month) <= coverage.end;
}
function latestCompleteCoveredMonth(coverage) {
  if (!coverage) return null;
  const end = new Date(coverage.end);
  let year = end.getUTCFullYear();
  let month = end.getUTCMonth() + 1;
  for (let attempts = 0; attempts < 2400; attempts += 1) {
    if (fullMonthWithinCoverage(year, month, coverage)) return { year, month };
    const previous = new Date(Date.UTC(year, month - 2, 1));
    year = previous.getUTCFullYear();
    month = previous.getUTCMonth() + 1;
  }
  return null;
}

function verifiedCoverageForScope(context, district, legacyCoverage) {
  const districts = district ? [district] : CITY_DISTRICTS;
  const intervalsByDistrict = new Map();
  for (const name of districts) {
    const intervals = context?.verifiedCoverageByDistrict?.get(name) || [];
    if (intervals.length) {
      intervalsByDistrict.set(name, intervals);
      continue;
    }
    const legacy = legacyCoverage?.get(name);
    const start = validDate(legacy?.coverageStart);
    const end = validDate(legacy?.coverageEnd);
    if (!start || !end) return null;
    intervalsByDistrict.set(name, [{ start, end }]);
  }
  const allIntervals = [...intervalsByDistrict.values()].flat();
  return {
    start: new Date(Math.min(...allIntervals.map((entry) => entry.start.getTime()))),
    end: new Date(Math.max(...allIntervals.map((entry) => entry.end.getTime()))),
    districts,
    intervalsByDistrict,
  };
}

function exclusionContainsMonth(exclusion, year, month, disease, district) {
  const exclusionDisease = normalizeSurveillanceDisease(exclusion?.disease);
  if (exclusionDisease && exclusionDisease !== disease) return false;
  if (exclusion?.district && exclusion.district !== district) return false;
  if (exclusion?.district && !district) return false;
  const values = [exclusion?.startYear, exclusion?.startMonth, exclusion?.endYear, exclusion?.endMonth].map(Number);
  if (!values.every(Number.isInteger)) return false;
  const [startYear, startMonth, endYear, endMonth] = values;
  const target = (Number(year) * 12) + Number(month);
  return target >= (startYear * 12) + startMonth && target <= (endYear * 12) + endMonth;
}

function sumForMonth(rows, year, month) {
  return rows.reduce((sum, row) => Number(row.year) === Number(year) && Number(row.month) === Number(month)
    ? sum + Math.max(0, Number(row.cases || 0)) : sum, 0);
}
function populationStandardDeviation(values, mean) {
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length);
}

export function classifyThresholdValue(value, alertThreshold, epidemicThreshold, { expected = false } = {}) {
  const numericValue = Number(value);
  if (![numericValue, alertThreshold, epidemicThreshold].every(Number.isFinite)) return "insufficient_baseline";
  if (numericValue > epidemicThreshold) return expected ? "expected_epidemic" : "epidemic_threshold_exceeded";
  if (numericValue > alertThreshold) return expected ? "expected_alert" : "alert_threshold_exceeded";
  return expected ? "expected_within_level" : "within_expected_level";
}

function baseResult({ disease, district, target, observedCases = null, baselinePeriods = [] }) {
  const includedStatuses = includedStatusesForDisease(disease);
  return {
    periodType: "monthly", targetYear: target?.year || null, targetMonth: target?.month || null,
    disease, condition: disease, geographicLevel: district ? "district" : "city", district: district || null,
    observedCases, observedConfirmedCases: observedCases, includedCaseStatuses: includedStatuses,
    baselinePeriods, baselineYearsRequired: FIXED_THRESHOLD_SETTINGS.baselineYears, formula: THRESHOLD_FORMULA,
    caseDefinition: `${disease}: ${includedStatuses.join(", ")} cases from authoritative official surveillance uploads only. Citizen reports are retained for early warning and audit review but do not affect this threshold.`,
  };
}

export async function calculateSurveillanceThreshold({ datasetId, disease: requestedDisease, district, targetYear, targetMonth, evaluationMode = "observed", excludedPeriods = [] }) {
  const disease = normalizeSurveillanceDisease(requestedDisease);
  if (!disease) { const error = new Error("Select a supported disease."); error.status = 400; throw error; }
  const dataset = await Dataset.findById(datasetId).select("districtCoverage status filePath formatType providerType providerName").lean();
  if (!dataset) { const error = new Error("Dataset not found"); error.status = 404; throw error; }
  if (dataset.status !== "validated") { const error = new Error("Thresholds require a validated dataset"); error.status = 400; throw error; }
  const context = await resolveCumulativeDatasetContext(datasetId);
  const requiredDistricts = district ? [district] : CITY_DISTRICTS;
  const hasExplicitCoverage = requiredDistricts.every((name) => (
    context?.verifiedCoverageByDistrict?.get(name)?.length > 0
  ));
  const legacySource = hasExplicitCoverage ? null : loadOfficialCaseSource(dataset);
  const coverage = verifiedCoverageForScope(context, district, legacySource?.districtCoverage);
  if (!coverage) return { ...baseResult({ disease, district, target: null }), baselineMean: null, standardDeviation: null, alertThreshold: null, epidemicThreshold: null, outcome: "no_data", insufficiencyReason: district ? `No verified complete reporting coverage is stored for ${district}.` : "Whole-Manila evaluation requires verified complete coverage for all six districts." };

  const explicitTarget = Number.isInteger(Number(targetYear)) && Number.isInteger(Number(targetMonth)) && Number(targetMonth) >= 1 && Number(targetMonth) <= 12
    ? { year: Number(targetYear), month: Number(targetMonth) } : null;
  const target = explicitTarget || latestCompleteCoveredMonth(coverage);
  if (!target || (evaluationMode !== "forecast" && !fullMonthWithinCoverage(target.year, target.month, coverage))) {
    return { ...baseResult({ disease, district, target }), baselineMean: null, standardDeviation: null, alertThreshold: null, epidemicThreshold: null, outcome: "no_data", insufficiencyReason: "The selected month is outside verified complete reporting coverage." };
  }

  const includedStatuses = includedStatusesForDisease(disease);
  const rows = await getAnalyticalCaseRows({
    datasetId,
    statuses: includedStatuses,
    district: district || undefined,
    disease,
    includeReports: false,
  });
  const eligibleRows = rows.filter((row) => includedStatuses.includes(row.caseClassification) && Number.isInteger(Number(row.year)) && Number.isInteger(Number(row.month)));
  const years = [];
  for (let year = target.year - 1; year >= coverage.start.getUTCFullYear(); year -= 1) {
    if (!fullMonthWithinCoverage(year, target.month, coverage)) continue;
    if (excludedPeriods.some((item) => exclusionContainsMonth(item, year, target.month, disease, district || null))) continue;
    years.push(year);
    if (years.length === FIXED_THRESHOLD_SETTINGS.baselineYears) break;
  }
  const baselinePeriods = years.map((year) => ({ year, month: target.month, cases: sumForMonth(eligibleRows, year, target.month) })).sort((a, b) => a.year - b.year);
  const observedCases = evaluationMode === "forecast" ? null : sumForMonth(eligibleRows, target.year, target.month);
  const base = baseResult({ disease, district, target, observedCases, baselinePeriods });
  if (baselinePeriods.length !== FIXED_THRESHOLD_SETTINGS.baselineYears) {
    return { ...base, baselineMean: null, standardDeviation: null, alertThreshold: null, epidemicThreshold: null, outcome: "insufficient_baseline", insufficiencyReason: `Five eligible observations for this calendar month are required; ${baselinePeriods.length} are available.` };
  }
  const values = baselinePeriods.map((period) => period.cases);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const standardDeviation = populationStandardDeviation(values, mean);
  const alertThreshold = mean + standardDeviation;
  const epidemicThreshold = mean + (2 * standardDeviation);
  return { ...base, baselineMean: Number(mean.toFixed(2)), standardDeviation: Number(standardDeviation.toFixed(2)), alertThreshold: Number(alertThreshold.toFixed(2)), epidemicThreshold: Number(epidemicThreshold.toFixed(2)), evaluationThresholds: { alert: alertThreshold, epidemic: epidemicThreshold }, outcome: evaluationMode === "forecast" ? "threshold_available" : classifyThresholdValue(observedCases, alertThreshold, epidemicThreshold), insufficiencyReason: null };
}

export async function calculateLatestSurveillanceThreshold({ disease, district } = {}) {
  const dataset = await Dataset.findOne({ status: "validated" }).sort({ createdAt: -1 }).select("_id").lean();
  if (!dataset) return null;
  const settings = await SurveillanceThresholdConfig.findOne({ isActive: true }).sort({ updatedAt: -1 }).select("excludedPeriods").lean();
  return calculateSurveillanceThreshold({ datasetId: dataset._id, disease, district, excludedPeriods: settings?.excludedPeriods || [] });
}
