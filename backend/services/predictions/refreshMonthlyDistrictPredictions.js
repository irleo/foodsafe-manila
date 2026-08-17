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

function completeMonthlySeries(series, endYm = null) {
  const safe = Array.isArray(series) ? series : [];
  if (!safe.length) return [];
  const sorted = [...safe].sort(
    (a, b) => ymToInt(a.year, a.month) - ymToInt(b.year, b.month),
  );
  const min = ymToInt(sorted[0].year, sorted[0].month);
  const ownMax = ymToInt(
    sorted[sorted.length - 1].year,
    sorted[sorted.length - 1].month,
  );
  const max = endYm == null ? ownMax : Math.max(ownMax, endYm);
  const by = new Map(sorted.map((r) => [ymToInt(r.year, r.month), r.y]));
  const out = [];
  let cur = min;
  while (cur <= max) {
    const { year, month } = intToYm(cur);
    out.push({
      year,
      month,
      y: by.has(cur) ? by.get(cur) : null,
      observed: by.has(cur),
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
  const byDistrict = new Map();
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
  let resolvedDatasetId = datasetId;
  if (!resolvedDatasetId) {
    const latest = await Dataset.findOne({ status: "validated" })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();
    resolvedDatasetId = latest?._id ? String(latest._id) : null;
  }

  const datasetScope = toDatasetScope(resolvedDatasetId);
  const now = new Date();

  try {
    const byDistrict = await aggregateMonthlyByDistrict(resolvedDatasetId);
    const fingerprint = inputFingerprint(byDistrict);
    const rawDistricts = [...byDistrict.values()]
      .map(({ district, series }) => ({ district, series }))
      .sort((a, b) => a.district.localeCompare(b.district));

    if (!rawDistricts.length) {
      throw new Error("No monthly confirmed case data found for forecasting.");
    }

    const allRawPoints = rawDistricts.flatMap((d) => d.series);
    const maxYm = Math.max(
      ...allRawPoints.map((p) => ymToInt(p.year, p.month)),
    );
    const basis = intToYm(maxYm);
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

    const districtsSeries = [...byDistrict.values()]
      .map(({ district, series }) => ({
        district,
        series: completeMonthlySeries(series, maxYm),
      }))
      .sort((a, b) => a.district.localeCompare(b.district));

    const districtForecasts = [];
    for (const { district, series } of districtsSeries) {
      const missingMonths = series.filter((point) => !point.observed);
      const autoregressiveFeatures = buildAutoregressiveFeatures(series);
      const mergedSeries = series.map((p, idx) => ({
        year: p.year,
        month: p.month,
        cases: p.y,
        lag1: Number(autoregressiveFeatures[idx]?.lag1 || 0),
        lag2: Number(autoregressiveFeatures[idx]?.lag2 || 0),
        avg3: Number(autoregressiveFeatures[idx]?.avg3 || 0),
      }));

      const historicalSeries = mergedSeries.map((p) => ({
        year: p.year,
        month: p.month,
        cases: p.cases,
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
          historicalSeries,
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
          historicalSeries,
          backtestSeries: [],
          forecast: [],
        });
        continue;
      }

      try {
        const prophetSeries = mergedSeries.map((p) => ({
          year: p.year,
          month: p.month,
          y: p.cases,
          lag1: p.lag1,
          lag2: p.lag2,
          avg3: p.avg3,
        }));
      const futureRegressors = buildFutureAutoregressiveRegressors(series, horizonMonths);
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

        districtForecasts.push({
          district,
          districtKey: normalizeDistrictKey(district),
          status: hitsTarget ? "success" : "insufficient_data",
          message: hitsTarget ? null : "No sufficient data",
          historicalSeries,
          futureRegressors,
          backtestSeries: (r.backtest || []).map((b) => ({
            year: b.year,
            month: b.month,
            actualCases: b.actualCases,
            predictedCases: b.predictedCases,
            lowerBound: b.lowerBound,
            upperBound: b.upperBound,
          })),
          forecast: hitsTarget ? forecast : [],
        });
      } catch (e) {
        districtForecasts.push({
          district,
          districtKey: normalizeDistrictKey(district),
          status: "forecast_failed",
          message: "Forecast generation failed",
          error: e?.message || "forecast_failed",
          historicalSeries,
          backtestSeries: [],
          forecast: [],
        });
      }
    }

    const successfulDistricts = districtForecasts.filter(
      (district) => district.status === "success" && district.forecast?.length,
    );
    if (!successfulDistricts.length) {
      throw new Error("Forecast generation failed for every district.");
    }

    const payload = {
      generatedAt: now.toISOString(),
      model: "prophet",
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
      inputDefinition: {
        target: "Confirmed official cases plus confirmed surveillance reports",
        includedCaseStatuses: ["confirmed"],
        excludedCaseStatuses: ["reported", "suspected", "not_validated"],
        sources: ["official_upload", "confirmed_surveillance_report"],
        unionStrategy: "query_time_no_copy",
      },
      autoregressiveFeatures: {
        source: "confirmed_target_series",
        features: ["lag1", "lag2", "avg3"],
        note: "Lag features are derived only from the confirmed target series.",
      },
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
