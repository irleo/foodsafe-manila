// @ts-check
import mongoose from "mongoose";
import PredictionRun from "../../models/PredictionRun.js";

export const GITHUB_JOB_LIFETIME_MS = 45 * 60_000;

class ForecastDispatchError extends Error {}

/** Fixed server-log diagnostics; never include GitHub response bodies or tokens.
 * @param {number} status
 */
function dispatchStatusMessage(status) {
  const hints = new Map([
    [401, "Token is invalid or expired."],
    [403, "Check Actions write permission, repository access, organization approval, and rate limits."],
    [404, "Check repository name, token repository access, and workflow presence on the default branch."],
    [422, "Check the configured environment branch, workflow_dispatch trigger, and environment/datasetId/predictionRunId inputs."],
    [400, "GitHub rejected the request format or API version."],
    [429, "GitHub rate limit reached."],
  ]);
  return `GITHUB_FORECAST_HTTP_${status}: ${hints.get(status) || "GitHub rejected the dispatch request."}`;
}

export function usesGitHubForecasts() {
  const mode = process.env.FORECAST_EXECUTION_MODE || "local";
  if (!["local", "github"].includes(mode)) throw new Error("Invalid forecast execution mode.");
  return mode === "github";
}

/** @param {string} jobId @param {string} datasetId @param {typeof fetch} request */
export async function dispatchGitHubForecast(jobId, datasetId, request = fetch) {
  const repository = process.env.GITHUB_FORECAST_REPOSITORY?.trim() || "";
  const token = process.env.GITHUB_FORECAST_TOKEN?.trim();
  const environment = process.env.GITHUB_FORECAST_ENVIRONMENT?.trim();
  if (environment !== "testing" && environment !== "production") {
    throw new ForecastDispatchError("GITHUB_FORECAST_CONFIG: Set GITHUB_FORECAST_ENVIRONMENT to testing or production on the API backend.");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new ForecastDispatchError("GITHUB_FORECAST_CONFIG: Set GITHUB_FORECAST_REPOSITORY on the API backend to owner/repository (not a URL).");
  }
  if (!token) throw new ForecastDispatchError("GITHUB_FORECAST_CONFIG: Set GITHUB_FORECAST_TOKEN on the API backend, not only in GitHub Environment secrets.");
  try {
    const response = await request(`https://api.github.com/repos/${repository}/actions/workflows/forecast-job.yml/dispatches`, {
      method: "POST",
      redirect: "error",
      headers: {
        Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`,
        "Content-Type": "application/json", "X-GitHub-Api-Version": "2026-03-10",
      },
      body: JSON.stringify({ ref: environment, inputs: { environment, datasetId, predictionRunId: jobId } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new ForecastDispatchError(dispatchStatusMessage(response.status));
    // Dispatch has been accepted. Body cleanup must not turn it into a failed job.
  } catch (error) {
    if (error instanceof ForecastDispatchError) throw error;
    // Do not expose response bodies, request credentials, or transport errors.
    throw new ForecastDispatchError("GITHUB_FORECAST_NETWORK: Dispatch timed out or GitHub could not be reached. Check API-backend outbound connectivity.");
  }
}

/** @param {{datasetId: string | mongoose.Types.ObjectId, trigger?: "manual" | "official_upload" | "monthly_fallback"}} options */
export async function startGitHubForecast({ datasetId, trigger = "manual" }) {
  const scope = new mongoose.Types.ObjectId(datasetId);
  // One indexed scope, never a broad repair. Expired workers cannot publish later.
  await PredictionRun.updateOne({
    model: "prophet", granularity: "monthly_disease_district_cases", datasetScope: scope,
    status: "running", executionBackend: "github", executionExpiresAt: { $lte: new Date() },
  }, { $set: { status: "failed", executionPhase: "finished", finishedAt: new Date(), errorMessage: "GitHub forecast exceeded its time limit. Refresh to retry." } });
  let job;
  try {
    job = await PredictionRun.create({
      model: "prophet", granularity: "monthly_disease_district_cases", datasetScope: scope,
      basisDatasetId: scope, trigger, status: "running", startedAt: new Date(),
      forecastHorizonMonths: 1, executionBackend: "github", executionPhase: "queued",
      executionExpiresAt: new Date(Date.now() + GITHUB_JOB_LIFETIME_MS),
    });
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== 11000) throw error;
    const existing = await PredictionRun.findOne({ model: "prophet", granularity: "monthly_disease_district_cases", datasetScope: scope, status: "running" }).lean();
    if (!existing) throw error;
    return existing;
  }
  try {
    await dispatchGitHubForecast(String(job._id), String(scope));
  } catch (error) {
    // An ambiguous HTTP timeout must not fail a job already claimed by GitHub.
    await PredictionRun.updateOne({ _id: job._id, status: "running", executionPhase: "queued" }, {
      $set: { status: "failed", executionPhase: "finished", finishedAt: new Date(), errorMessage: "Forecast dispatch failed. Refresh the forecast to retry." },
    });
    throw error;
  }
  return job;
}
