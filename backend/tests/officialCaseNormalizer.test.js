import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeTemplateRow,
  parseExcelDate,
} from "../services/officialCaseNormalizer.js";

const validRow = {
  district: "District 1",
  barangay: "Barangay 1",
  disease: "Cholera",
  report_date: "2026-03-10",
  case_classification: "Confirmed",
  cases: 3,
};

test("processed CESU rows use report_date as the surveillance period", () => {
  const result = normalizeTemplateRow(validRow);

  assert.equal(result.ok, true);
  assert.equal(result.value.year, 2026);
  assert.equal(result.value.month, 3);
  assert.equal(result.value.surveillanceDate.toISOString(), "2026-03-10T00:00:00.000Z");
  assert.equal(result.value.dateReported.toISOString(), "2026-03-10T00:00:00.000Z");
  assert.equal(result.value.dateOfOnset, undefined);
  assert.equal(result.value.surveillanceDateBasis, "report_date");
});

test("processed CESU rows reject the retired date_of_onset-only shape", () => {
  const result = normalizeTemplateRow({
    ...validRow,
    report_date: undefined,
    date_of_onset: "2026-03-10",
  });

  assert.equal(result.ok, false);
  assert.equal(result.field, "reportDate");
  assert.match(result.message, /Report date/);
});

test("text dates accept only the documented YYYY-MM-DD format", () => {
  assert.equal(parseExcelDate("2026-03-10").toISOString(), "2026-03-10T00:00:00.000Z");
  assert.equal(parseExcelDate("10/03/2026"), null);
  assert.equal(parseExcelDate("March 10, 2026"), null);
  assert.equal(parseExcelDate("2026-02-30"), null);
});

test("ambiguous and malformed template dates fail row validation", () => {
  for (const reportDate of ["10/03/2026", "03/10/2026", "not-a-date"]) {
    const result = normalizeTemplateRow({ ...validRow, report_date: reportDate });
    assert.equal(result.ok, false);
    assert.equal(result.field, "reportDate");
    assert.match(result.message, /YYYY-MM-DD/);
  }
});
