// @ts-check
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose from "mongoose";

/** @typedef {{status: string, forecast?: unknown[], backtestSeries?: unknown[]}} ModelResult */
/** @typedef {{disease: string, districts: Array<{district: string, models: {prophet: ModelResult}}>, wholeManila: {status: string}}} DiseaseResult */

/** Generate a test artifact using a read-only database connection. @returns {Promise<void>} */
async function main() {
  const uri = process.env.TEST_MONGO_URI?.trim();
  const datasetId = process.env.DATASET_ID?.trim();
  if (!uri)
    throw new Error(
      "Set TEST_MONGO_URI to a read-only testing database connection.",
    );
  if (!datasetId || !/^[a-f\d]{24}$/i.test(datasetId)) {
    throw new Error("DATASET_ID must be a 24-character MongoDB ObjectId.");
  }
  if (process.env.FORECAST_DRY_RUN !== "true") {
    throw new Error(
      "This entry point requires FORECAST_DRY_RUN=true and never supports writes.",
    );
  }

  // Set before importing models, preventing implicit collection/index creation.
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  const controller = new AbortController();
  const cancel = () =>
    controller.abort(new Error("Forecast dry run cancelled."));
  const timer = setTimeout(
    () => controller.abort(new Error("Forecast dry run exceeded 30 minutes.")),
    30 * 60_000,
  );
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  const started = performance.now();
  try {
    await mongoose.connect(uri, {
      autoCreate: false,
      autoIndex: false,
      maxPoolSize: 3,
      serverSelectionTimeoutMS: 15_000,
      socketTimeoutMS: 60_000,
    });
    const { refreshMonthlyDistrictPredictions } =
      await import("../services/predictions/refreshMonthlyDistrictPredictions.js");
    const result = await refreshMonthlyDistrictPredictions({
      datasetId,
      horizonMonths: 1,
      force: true,
      dryRun: true,
      signal: controller.signal,
    });
    const diseases = /** @type {DiseaseResult[]} */ (result.payload.diseases);
    const models = diseases.flatMap((disease) =>
      disease.districts.map((district) => ({
        disease: disease.disease,
        district: district.district,
        status: district.models.prophet.status,
        forecastPoints: district.models.prophet.forecast?.length ?? 0,
        backtestPoints: district.models.prophet.backtestSeries?.length ?? 0,
      })),
    );
    const summary = {
      dryRun: true,
      durationSeconds: Math.round((performance.now() - started) / 1000),
      nodeVersion: process.version,
      sourceCommit: process.env.GITHUB_SHA ?? null,
      successfulModels: models.filter((model) => model.status === "success")
        .length,
      failedModels: models.filter((model) => model.status === "failed").length,
      insufficientModels: models.filter(
        (model) => model.status === "insufficient_data",
      ).length,
      models,
    };
    const outputDirectory = resolve("forecast-artifacts");
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      resolve(outputDirectory, "forecast.json"),
      JSON.stringify(result, null, 2) + "\n",
      { flag: "wx" },
    );
    await writeFile(
      resolve(outputDirectory, "summary.json"),
      JSON.stringify(summary, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(
      `[forecast-dry-run] completed in ${summary.durationSeconds}s; successful=${summary.successfulModels}; failed=${summary.failedModels}; insufficient=${summary.insufficientModels}`,
    );
    // A partial payload is useful for diagnosis, but must not produce a green run.
    if (summary.failedModels > 0 || summary.successfulModels === 0) {
      throw new Error(
        "Forecast validation failed; inspect the downloaded summary artifact.",
      );
    }
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
    await mongoose.disconnect();
  }
}

main().catch(() => {
  // Workflow logs are public: do not print database errors, URIs, or data rows.
  console.error(
    "[forecast-dry-run] Failed. Check the testing secret, dataset ID, database network access, Python setup, and any available summary artifact.",
  );
  process.exitCode = 1;
});
