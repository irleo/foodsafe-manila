import assert from "node:assert/strict";
import test from "node:test";
import PredictionRun from "../models/PredictionRun.js";
import { dispatchGitHubForecast, startGitHubForecast, usesGitHubForecasts } from "../services/predictions/githubForecastJobs.js";
import { claimGitHubForecast, failGitHubForecast } from "../services/predictions/githubForecastWorkerStore.js";
import { publicRefreshJob } from "../controllers/predictionController.js";

const datasetId = "6a9dc9c12c8dd2a0e7e49ce6";
const jobId = "478a9b04ade4d9ca4a838fee";

test("local is the default; unrecognized execution modes fail closed", () => {
  const previous = process.env.FORECAST_EXECUTION_MODE;
  try {
    delete process.env.FORECAST_EXECUTION_MODE;
    assert.equal(usesGitHubForecasts(), false);
    process.env.FORECAST_EXECUTION_MODE = "github";
    assert.equal(usesGitHubForecasts(), true);
    process.env.FORECAST_EXECUTION_MODE = "typo";
    assert.throws(usesGitHubForecasts);
  } finally {
    if (previous === undefined) delete process.env.FORECAST_EXECUTION_MODE;
    else process.env.FORECAST_EXECUTION_MODE = previous;
  }
});

test("dispatch selects testing and sends IDs as JSON; transport errors hide credentials", async () => {
  const before = { token: process.env.GITHUB_FORECAST_TOKEN, repo: process.env.GITHUB_FORECAST_REPOSITORY };
  process.env.GITHUB_FORECAST_TOKEN = "test-secret";
  process.env.GITHUB_FORECAST_REPOSITORY = "example/repo";
  try {
    await dispatchGitHubForecast(jobId, datasetId, async (url, options) => {
      assert.match(url, /forecast-testing-auto.yml\/dispatches$/);
      assert.deepEqual(JSON.parse(options.body), { ref: "testing", inputs: { datasetId, predictionRunId: jobId } });
      return new Response(null, { status: 204 });
    });
    await assert.rejects(dispatchGitHubForecast(jobId, datasetId, async () => {
      throw new Error("test-secret");
    }), (error) => !error.message.includes("test-secret"));
  } finally {
    for (const [name, value] of [["GITHUB_FORECAST_TOKEN", before.token], ["GITHUB_FORECAST_REPOSITORY", before.repo]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("queued/executing remote jobs cannot trigger the frontend local-resume path", () => {
  for (const executionPhase of ["queued", "executing"]) {
    const result = publicRefreshJob({ _id: jobId, basisDatasetId: datasetId, status: "running", executionBackend: "github", executionPhase });
    assert.equal(result.workerActive, true);
    assert.equal(result.status, "running");
    assert.equal(result.executionPhase, executionPhase);
  }
});

test("worker claim is scoped, atomic, queued-only, and excludes expired jobs", async (t) => {
  t.mock.method(PredictionRun, "findOneAndUpdate", (filter, update) => {
    assert.equal(String(filter._id), jobId);
    assert.equal(String(filter.datasetScope), datasetId);
    assert.equal(filter.executionPhase, "queued");
    assert.equal(filter.executionBackend, "github");
    assert.equal(filter.status, "running");
    assert.ok(filter.executionExpiresAt.$gt instanceof Date);
    assert.equal(update.$set.workerRunId, "run-1");
    return { lean: async () => null };
  });
  assert.equal(await claimGitHubForecast(jobId, datasetId, "run-1"), null);
});

test("failure writes require the same worker and never overwrite success", async (t) => {
  t.mock.method(PredictionRun, "updateOne", async (filter, update) => {
    assert.equal(filter.workerRunId, "run-1");
    assert.equal(filter.status, "running");
    assert.equal(filter.executionPhase, "executing");
    assert.equal(update.$set.status, "failed");
  });
  await failGitHubForecast(jobId, "run-1");
});

test("duplicate active scope reuses the existing job without dispatching", async (t) => {
  t.mock.method(PredictionRun, "updateOne", async () => ({}));
  t.mock.method(PredictionRun, "create", async () => { throw Object.assign(new Error("duplicate"), { code: 11000 }); });
  t.mock.method(PredictionRun, "findOne", () => ({ lean: async () => ({ _id: jobId, status: "running" }) }));
  const result = await startGitHubForecast({ datasetId });
  assert.equal(result._id, jobId);
});

test("dispatch rejection fails only the unclaimed queued job", async (t) => {
  const previous = process.env.GITHUB_FORECAST_TOKEN;
  delete process.env.GITHUB_FORECAST_TOKEN;
  const writes = [];
  try {
    t.mock.method(PredictionRun, "updateOne", async (filter, update) => { writes.push({ filter, update }); });
    t.mock.method(PredictionRun, "create", async (job) => {
      assert.equal(job.status, "running");
      assert.equal(job.executionPhase, "queued");
      return { ...job, _id: jobId };
    });
    await assert.rejects(startGitHubForecast({ datasetId }));
    assert.equal(writes[1].filter.executionPhase, "queued");
    assert.equal(writes[1].update.$set.status, "failed");
  } finally {
    if (previous !== undefined) process.env.GITHUB_FORECAST_TOKEN = previous;
  }
});
