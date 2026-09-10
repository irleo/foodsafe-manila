import assert from "node:assert/strict";
import test from "node:test";
import { ForecastTrialSetupError, readForecastTrialConfiguration, safeForecastTrialDiagnostic } from "../services/predictions/forecastWriteTrialDiagnostics.js";

function environment() {
  return {
    GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/testing", CONFIRM_TEST_WRITE: "true",
    GITHUB_RUN_ID: "123", GITHUB_REPOSITORY: "example/repo",
    TEST_FORECAST_WRITE_MONGO_URI: "mongodb+srv://fake:secret@example.invalid/testing",
    TEST_FORECAST_DB_NAME: "testing", DATASET_ID: "ABCDEF012345678901234567",
  };
}

test("normalizes ObjectIds while preserving configured testing settings", () => {
  const result = readForecastTrialConfiguration(environment());
  assert.equal(result.datasetId, "abcdef012345678901234567");
  assert.equal(result.expectedDatabase, "testing");
});

test("identifies missing environment variable separately from missing write secret", () => {
  for (const [key, code] of [["TEST_FORECAST_DB_NAME", "MISSING_DATABASE_NAME"], ["TEST_FORECAST_WRITE_MONGO_URI", "MISSING_WRITE_URI"]]) {
    const env = environment();
    delete env[key];
    assert.throws(() => readForecastTrialConfiguration(env), (error) => error instanceof ForecastTrialSetupError && error.code === code);
  }
});

test("rejects unconfirmed runs, production branch, system database, malformed ID", () => {
  for (const override of [
    { CONFIRM_TEST_WRITE: "false" }, { GITHUB_REF: "refs/heads/production" },
    { TEST_FORECAST_DB_NAME: "admin" }, { DATASET_ID: "ObjectId(abc)" },
  ]) assert.throws(() => readForecastTrialConfiguration({ ...environment(), ...override }));
});

test("safe diagnostics never emit driver messages or sensitive stack traces", () => {
  for (const properties of [{ code: 18 }, { code: 13 }, { name: "MongoParseError" }, { name: "MongoServerSelectionError" }, {}]) {
    const error = Object.assign(new Error(environment().TEST_FORECAST_WRITE_MONGO_URI), properties);
    const message = safeForecastTrialDiagnostic(error);
    assert.ok(!message.includes("fake:") && !message.includes("example.invalid"));
    assert.ok(!message.includes("mongodb+srv://"));
  }
});

test("setup diagnostics explain where the database variable belongs", () => {
  const message = safeForecastTrialDiagnostic(new ForecastTrialSetupError("MISSING_DATABASE_NAME"));
  assert.match(message, /Environment variables \(not secrets\)/);
});
