import assert from "node:assert/strict";
import test from "node:test";
import { boundedForecastMap } from "../services/predictions/boundedForecastMap.js";
import { calculateSurveillanceThreshold } from "../services/surveillanceThresholdService.js";
import Dataset from "../models/Dataset.js";
import { incrementalBacktestPlan } from "../services/predictions/refreshMonthlyDistrictPredictions.js";

test("unchanged history reuses backtests, while a historical revision forces recomputation", () => {
  const historicalSeries = Array.from({ length: 49 }, (_, index) => ({ year: 2022 + Math.floor(index / 12), month: index % 12 + 1, cases: index }));
  const backtestSeries = historicalSeries.slice(-19).map((point) => ({ ...point, actualCases: point.cases, predictedCases: point.cases }));
  const previous = { historicalSeries, models: { prophet: { status: "success", backtestSeries, forecast: [{ year: 2026, month: 2, predictedCases: 49, isPrimaryTarget: true }] } } };
  const current = [...historicalSeries.map(({ cases, ...point }) => ({ ...point, y: cases })), { year: 2026, month: 2, y: 50 }];
  const plan = incrementalBacktestPlan(previous, current);
  assert.equal(plan.backtestMonths, 0);
  assert.equal(plan.reusedBacktests.at(-1).actualCases, 50);
  assert.equal(plan.reusedBacktests.at(-1).predictedCases, 49);
  current[0].y = 99;
  assert.equal(incrementalBacktestPlan(previous, current).backtestMonths, 19);
});

test("bounded models overlap at most twice and retain district order", async () => {
  let active = 0;
  let peak = 0;
  const result = await boundedForecastMap([1, 2, 3, 4, 5, 6], 2, async (value) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
    return value * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(result, [2, 4, 6, 8, 10, 12]);
});

test("a failed operation drains active work and does not launch more", async () => {
  const calls = [];
  let drained = false;
  await assert.rejects(boundedForecastMap([1, 2, 3, 4], 2, async (value) => {
    calls.push(value);
    if (value === 1) throw new Error("cancelled");
    await new Promise((resolve) => setImmediate(resolve));
    drained = true;
  }), /cancelled/);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(drained, true);
});

test("prepared threshold inputs preserve five-year population-SD formula and district filtering without database reads", async (t) => {
  t.mock.method(Dataset, "findById", () => { throw new Error("Unexpected database read"); });
  const intervals = [{ start: new Date("2020-01-01Z"), end: new Date("2025-12-31T23:59:59.999Z") }];
  const preparedInput = {
    dataset: { _id: "test-scope", status: "validated" },
    disease: "Cholera",
    context: { verifiedCoverageByDistrict: new Map(Array.from({ length: 6 }, (_, i) => [`District ${i + 1}`, intervals])) },
    rows: [1, 2, 3, 4, 5].flatMap((cases, index) => [
      { year: 2021 + index, month: 1, cases, district: "District 1", caseClassification: "confirmed" },
      { year: 2021 + index, month: 1, cases: 100, district: "District 2", caseClassification: "confirmed" },
    ]),
  };
  const options = { datasetId: "test-scope", disease: "Cholera", district: "District 1", targetYear: 2026, targetMonth: 1, evaluationMode: "forecast", preparedInput };
  const result = await calculateSurveillanceThreshold(options);
  assert.equal(result.baselineMean, 3);
  assert.equal(result.standardDeviation, Math.sqrt(2));
  assert.equal(result.evaluationThresholds.alert, 3 + Math.sqrt(2));
  assert.equal(result.evaluationThresholds.epidemic, 3 + 2 * Math.sqrt(2));
  const city = await calculateSurveillanceThreshold({ ...options, district: undefined });
  assert.equal(city.baselineMean, 103);
  const excluded = await calculateSurveillanceThreshold({ ...options, excludedPeriods: [{ startYear: 2025, startMonth: 1, endYear: 2025, endMonth: 1 }] });
  assert.equal(excluded.baselinePeriods.find((p) => p.year === 2020).cases, 0);
  assert.equal(excluded.baselineMean, 2);
  await assert.rejects(calculateSurveillanceThreshold({ ...options, datasetId: "different" }), /scope/);
});
