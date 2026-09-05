import mongoose from "mongoose";
import PredictionRun from "../models/PredictionRun.js";
import Dataset from "../models/Dataset.js";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";
import { logServerError } from "../utils/serverLogger.js";
import { isSafePublicMessage } from "../middleware/errorHandler.js";

const MODEL = "prophet";
const GRANULARITY = "monthly_disease_district_cases";
const DEFAULT_REFRESH_TIMEOUT_MS = 12 * 60 * 1000;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function refreshTimeoutMs() {
  return positiveInteger(
    process.env.PREDICTION_REFRESH_TIMEOUT_MS,
    DEFAULT_REFRESH_TIMEOUT_MS,
  );
}

async function resolveDataset(datasetId) {
  if (datasetId) {
    if (!mongoose.Types.ObjectId.isValid(datasetId)) return null;
    return Dataset.findOne({
      _id: datasetId,
      status: "validated",
      providerType: "cesu",
    })
      .select("_id")
      .lean();
  }

  return Dataset.findOne({ status: "validated", providerType: "cesu" })
    .sort({ createdAt: -1 })
    .select("_id")
    .lean();
}

function publicRefreshJob(run) {
  if (!run) {
    return {
      jobId: null,
      datasetId: null,
      status: "idle",
      requestedAt: null,
      completedAt: null,
      errorMessage: null,
    };
  }

  return {
    jobId: String(run._id),
    datasetId: run.basisDatasetId ? String(run.basisDatasetId) : null,
    status: run.status === "success" ? "succeeded" : run.status,
    requestedAt: run.startedAt || run.createdAt || null,
    completedAt: run.finishedAt || null,
    errorMessage: isSafePublicMessage(run.errorMessage)
      ? run.errorMessage
      : run.status === "failed"
        ? "Prediction refresh could not be completed."
        : null,
  };
}

export function sanitizePredictionPayload(value, key = "", depth = 0) {
  if (depth > 20) return null;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePredictionPayload(item, "", depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([entryKey]) => !/^(stack|traceback|exception)$/i.test(entryKey))
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizePredictionPayload(entryValue, entryKey, depth + 1),
        ]),
    );
  }
  if (
    typeof value === "string"
    && /^(message|error|errorMessage)$/i.test(key)
    && !isSafePublicMessage(value)
  ) {
    return "Prediction unavailable. The forecasting service encountered an error. Please try again later.";
  }
  return value;
}

async function latestRefresh(datasetScope) {
  let run = await PredictionRun.findOne({
    model: MODEL,
    granularity: GRANULARITY,
    datasetScope,
  })
    .sort({ startedAt: -1, _id: -1 })
    .select("status startedAt finishedAt createdAt errorMessage basisDatasetId")
    .lean();

  const startedAt = new Date(run?.startedAt || run?.createdAt || 0).getTime();
  if (
    run?.status === "running"
    && Date.now() - startedAt >= refreshTimeoutMs()
  ) {
    run = await PredictionRun.findOneAndUpdate(
      { _id: run._id, status: "running" },
      {
        $set: {
          status: "failed",
          finishedAt: new Date(),
          errorMessage:
            "Prediction refresh was interrupted or exceeded its time limit.",
        },
      },
      { new: true, runValidators: true },
    )
      .select("status startedAt finishedAt createdAt errorMessage basisDatasetId")
      .lean();
  }

  return run;
}

export const getPredictions = async (req, res) => {
  try {
    const dataset = await resolveDataset(req.query.datasetId);
    const datasetScope = dataset?._id || "all";
    const refreshRun = await latestRefresh(datasetScope);

    const run = await PredictionRun.findOne({
      model: MODEL,
      granularity: GRANULARITY,
      datasetScope,
      status: "success",
    })
      .sort({ generatedAt: -1 })
      .select(
        "_id granularity basisDatasetId basisYear basisMonth forecastTargetYear forecastTargetMonth forecastHorizonMonths generatedAt trigger status payload",
      )
      .lean();

    if (!run) {
      return res.json({
        success: true,
        hasPrediction: false,
        message: "No saved monthly forecast is available yet.",
        refreshJob: publicRefreshJob(refreshRun),
      });
    }

    return res.json({
      success: true,
      hasPrediction: true,
      predictionRunId: String(run._id),
      granularity: run.granularity,
      basisDatasetId: run.basisDatasetId ? String(run.basisDatasetId) : null,
      basisYear: run.basisYear,
      basisMonth: run.basisMonth,
      forecastTargetYear: run.forecastTargetYear,
      forecastTargetMonth: run.forecastTargetMonth,
      forecastHorizonMonths: run.forecastHorizonMonths,
      generatedAt: run.generatedAt,
      trigger: run.trigger,
      status: run.status,
      refreshJob: publicRefreshJob(refreshRun),
      payload: sanitizePredictionPayload(run.payload || {}),
    });
  } catch (error) {
    logServerError(error, {
      errorId: req.errorId,
      code: "PREDICTION_SERVICE_ERROR",
      method: req.method,
      route: req.baseUrl,
      userId: req.user?.id,
    });
    return res.status(500).json({
      code: "PREDICTION_SERVICE_ERROR",
      message: "Prediction data is currently unavailable.",
    });
  }
};

export const refreshPredictions = async (req, res) => {
  try {
    const horizonMonths = Number(req.body?.forecastHorizonMonths ?? 1);
    const dataset = await resolveDataset(req.body?.datasetId);
    if (!dataset?._id) {
      return res.status(422).json({
        message: "A validated CESU dataset is required for forecasting.",
        code: "INSUFFICIENT_FORECAST_HISTORY",
      });
    }

    const datasetId = dataset._id;
    const existing = await latestRefresh(datasetId);
    if (existing?.status === "running") {
      return res.status(202).json({
        success: true,
        accepted: true,
        message: "The global forecast refresh is already running.",
        refreshJob: publicRefreshJob(existing),
      });
    }
    const savedRun = existing?.status === "success"
      ? existing
      : await PredictionRun.findOne({
        model: MODEL,
        granularity: GRANULARITY,
        datasetScope: datasetId,
        status: "success",
      })
        .sort({ generatedAt: -1 })
        .select("status startedAt finishedAt createdAt errorMessage basisDatasetId")
        .lean();
    if (savedRun) {
      return res.status(200).json({
        success: true,
        accepted: false,
        alreadyUpToDate: true,
        message: "The latest dataset already has a saved forecast.",
        refreshJob: publicRefreshJob(savedRun),
      });
    }

    let job;
    try {
      job = await PredictionRun.create({
        model: MODEL,
        granularity: GRANULARITY,
        datasetScope: datasetId,
        basisDatasetId: datasetId,
        trigger: "manual",
        status: "running",
        startedAt: new Date(),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      job = await PredictionRun.findOne({
        model: MODEL,
        granularity: GRANULARITY,
        datasetScope: datasetId,
        status: "running",
      }).lean();
      if (!job) throw error;
      return res.status(202).json({
        success: true,
        accepted: true,
        message: "The global forecast refresh is already running.",
        refreshJob: publicRefreshJob(job),
      });
    }

    const timeoutMs = refreshTimeoutMs();
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort(
        new Error(`Prediction refresh exceeded its ${timeoutMs} ms time limit.`),
      );
    }, timeoutMs);
    timeout.unref?.();

    void refreshMonthlyDistrictPredictions({
      trigger: "manual",
      datasetId,
      predictionRunId: job._id,
      horizonMonths: Number.isFinite(horizonMonths) ? horizonMonths : 1,
      force: true,
      signal: abortController.signal,
    })
      .catch(async (error) => {
        logServerError(error, {
          errorId: req.errorId,
          code: "PREDICTION_REFRESH_FAILED",
          method: req.method,
          route: req.baseUrl,
          userId: req.user?.id,
        });
        try {
          await PredictionRun.updateOne(
            { _id: job._id, status: "running" },
            {
              $set: {
                status: "failed",
                finishedAt: new Date(),
                errorMessage: "Prediction refresh could not be completed.",
              },
            },
          );
        } catch (updateError) {
          logServerError(updateError, {
            errorId: req.errorId,
            code: "PREDICTION_STATUS_UPDATE_FAILED",
            method: req.method,
            route: req.baseUrl,
            userId: req.user?.id,
          });
        }
      })
      .finally(() => clearTimeout(timeout));

    return res.status(202).json({
      success: true,
      accepted: true,
      message: "The monthly forecast for all diseases and districts has started.",
      refreshJob: publicRefreshJob(job),
    });
  } catch (error) {
    const message = error?.message || "Server error";
    const setupError = /Prophet|Python|prophet_import|PYTHON_BIN/i.test(message);
    const eligibilityError =
      /verified complete coverage|required|months|unavailable/i.test(message);
    return res.status(setupError ? 503 : eligibilityError ? 422 : 500).json({
      message,
      code: eligibilityError
        ? "INSUFFICIENT_FORECAST_HISTORY"
        : "FORECAST_REFRESH_FAILED",
    });
  }
};
