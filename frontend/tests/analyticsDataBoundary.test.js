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

test("declared official coverage supplies zero months before the first valid case row", () => {
  const view = buildAnalyticsCasesViewModel(
    [{
      year: 2022,
      month: 2,
      district: "District 1",
      disease: "Cholera",
      caseClassification: "confirmed",
      cases: 2,
    }],
    {
      coverageStart: "2022-01-01T00:00:00.000Z",
      coverageEnd: "2022-03-31T23:59:59.999Z",
    },
  );

  assert.deepEqual(
    view.monthlyTimelineData.map(({ date, confirmedCases }) => ({ date, confirmedCases })),
    [
      { date: "2022-01-01", confirmedCases: 0 },
      { date: "2022-02-01", confirmedCases: 2 },
      { date: "2022-03-01", confirmedCases: 0 },
    ],
  );
});

test("official coverage retains all Manila districts in zero-case selections", () => {
  const view = buildAnalyticsCasesViewModel(
    [{
      year: 2026,
      month: 1,
      district: "District 1",
      disease: "Cholera",
      caseClassification: "confirmed",
      cases: 12,
    }],
    {
      coverageStart: "2025-01-01T00:00:00.000Z",
      coverageEnd: "2026-02-28T23:59:59.999Z",
      coveredDistricts: Array.from({ length: 6 }, (_, index) => `District ${index + 1}`),
    },
  );

  assert.equal(view.districtsCovered, 6);
  assert.equal(view.districtData.length, 6);
  assert.equal(view.districtData.find((row) => row.district === "District 6")?.cases, 0);
});

test("coverage end controls the headline year and YoY uses matching months", () => {
  const view = buildAnalyticsCasesViewModel(
    [
      { year: 2025, month: 1, district: "District 1", disease: "Cholera", cases: 10 },
      { year: 2025, month: 2, district: "District 1", disease: "Cholera", cases: 10 },
      { year: 2025, month: 3, district: "District 1", disease: "Cholera", cases: 100 },
    ],
    {
      coverageStart: "2025-01-01T00:00:00.000Z",
      coverageEnd: "2026-02-28T23:59:59.999Z",
    },
  );

  assert.equal(view.latestYear, 2026);
  assert.equal(view.latestYearCases, 0);
  assert.equal(view.previousYearCases, 20);
  assert.equal(view.yoyPct, -100);
  assert.equal(view.comparisonIsPartial, true);
  assert.equal(view.hasComparablePeriod, true);
});

test("YoY is unavailable when the matching prior-year months are outside coverage", () => {
  const view = buildAnalyticsCasesViewModel([], {
    coverageStart: "2025-08-01T00:00:00.000Z",
    coverageEnd: "2026-02-28T23:59:59.999Z",
  });

  assert.equal(view.latestYear, 2026);
  assert.equal(view.hasComparablePeriod, false);
  assert.equal(view.yoyPct, null);
});
