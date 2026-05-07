import mongoose from "mongoose";
import Dataset from "../../models/Dataset.js";
import OfficialCase from "../../models/OfficialCase.js";
import PredictionRun from "../../models/PredictionRun.js";
import { runProphetForecast } from "../prophet/runForecast.js";

function fillYearlyGaps(series) {
  const safe = Array.isArray(series) ? series : [];
  if (!safe.length) return [];
  const sorted = [...safe].sort((a, b) => a.year - b.year);
  const minY = sorted[0].year;
  const maxY = sorted[sorted.length - 1].year;
  const byYear = new Map(sorted.map((r) => [r.year, r.y]));
  const out = [];
  for (let y = minY; y <= maxY; y++) {
    out.push({ year: y, y: byYear.has(y) ? byYear.get(y) : 0 });
  }
  return out;
}

async function aggregateYearlyTotal(match) {
  const rows = await OfficialCase.aggregate([
    { $match: match },
    { $group: { _id: "$year", y: { $sum: "$cases" } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ year: r._id, y: r.y }));
}

async function aggregateYearlyByDistrict(match) {
  const rows = await OfficialCase.aggregate([
    { $match: match },
    {
      $group: {
        _id: { district: "$district", year: "$year" },
        y: { $sum: "$cases" },
      },
    },
    { $sort: { "_id.district": 1, "_id.year": 1 } },
  ]);

  const byDistrict = new Map();
  for (const r of rows) {
    const d = String(r?._id?.district || "").trim();
    if (!d) continue;
    if (!byDistrict.has(d)) byDistrict.set(d, []);
    byDistrict.get(d).push({ year: r._id.year, y: r.y });
  }
  return byDistrict;
}

function riskLevelFromScore(score) {
  if (score >= 67) return "high";
  if (score >= 34) return "medium";
  return "low";
}

function attachRiskScores(districtPayloads) {
  const preds = districtPayloads
    .filter((d) => d.ok && d.nextForecast)
    .map((d) => d.nextForecast.predicted);
  const maxPred = preds.length ? Math.max(...preds, 1) : 1;

  return districtPayloads.map((d) => {
    if (!d.ok || !d.nextForecast) return d;
    const pred = Number(d.nextForecast.predicted) || 0;
    const riskScore = Math.min(100, Math.round((pred / maxPred) * 100));
    return {
      ...d,
      riskScore,
      riskLevel: riskLevelFromScore(riskScore),
    };
  });
}

function stripCompareRow(r) {
  const { backtestable: _b, ...rest } = r || {};
  return rest;
}

function stripForecastPayload(r) {
  if (!r || !r.compareRows) return r;
  return {
    compareRows: r.compareRows.map(stripCompareRow),
    nextForecast: r.nextForecast,
    metrics: r.metrics,
  };
}

function toDatasetScope(datasetId) {
  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
    return new mongoose.Types.ObjectId(datasetId);
  }
  return "all";
}

/**
 * Month (1–12) from dataset upload `coverageEnd`, when scope is a single dataset.
 * OfficialCase rows are yearly only; this is the best "as of" month from metadata.
 */
async function resolveBasisMonthFromDataset(datasetScope) {
  if (datasetScope === "all") return null;
  const ds = await Dataset.findById(datasetScope).select("coverageEnd").lean();
  const end = ds?.coverageEnd ? new Date(ds.coverageEnd) : null;
  if (!end || Number.isNaN(end.getTime())) return null;
  return end.getUTCMonth() + 1;
}

/**
 * Refreshes Prophet predictions and persists them in PredictionRun.
 *
 * @param {{ trigger: "official_upload"|"monthly_fallback"|"manual", datasetId?: string, force?: boolean }} opts
 */
export async function refreshProphetPredictions({
  trigger,
  datasetId,
  force = false,
} = {}) {
  const datasetScope = toDatasetScope(datasetId);
  const match =
    datasetScope === "all" ? {} : { datasetId: new mongoose.Types.ObjectId(datasetScope) };

  const now = new Date();

  // Optional safeguard: skip if recently successful and not forced
  if (!force) {
    const existing = await PredictionRun.findOne({
      model: "prophet",
      granularity: "yearly_total_cases",
      datasetScope,
      status: "success",
    })
      .select("generatedAt")
      .lean();
    if (existing?.generatedAt) {
      const ageMs = now.getTime() - new Date(existing.generatedAt).getTime();
      const oneDay = 24 * 60 * 60 * 1000;
      if (ageMs < oneDay) {
        return await PredictionRun.findOne({
          model: "prophet",
          granularity: "yearly_total_cases",
          datasetScope,
        }).lean();
      }
    }
  }

  // Upsert single run per scope and mark running
  const running = await PredictionRun.findOneAndUpdate(
    { model: "prophet", granularity: "yearly_total_cases", datasetScope },
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
        forecastStartYear: null,
        forecastEndYear: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    const totalSeries = fillYearlyGaps(await aggregateYearlyTotal(match));
    if (totalSeries.length < 2) {
      throw new Error(
        "Not enough yearly history (need at least two calendar years of official case data)."
      );
    }

    const byDistrict = await aggregateYearlyByDistrict(match);
    const districtEntries = [...byDistrict.entries()]
      .map(([district, series]) => ({
        district,
        series: fillYearlyGaps(series),
      }))
      .filter((d) => d.series.length >= 2)
      .sort((a, b) => a.district.localeCompare(b.district));

    const totalResult = await runProphetForecast(totalSeries);

    const districtResults = await Promise.all(
      districtEntries.map(async ({ district, series }) => {
        try {
          const r = await runProphetForecast(series);
          return { district, ok: true, ...r };
        } catch (err) {
          return {
            district,
            ok: false,
            error: err?.message || "forecast_failed",
          };
        }
      })
    );

    const districts = attachRiskScores(districtResults);

    const latestActualYear = Math.max(...totalSeries.map((r) => Number(r.year)));
    const targetYear = Number(totalResult?.nextForecast?.targetYear);
    const forecastStartYear = Number.isFinite(targetYear) ? targetYear : null;
    const forecastEndYear = forecastStartYear;
    const basisMonth = await resolveBasisMonthFromDataset(datasetScope);

    const payload = {
      generatedAt: now.toISOString(),
      model: "prophet",
      granularity: "yearly_total_cases",
      datasetScope: datasetScope === "all" ? "all" : String(datasetScope),
      // What the model saw vs what it predicts (yearly horizon = one future calendar year).
      basisYear: latestActualYear,
      basisMonth,
      forecastStartYear,
      forecastEndYear,
      description:
        "Facebook Prophet on yearly case totals (sum across diseases). basisYear is the latest calendar year present in official case rows used for training; basisMonth (when set) comes from the dataset coverageEnd. forecastStartYear–forecastEndYear is the predicted horizon (one year ahead for this model). Training uses expanding windows for backtest rows; the next-year point uses the full history. Confidence bands are Prophet yhat_lower / yhat_upper.",
      total: {
        district: null,
        ...stripForecastPayload(totalResult),
      },
      districts: districts.map((d) => {
        if (!d.ok) return { district: d.district, ok: false, error: d.error };
        const { ok: _ok, ...rest } = d;
        return {
          district: rest.district,
          ok: true,
          ...stripForecastPayload(rest),
          riskScore: rest.riskScore,
          riskLevel: rest.riskLevel,
        };
      }),
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
          basisYear: Number.isFinite(latestActualYear) ? latestActualYear : null,
          basisMonth: Number.isFinite(basisMonth) ? basisMonth : null,
          forecastStartYear,
          forecastEndYear,
        },
      },
      { new: true }
    ).lean();

    return saved;
  } catch (err) {
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
      { new: true }
    ).lean();
    return saved;
  }
}

