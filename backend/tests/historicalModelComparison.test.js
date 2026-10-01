// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { historicalModelWinner } from "../services/predictions/historicalModelComparison.js";

test("compares precision hidden by two-decimal formatting", () => {
  assert.equal((1.001).toFixed(2), (1.004).toFixed(2));
  assert.equal(historicalModelWinner(1.001, 1.004), "prophet");
  assert.equal(historicalModelWinner(1.004, 1.001), "seasonal_naive");
});

test("equal MAEs are ties, including zero", () => {
  assert.equal(historicalModelWinner(0, 0), "tie");
  assert.equal(historicalModelWinner(2.5, 2.5), "tie");
});

test("missing and invalid values cannot select a winner", () => {
  for (const value of [null, undefined, NaN, Infinity, -1]) {
    assert.equal(historicalModelWinner(value, 1), null);
    assert.equal(historicalModelWinner(1, value), null);
  }
});
