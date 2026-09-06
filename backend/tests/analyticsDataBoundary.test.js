import test from "node:test";
import assert from "node:assert/strict";
import { assertOfficialCaseRows } from "../services/analyticalCaseService.js";
import { groupReportRowsByStatus } from "../services/reportAnalyticsService.js";

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
