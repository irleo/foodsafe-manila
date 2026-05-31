import mongoose from "mongoose";
import PredictionRun from "../models/PredictionRun.js";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";
import Dataset from "../models/Dataset.js";

function toDatasetScope(datasetId) {
  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
    return new mongoose.Types.ObjectId(datasetId);
  }
  return "all";
}

export const getPredictions = async (req, res) => {
  try {
    let datasetId = req.query.datasetId;
    if (!datasetId) {
      const latest = await Dataset.findOne({ status: "validated" })
        .sort({ createdAt: -1 })
        .select("_id")
        .lean();
      datasetId = latest?._id ? String(latest._id) : null;
    }

    const datasetScope = toDatasetScope(datasetId);
    const run = await PredictionRun.findOne({
      model: "prophet",
      granularity: "monthly_district_cases",
      datasetScope,
      status: "success",
    })
      .sort({ generatedAt: -1, createdAt: -1 })
      .select(
        "_id granularity basisDatasetId basisYear basisMonth forecastTargetYear forecastTargetMonth forecastHorizonMonths generatedAt trigger status payload",
      )
      .lean();

    if (!run) {
      return res.json({
        success: true,
        hasPrediction: false,
        message: "No saved monthly district prediction run found.",
      });
    }

    const districtFilter =
      req.query.districtKey || req.query.district ? String(req.query.districtKey || req.query.district) : null;
    const payload = run.payload || {};
    const districts = Array.isArray(payload.districts) ? payload.districts : [];
    const filtered =
      districtFilter && districts.length
        ? districts.filter(
            (d) => d.districtKey === districtFilter || d.district === districtFilter,
          )
        : districts;

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
      payload: { ...payload, districts: filtered },
    });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};

export const refreshPredictions = async (req, res) => {
  try {
    const datasetId = req.body?.datasetId;
    const horizonMonths = Number(req.body?.forecastHorizonMonths ?? 1);

    const saved = await refreshMonthlyDistrictPredictions({
      trigger: "manual",
      datasetId,
      horizonMonths: Number.isFinite(horizonMonths) ? horizonMonths : 1,
      force: false,
    });

    if (saved?.alreadyUpToDate) {
      return res.status(200).json({
        success: true,
        upToDate: true,
        message:
          "Latest prediction already available. Upload a new validated dataset to update forecasts.",
        predictionRunId: saved?._id ? String(saved._id) : null,
        granularity: "monthly_district_cases",
        basisYear: saved?.basisYear ?? null,
        basisMonth: saved?.basisMonth ?? null,
        forecastTargetYear: saved?.forecastTargetYear ?? null,
        forecastTargetMonth: saved?.forecastTargetMonth ?? null,
      });
    }

    if (saved?.status === "failed") {
      const msg = saved?.errorMessage || "Refresh failed";
      const isSetup =
        /Prophet|Python|prophet_import|pip install/i.test(msg) ||
        msg.includes("PYTHON_BIN");
      return res.status(isSetup ? 503 : 500).json({ message: msg });
    }

    return res.json({
      success: true,
      upToDate: false,
      predictionRunId: saved?._id ? String(saved._id) : null,
      granularity: saved?.granularity,
      basisDatasetId: saved?.basisDatasetId ? String(saved.basisDatasetId) : null,
      basisYear: saved?.basisYear,
      basisMonth: saved?.basisMonth,
      forecastTargetYear: saved?.forecastTargetYear,
      forecastTargetMonth: saved?.forecastTargetMonth,
      status: saved?.status,
    });
  } catch (err) {
    const msg = err?.message || "Server error";
    const isSetup =
      /Prophet|Python|prophet_import|pip install/i.test(msg) ||
      msg.includes("PYTHON_BIN");
    return res.status(isSetup ? 503 : 500).json({ message: msg });
  }
};
