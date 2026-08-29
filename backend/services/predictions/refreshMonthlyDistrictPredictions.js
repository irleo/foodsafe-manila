import { createHash } from "crypto";
import mongoose from "mongoose";
import Dataset from "../../models/Dataset.js";
import PredictionRun from "../../models/PredictionRun.js";
import SurveillanceThresholdConfig from "../../models/SurveillanceThresholdConfig.js";
import { normalizeDistrictKey } from "../../constants/manilaDistrictCoords.js";
import { SURVEILLANCE_DISEASES, includedStatusesForDisease } from "../../constants/surveillanceMethodology.js";
import { getAnalyticalCaseRows } from "../analyticalCaseService.js";
import { loadOfficialCaseSource } from "../officialCaseSourceReader.js";
import { resolveCumulativeDatasetContext } from "../cumulativeOfficialCaseService.js";
import { calculateSurveillanceThreshold, classifyThresholdValue } from "../surveillanceThresholdService.js";
import { runProphetMonthlyForecast } from "../prophet/runMonthlyForecast.js";
import { runSerializedForecast } from "./forecastExecution.js";

const MIN_TRAINING_MONTHS = 24;
const MIN_COMPARABLE_OBSERVATIONS = 3;
const FORECAST_SCHEMA_VERSION = 8;
const GRANULARITY = "monthly_disease_district_cases";
const DISTRICTS = Object.freeze(Array.from({ length: 6 }, (_, index) => `District ${index + 1}`));

function periodKey(year, month) { return `${Number(year)}-${Number(month)}`; }
function addMonths(year, month, amount) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1 + amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}
function coverageForDistrict(context, district, fallback) {
  const intervals = context?.verifiedCoverageByDistrict?.get(district) || [];
  if (intervals.length) return intervals;
  const coverage = fallback?.get(district);
  return coverage ? [{ start: new Date(coverage.coverageStart), end: new Date(coverage.coverageEnd) }] : null;
}
function firstCompleteMonth(start) {
  const date = new Date(start);
  return date.getUTCDate() === 1
    ? { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
    : addMonths(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}
function lastCompleteMonth(end) {
  const date = new Date(end);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return date.getUTCDate() === lastDay
    ? { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
    : addMonths(date.getUTCFullYear(), date.getUTCMonth() + 1, -1);
}
function completeSeries(rows, coverageIntervals, commonEnd) {
  const counts = new Map();
  for (const row of rows) {
    const key = periodKey(row.year, row.month);
    counts.set(key, (counts.get(key) || 0) + Math.max(0, Number(row.cases || 0)));
  }
  const coveredPeriods = new Map();
  for (const coverage of coverageIntervals) {
    const end = new Date(Math.min(coverage.end.getTime(), commonEnd.getTime()));
    const first = firstCompleteMonth(coverage.start);
    const last = lastCompleteMonth(end);
    for (let current = first; current.year < last.year || (current.year === last.year && current.month <= last.month); current = addMonths(current.year, current.month, 1)) {
      coveredPeriods.set(periodKey(current.year, current.month), current);
    }
  }
  return [...coveredPeriods.values()]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((current) => {
      const key = periodKey(current.year, current.month);
      const hasCaseRecord = counts.has(key);
      return { ...current, date: `${current.year}-${String(current.month).padStart(2, "0")}-01`, y: hasCaseRecord ? counts.get(key) : 0, observed: true, hasCaseRecord, zeroFilledWithinVerifiedCoverage: !hasCaseRecord };
    });
}
function withErrors(row) {
  const actualCases = Number(row?.actualCases);
  const predictedCases = Number(row?.predictedCases);
  const comparisonPredictedCases = row?.rawPredictedCases != null
    && Number.isFinite(Number(row.rawPredictedCases))
    ? Number(row.rawPredictedCases)
    : predictedCases;
  if (!Number.isFinite(actualCases) || !Number.isFinite(comparisonPredictedCases)) return null;
  const signedError = actualCases - comparisonPredictedCases;
  return { ...row, actualCases, predictedCases, comparisonPredictedCases, signedError, absoluteError: Math.abs(signedError) };
}
function metrics(rows = []) {
  const usable = rows.map(withErrors).filter(Boolean);
  if (!usable.length) return null;
  const absolute = usable.reduce((sum, row) => sum + row.absoluteError, 0);
  const squared = usable.reduce((sum, row) => sum + (row.signedError ** 2), 0);
  const actual = usable.reduce((sum, row) => sum + Math.max(0, row.actualCases), 0);
  const percentageRows = usable.filter((row) => row.actualCases > 0);
  return { mae: Number((absolute / usable.length).toFixed(2)), rmse: Number(Math.sqrt(squared / usable.length).toFixed(2)), wape: actual > 0 ? Number(((absolute / actual) * 100).toFixed(2)) : null, mape: percentageRows.length ? Number((percentageRows.reduce((sum, row) => sum + (row.absoluteError / row.actualCases), 0) * 100 / percentageRows.length).toFixed(2)) : null, observationCount: usable.length };
}
function seasonalNaiveModel(series, horizonMonths) {
  const byPeriod = new Map(series.map((point) => [periodKey(point.year, point.month), Number(point.y)]));
  const backtestSeries = [];
  for (let index = Math.max(12, series.length - 12); index < series.length; index += 1) {
    const target = series[index];
    const prior = byPeriod.get(periodKey(target.year - 1, target.month));
    if (!Number.isFinite(prior)) continue;
    backtestSeries.push(withErrors({ year: target.year, month: target.month, date: target.date, actualCases: target.y, predictedCases: prior }));
  }
  const latest = series.at(-1);
  const forecast = [];
  for (let offset = 1; latest && offset <= horizonMonths; offset += 1) {
    const target = addMonths(latest.year, latest.month, offset);
    const prior = byPeriod.get(periodKey(target.year - 1, target.month));
    if (!Number.isFinite(prior)) continue;
    forecast.push({ ...target, date: `${target.year}-${String(target.month).padStart(2, "0")}-01`, predictedCases: Math.max(0, Math.round(prior)), rawPredictedCases: Math.max(0, prior), lowerBound: null, upperBound: null, isPrimaryTarget: offset === 1 });
  }
  return { model: "seasonal_naive", status: forecast.some((point) => point.isPrimaryTarget) ? "success" : "insufficient_data", message: forecast.length ? null : "The same month from the previous year is unavailable.", backtestSeries: backtestSeries.filter(Boolean), forecast, metrics: metrics(backtestSeries) };
}
async function prophetModel(series, horizonMonths) {
  if (series.length < MIN_TRAINING_MONTHS) return { model: "prophet", status: "insufficient_data", message: `At least ${MIN_TRAINING_MONTHS} complete months are required.`, backtestSeries: [], forecast: [], metrics: null };
  try {
    const output = await runProphetMonthlyForecast(series, { horizonMonths });
    const backtestSeries = (output.backtest || []).map(withErrors).filter(Boolean);
    return { model: "prophet", status: "success", message: null, backtestSeries, forecast: output.forecast || [], metrics: metrics(backtestSeries) };
  } catch (error) {
    return { model: "prophet", status: "failed", message: error?.message || "Monthly forecast failed.", backtestSeries: [], forecast: [], metrics: null };
  }
}
function primaryForecast(model) { return model?.forecast?.find((point) => point.isPrimaryTarget) || model?.forecast?.[0] || null; }
function compareModels(prophet, seasonalNaive) {
  const prophetBy = new Map((prophet.backtestSeries || []).map((row) => [periodKey(row.year, row.month), row]));
  const naiveBy = new Map((seasonalNaive.backtestSeries || []).map((row) => [periodKey(row.year, row.month), row]));
  const keys = [...prophetBy.keys()].filter((key) => naiveBy.has(key));
  const prophetMetrics = metrics(keys.map((key) => prophetBy.get(key)));
  const seasonalNaiveMetrics = metrics(keys.map((key) => naiveBy.get(key)));
  const sufficient = keys.length >= MIN_COMPARABLE_OBSERVATIONS;
  const selectedModel = sufficient
    ? Number(prophetMetrics?.mae) < Number(seasonalNaiveMetrics?.mae) ? "prophet" : "seasonal_naive"
    : seasonalNaive.status === "success" ? "seasonal_naive" : prophet.status === "success" ? "prophet" : null;
  const selected = selectedModel === "prophet" ? prophet : seasonalNaive;
  const fallbackModel = selectedModel === "prophet" ? "seasonal_naive" : "prophet";
  const fallback = fallbackModel === "prophet" ? prophet : seasonalNaive;
  const operationalModel = selected?.status === "success" && primaryForecast(selected)
    ? selectedModel : fallback?.status === "success" && primaryForecast(fallback) ? fallbackModel : null;
  return { sufficient, comparableObservationCount: keys.length, minimumRequiredObservations: MIN_COMPARABLE_OBSERVATIONS, selectedModel, operationalModel, prophetMetrics, seasonalNaiveMetrics, selectedModelReason: sufficient ? `${selectedModel === "prophet" ? "Prophet" : "Seasonal Naive"} had the smaller average error in recent checks.` : "There is not enough shared history for a full comparison, so the available model is used." };
}
async function attachThreshold({ point, datasetId, disease, district, excludedPeriods }) {
  if (!point) return null;
  const threshold = await calculateSurveillanceThreshold({ datasetId, disease, district, targetYear: point.year, targetMonth: point.month, evaluationMode: "forecast", excludedPeriods });
  const alert = threshold.evaluationThresholds?.alert;
  const epidemic = threshold.evaluationThresholds?.epidemic;
  const thresholdComparisonValue = Number.isFinite(Number(point.rawPredictedCases))
    ? Number(point.rawPredictedCases)
    : Number(point.predictedCases);
  return { ...point, threshold: { alert: threshold.alertThreshold, epidemic: threshold.epidemicThreshold, baselineYears: threshold.baselinePeriods?.length || 0, requiredBaselineYears: 5, status: threshold.outcome, message: threshold.insufficiencyReason }, expectedStatus: !Number.isFinite(alert) ? threshold.outcome : classifyThresholdValue(thresholdComparisonValue, alert, epidemic, { expected: true }) };
}
function aggregateWholeManila(districts) {
  const usable = districts.map((district) => ({ district, model: district.operationalModel === "prophet" ? district.models.prophet : district.models.seasonalNaive })).filter(({ model }) => model?.status === "success" && primaryForecast(model));
  const historical = new Map();
  const backtest = new Map();
  for (const { district, model } of usable) {
    for (const row of district.historicalSeries || []) {
      const key = periodKey(row.year, row.month);
      const current = historical.get(key) || { year: row.year, month: row.month, date: row.date, cases: 0, districtCount: 0 };
      current.cases += Number(row.cases || 0); current.districtCount += 1; historical.set(key, current);
    }
    for (const row of model.backtestSeries || []) {
      const key = periodKey(row.year, row.month);
      const current = backtest.get(key) || { year: row.year, month: row.month, actualCases: 0, predictedCases: 0, rawPredictedCases: 0, districtCount: 0 };
      current.actualCases += Number(row.actualCases || 0); current.predictedCases += Number(row.predictedCases || 0); current.rawPredictedCases += Number(row.rawPredictedCases ?? row.predictedCases ?? 0); current.districtCount += 1; backtest.set(key, current);
    }
  }
  const historicalSeries = [...historical.values()].filter((row) => row.districtCount === DISTRICTS.length).map(({ districtCount, ...row }) => row);
  const backtestSeries = [...backtest.values()].filter((row) => row.districtCount === DISTRICTS.length).map(({ districtCount, ...row }) => withErrors(row));
  if (usable.length !== DISTRICTS.length) return { status: "incomplete_coverage", historicalSeries, backtestSeries, forecast: [], coverage: { totalDistricts: DISTRICTS.length, successfulDistricts: usable.length, completeCityForecast: false } };
  const first = primaryForecast(usable[0].model);
  return { status: "success", historicalSeries, backtestSeries, metrics: metrics(backtestSeries), forecast: [{ year: first.year, month: first.month, date: first.date, predictedCases: usable.reduce((sum, item) => sum + Number(primaryForecast(item.model).predictedCases || 0), 0), rawPredictedCases: usable.reduce((sum, item) => sum + Number(primaryForecast(item.model).rawPredictedCases ?? primaryForecast(item.model).predictedCases ?? 0), 0), lowerBound: null, upperBound: null, isPrimaryTarget: true }], coverage: { totalDistricts: DISTRICTS.length, successfulDistricts: usable.length, completeCityForecast: true }, intervalAggregation: "not_calculated" };
}
function pooledEvaluation(districts) {
  const prophetRows = []; const naiveRows = [];
  for (const district of districts) {
    const prophetBy = new Map((district.models?.prophet?.backtestSeries || []).map((row) => [periodKey(row.year, row.month), row]));
    const naiveBy = new Map((district.models?.seasonalNaive?.backtestSeries || []).map((row) => [periodKey(row.year, row.month), row]));
    for (const [key, row] of prophetBy) if (naiveBy.has(key)) { prophetRows.push(row); naiveRows.push(naiveBy.get(key)); }
  }
  const prophet = metrics(prophetRows); const seasonalNaive = metrics(naiveRows);
  return { sufficient: prophetRows.length >= MIN_COMPARABLE_OBSERVATIONS, comparableObservationCount: prophetRows.length, minimumRequiredObservations: MIN_COMPARABLE_OBSERVATIONS, prophet, seasonalNaive, bestHistoricalModel: prophetRows.length >= MIN_COMPARABLE_OBSERVATIONS ? Number(prophet?.mae) < Number(seasonalNaive?.mae) ? "prophet" : "seasonal_naive" : null, selectionMetric: "mae" };
}
function fingerprint(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

async function refreshMonthlyDistrictPredictionsImpl({ trigger = "manual", datasetId, horizonMonths = 1, force = true } = {}) {
  const dataset = datasetId
    ? await Dataset.findById(datasetId).select("_id status districtCoverage filePath formatType providerType providerName").lean()
    : await Dataset.findOne({ status: "validated" }).sort({ createdAt: -1 }).select("_id status districtCoverage filePath formatType providerType providerName").lean();
  if (!dataset?._id || dataset.status !== "validated") throw new Error("A validated dataset is required for forecasting.");
  const context = await resolveCumulativeDatasetContext(dataset._id);
  const explicitCoverage = DISTRICTS.every((district) => context?.verifiedCoverageByDistrict?.get(district)?.length > 0);
  const legacySource = explicitCoverage ? null : loadOfficialCaseSource(dataset);
  const coverages = new Map(DISTRICTS.map((district) => [district, coverageForDistrict(context, district, legacySource?.districtCoverage)]));
  if ([...coverages.values()].some((coverage) => !coverage)) throw new Error("Verified complete coverage is required for all six districts before forecasting.");
  const commonEnd = new Date(Math.min(...[...coverages.values()].map((intervals) => intervals.at(-1).end.getTime())));
  const datasetScope = new mongoose.Types.ObjectId(dataset._id);
  const settings = await SurveillanceThresholdConfig.findOne({ isActive: true }).sort({ updatedAt: -1 }).select("excludedPeriods").lean();
  const excludedPeriods = settings?.excludedPeriods || [];
  const diseaseOutputs = [];
  for (const disease of SURVEILLANCE_DISEASES) {
    const statuses = includedStatusesForDisease(disease);
    const rows = await getAnalyticalCaseRows({
      datasetId: dataset._id,
      disease,
      statuses,
      includeReports: false,
    });
    const districts = [];
    for (const district of DISTRICTS) {
      const series = completeSeries(rows.filter((row) => row.district === district), coverages.get(district), commonEnd);
      const seasonalNaive = seasonalNaiveModel(series, horizonMonths);
      const prophet = await prophetModel(series, horizonMonths);
      const comparison = compareModels(prophet, seasonalNaive);
      const selected = comparison.operationalModel === "prophet" ? prophet : comparison.operationalModel === "seasonal_naive" ? seasonalNaive : null;
      const nextForecast = await attachThreshold({ point: primaryForecast(selected), datasetId: dataset._id, disease, district, excludedPeriods });
      if (nextForecast) selected.forecast = selected.forecast.map((point) => point.isPrimaryTarget ? nextForecast : point);
      districts.push({ district, districtKey: normalizeDistrictKey(district), disease, historicalSeries: series.map(({ y, ...point }) => ({ ...point, cases: y })), models: { prophet, seasonalNaive }, modelComparison: comparison, selectedModel: comparison.selectedModel, operationalModel: comparison.operationalModel, status: nextForecast ? "success" : "insufficient_data", message: selected?.message || "No forecast is available for the next month.", nextForecast });
    }
    const wholeManila = aggregateWholeManila(districts);
    const cityForecast = await attachThreshold({ point: primaryForecast(wholeManila), datasetId: dataset._id, disease, district: undefined, excludedPeriods });
    if (cityForecast) wholeManila.forecast = [cityForecast];
    diseaseOutputs.push({ disease, districts, wholeManila, modelEvaluation: pooledEvaluation(districts), modelCoverage: { prophet: { totalDistricts: DISTRICTS.length, successfulDistricts: districts.filter((item) => item.models.prophet.status === "success").length }, seasonalNaive: { totalDistricts: DISTRICTS.length, successfulDistricts: districts.filter((item) => item.models.seasonalNaive.status === "success").length } } });
  }
  const inputFingerprint = fingerprint(diseaseOutputs.map(({ disease, districts }) => ({ disease, districts: districts.map(({ district, historicalSeries }) => ({ district, historicalSeries })) })));
  const basis = diseaseOutputs[0]?.districts?.[0]?.historicalSeries?.at(-1) || null;
  const target = basis ? addMonths(basis.year, basis.month, 1) : null;
  const existing = await PredictionRun.findOne({ model: "prophet", granularity: GRANULARITY, datasetScope, status: "success" }).sort({ generatedAt: -1 }).lean();
  const canReuse = !force
    && existing?.inputFingerprint === inputFingerprint
    && existing?.payload?.schemaVersion === FORECAST_SCHEMA_VERSION
    && Number(existing?.basisYear) === Number(basis?.year)
    && Number(existing?.basisMonth) === Number(basis?.month)
    && Number(existing?.forecastTargetYear) === Number(target?.year)
    && Number(existing?.forecastTargetMonth) === Number(target?.month)
    && Number(existing?.forecastHorizonMonths) === Number(horizonMonths);
  if (canReuse) return { ...existing, alreadyUpToDate: true };
  const now = new Date();
  const payload = { schemaVersion: FORECAST_SCHEMA_VERSION, generatedAt: now.toISOString(), model: "prophet_seasonal_naive_comparison", granularity: GRANULARITY, datasetScope: String(datasetScope), basisYear: basis?.year || null, basisMonth: basis?.month || null, forecastTargetYear: target?.year || null, forecastTargetMonth: target?.month || null, forecastHorizonMonths: horizonMonths, diseases: diseaseOutputs, methodology: { sourceProcessing: "Authoritative official surveillance uploads only; citizen reports remain separate early-warning and audit records.", comparisonPeriod: "Calendar-month totals", baseline: "The same calendar month from the previous five eligible years", zeroHandling: "A complete covered month with no eligible official case row is counted as zero.", missingHandling: "Partial months and periods outside verified district coverage remain missing.", forecastScope: "One run includes every supported disease and all six districts." } };
  return PredictionRun.findOneAndUpdate(
    { model: "prophet", granularity: GRANULARITY, datasetScope },
    { $set: { trigger, status: "success", startedAt: now, finishedAt: new Date(), generatedAt: now, errorMessage: null, payload, basisDatasetId: dataset._id, basisYear: basis?.year || null, basisMonth: basis?.month || null, basisWeek: null, forecastTargetYear: target?.year || null, forecastTargetMonth: target?.month || null, forecastTargetWeek: null, forecastHorizonMonths: horizonMonths, forecastHorizonWeeks: null, inputFingerprint } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean();
}

export function refreshMonthlyDistrictPredictions(options = {}) {
  const datasetKey = options.datasetId ? String(options.datasetId) : "latest";
  return runSerializedForecast({ key: `monthly-global:${datasetKey}`, label: `monthly global forecast (${datasetKey})` }, () => refreshMonthlyDistrictPredictionsImpl(options));
}
