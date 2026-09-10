// @ts-check
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { validateForecastWriteTrial } from "../services/predictions/forecastWriteTrialValidation.js";
import {
  ForecastTrialSetupError,
  readForecastTrialConfiguration,
  safeForecastTrialDiagnostic,
} from "../services/predictions/forecastWriteTrialDiagnostics.js";

let stage = "configuration";
/** @param {string} nextStage */
function reportStage(nextStage) {
  stage = nextStage;
  console.log(`[forecast-write-trial] stage=${stage}`);
}

/** Compute first, insert one successful record, then verify it. @returns {Promise<void>} */
async function main() {
  const { uri, expectedDatabase, datasetId, runId, repository } =
    readForecastTrialConfiguration(process.env);
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error("Write trial cancelled."));
  const timer = setTimeout(
    () => controller.abort(new Error("Write trial timed out.")),
    30 * 60_000,
  );
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  const started = performance.now();
  try {
    reportStage("database_connection");
    await mongoose.connect(uri, {
      autoCreate: false,
      autoIndex: false,
      maxPoolSize: 3,
      serverSelectionTimeoutMS: 15_000,
      socketTimeoutMS: 60_000,
    });
    if (mongoose.connection.name !== expectedDatabase) {
      throw new ForecastTrialSetupError("DATABASE_MISMATCH");
    }
    reportStage("module_loading");
    const { default: Dataset } = await import("../models/Dataset.js");
    const { default: PredictionRun } =
      await import("../models/PredictionRun.js");
    const { SURVEILLANCE_DISEASES } =
      await import("../constants/surveillanceMethodology.js");
    const {
      refreshMonthlyDistrictPredictions,
      FORECAST_SCHEMA_VERSION,
      isUsablePredictionRun,
    } =
      await import("../services/predictions/refreshMonthlyDistrictPredictions.js");
    reportStage("dataset_lookup");
    const dataset = await Dataset.findOne({
      _id: datasetId,
      status: "validated",
      providerType: "cesu",
    })
      .select("_id")
      .lean();
    if (!dataset) throw new ForecastTrialSetupError("DATASET_NOT_FOUND");

    // Stable within one workflow run (including retries), unique across new runs.
    const id = new mongoose.Types.ObjectId(
      createHash("sha256")
        .update(`forecast-write-trial:${repository}:${runId}:${datasetId}`)
        .digest("hex")
        .slice(0, 24),
    );
    reportStage("existing_result_lookup");
    let saved = await PredictionRun.findById(id).lean();
    let reused = Boolean(saved);
    if (!saved) {
      reportStage("forecast_computation");
      const computed = await refreshMonthlyDistrictPredictions({
        datasetId,
        horizonMonths: 1,
        force: true,
        dryRun: true,
        signal: controller.signal,
      });
      reportStage("forecast_validation");
      validateForecastWriteTrial(
        computed,
        datasetId,
        SURVEILLANCE_DISEASES,
        FORECAST_SCHEMA_VERSION,
      );
      controller.signal.throwIfAborted();
      // Whitelist fields; append a new success record without replacing prior forecasts.
      try {
        reportStage("database_insert");
        await PredictionRun.create({
          _id: id,
          model: "prophet",
          granularity: "monthly_disease_district_cases",
          datasetScope: dataset._id,
          basisDatasetId: dataset._id,
          trigger: "manual",
          status: "success",
          startedAt: new Date(Date.now() - (performance.now() - started)),
          finishedAt: new Date(),
          generatedAt: new Date(),
          errorMessage: null,
          basisYear: computed.basisYear,
          basisMonth: computed.basisMonth,
          forecastTargetYear: computed.forecastTargetYear,
          forecastTargetMonth: computed.forecastTargetMonth,
          forecastHorizonMonths: 1,
          inputFingerprint: computed.inputFingerprint,
          payload: computed.payload,
        });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== 11000
        )
          throw error;
        // Another attempt may have completed the same run; verify the exact record below.
        reused = true;
      }
      reportStage("database_read_back");
      saved = await PredictionRun.findById(id).lean();
    }
    reportStage("saved_result_validation");
    if (
      !saved ||
      saved.status !== "success" ||
      !isUsablePredictionRun(saved, { horizonMonths: 1 })
    ) {
      throw new Error(
        "Saved forecast could not be verified using the API eligibility check.",
      );
    }
    validateForecastWriteTrial(
      { ...saved, dryRun: true },
      datasetId,
      SURVEILLANCE_DISEASES,
      FORECAST_SCHEMA_VERSION,
    );
    reportStage("summary_export");
    await mkdir("forecast-write-artifacts", { recursive: true });
    await writeFile(
      "forecast-write-artifacts/summary.json",
      JSON.stringify(
        {
          predictionRunId: String(id),
          datasetId,
          status: saved.status,
          verifiedReadBack: true,
          reused,
          durationSeconds: Math.round((performance.now() - started) / 1000),
          forecastTargetYear: saved.forecastTargetYear,
          forecastTargetMonth: saved.forecastTargetMonth,
          sourceCommit: process.env.GITHUB_SHA,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "[forecast-write-trial] Forecast saved and read-back validation passed.",
    );
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(
    `[forecast-write-trial] stage=${stage}; ${safeForecastTrialDiagnostic(error)}`,
  );
  process.exitCode = 1;
});
