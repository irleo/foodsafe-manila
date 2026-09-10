// @ts-check
import mongoose from "mongoose";
import PredictionRun from "../../models/PredictionRun.js";

/** @param {string} jobId @param {string} datasetId @param {string} workerRunId */
export async function claimGitHubForecast(jobId, datasetId, workerRunId) {
  return PredictionRun.findOneAndUpdate({
    _id: new mongoose.Types.ObjectId(jobId), basisDatasetId: new mongoose.Types.ObjectId(datasetId),
    datasetScope: new mongoose.Types.ObjectId(datasetId), model: "prophet",
    granularity: "monthly_disease_district_cases", forecastHorizonMonths: 1,
    status: "running", executionBackend: "github", executionPhase: "queued",
    executionExpiresAt: { $gt: new Date() },
  }, { $set: { executionPhase: "executing", workerRunId } }, { returnDocument: "after", runValidators: true }).lean();
}

/** @param {string} jobId @param {string} workerRunId */
export function ownedGitHubJobFilter(jobId, workerRunId) {
  return { _id: new mongoose.Types.ObjectId(jobId), status: "running", executionBackend: "github", executionPhase: "executing", workerRunId };
}

/** @param {string} jobId @param {string} workerRunId */
export async function failGitHubForecast(jobId, workerRunId) {
  await PredictionRun.updateOne(ownedGitHubJobFilter(jobId, workerRunId), {
    $set: { status: "failed", executionPhase: "finished", finishedAt: new Date(), errorMessage: "GitHub forecast failed or was interrupted. Refresh to retry." },
  });
}
