// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import Dataset from "../models/Dataset.js";
import OfficialCase from "../models/OfficialCase.js";
import { getMobileOfficialAnalytics } from "../controllers/mobileController.js";

/** @param {Record<string, unknown>} query */
async function request(query = {}) {
  let status = 200;
  let body;
  const response = {
    /** @param {number} value */
    status(value) { status = value; return response; },
    /** @param {any} value */
    json(value) { body = value; return response; },
  };
  await getMobileOfficialAnalytics({ query }, response);
  return { status, body };
}

test("guest analytics coalesces reads, caches responses, bounds keys and refreshes after expiry", async (t) => {
  let reads = 0;
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  t.mock.method(Dataset, "findOne", () => ({ sort: () => ({ select: () => ({ lean: async () => null }) }) }));
  t.mock.method(OfficialCase, "find", () => ({ select: () => ({ limit: () => ({ lean: async () => {
    reads += 1;
    return [{ district: "District 1", disease: "Cholera", year: 2026, month: 1, epidemiologicalYear: 2026, epidemiologicalWeek: 1, cases: 7 }];
  } }) }) }));
  const results = await Promise.all(Array.from({ length: 20 }, () => request()));
  assert.equal(reads, 1);
  for (const result of results) {
    assert.equal(result.status, 200);
    assert.equal(result.body.totalCases, 7);
    assert.equal(result.body.overview.cumulativeCases, 7);
  }
  const filtered = await request({ district: "District 2" });
  assert.equal(filtered.body.totalCases, 0);
  assert.equal(reads, 1);
  for (const query of [{ period: "random" }, { period: ["total_cumulative"] }, { district: "random" }, { disease: { $ne: "" } }]) {
    assert.equal((await request(query)).status, 400);
  }
  assert.equal(reads, 1);
  clock += 60_001;
  assert.equal((await request()).body.totalCases, 7);
  assert.equal(reads, 2);
});
