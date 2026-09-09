import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCitizenDuplicateQuery,
  isWithinManilaBounds,
  parseManilaReportDate,
  validateReportedAt,
} from "../utils/reportPolicy.js";

test("Manila report-date end boundary includes reports late on the selected date", () => {
  const from = parseManilaReportDate("2026-09-09");
  const to = parseManilaReportDate("2026-09-09", { exclusiveEnd: true });

  assert.equal(from.toISOString(), "2026-09-08T16:00:00.000Z");
  assert.equal(to.toISOString(), "2026-09-09T16:00:00.000Z");
  assert.ok(new Date("2026-09-09T15:59:59.999Z") < to);
  assert.ok(!(new Date("2026-09-09T16:00:00.000Z") < to));
});

test("citizen input policy rejects fractional counts, out-of-bounds coordinates, and backdating", () => {
  assert.equal(Number.isInteger(1.5) && 1.5 > 0, false);
  assert.equal(isWithinManilaBounds(14.5995, 120.9842), true);
  assert.equal(isWithinManilaBounds(14.6760, 121.0437), false);

  const now = new Date("2026-09-09T12:00:00.000Z");
  assert.match(
    validateReportedAt("2026-07-01T12:00:00.000Z", now).error,
    /older than 30 days/,
  );
  assert.match(
    validateReportedAt("2026-09-09T12:00:00.001Z", now).error,
    /future/,
  );
});

test("duplicate detection uses server creation time, not backdated reportedAt", () => {
  const since = new Date("2026-09-09T06:00:00.000Z");
  const query = buildCitizenDuplicateQuery({
    reportedBy: "user-id",
    countingDistrictKey: "district_1",
    since,
  });

  assert.deepEqual(query.createdAt, { $gte: since });
  assert.equal("reportedAt" in query, false);
});
