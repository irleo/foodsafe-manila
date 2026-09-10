// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { readGitHubForecastConfiguration, safeGitHubForecastDiagnostic } from "../services/predictions/githubForecastConfiguration.js";

/** @param {string} environment @returns {Record<string, string | undefined>} */
function configuration(environment) {
  return {
    FORECAST_ENVIRONMENT: environment, GITHUB_ACTIONS: "true",
    GITHUB_REF: `refs/heads/${environment}`, GITHUB_RUN_ID: "123", GITHUB_REPOSITORY: "example/repo",
    FORECAST_MONGO_URI: "mongodb://worker:secret@example.invalid/app", FORECAST_DB_NAME: "app",
    DATASET_ID: "ABCDEF012345678901234567", PREDICTION_RUN_ID: "123456789012345678901234",
  };
}

test("both environment branches can configure the worker", () => {
  for (const environment of ["testing", "production"]) {
    const result = readGitHubForecastConfiguration(configuration(environment));
    assert.equal(result.datasetId, "abcdef012345678901234567");
    assert.equal(result.expectedDatabase, "app");
  }
});

test("cross-environment, missing configuration and invalid IDs fail closed", () => {
  const invalid = [
    { GITHUB_REF: "refs/heads/testing" }, { GITHUB_REF: "refs/pull/1/merge" },
    { FORECAST_ENVIRONMENT: "main" }, { GITHUB_ACTIONS: "false" },
    { GITHUB_RUN_ID: undefined }, { GITHUB_REPOSITORY: undefined },
    { FORECAST_MONGO_URI: undefined, MONGO_URI: "mongodb://example.invalid/production" },
    { FORECAST_DB_NAME: undefined }, { FORECAST_DB_NAME: "admin" },
    { DATASET_ID: "bad" }, { PREDICTION_RUN_ID: "bad" },
  ];
  for (const override of invalid) {
    assert.throws(() => readGitHubForecastConfiguration({ ...configuration("production"), ...override }));
  }
});

test("worker diagnostics never expose raw credentials", () => {
  for (const properties of [{}, { code: 18 }, { code: 13 }, { name: "MongoParseError" }, { name: "MongoServerSelectionError" }]) {
    const error = Object.assign(new Error("mongodb://worker:secret@example.invalid/app"), properties);
    assert.doesNotMatch(safeGitHubForecastDiagnostic(error), /secret|example.invalid/);
  }
});
