import mongoose from "mongoose";
import PredictionRun from "../models/PredictionRun.js";
import Dataset from "../models/Dataset.js";
import {
  FORECAST_SCHEMA_VERSION,
  isMonthlyDistrictPredictionRefreshActive,
  isUsablePredictionRun,
  refreshMonthlyDistrictPredictions,
} from "../services/predictions/refreshMonthlyDistrictPredictions.js";
import { logServerError } from "../utils/serverLogger.js";
import { isSafePublicMessage } from "../middleware/errorHandler.js";
import { startGitHubForecast, usesGitHubForecasts } from "../services/predictions/githubForecastJobs.js";

const MODEL = "prophet";
const GRANULARITY = "monthly_disease_district_cases";
const DEFAULT_REFRESH_TIMEOUT_MS = 12 * 60 * 1000;
const DEFAULT_FORECAST_HORIZON_MONTHS = 1;
const MAX_FORECAST_HORIZON_MONTHS = 36;

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

function parseForecastHorizon(value) {
  const parsed = Number(value ?? DEFAULT_FORECAST_HORIZON_MONTHS);
  return Number.isInteger(parsed)
    && parsed >= 1
    && parsed <= MAX_FORECAST_HORIZON_MONTHS
    ? parsed
    : null;
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

function invalidRequestedDatasetResponse(datasetId, dataset) {
  if (!datasetId || dataset?._id) return null;
  if (typeof datasetId !== "string" || !mongoose.Types.ObjectId.isValid(datasetId)) {
    return {
      status: 400,
      body: {
        code: "INVALID_DATASET_ID",
        message: "Dataset ID must be a valid MongoDB ObjectId.",
      },
    };
  }
  return {
    status: 404,
    body: {
      code: "FORECAST_DATASET_NOT_FOUND",
      message: "The requested validated CESU dataset was not found.",
    },
  };
}

export function publicRefreshJob(run) {
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
    executionPhase: run.executionPhase || null,
    workerActive:
      run.status === "running"
      && (run.executionBackend === "github" || isMonthlyDistrictPredictionRefreshActive({
        datasetId: run.basisDatasetId,
        predictionRunId: run._id,
      })),
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

async function latestRefresh(datasetScope, horizonMonths) {
  let run = await PredictionRun.findOne({
    model: MODEL,
    granularity: GRANULARITY,
    datasetScope,
    forecastHorizonMonths: horizonMonths,
  })
    .sort({ startedAt: -1, _id: -1 })
    .select("status startedAt finishedAt createdAt errorMessage basisDatasetId executionBackend executionPhase executionExpiresAt")
    .lean();

  const startedAt = new Date(run?.startedAt || run?.createdAt || 0).getTime();
  if (
    run?.status === "running"
    && (run.executionBackend === "github"
      ? Date.now() >= new Date(run.executionExpiresAt || startedAt).getTime()
      : Date.now() - startedAt >= refreshTimeoutMs())
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
      .select("status startedAt finishedAt createdAt errorMessage basisDatasetId executionBackend executionPhase executionExpiresAt")
      .lean();
  }

  return run;
}

async function latestUsablePrediction(datasetScope, horizonMonths) {
  const filter = {
    model: MODEL,
    granularity: GRANULARITY,
    status: "success",
    forecastHorizonMonths: horizonMonths,
    "payload.schemaVersion": FORECAST_SCHEMA_VERSION,
    "payload.diseases.0": { $exists: true },
  };
  if (datasetScope !== undefined) filter.datasetScope = datasetScope;

  const candidates = await PredictionRun.find(filter)
    .sort({ generatedAt: -1, _id: -1 })
    .limit(20)
    .select(
      "_id granularity basisDatasetId basisYear basisMonth forecastTargetYear forecastTargetMonth forecastHorizonMonths generatedAt trigger status payload startedAt finishedAt createdAt errorMessage",
    )
    .lean();

  return candidates.find((candidate) => (
    isUsablePredictionRun(candidate, { horizonMonths })
  )) || null;
}

function launchRefreshWorker({ job, datasetId, horizonMonths, trigger, req }) {
  if (job.executionBackend === "github") return;
  const timeoutMs = refreshTimeoutMs();
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort(
      new Error(`Prediction refresh exceeded its ${timeoutMs} ms time limit.`),
    );
  }, timeoutMs);
  timeout.unref?.();

  void refreshMonthlyDistrictPredictions({
    trigger,
    datasetId,
    predictionRunId: job._id,
    horizonMonths,
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
}

export const getPredictions = async (req, res) => {
  try {
    const horizonMonths = parseForecastHorizon(req.query.forecastHorizonMonths);
    if (!horizonMonths) {
      return res.status(400).json({
        message: `Forecast horizon must be a whole number from 1 to ${MAX_FORECAST_HORIZON_MONTHS}.`,
      });
    }
    const dataset = await resolveDataset(req.query.datasetId);
    const datasetError = invalidRequestedDatasetResponse(
      req.query.datasetId,
      dataset,
    );
    if (datasetError) {
      return res.status(datasetError.status).json(datasetError.body);
    }

    const datasetScope = dataset?._id || "all";
    const refreshRun = await latestRefresh(datasetScope, horizonMonths);

    const currentRun = await latestUsablePrediction(datasetScope, horizonMonths);
    const showingPreviousRun = Boolean(
      currentRun && refreshRun?.status === "running",
    );
    const run = currentRun;

    if (!run) {
      return res.json({
        success: true,
        hasPrediction: false,
        message: "No current, renderable monthly forecast is available. Refresh the forecast to replace any outdated or incomplete saved record.",
        refreshJob: publicRefreshJob(refreshRun),
      });
    }

    return res.json({
      success: true,
      hasPrediction: true,
      predictionIsStale: showingPreviousRun,
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
    const horizonMonths = parseForecastHorizon(req.body?.forecastHorizonMonths);
    if (!horizonMonths) {
      return res.status(400).json({
        message: `Forecast horizon must be a whole number from 1 to ${MAX_FORECAST_HORIZON_MONTHS}.`,
      });
    }
    if (req.body?.force !== undefined && typeof req.body.force !== "boolean") {
      return res.status(400).json({
        code: "INVALID_FORCE_VALUE",
        message: "Force must be a boolean value.",
      });
    }
    const dataset = await resolveDataset(req.body?.datasetId);
    const datasetError = invalidRequestedDatasetResponse(
      req.body?.datasetId,
      dataset,
    );
    if (datasetError) {
      return res.status(datasetError.status).json(datasetError.body);
    }
    if (!dataset?._id) {
      return res.status(422).json({
        message: "A validated CESU dataset is required for forecasting.",
        code: "INSUFFICIENT_FORECAST_HISTORY",
      });
    }

    const datasetId = dataset._id;
    const force = req.body?.force === true;
    const existing = await latestRefresh(datasetId, horizonMonths);
    if (existing?.status === "running") {
      const workerIsActive = existing.executionBackend === "github" || isMonthlyDistrictPredictionRefreshActive({
        datasetId,
        predictionRunId: existing._id,
      });
      if (!workerIsActive) {
        launchRefreshWorker({
          job: existing,
          datasetId,
          horizonMonths,
          trigger: "manual",
          req,
        });
      }
      return res.status(202).json({
        success: true,
        accepted: true,
        resumed: !workerIsActive,
        message: workerIsActive
          ? "The global forecast refresh is already running."
          : "The interrupted forecast worker has been resumed.",
        refreshJob: publicRefreshJob(existing),
      });
    }
    const savedRun = force
      ? null
      : await latestUsablePrediction(datasetId, horizonMonths);
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
    if (usesGitHubForecasts()) {
      if (horizonMonths !== 1) return res.status(400).json({ message: "GitHub testing forecasts currently support a one-month horizon." });
      job = await startGitHubForecast({ datasetId, trigger: "manual" });
      return res.status(202).json({ success: true, accepted: true, message: "Forecast queued for GitHub execution.", refreshJob: publicRefreshJob(job) });
    }
    try {
      job = await PredictionRun.create({
        model: MODEL,
        granularity: GRANULARITY,
        datasetScope: datasetId,
        basisDatasetId: datasetId,
        trigger: "manual",
        status: "running",
        startedAt: new Date(),
        forecastHorizonMonths: horizonMonths,
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

    launchRefreshWorker({
      job,
      datasetId,
      horizonMonths,
      trigger: "manual",
      req,
    });

    return res.status(202).json({
      success: true,
      accepted: true,
      message: "The monthly forecast for all diseases and districts has started.",
      refreshJob: publicRefreshJob(job),
    });
  } catch (error) {
    const message = error?.message || "Server error";
    logServerError(error, {
      errorId: req.errorId,
      code: "FORECAST_REFRESH_FAILED",
      method: req.method,
      route: req.baseUrl,
      userId: req.user?.id,
    });
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
