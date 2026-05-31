import mongoose from "mongoose";
import OfficialCase from "../../models/OfficialCase.js";
import Report from "../../models/Report.js";
import PredictionRun from "../../models/PredictionRun.js";
import { runProphetMonthlyForecast } from "../prophet/runMonthlyForecast.js";
import Dataset from "../../models/Dataset.js";
import { normalizeDistrictKey } from "../../constants/manilaDistrictCoords.js";
import { createNotification } from "../notificationService.js";

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

function fillMonthlyGaps(series, endYm = null) {
  const safe = Array.isArray(series) ? series : [];
  if (!safe.length) return [];
  const sorted = [...safe].sort((a, b) => ymToInt(a.year, a.month) - ymToInt(b.year, b.month));
  const min = ymToInt(sorted[0].year, sorted[0].month);
  const ownMax = ymToInt(sorted[sorted.length - 1].year, sorted[sorted.length - 1].month);
  const max = endYm == null ? ownMax : Math.max(ownMax, endYm);
  const by = new Map(sorted.map((r) => [ymToInt(r.year, r.month), r.y]));
  const out = [];
  let cur = min;
  while (cur <= max) {
    const { year, month } = intToYm(cur);
    out.push({ year, month, y: by.has(cur) ? by.get(cur) : 0 });
    const next = addMonths(year, month, 1);
    cur = ymToInt(next.year, next.month);
  }
  return out;
}

async function aggregateMonthlyByDistrict(match) {
  const rows = await OfficialCase.aggregate([
    { $match: match },
    {
      $group: {
        _id: { district: "$district", year: "$year", month: "$month" },
        y: { $sum: "$cases" },
      },
    },
    { $sort: { "_id.district": 1, "_id.year": 1, "_id.month": 1 } },
  ]);
  const byDistrict = new Map();
  for (const r of rows) {
    const d = String(r?._id?.district || "").trim();
    if (!d) continue;
    if (!byDistrict.has(d)) byDistrict.set(d, []);
    byDistrict.get(d).push({ year: r._id.year, month: r._id.month, y: r.y });
  }
  return byDistrict;
}

async function aggregateMonthlySuspectedReportsByDistrict() {
  const rows = await Report.aggregate([
    {
      $match: {
        source: "citizen_app",
        isCounted: true,
      },
    },
    {
      $project: {
        district: { $ifNull: ["$exposureDistrict", "$location.district"] },
        year: { $year: "$reportedAt" },
        month: { $month: "$reportedAt" },
        count: { $ifNull: ["$caseCount", 1] },
      },
    },
    {
      $group: {
        _id: { district: "$district", year: "$year", month: "$month" },
        y: { $sum: "$count" },
      },
    },
    { $sort: { "_id.district": 1, "_id.year": 1, "_id.month": 1 } },
  ]);

  const byDistrict = new Map();
  for (const r of rows) {
    const d = String(r?._id?.district || "").trim();
    if (!d) continue;
    if (!byDistrict.has(d)) byDistrict.set(d, []);
    byDistrict.get(d).push({ year: r._id.year, month: r._id.month, y: r.y });
  }
  return byDistrict;
}

function buildReportFeatures(reportSeries = []) {
  const safe = Array.isArray(reportSeries) ? reportSeries : [];
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

function alignSuspectedToOfficialSeries(officialSeries = [], suspectedSeries = [], maxYm) {
  const clipped = (Array.isArray(suspectedSeries) ? suspectedSeries : []).filter(
    (p) => ymToInt(p.year, p.month) <= maxYm,
  );
  const byYm = new Map(
    clipped.map((p) => [`${p.year}-${p.month}`, Number(p.y || 0)]),
  );
  return (Array.isArray(officialSeries) ? officialSeries : []).map((p) => ({
    year: p.year,
    month: p.month,
    y: byYm.get(`${p.year}-${p.month}`) || 0,
  }));
}

function buildFutureReportRegressors(reportSeries = [], horizonMonths = 1) {
  const safe = Array.isArray(reportSeries) ? reportSeries : [];
  const rows = [];
  let a = Number(safe[safe.length - 1]?.y || 0);
  let b = Number(safe[safe.length - 2]?.y || 0);
  let c = Number(safe[safe.length - 3]?.y || 0);

  for (let i = 0; i < horizonMonths; i += 1) {
    const avg3 = (a + b + c) / 3;
    rows.push({ lag1: a, lag2: b, avg3 });
    // Persistence fallback for unknown future report counts.
    c = b;
    b = a;
    a = a;
  }
  return rows;
}

function riskLevelFromScore(score) {
  if (score >= 67) return "high";
  if (score >= 34) return "medium";
  return "low";
}

function attachRiskScores(districtPayloads) {
  const preds = districtPayloads
    .filter((d) => d.forecast?.length)
    .map((d) => d.forecast.find((x) => x.isPrimaryTarget)?.predictedCases ?? null)
    .filter((v) => Number.isFinite(Number(v)));
  const maxPred = preds.length ? Math.max(...preds, 1) : 1;
  return districtPayloads.map((d) => {
    const primary = d.forecast?.find((x) => x.isPrimaryTarget);
    const pred = primary ? Number(primary.predictedCases ?? 0) : null;
    const riskScore =
      pred == null ? null : Math.min(100, Math.round((pred / maxPred) * 100));
    return {
      ...d,
      nextForecast: primary
        ? {
            year: primary.year,
            month: primary.month,
            predictedCases: primary.predictedCases,
            lowerBound: primary.lowerBound,
            upperBound: primary.upperBound,
        }
        : null,
      riskScore,
      riskLevel: riskScore == null ? "insufficient" : riskLevelFromScore(riskScore),
    };
  });
}

function toDatasetScope(datasetId) {
  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
    return new mongoose.Types.ObjectId(datasetId);
  }
  return "all";
}

export async function refreshMonthlyDistrictPredictions({
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
  const match =
    datasetScope === "all"
      ? {}
      : { datasetId: new mongoose.Types.ObjectId(datasetScope) };

  const now = new Date();

  try {
    const byDistrict = await aggregateMonthlyByDistrict(match);
    const suspectedByDistrict = await aggregateMonthlySuspectedReportsByDistrict();
    const rawDistricts = [...byDistrict.entries()]
      .map(([district, series]) => ({ district, series }))
      .sort((a, b) => a.district.localeCompare(b.district));

    if (!rawDistricts.length) {
      throw new Error("No monthly official case data found for forecasting.");
    }

    const allRawPoints = rawDistricts.flatMap((d) => d.series);
    const maxYm = Math.max(...allRawPoints.map((p) => ymToInt(p.year, p.month)));
    const basis = intToYm(maxYm);
    const target = addMonths(basis.year, basis.month, 1);

    const existingSuccess = await PredictionRun.findOne({
      model: "prophet",
      granularity: "monthly_district_cases",
      datasetScope,
      status: "success",
    })
      .select(
        "_id basisYear basisMonth forecastTargetYear forecastTargetMonth forecastHorizonMonths payload",
      )
      .lean();

    const isUpToDate =
      existingSuccess &&
      existingSuccess.basisYear === basis.year &&
      existingSuccess.basisMonth === basis.month &&
      existingSuccess.forecastTargetYear === target.year &&
      existingSuccess.forecastTargetMonth === target.month &&
      Number(existingSuccess.forecastHorizonMonths || 1) === Number(horizonMonths || 1);

    if (!force && isUpToDate) {
      return { ...existingSuccess, alreadyUpToDate: true };
    }

    if (trigger === "manual" && isUpToDate) {
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
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const districtsSeries = [...byDistrict.entries()]
      .map(([district, series]) => ({
        district,
        series: fillMonthlyGaps(series, maxYm),
        suspectedSeries: alignSuspectedToOfficialSeries(
          fillMonthlyGaps(series, maxYm),
          suspectedByDistrict.get(district) || [],
          maxYm,
        ),
      }))
      .sort((a, b) => a.district.localeCompare(b.district));

    const districtForecasts = await Promise.all(
      districtsSeries.map(async ({ district, series, suspectedSeries }) => {
        const reportFeatures = buildReportFeatures(suspectedSeries);
        const mergedSeries = series.map((p, idx) => ({
          year: p.year,
          month: p.month,
          cases: p.y,
          lag1: Number(reportFeatures[idx]?.lag1 || 0),
          lag2: Number(reportFeatures[idx]?.lag2 || 0),
          avg3: Number(reportFeatures[idx]?.avg3 || 0),
          suspectedReports: Number(suspectedSeries[idx]?.y || 0),
        }));

        const historicalSeries = mergedSeries.map((p) => ({
          year: p.year,
          month: p.month,
          cases: p.cases,
          suspectedReports: p.suspectedReports,
          lag1: p.lag1,
          lag2: p.lag2,
          avg3: p.avg3,
        }));

        if (series.length < 3) {
          return {
            district,
            districtKey: normalizeDistrictKey(district),
            status: "insufficient_data",
            message: "No sufficient data",
            historicalSeries,
            backtestSeries: [],
            forecast: [],
          };
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
          const futureRegressors = buildFutureReportRegressors(
            suspectedSeries,
            horizonMonths,
          );
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

          return {
            district,
            districtKey: normalizeDistrictKey(district),
            status: hitsTarget ? "success" : "insufficient_data",
            message: hitsTarget ? null : "No sufficient data",
            historicalSeries,
            suspectedReportSeries: suspectedSeries.map((p) => ({
              year: p.year,
              month: p.month,
              suspectedReports: p.y,
            })),
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
          };
        } catch (e) {
          return {
            district,
            districtKey: normalizeDistrictKey(district),
            status: "insufficient_data",
            message: "No sufficient data",
            error: e?.message || "forecast_failed",
            historicalSeries,
            backtestSeries: [],
            forecast: [],
          };
        }
      })
    );

    const withRisk = attachRiskScores(districtForecasts);

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
      exogenous: {
        source: "suspected_reports",
        features: ["lag1", "lag2", "avg3"],
        note: "Official cases remain target; suspected report features are regressors.",
      },
      districts: withRisk,
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
        },
      },
      { new: true }
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
      { $set: { status: "failed", finishedAt, errorMessage: msg, payload: null } },
      { new: true }
    ).lean();
    return saved;
  }
}
