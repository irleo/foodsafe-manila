// @ts-check
import mongoose from "mongoose";
import {
  readForecastTrialConfiguration,
  safeForecastTrialDiagnostic,
  ForecastTrialSetupError,
} from "../services/predictions/forecastWriteTrialDiagnostics.js";
import { validateForecastWriteTrial } from "../services/predictions/forecastWriteTrialValidation.js";

let stage = "configuration";
async function main() {
  const { uri, expectedDatabase, datasetId, runId } =
    readForecastTrialConfiguration(process.env);
  const jobId = process.env.PREDICTION_RUN_ID?.trim();
  if (!jobId || !/^[a-f\d]{24}$/i.test(jobId))
    throw new Error("Invalid prediction job ID.");
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  const abort = new AbortController();
  const cancel = () => abort.abort(new Error("GitHub forecast interrupted."));
  const timer = setTimeout(cancel, 30 * 60_000);
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  try {
    stage = "database_connection";
    await mongoose.connect(uri, {
      autoCreate: false,
      autoIndex: false,
      maxPoolSize: 3,
      serverSelectionTimeoutMS: 15_000,
      socketTimeoutMS: 60_000,
    });
    if (mongoose.connection.name !== expectedDatabase)
      throw new ForecastTrialSetupError("DATABASE_MISMATCH");
    const { default: PredictionRun } =
      await import("../models/PredictionRun.js");
    const { claimGitHubForecast, failGitHubForecast, ownedGitHubJobFilter } =
      await import("../services/predictions/githubForecastWorkerStore.js");
    const {
      refreshMonthlyDistrictPredictions,
      FORECAST_SCHEMA_VERSION,
      isUsablePredictionRun,
    } =
      await import("../services/predictions/refreshMonthlyDistrictPredictions.js");
    const { SURVEILLANCE_DISEASES } =
      await import("../constants/surveillanceMethodology.js");
    stage = "claim";
    const job = await claimGitHubForecast(jobId, datasetId, runId);
    if (!job) {
      const prior = await PredictionRun.findById(jobId).lean();
      if (
        prior?.status === "success" &&
        prior.executionBackend === "github" &&
        String(prior.basisDatasetId) === datasetId &&
        isUsablePredictionRun(prior, { horizonMonths: 1 })
      ) {
        console.log(
          "[github-forecast] Job already completed; nothing to recompute.",
        );
        return;
      }
      throw new Error(
        "Job is already claimed, expired, failed, or does not match this dataset.",
      );
    }
    try {
      stage = "compute";
      console.log(`[github-forecast] Computing claimed job ${jobId}.`);
      const computed = await refreshMonthlyDistrictPredictions({
        datasetId,
        horizonMonths: 1,
        force: true,
        dryRun: true,
        signal: abort.signal,
      });
      stage = "validate";
      validateForecastWriteTrial(
        computed,
        datasetId,
        SURVEILLANCE_DISEASES,
        FORECAST_SCHEMA_VERSION,
      );
      abort.signal.throwIfAborted();
      stage = "save";
      const saved = await PredictionRun.findOneAndUpdate(
        {
          ...ownedGitHubJobFilter(jobId, runId),
          executionExpiresAt: { $gt: new Date() },
        },
        {
          $set: {
            status: "success",
            executionPhase: "finished",
            finishedAt: new Date(),
            generatedAt: new Date(),
            errorMessage: null,
            basisYear: computed.basisYear,
            basisMonth: computed.basisMonth,
            forecastTargetYear: computed.forecastTargetYear,
            forecastTargetMonth: computed.forecastTargetMonth,
            inputFingerprint: computed.inputFingerprint,
            payload: computed.payload,
          },
        },
        { returnDocument: "after", runValidators: true },
      ).lean();
      if (!saved || !isUsablePredictionRun(saved, { horizonMonths: 1 }))
        throw new Error(
          "Job is no longer active or output verification failed.",
        );
      console.log(`[github-forecast] Saved predictionRunId=${jobId}.`);
    } catch (error) {
      await failGitHubForecast(jobId, runId);
      throw error;
    }
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
    await mongoose.disconnect();
  }
}
main().catch((error) => {
  console.error(
    `[github-forecast] stage=${stage}; ${safeForecastTrialDiagnostic(error)}`,
  );
  process.exitCode = 1;
});
