import mongoose from "mongoose";
import { createHash } from "crypto";
import PredictionRun from "../../models/PredictionRun.js";
import { runProphetMonthlyForecast } from "../prophet/runMonthlyForecast.js";
import Dataset from "../../models/Dataset.js";
import { normalizeDistrictKey } from "../../constants/manilaDistrictCoords.js";
import { createNotification } from "../notificationService.js";
import { runSerializedForecast } from "./forecastExecution.js";
import { getAnalyticalCaseRows } from "../analyticalCaseService.js";

const MIN_TRAINING_MONTHS = 24;
const MIN_COMPARABLE_BACKTEST_OBSERVATIONS = 3;
const FORECAST_SCHEMA_VERSION = 3;
const MANILA_DISTRICTS = Array.from({ length: 6 }, (_, index) => `District ${index + 1}`);

function ymToInt(year, month) {
  return year * 100 + month;
}

function intToYm(v) {
  const y = Math.floor(v / 100);
  const m = v % 100;
  return { year: y, month: m };
}

function addMonths(year, month, delta) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function coverageMonth(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`A valid dataset ${fieldName} is required for forecasting.`);
  }
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function completeMonthlySeries(series, coverageStart, coverageEnd) {
  const safe = Array.isArray(series) ? series : [];
  const start = coverageMonth(coverageStart, "coverage start");
  const end = coverageMonth(coverageEnd, "coverage end");
  const min = ymToInt(start.year, start.month);
  const max = ymToInt(end.year, end.month);
  if (min > max) throw new Error("Dataset coverage start must not be after coverage end.");

  const by = new Map(
    safe.map((row) => [ymToInt(row.year, row.month), Number(row.y || 0)]),
  );
  const out = [];
  let cur = min;
  while (cur <= max) {
    const { year, month } = intToYm(cur);
    const hasConfirmedRecord = by.has(cur);
    out.push({
      year,
      month,
      y: hasConfirmedRecord ? by.get(cur) : 0,
      observed: true,
      hasConfirmedRecord,
      zeroFilledWithinCoverage: !hasConfirmedRecord,
    });
    const next = addMonths(year, month, 1);
    cur = ymToInt(next.year, next.month);
  }
  return out;
}

async function aggregateMonthlyByDistrict(datasetId) {
  const rows = await getAnalyticalCaseRows({
    datasetId,
    statuses: ["confirmed"],
  });
  const byDistrict = new Map(
    MANILA_DISTRICTS.map((district) => [normalizeDistrictKey(district), {
      district,
      series: [],
    }]),
  );
  for (const r of rows) {
    const d = String(r?.district || "").trim();
    if (!d) continue;
    const districtKey = normalizeDistrictKey(d);
    if (!byDistrict.has(districtKey)) {
      byDistrict.set(districtKey, {
        district: d,
        series: [],
      });
    }
    const series = byDistrict.get(districtKey).series;
    const existing = series.find(
      (point) => point.year === r.year && point.month === r.month,
    );
    if (existing) existing.y += Number(r.cases || 0);
    else series.push({ year: r.year, month: r.month, y: Number(r.cases || 0) });
  }
  return byDistrict;
}

function periodKey(year, month) {
  return `${Number(year)}-${Number(month)}`;
}

function withPredictionErrors(row) {
  const actualCases = Number(row?.actualCases);
  const predictedCases = Number(row?.predictedCases);
  if (!Number.isFinite(actualCases) || !Number.isFinite(predictedCases)) return null;
  const signedError = actualCases - predictedCases;
  return {
    ...row,
    actualCases,
    predictedCases,
    signedError,
    absoluteError: Math.abs(signedError),
    absolutePercentageError: actualCases > 0
      ? Number(((Math.abs(signedError) / actualCases) * 100).toFixed(2))
      : null,
  };
}

function calculateMetrics(rows = []) {
  const usable = (Array.isArray(rows) ? rows : [])
    .map(withPredictionErrors)
    .filter(Boolean);
  if (!usable.length) return null;

  const absoluteErrorSum = usable.reduce((sum, row) => sum + row.absoluteError, 0);
  const squaredErrorSum = usable.reduce((sum, row) => sum + row.signedError ** 2, 0);
  const actualTotal = usable.reduce((sum, row) => sum + Math.max(0, row.actualCases), 0);
  const percentageRows = usable.filter((row) => row.actualCases > 0);

  return {
    mae: Number((absoluteErrorSum / usable.length).toFixed(2)),
    rmse: Number(Math.sqrt(squaredErrorSum / usable.length).toFixed(2)),
    wape: actualTotal > 0 ? Number(((absoluteErrorSum / actualTotal) * 100).toFixed(2)) : null,
    mape: percentageRows.length
      ? Number((percentageRows.reduce(
          (sum, row) => sum + (row.absoluteError / row.actualCases) * 100,
          0,
        ) / percentageRows.length).toFixed(2))
      : null,
    observationCount: usable.length,
  };
}

function rawMae(rows = []) {
  const usable = (Array.isArray(rows) ? rows : [])
    .map(withPredictionErrors)
    .filter(Boolean);
  if (!usable.length) return null;
  return usable.reduce((sum, row) => sum + row.absoluteError, 0) / usable.length;
}

function buildSeasonalNaiveModel(series = [], horizonMonths = 1) {
  const byPeriod = new Map(
    series.map((point) => [periodKey(point.year, point.month), Number(point.y)]),
  );
  const backtestStart = Math.max(MIN_TRAINING_MONTHS, series.length - 12);
  const backtestSeries = [];

  for (let index = backtestStart; index < series.length; index += 1) {
    const target = series[index];
    const priorYear = addMonths(target.year, target.month, -12);
    const priorValue = byPeriod.get(periodKey(priorYear.year, priorYear.month));
    if (!Number.isFinite(priorValue) || !Number.isFinite(Number(target.y))) continue;
    const row = withPredictionErrors({
      year: target.year,
      month: target.month,
      actualCases: Math.max(0, Math.round(Number(target.y))),
      predictedCases: Math.max(0, Math.round(priorValue)),
    });
    if (row) backtestSeries.push(row);
  }

  const latest = series[series.length - 1];
  const forecast = [];
  for (let offset = 1; offset <= horizonMonths; offset += 1) {
    const target = addMonths(latest.year, latest.month, offset);
    const priorYear = addMonths(target.year, target.month, -12);
    const priorValue = byPeriod.get(periodKey(priorYear.year, priorYear.month));
    if (!Number.isFinite(priorValue)) continue;
    forecast.push({
      year: target.year,
      month: target.month,
      predictedCases: Math.max(0, Math.round(priorValue)),
      lowerBound: null,
      upperBound: null,
      isPrimaryTarget: offset === 1,
    });
  }

  return {
    model: "seasonal_naive",
    status: forecast.some((point) => point.isPrimaryTarget) ? "success" : "insufficient_data",
    message: forecast.some((point) => point.isPrimaryTarget)
      ? null
      : "The corresponding observation from 12 months earlier is unavailable",
    backtestSeries,
    forecast,
    metrics: calculateMetrics(backtestSeries),
  };
}

function compareDistrictModels(prophetModel, seasonalNaiveModel) {
  const prophetByPeriod = new Map(
    (prophetModel?.backtestSeries || []).map((row) => [periodKey(row.year, row.month), row]),
  );
  const naiveByPeriod = new Map(
    (seasonalNaiveModel?.backtestSeries || []).map((row) => [periodKey(row.year, row.month), row]),
  );
  const comparableKeys = [...prophetByPeriod.keys()].filter((key) => naiveByPeriod.has(key));
  const prophetRows = comparableKeys.map((key) => prophetByPeriod.get(key));
  const naiveRows = comparableKeys.map((key) => naiveByPeriod.get(key));
  const prophetMetrics = calculateMetrics(prophetRows);
  const seasonalNaiveMetrics = calculateMetrics(naiveRows);
  const sufficient = comparableKeys.length >= MIN_COMPARABLE_BACKTEST_OBSERVATIONS;
  const prophetMae = rawMae(prophetRows);
  const seasonalNaiveMae = rawMae(naiveRows);
  const selectedModel = sufficient
    ? prophetMae < seasonalNaiveMae
      ? "prophet"
      : "seasonal_naive"
    : null;

  return {
    sufficient,
    minimumRequiredObservations: MIN_COMPARABLE_BACKTEST_OBSERVATIONS,
    comparableObservationCount: comparableKeys.length,
    selectedModel,
    selectedModelReason: sufficient
      ? selectedModel === "prophet"
        ? "Prophet has the lower rolling-backtest MAE"
        : "Seasonal Naïve has the lower or equal rolling-backtest MAE"
      : "Insufficient historical backtest data for model comparison.",
    winningMae: selectedModel === "prophet"
      ? prophetMetrics?.mae ?? null
      : selectedModel === "seasonal_naive"
        ? seasonalNaiveMetrics?.mae ?? null
        : null,
    prophetMetrics,
    seasonalNaiveMetrics,
  };
}

function selectOperationalModel(models, comparison) {
  if (comparison?.selectedModel === "prophet" && models?.prophet?.status === "success") {
    return "prophet";
  }
  if (comparison?.selectedModel === "seasonal_naive" && models?.seasonalNaive?.status === "success") {
    return "seasonal_naive";
  }
  if (models?.seasonalNaive?.status === "success") return "seasonal_naive";
  if (models?.prophet?.status === "success") return "prophet";
  return null;
}

function modelForMode(district, mode) {
  if (mode === "prophet") return district?.models?.prophet || null;
  if (mode === "seasonal_naive") return district?.models?.seasonalNaive || null;
  const selected = district?.selectedModel || district?.operationalModel;
  return selected === "prophet"
    ? district?.models?.prophet || null
    : district?.models?.seasonalNaive || null;
}

function buildWholeManilaModel(districts, mode) {
  const safeDistricts = Array.isArray(districts) ? districts : [];
  const historical = new Map();
  const backtest = new Map();
  const primaryForecasts = [];

  for (const district of safeDistricts) {
    for (const row of district.historicalSeries || []) {
      const key = periodKey(row.year, row.month);
      const aggregate = historical.get(key) || { year: row.year, month: row.month, cases: 0 };
      aggregate.cases += Number(row.cases || 0);
      historical.set(key, aggregate);
    }

    const model = modelForMode(district, mode);
    for (const row of model?.backtestSeries || []) {
      const key = periodKey(row.year, row.month);
      const aggregate = backtest.get(key) || {
        year: row.year,
        month: row.month,
        actualCases: 0,
        predictedCases: 0,
        districtCount: 0,
      };
      aggregate.actualCases += Number(row.actualCases || 0);
      aggregate.predictedCases += Number(row.predictedCases || 0);
      aggregate.districtCount += 1;
      backtest.set(key, aggregate);
    }

    const primary = model?.forecast?.find((point) => point.isPrimaryTarget);
    if (model?.status === "success" && primary) primaryForecasts.push(primary);
  }

  const complete = safeDistricts.length > 0 && primaryForecasts.length === safeDistricts.length;
  const backtestSeries = [...backtest.values()]
    .filter((row) => row.districtCount === safeDistricts.length)
    .map((row) => withPredictionErrors({
      year: row.year,
      month: row.month,
      actualCases: row.actualCases,
      predictedCases: row.predictedCases,
    }))
    .filter(Boolean);
  const firstPrimary = primaryForecasts[0];
  const forecast = complete && firstPrimary
    ? [{
        year: firstPrimary.year,
        month: firstPrimary.month,
        predictedCases: primaryForecasts.reduce(
          (sum, point) => sum + Number(point.predictedCases || 0),
          0,
        ),
        lowerBound: null,
        upperBound: null,
        isPrimaryTarget: true,
      }]
    : [];

  return {
    model: mode,
    status: complete ? "success" : "incomplete_coverage",
    historicalSeries: [...historical.values()].sort(
      (a, b) => ymToInt(a.year, a.month) - ymToInt(b.year, b.month),
    ),
    backtestSeries,
    forecast,
    metrics: calculateMetrics(backtestSeries),
    coverage: {
      totalDistricts: safeDistricts.length,
      successfulDistricts: primaryForecasts.length,
      completeCityForecast: complete,
    },
    intervalAggregation: "not_calculated",
  };
}

function buildPooledModelEvaluation(districts) {
  const prophetRows = [];
  const seasonalNaiveRows = [];

  for (const district of districts) {
    const prophetByPeriod = new Map(
      (district.models?.prophet?.backtestSeries || []).map((row) => [periodKey(row.year, row.month), row]),
    );
    const naiveByPeriod = new Map(
      (district.models?.seasonalNaive?.backtestSeries || []).map((row) => [periodKey(row.year, row.month), row]),
    );
    for (const [key, prophetRow] of prophetByPeriod) {
      if (!naiveByPeriod.has(key)) continue;
      prophetRows.push(prophetRow);
      seasonalNaiveRows.push(naiveByPeriod.get(key));
    }
  }

  const prophet = calculateMetrics(prophetRows);
  const seasonalNaive = calculateMetrics(seasonalNaiveRows);
  const sufficient = prophetRows.length >= MIN_COMPARABLE_BACKTEST_OBSERVATIONS;
  const prophetMae = rawMae(prophetRows);
  const seasonalNaiveMae = rawMae(seasonalNaiveRows);
  const bestHistoricalModel = sufficient
    ? prophetMae < seasonalNaiveMae
      ? "prophet"
      : "seasonal_naive"
    : null;

  return {
    sufficient,
    comparableObservationCount: prophetRows.length,
    minimumRequiredObservations: MIN_COMPARABLE_BACKTEST_OBSERVATIONS,
    prophet,
    seasonalNaive,
    bestHistoricalModel,
    selectionMetric: "mae",
    message: sufficient
      ? null
      : "Insufficient historical backtest data for model comparison.",
  };
}

function inputFingerprint(byDistrict) {
  const normalized = [...byDistrict.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([districtKey, value]) => ({
      districtKey,
      series: [...value.series]
        .sort((a, b) => ymToInt(a.year, a.month) - ymToInt(b.year, b.month))
        .map(({ year, month, y }) => ({ year, month, y: Number(y || 0) })),
    }));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function buildAutoregressiveFeatures(targetSeries = []) {
  const safe = Array.isArray(targetSeries) ? targetSeries : [];
  return safe.map((point, idx) => {
    const prev1 = idx - 1 >= 0 ? Number(safe[idx - 1]?.y || 0) : 0;
    const prev2 = idx - 2 >= 0 ? Number(safe[idx - 2]?.y || 0) : 0;
    const prev3 = idx - 3 >= 0 ? Number(safe[idx - 3]?.y || 0) : 0;
    const avg3 = (prev1 + prev2 + prev3) / 3;
    return {
      year: point.year,
      month: point.month,
      lag1: prev1,
      lag2: prev2,
      avg3,
    };
  });
}

function buildFutureAutoregressiveRegressors(targetSeries = [], horizonMonths = 1) {
  const safe = Array.isArray(targetSeries) ? targetSeries : [];
  const rows = [];
  let a = Number(safe[safe.length - 1]?.y || 0);
  let b = Number(safe[safe.length - 2]?.y || 0);
  let c = Number(safe[safe.length - 3]?.y || 0);

  for (let i = 0; i < horizonMonths; i += 1) {
    const avg3 = (a + b + c) / 3;
    rows.push({ lag1: a, lag2: b, avg3 });
    // Persistence fallback for unknown future confirmed-case lag values.
    c = b;
    b = a;
    a = a;
  }
  return rows;
}

function toDatasetScope(datasetId) {
  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
    return new mongoose.Types.ObjectId(datasetId);
  }
  return "all";
}

async function refreshMonthlyDistrictPredictionsImpl({
  trigger,
  datasetId,
  horizonMonths = 1,
  force = true,
} = {}) {
  const forecastDataset = datasetId
    ? await Dataset.findById(datasetId)
      .select("_id coverageStart coverageEnd status")
      .lean()
    : await Dataset.findOne({ status: "validated" })
      .sort({ createdAt: -1 })
      .select("_id coverageStart coverageEnd status")
      .lean();
  if (!forecastDataset?._id || forecastDataset.status !== "validated") {
    throw new Error("A validated dataset with a verified coverage period is required for forecasting.");
  }

  const resolvedDatasetId = String(forecastDataset._id);
  const datasetScope = toDatasetScope(resolvedDatasetId);
  const now = new Date();

  try {
    const byDistrict = await aggregateMonthlyByDistrict(resolvedDatasetId);
    const districtsSeries = [...byDistrict.values()]
      .map(({ district, series }) => ({
        district,
        series: completeMonthlySeries(
          series,
          forecastDataset.coverageStart,
          forecastDataset.coverageEnd,
        ),
      }))
      .sort((a, b) => a.district.localeCompare(b.district));
    const completedByDistrict = new Map(
      districtsSeries.map((district) => [
        normalizeDistrictKey(district.district),
        { series: district.series },
      ]),
    );
    const fingerprint = inputFingerprint(completedByDistrict);
    const basis = coverageMonth(forecastDataset.coverageEnd, "coverage end");
    const target = addMonths(basis.year, basis.month, 1);

    const existingSuccess = await PredictionRun.findOne({
      model: "prophet",
      granularity: "monthly_district_cases",
      datasetScope,
      status: "success",
    })
      .select(
        "_id basisYear basisMonth forecastTargetYear forecastTargetMonth forecastHorizonMonths inputFingerprint payload",
      )
      .lean();

    const isUpToDate =
      existingSuccess &&
      Number(existingSuccess.payload?.schemaVersion) === FORECAST_SCHEMA_VERSION &&
      existingSuccess.basisYear === basis.year &&
      existingSuccess.basisMonth === basis.month &&
      existingSuccess.forecastTargetYear === target.year &&
      existingSuccess.forecastTargetMonth === target.month &&
      existingSuccess.inputFingerprint === fingerprint &&
      Number(existingSuccess.forecastHorizonMonths || 1) ===
        Number(horizonMonths || 1);

    if (!force && isUpToDate) {
      return { ...existingSuccess, alreadyUpToDate: true };
    }

    const running = await PredictionRun.findOneAndUpdate(
      { model: "prophet", granularity: "monthly_district_cases", datasetScope },
      {
        $set: {
          trigger,
          status: "running",
          startedAt: now,
          finishedAt: null,
          errorMessage: null,
          generatedAt: now,
          payload: null,
          basisDatasetId: datasetScope === "all" ? null : datasetScope,
          basisYear: null,
          basisMonth: null,
          forecastTargetYear: null,
          forecastTargetMonth: null,
          forecastHorizonMonths: horizonMonths,
          inputFingerprint: fingerprint,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );

    const districtForecasts = [];
    for (const { district, series } of districtsSeries) {
      const missingMonths = series.filter((point) => !point.observed);
      const observedMonths = series.length;
      const explicitConfirmedRecordMonths = series.filter(
        (point) => point.hasConfirmedRecord,
      ).length;
      const zeroFilledMonths = series.filter(
        (point) => point.zeroFilledWithinCoverage,
      ).length;
      const eligibility = {
        observedMonths,
        requiredObservedMonths: MIN_TRAINING_MONTHS,
        missingMonths: missingMonths.length,
        continuousHistory: missingMonths.length === 0,
        explicitConfirmedRecordMonths,
        zeroFilledMonths,
      };
      const autoregressiveFeatures = buildAutoregressiveFeatures(series);
      const mergedSeries = series.map((p, idx) => ({
        year: p.year,
        month: p.month,
        cases: p.y,
        hasConfirmedRecord: p.hasConfirmedRecord,
        zeroFilledWithinCoverage: p.zeroFilledWithinCoverage,
        lag1: Number(autoregressiveFeatures[idx]?.lag1 || 0),
        lag2: Number(autoregressiveFeatures[idx]?.lag2 || 0),
        avg3: Number(autoregressiveFeatures[idx]?.avg3 || 0),
      }));

      const historicalSeries = mergedSeries.map((p) => ({
        year: p.year,
        month: p.month,
        cases: p.cases,
        hasConfirmedRecord: p.hasConfirmedRecord,
        zeroFilledWithinCoverage: p.zeroFilledWithinCoverage,
        lag1: p.lag1,
        lag2: p.lag2,
        avg3: p.avg3,
      }));

      if (missingMonths.length) {
        districtForecasts.push({
          district,
          districtKey: normalizeDistrictKey(district),
          status: "data_gap",
          message: `${missingMonths.length} monthly observation${missingMonths.length === 1 ? " is" : "s are"} missing`,
          eligibility,
          historicalSeries,
          models: { prophet: null, seasonalNaive: null },
          modelComparison: null,
          selectedModel: null,
          operationalModel: null,
          backtestSeries: [],
          forecast: [],
        });
        continue;
      }

      if (series.length < MIN_TRAINING_MONTHS) {
        districtForecasts.push({
          district,
          districtKey: normalizeDistrictKey(district),
          status: "insufficient_data",
          message: `At least ${MIN_TRAINING_MONTHS} complete monthly observations are required`,
          eligibility,
          historicalSeries,
          models: { prophet: null, seasonalNaive: null },
          modelComparison: null,
          selectedModel: null,
          operationalModel: null,
          backtestSeries: [],
          forecast: [],
        });
        continue;
      }

      const prophetSeries = mergedSeries.map((p) => ({
        year: p.year,
        month: p.month,
        y: p.cases,
        lag1: p.lag1,
        lag2: p.lag2,
        avg3: p.avg3,
      }));
      const seasonalNaiveModel = buildSeasonalNaiveModel(prophetSeries, horizonMonths);
      const futureRegressors = buildFutureAutoregressiveRegressors(series, horizonMonths);
      let prophetModel;

      try {
        const r = await runProphetMonthlyForecast(prophetSeries, {
          horizonMonths,
          futureRegressors,
        });
        const forecast = (r.forecast || []).map((f) => ({
          year: f.year,
          month: f.month,
          predictedCases: f.predictedCases,
          lowerBound: f.lowerBound,
          upperBound: f.upperBound,
          isPrimaryTarget: f.isPrimaryTarget,
        }));
        const primary = forecast.find((f) => f.isPrimaryTarget);
        const hitsTarget =
          primary?.year === target.year && primary?.month === target.month;

        const backtestSeries = (r.backtest || []).map((b) => withPredictionErrors({
            year: b.year,
            month: b.month,
            actualCases: b.actualCases,
            predictedCases: b.predictedCases,
            lowerBound: b.lowerBound,
            upperBound: b.upperBound,
          })).filter(Boolean);
        prophetModel = {
          model: "prophet",
          status: hitsTarget ? "success" : "insufficient_data",
          message: hitsTarget ? null : "No sufficient Prophet forecast",
          backtestSeries,
          forecast: hitsTarget ? forecast : [],
          metrics: calculateMetrics(backtestSeries),
          futureRegressors,
        };
      } catch (e) {
        prophetModel = {
          model: "prophet",
          status: "forecast_failed",
          message: "Prophet forecast generation failed",
          error: e?.message || "forecast_failed",
          backtestSeries: [],
          forecast: [],
          metrics: null,
          futureRegressors,
        };
      }

      const models = {
        prophet: prophetModel,
        seasonalNaive: seasonalNaiveModel,
      };
      const modelComparison = compareDistrictModels(prophetModel, seasonalNaiveModel);
      const operationalModel = selectOperationalModel(models, modelComparison);
      const selectedOutput = operationalModel === "prophet"
        ? prophetModel
        : operationalModel === "seasonal_naive"
          ? seasonalNaiveModel
          : null;

      districtForecasts.push({
        district,
        districtKey: normalizeDistrictKey(district),
        status: selectedOutput?.status === "success" ? "success" : "forecast_failed",
        message: selectedOutput?.status === "success"
          ? null
          : "Neither forecasting model produced the target month",
        historicalSeries,
        eligibility,
        models,
        modelComparison,
        selectedModel: modelComparison.selectedModel,
        operationalModel,
        selectedModelReason: modelComparison.selectedModelReason,
        backtestSeries: selectedOutput?.backtestSeries || [],
        forecast: selectedOutput?.forecast || [],
      });
    }

    const successfulDistricts = districtForecasts.filter(
      (district) => district.status === "success" && district.forecast?.length,
    );
    if (!successfulDistricts.length) {
      const districtDiagnostics = districtForecasts
        .map((district) => {
          const eligibility = district.eligibility;
          if (!eligibility) return `${district.district}: ${district.message || "ineligible"}`;
          return `${district.district}: ${eligibility.observedMonths} observed months, ${eligibility.missingMonths} missing months`;
        })
        .join("; ");
      throw new Error(
        `No district has the required continuous ${MIN_TRAINING_MONTHS}-month history. ${districtDiagnostics}`,
      );
    }

    const wholeManila = {
      prophet: buildWholeManilaModel(districtForecasts, "prophet"),
      seasonalNaive: buildWholeManilaModel(districtForecasts, "seasonal_naive"),
      best: buildWholeManilaModel(districtForecasts, "best"),
    };
    const modelEvaluation = buildPooledModelEvaluation(districtForecasts);
    const prophetSuccessfulDistricts = districtForecasts.filter(
      (district) => district.models?.prophet?.status === "success",
    ).length;
    const seasonalNaiveSuccessfulDistricts = districtForecasts.filter(
      (district) => district.models?.seasonalNaive?.status === "success",
    ).length;

    const payload = {
      schemaVersion: FORECAST_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      model: "prophet_seasonal_naive_comparison",
      granularity: "monthly_district_cases",
      datasetScope: datasetScope === "all" ? "all" : String(datasetScope),
      basisYear: basis.year,
      basisMonth: basis.month,
      forecastTargetYear: target.year,
      forecastTargetMonth: target.month,
      forecastHorizonMonths: horizonMonths,
      inputFingerprint: fingerprint,
      coverage: {
        totalDistricts: districtForecasts.length,
        successfulDistricts: successfulDistricts.length,
        completeCityForecast: successfulDistricts.length === districtForecasts.length,
      },
      modelCoverage: {
        prophet: {
          successfulDistricts: prophetSuccessfulDistricts,
          totalDistricts: districtForecasts.length,
        },
        seasonalNaive: {
          successfulDistricts: seasonalNaiveSuccessfulDistricts,
          totalDistricts: districtForecasts.length,
        },
      },
      inputDefinition: {
        target: "Confirmed official cases plus confirmed surveillance reports",
        includedCaseStatuses: ["confirmed"],
        excludedCaseStatuses: ["reported", "suspected", "not_validated", "ruled_out", "duplicate_suppressed"],
        sources: ["official_upload", "confirmed_surveillance_report"],
        unionStrategy: "query_time_no_copy",
      },
      monthlySeriesCompletion: {
        coverageStart: forecastDataset.coverageStart,
        coverageEnd: forecastDataset.coverageEnd,
        districtScope: MANILA_DISTRICTS,
        withinCoverageNoRecordValue: 0,
        outsideCoverageValue: null,
        methodology: "Within the verified official dataset coverage period, a district-month with no confirmed case record is interpreted as zero recorded confirmed cases. Months outside that period remain missing.",
      },
      autoregressiveFeatures: {
        source: "confirmed_target_series",
        features: ["lag1", "lag2", "avg3"],
        note: "Lag features are derived only from the confirmed target series.",
      },
      modelSelection: {
        defaultMode: "best",
        primaryMetric: "mae",
        tieBreaker: "seasonal_naive",
        minimumComparableBacktestObservations: MIN_COMPARABLE_BACKTEST_OBSERVATIONS,
      },
      modelEvaluation,
      wholeManila,
      districts: districtForecasts,
    };

    const finishedAt = new Date();
    const saved = await PredictionRun.findByIdAndUpdate(
      running._id,
      {
        $set: {
          status: "success",
          finishedAt,
          generatedAt: now,
          payload,
          basisYear: basis.year,
          basisMonth: basis.month,
          forecastTargetYear: target.year,
          forecastTargetMonth: target.month,
          forecastHorizonMonths: horizonMonths,
          inputFingerprint: fingerprint,
        },
      },
      { returnDocument: "after" },
    ).lean();

    const targetMonth = `${target.year}-${String(target.month).padStart(2, "0")}`;
    await createNotification({
      type: "prediction_generated",
      title: "Prediction Generated",
      message: `Monthly prediction generated for ${targetMonth}.`,
      dotColor: "purple",
      targetMonth,
      metadata: {
        predictionRunId: String(saved?._id || running._id),
        forecastTargetYear: target.year,
        forecastTargetMonth: target.month,
      },
    });

    return saved;
  } catch (err) {
    const running = await PredictionRun.findOne({
      model: "prophet",
      granularity: "monthly_district_cases",
      datasetScope,
    })
      .sort({ updatedAt: -1 })
      .select("_id")
      .lean();

    if (!running?._id) {
      throw err;
    }

    const finishedAt = new Date();
    const msg = err?.message || "forecast_failed";
    const saved = await PredictionRun.findByIdAndUpdate(
      running._id,
      {
        $set: {
          status: "failed",
          finishedAt,
          errorMessage: msg,
          payload: null,
        },
      },
      { returnDocument: "after" },
    ).lean();
    return saved;
  }
}

export function refreshMonthlyDistrictPredictions(options = {}) {
  const datasetKey = options.datasetId ? String(options.datasetId) : "latest";
  const horizonMonths = Number(options.horizonMonths || 1);
  const key = `monthly:${datasetKey}:horizon:${horizonMonths}`;
  const label = `monthly dataset=${datasetKey} horizon=${horizonMonths}`;

  return runSerializedForecast(
    { key, label },
    () => refreshMonthlyDistrictPredictionsImpl(options),
  );
}
