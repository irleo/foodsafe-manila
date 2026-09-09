import test from "node:test";
import assert from "node:assert/strict";
import { assertOfficialCaseRows } from "../services/analyticalCaseService.js";
import { groupReportRowsByStatus } from "../services/reportAnalyticsService.js";
import {
  aggregateWholeManila,
  isUsablePredictionRun,
} from "../services/predictions/refreshMonthlyDistrictPredictions.js";

test("official analytics rejects report-shaped rows regardless of validation state", () => {
  assert.doesNotThrow(() => assertOfficialCaseRows([{ sourceType: "official_upload" }]));

  for (const row of [
    { sourceType: "surveillance_report", caseClassification: "reported" },
    { sourceType: "surveillance_report", caseClassification: "confirmed" },
    { sourceType: "surveillance_report", caseClassification: "confirmed", isCounted: true },
  ]) {
    assert.throws(() => assertOfficialCaseRows([row]), {
      code: "NON_OFFICIAL_ANALYTICS_ROW",
    });
  }
});

test("report workflow aggregation remains independent of official analytics", () => {
  const counts = groupReportRowsByStatus([
    { currentStatus: "reported", caseCount: 1, isCounted: true },
    { currentStatus: "confirmed", caseCount: 2, isCounted: true },
    { currentStatus: "ruled_out", caseCount: 1, isCounted: false },
  ]);

  assert.deepEqual(counts, {
    reported: 1,
    suspected: 0,
    probable: 0,
    confirmed: 2,
    ruledOut: 1,
  });
});

test("prediction cache accepts only current, populated, horizon-matched forecasts", () => {
  const validRun = {
    forecastHorizonMonths: 1,
    forecastTargetYear: 2026,
    forecastTargetMonth: 3,
    payload: {
      schemaVersion: 10,
      forecastHorizonMonths: 1,
      forecastTargetYear: 2026,
      forecastTargetMonth: 3,
      diseases: [{
        disease: "Cholera",
        districts: [{
          status: "success",
          nextForecast: { year: 2026, month: 3, predictedCases: 4 },
        }],
      }],
    },
  };

  assert.equal(isUsablePredictionRun(validRun, { horizonMonths: 1 }), true);
  assert.equal(isUsablePredictionRun({ ...validRun, payload: { ...validRun.payload, schemaVersion: 9 } }, { horizonMonths: 1 }), false);
  assert.equal(isUsablePredictionRun({ ...validRun, payload: { ...validRun.payload, diseases: [] } }, { horizonMonths: 1 }), false);
  assert.equal(isUsablePredictionRun(validRun, { horizonMonths: 2 }), false);
  assert.equal(isUsablePredictionRun({
    ...validRun,
    payload: {
      ...validRun.payload,
      diseases: [{ disease: "Cholera", districts: [] }],
    },
  }, { horizonMonths: 1 }), false);
});

test("prediction cache requires every consecutive month in the requested horizon", () => {
  const run = {
    forecastHorizonMonths: 3,
    forecastTargetYear: 2026,
    forecastTargetMonth: 11,
    payload: {
      schemaVersion: 10,
      forecastHorizonMonths: 3,
      diseases: [{
        disease: "Cholera",
        districts: [{
          status: "success",
          models: {
            prophet: {
              status: "success",
              forecast: [
                { year: 2026, month: 11, predictedCases: 4 },
              ],
            },
          },
        }],
      }],
    },
  };

  assert.equal(isUsablePredictionRun(run, { horizonMonths: 3 }), false);

  run.payload.diseases[0].districts[0].models.prophet.forecast.push(
    { year: 2026, month: 12, predictedCases: 5 },
    { year: 2027, month: 1, predictedCases: 6 },
  );
  assert.equal(isUsablePredictionRun(run, { horizonMonths: 3 }), true);
});

test("Whole-Manila aggregation preserves the complete district horizon", () => {
  const districts = Array.from({ length: 6 }, (_, districtIndex) => ({
    district: `District ${districtIndex + 1}`,
    historicalSeries: [],
    models: {
      prophet: {
        status: "success",
        backtestSeries: [],
        forecast: [
          { year: 2026, month: 11, predictedCases: 1, rawPredictedCases: 1, isPrimaryTarget: true },
          { year: 2026, month: 12, predictedCases: 2, rawPredictedCases: 2 },
          { year: 2027, month: 1, predictedCases: 3, rawPredictedCases: 3 },
        ],
      },
    },
  }));

  const aggregate = aggregateWholeManila(districts, 3);

  assert.equal(aggregate.status, "success");
  assert.deepEqual(
    aggregate.forecast.map(({ year, month, predictedCases }) => ({
      year,
      month,
      predictedCases,
    })),
    [
      { year: 2026, month: 11, predictedCases: 6 },
      { year: 2026, month: 12, predictedCases: 12 },
      { year: 2027, month: 1, predictedCases: 18 },
    ],
  );

  districts[5].models.prophet.forecast.pop();
  assert.equal(aggregateWholeManila(districts, 3).status, "incomplete_coverage");
});
