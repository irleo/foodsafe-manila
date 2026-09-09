import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Dataset from "../models/Dataset.js";
import {
  buildAuthoritativeDatasetScopes,
} from "../services/analyticalCaseService.js";
import {
  selectAuthoritativeOfficialRows,
} from "../services/cumulativeOfficialCaseService.js";

function datasetFixture({ id, createdAt, start, end }) {
  return {
    _id: id,
    createdAt,
    providerType: "cesu",
    providerName: "CESU",
    reportingFrequency: "monthly",
    coverageStart: start,
    coverageEnd: end,
    districtCoverage: [{
      district: "District 1",
      coverageStart: start,
      coverageEnd: end,
      verifiedComplete: true,
    }],
  };
}

test("failed datasets may omit coverage while validated datasets may not", () => {
  const common = {
    name: "Rejected upload",
    originalFileName: "invalid.xlsx",
  };
  const failedError = new Dataset({ ...common, status: "failed" }).validateSync();
  assert.equal(failedError?.errors.coverageStart, undefined);
  assert.equal(failedError?.errors.coverageEnd, undefined);

  const validatedError = new Dataset({ ...common, status: "validated" }).validateSync();
  assert.equal(validatedError?.errors.coverageStart?.kind, "required");
  assert.equal(validatedError?.errors.coverageEnd?.kind, "required");
});

test("newer overlapping CESU uploads replace older rows", () => {
  const oldId = new mongoose.Types.ObjectId("000000000000000000000001");
  const newId = new mongoose.Types.ObjectId("000000000000000000000002");
  const oldDataset = datasetFixture({
    id: oldId,
    createdAt: new Date("2025-02-01T00:00:00.000Z"),
    start: new Date("2025-01-01T00:00:00.000Z"),
    end: new Date("2025-03-31T23:59:59.999Z"),
  });
  const newDataset = datasetFixture({
    id: newId,
    createdAt: new Date("2025-04-01T00:00:00.000Z"),
    start: new Date("2025-03-01T00:00:00.000Z"),
    end: new Date("2025-04-30T23:59:59.999Z"),
  });
  const oldMarch = {
    _id: new mongoose.Types.ObjectId(),
    datasetId: oldId,
    district: "District 1",
    year: 2025,
    month: 3,
  };
  const newMarch = {
    _id: new mongoose.Types.ObjectId(),
    datasetId: newId,
    district: "District 1",
    year: 2025,
    month: 3,
  };

  const selected = selectAuthoritativeOfficialRows(
    [oldMarch, newMarch],
    [newDataset, oldDataset],
  );
  assert.deepEqual(selected.map((row) => String(row.datasetId)), [String(newId)]);

  const scopes = buildAuthoritativeDatasetScopes([oldDataset, newDataset]);
  assert.equal(String(scopes[0].datasetId), String(newId));
  assert.equal(String(scopes[1].datasetId), String(oldId));
  assert.ok(Array.isArray(scopes[1].$nor));
  assert.ok(scopes[1].$nor.length > 0);
});
