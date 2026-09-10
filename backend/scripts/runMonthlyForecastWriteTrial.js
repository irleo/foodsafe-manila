// @ts-check
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { validateForecastWriteTrial } from "../services/predictions/forecastWriteTrialValidation.js";

/** Compute first, insert one successful record, then verify it. @returns {Promise<void>} */
async function main() {
  const uri = process.env.TEST_FORECAST_WRITE_MONGO_URI?.trim();
  const expectedDatabase = process.env.TEST_FORECAST_DB_NAME?.trim();
  const datasetId = process.env.DATASET_ID?.trim();
  const runId = process.env.GITHUB_RUN_ID;
  const repository = process.env.GITHUB_REPOSITORY;
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/testing"
    || process.env.CONFIRM_TEST_WRITE !== "true" || !runId || !repository) {
    throw new Error("Write trials require a confirmed GitHub Actions run on testing.");
  }
  if (!uri || !expectedDatabase || ["admin", "config", "local"].includes(expectedDatabase)
    || !datasetId || !/^[a-f\d]{24}$/i.test(datasetId)) {
    throw new Error("Configure the testing write secret, expected database name, and dataset ID.");
  }
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error("Write trial cancelled."));
  const timer = setTimeout(() => controller.abort(new Error("Write trial timed out.")), 30 * 60_000);
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  const started = performance.now();
  try {
    await mongoose.connect(uri, {
      autoCreate: false, autoIndex: false, maxPoolSize: 3,
      serverSelectionTimeoutMS: 15_000, socketTimeoutMS: 60_000,
    });
    if (mongoose.connection.name !== expectedDatabase) {
      throw new Error("Connected database does not match TEST_FORECAST_DB_NAME.");
    }
    const { default: Dataset } = await import("../models/Dataset.js");
    const { default: PredictionRun } = await import("../models/PredictionRun.js");
    const { SURVEILLANCE_DISEASES } = await import("../constants/surveillanceMethodology.js");
    const { refreshMonthlyDistrictPredictions, FORECAST_SCHEMA_VERSION, isUsablePredictionRun } = await import("../services/predictions/refreshMonthlyDistrictPredictions.js");
    const dataset = await Dataset.findOne({
      _id: datasetId, status: "validated", providerType: "cesu",
    }).select("_id").lean();
    if (!dataset) throw new Error("Validated CESU dataset not found in testing.");

    // Stable within one workflow run (including retries), unique across new runs.
    const id = new mongoose.Types.ObjectId(createHash("sha256")
      .update(`forecast-write-trial:${repository}:${runId}:${datasetId}`)
      .digest("hex").slice(0, 24));
    let saved = await PredictionRun.findById(id).lean();
    let reused = Boolean(saved);
    if (!saved) {
      const computed = await refreshMonthlyDistrictPredictions({
        datasetId, horizonMonths: 1, force: true, dryRun: true, signal: controller.signal,
      });
      validateForecastWriteTrial(computed, datasetId, SURVEILLANCE_DISEASES, FORECAST_SCHEMA_VERSION);
      controller.signal.throwIfAborted();
      // Whitelist fields; append a new success record without replacing prior forecasts.
      try {
        await PredictionRun.create({
          _id: id, model: "prophet", granularity: "monthly_disease_district_cases",
          datasetScope: dataset._id, basisDatasetId: dataset._id, trigger: "manual",
          status: "success", startedAt: new Date(Date.now() - (performance.now() - started)),
          finishedAt: new Date(), generatedAt: new Date(), errorMessage: null,
          basisYear: computed.basisYear, basisMonth: computed.basisMonth,
          forecastTargetYear: computed.forecastTargetYear,
          forecastTargetMonth: computed.forecastTargetMonth, forecastHorizonMonths: 1,
          inputFingerprint: computed.inputFingerprint, payload: computed.payload,
        });
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== 11000) throw error;
        // Another attempt may have completed the same run; verify the exact record below.
        reused = true;
      }
      saved = await PredictionRun.findById(id).lean();
    }
    if (!saved || saved.status !== "success" || !isUsablePredictionRun(saved, { horizonMonths: 1 })) {
      throw new Error("Saved forecast could not be verified using the API eligibility check.");
    }
    validateForecastWriteTrial({ ...saved, dryRun: true }, datasetId, SURVEILLANCE_DISEASES, FORECAST_SCHEMA_VERSION);
    await mkdir("forecast-write-artifacts", { recursive: true });
    await writeFile("forecast-write-artifacts/summary.json", JSON.stringify({
      predictionRunId: String(id), datasetId, status: saved.status, verifiedReadBack: true,
      reused, durationSeconds: Math.round((performance.now() - started) / 1000),
      forecastTargetYear: saved.forecastTargetYear, forecastTargetMonth: saved.forecastTargetMonth,
      sourceCommit: process.env.GITHUB_SHA,
    }, null, 2) + "\n");
    console.log("[forecast-write-trial] Forecast saved and read-back validation passed.");
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error("[forecast-write-trial] Failed. Check testing configuration, dataset coverage, and database permissions. If persistence completed, rerun this same workflow run to verify without duplicating it.");
  process.exitCode = 1;
});
