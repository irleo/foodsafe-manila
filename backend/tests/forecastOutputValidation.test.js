import assert from "node:assert/strict";
import test from "node:test";
import { validateForecastOutput } from "../services/predictions/forecastOutputValidation.js";

const datasetId = "a12345678901234567890123b";
const diseases = ["Test disease"];

function fixture() {
  const forecast = (predictedCases) => ({
    status: "success",
    forecast: [{ year: 2026, month: 1, isPrimaryTarget: true, predictedCases }],
  });
  return {
    dryRun: true, status: "success", basisDatasetId: datasetId, datasetScope: datasetId,
    basisYear: 2025, basisMonth: 12, forecastTargetYear: 2026, forecastTargetMonth: 1,
    forecastHorizonMonths: 1,
    payload: {
      schemaVersion: 10, datasetScope: datasetId, forecastHorizonMonths: 1,
      basisYear: 2025, basisMonth: 12, forecastTargetYear: 2026, forecastTargetMonth: 1,
      diseases: [{
        disease: diseases[0],
        districts: Array.from({ length: 6 }, (_, index) => ({
          district: `District ${index + 1}`, models: { prophet: forecast(index + 1) },
        })),
        wholeManila: forecast(21),
      }],
    },
  };
}

test("accepts complete forecasts across a December-to-January boundary", () => {
  assert.doesNotThrow(() => validateForecastOutput(fixture(), datasetId, diseases, 10));
});

test("rejects a valid-looking forecast for a different database dataset", () => {
  assert.throws(() => validateForecastOutput(fixture(), "b12345678901234567890123a", diseases, 10));
});

test("rejects partial models even when the top-level run claims success", () => {
  const data = fixture();
  data.payload.diseases[0].districts[2].models.prophet.status = "failed";
  assert.throws(() => validateForecastOutput(data, datasetId, diseases, 10));
});

test("rejects duplicated districts masquerading as full coverage", () => {
  const data = fixture();
  data.payload.diseases[0].districts[5].district = "District 1";
  assert.throws(() => validateForecastOutput(data, datasetId, diseases, 10));
});

test("rejects incoherent city totals", () => {
  const data = fixture();
  data.payload.diseases[0].wholeManila.forecast[0].predictedCases = 99;
  assert.throws(() => validateForecastOutput(data, datasetId, diseases, 10));
});

test("rejects stale targets, schema versions, and non-finite counts", () => {
  const stale = fixture();
  stale.payload.diseases[0].districts[0].models.prophet.forecast[0].month = 12;
  assert.throws(() => validateForecastOutput(stale, datasetId, diseases, 10));
  assert.throws(() => validateForecastOutput(fixture(), datasetId, diseases, 11));
  const invalid = fixture();
  invalid.payload.diseases[0].districts[0].models.prophet.forecast[0].predictedCases = NaN;
  assert.throws(() => validateForecastOutput(invalid, datasetId, diseases, 10));
});

test("rejects missing diseases and mismatched payload basis", () => {
  assert.throws(() => validateForecastOutput(fixture(), datasetId, [...diseases, "Missing"], 10));
  const data = fixture();
  data.payload.basisMonth = 11;
  assert.throws(() => validateForecastOutput(data, datasetId, diseases, 10));
});
