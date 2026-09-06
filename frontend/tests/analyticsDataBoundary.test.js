import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalyticsCasesViewModel } from "../src/modules/analytics/utils/analyticsCasesViewModel.js";
import { buildReportVolumeRows } from "../src/modules/analytics/utils/reportAnalyticsBuilders.js";

test("adding or validating a report does not change official analytics", () => {
  const officialRows = [
    { year: 2026, month: 1, district: "District 1", disease: "Cholera", cases: 4 },
  ];
  const before = buildAnalyticsCasesViewModel(officialRows);
  const after = buildAnalyticsCasesViewModel(officialRows);

  assert.deepEqual(after, before);
  assert.equal(after.latestYearCases, 4);
});

test("validated and classified citizen records remain reported-volume rows", () => {
  const rows = buildReportVolumeRows([
    { reportedAt: "2026-01-01T00:00:00.000Z", currentStatus: "suspected" },
    { reportedAt: "2026-01-02T00:00:00.000Z", currentStatus: "probable" },
    { reportedAt: "2026-01-03T00:00:00.000Z", currentStatus: "confirmed" },
  ]);

  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.caseClassification === "reported"));
  assert.ok(rows.every((row) => row.sourceType === "citizen_report"));
});
