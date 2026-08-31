import mongoose from "mongoose";
import PredictionRun from "../models/PredictionRun.js";
import Dataset from "../models/Dataset.js";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";

let refreshJob = {
  status: "idle",
  requestedAt: null,
  completedAt: null,
  errorMessage: null,
};

function publicRefreshJob() {
  return { ...refreshJob };
}

function toDatasetScope(datasetId) {
  return datasetId && mongoose.Types.ObjectId.isValid(datasetId)
    ? new mongoose.Types.ObjectId(datasetId)
    : "all";
}

export const getPredictions = async (req, res) => {
  try {
    let datasetId = req.query.datasetId;
    if (!datasetId) {
      const latest = await Dataset.findOne({ status: "validated", providerType: "cesu" })
        .sort({ createdAt: -1 })
        .select("_id")
        .lean();
      datasetId = latest?._id ? String(latest._id) : null;
    }

    const run = await PredictionRun.findOne({
      model: "prophet",
      granularity: "monthly_disease_district_cases",
      datasetScope: toDatasetScope(datasetId),
      status: "success",
    })
      .sort({ generatedAt: -1 })
      .select("_id granularity basisDatasetId basisYear basisMonth forecastTargetYear forecastTargetMonth forecastHorizonMonths generatedAt trigger status payload")
      .lean();
    if (!run) {
      return res.json({
        success: true,
        hasPrediction: false,
        message: "No saved monthly forecast is available yet.",
        refreshJob: publicRefreshJob(),
      });
    }

    const payload = run.payload || {};
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
      refreshJob: publicRefreshJob(),
      payload,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error" });
  }
};

export const refreshPredictions = async (req, res) => {
  try {
    const horizonMonths = Number(req.body?.forecastHorizonMonths ?? 1);
    if (refreshJob.status === "running") {
      return res.status(202).json({
        success: true,
        accepted: true,
        message: "The global forecast refresh is already running.",
        refreshJob: publicRefreshJob(),
      });
    }

    const requestedAt = new Date();
    refreshJob = {
      status: "running",
      requestedAt: requestedAt.toISOString(),
      completedAt: null,
      errorMessage: null,
    };
    void refreshMonthlyDistrictPredictions({
      trigger: "manual",
      datasetId: req.body?.datasetId,
      horizonMonths: Number.isFinite(horizonMonths) ? horizonMonths : 1,
      force: true,
    }).then((saved) => {
      refreshJob = {
        status: "succeeded",
        requestedAt: requestedAt.toISOString(),
        completedAt: new Date().toISOString(),
        predictionRunId: saved?._id ? String(saved._id) : null,
        errorMessage: null,
      };
    }).catch((error) => {
      console.error("[forecast] global refresh failed", error);
      refreshJob = {
        status: "failed",
        requestedAt: requestedAt.toISOString(),
        completedAt: new Date().toISOString(),
        errorMessage: error?.message || "Global forecast refresh failed.",
      };
    });
    return res.status(202).json({
      success: true,
      accepted: true,
      message: "The monthly forecast for all diseases and districts has started.",
      refreshJob: publicRefreshJob(),
    });
  } catch (error) {
    const message = error?.message || "Server error";
    const setupError = /Prophet|Python|prophet_import|PYTHON_BIN/i.test(message);
    const eligibilityError = /verified complete coverage|required|months|unavailable/i.test(message);
    return res.status(setupError ? 503 : eligibilityError ? 422 : 500).json({
      message,
      code: eligibilityError ? "INSUFFICIENT_FORECAST_HISTORY" : "FORECAST_REFRESH_FAILED",
    });
  }
};
