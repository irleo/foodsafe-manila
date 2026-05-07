import mongoose from "mongoose";
import PredictionRun from "../models/PredictionRun.js";
import { refreshProphetPredictions } from "../services/predictions/refreshProphetPredictions.js";

function toDatasetScope(datasetId) {
  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
    return new mongoose.Types.ObjectId(datasetId);
  }
  return "all";
}

export const getPredictions = async (req, res) => {
  try {
    const datasetScope = toDatasetScope(req.query.datasetId);
    const run = await PredictionRun.findOne({
      model: "prophet",
      granularity: "yearly_total_cases",
      datasetScope,
      status: "success",
    })
      .select("payload generatedAt status")
      .lean();

    if (!run?.payload) {
      return res.status(404).json({
        message:
          "No saved forecast yet. Upload a dataset (or run a refresh) to generate predictions.",
      });
    }

    return res.json(run.payload);
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};

export const refreshPredictions = async (req, res) => {
  try {
    const datasetId = req.body?.datasetId;
    const force = Boolean(req.body?.force);

    const saved = await refreshProphetPredictions({
      trigger: "manual",
      datasetId,
      force: true,
    });

    if (saved?.status === "failed") {
      const msg = saved?.errorMessage || "Refresh failed";
      const isSetup =
        /Prophet|Python|prophet_import|pip install/i.test(msg) ||
        msg.includes("PYTHON_BIN");
      return res.status(isSetup ? 503 : 500).json({ message: msg });
    }

    return res.json(saved?.payload || { status: saved?.status || "running" });
  } catch (err) {
    const msg = err?.message || "Server error";
    const isSetup =
      /Prophet|Python|prophet_import|pip install/i.test(msg) ||
      msg.includes("PYTHON_BIN");
    return res.status(isSetup ? 503 : 500).json({ message: msg });
  }
};
