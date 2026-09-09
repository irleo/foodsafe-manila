import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import { completeInvestigation } from "../controllers/reportController.js";
import {
  requireCitizenAccount,
  requireInternalRole,
} from "../middleware/authMiddleware.js";
import { normalizeExcludedPeriods } from "../controllers/thresholdController.js";
import { exclusionContainsMonth } from "../services/surveillanceThresholdService.js";
import Report from "../models/Report.js";
import ReportAuditLog from "../models/ReportAuditLog.js";
import WebUser from "../models/WebUser.js";

function invokeMiddleware(middleware, user) {
  let statusCode = 200;
  let body = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  middleware({ user }, res, () => {
    nextCalled = true;
  });
  return { statusCode, body, nextCalled };
}

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("citizen accounts cannot enter internal activity, notification, or dataset handlers", () => {
  const middleware = requireInternalRole("admin", "cesu", "surveillance_team");
  const result = invokeMiddleware(middleware, {
    id: "citizen-id",
    role: "citizen",
    accountType: "citizen",
  });

  assert.equal(result.statusCode, 403);
  assert.equal(result.nextCalled, false);
  assert.deepEqual(result.body, { message: "Access denied" });
});

test("internal middleware requires a web account as well as an allowed role", () => {
  const middleware = requireInternalRole("admin", "cesu", "surveillance_team");
  assert.equal(invokeMiddleware(middleware, {
    role: "cesu",
    accountType: "citizen",
  }).statusCode, 403);
  assert.equal(invokeMiddleware(middleware, {
    role: "surveillance_team",
    accountType: "web",
  }).nextCalled, true);
});

test("staff accounts cannot enter the citizen report creation handler", () => {
  const result = invokeMiddleware(requireCitizenAccount, {
    id: "staff-id",
    role: "admin",
    accountType: "web",
  });

  assert.equal(result.statusCode, 403);
  assert.equal(result.nextCalled, false);
  assert.deepEqual(result.body, { message: "Citizen account required." });
});

test("threshold exclusions reject unsupported disease and district scopes", () => {
  const common = {
    startYear: 2020,
    startMonth: 1,
    endYear: 2020,
    endMonth: 2,
    reason: "Incomplete source reporting",
  };

  assert.match(
    normalizeExcludedPeriods([{ ...common, disease: "Cholra" }]).error,
    /unsupported disease/,
  );
  assert.match(
    normalizeExcludedPeriods([{ ...common, district: "District 7" }]).error,
    /District 1 through District 6/,
  );
});

test("threshold exclusions canonicalize valid scopes and preserve explicit wildcards", () => {
  const result = normalizeExcludedPeriods([
    {
      startYear: "2020",
      startMonth: "1",
      endYear: "2020",
      endMonth: "2",
      disease: "cholera",
      district: "district 3",
      reason: " Incomplete source reporting ",
    },
    {
      startYear: 2021,
      startMonth: 3,
      endYear: 2021,
      endMonth: 3,
      disease: null,
      district: null,
      reason: "All scopes",
    },
  ]);

  assert.equal(result.error, undefined);
  assert.equal(result.value[0].disease, "Cholera");
  assert.equal(result.value[0].district, "District 3");
  assert.equal(result.value[0].reason, "Incomplete source reporting");
  assert.equal(result.value[1].disease, null);
  assert.equal(result.value[1].district, null);
});

test("threshold exclusions apply only to matching valid disease and district scopes", () => {
  const exclusion = {
    startYear: 2020,
    startMonth: 2,
    endYear: 2020,
    endMonth: 4,
    disease: "Cholera",
    district: "District 3",
  };

  assert.equal(exclusionContainsMonth(exclusion, 2020, 3, "Cholera", "District 3"), true);
  assert.equal(exclusionContainsMonth(exclusion, 2020, 3, "Rotavirus", "District 3"), false);
  assert.equal(exclusionContainsMonth(exclusion, 2020, 3, "Cholera", "District 2"), false);
  assert.equal(exclusionContainsMonth(exclusion, 2020, 5, "Cholera", "District 3"), false);
  assert.equal(exclusionContainsMonth({ ...exclusion, disease: "Cholra" }, 2020, 3, "Cholera", "District 3"), false);
});

test("parallel investigation requests produce one winner and one conflict audit-free loser", async () => {
  const originalFindById = Report.findById;
  const originalFindOneAndUpdate = Report.findOneAndUpdate;
  const originalWebUserFind = WebUser.find;
  const originalAuditCreate = ReportAuditLog.create;
  const reportId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const record = {
    _id: reportId,
    currentStatus: "reported",
    investigationStatus: "not_started",
    disease: null,
  };
  let auditCount = 0;

  try {
    Report.findById = async () => ({ ...record });
    WebUser.find = () => ({
      select() {
        return this;
      },
      async lean() {
        return [{ _id: actorId }];
      },
    });
    Report.findOneAndUpdate = (filter, update) => ({
      select() {
        return this;
      },
      async lean() {
        if (
          String(filter._id) !== String(record._id)
          || filter.currentStatus !== record.currentStatus
          || filter.investigationStatus !== record.investigationStatus
        ) return null;
        Object.assign(record, update.$set);
        return { ...record };
      },
    });
    ReportAuditLog.create = async () => {
      auditCount += 1;
      return {};
    };

    const request = () => ({
      params: { id: String(reportId) },
      user: { id: String(actorId), role: "cesu", accountType: "web" },
      body: {
        investigationDate: new Date(Date.now() - 86_400_000).toISOString(),
        locationVisited: "Barangay 1 Health Center",
        findings: "Symptoms are consistent with the suspected disease.",
        suspectedDisease: "Cholera",
      },
    });
    const firstResponse = mockResponse();
    const secondResponse = mockResponse();

    await Promise.all([
      completeInvestigation(request(), firstResponse),
      completeInvestigation(request(), secondResponse),
    ]);

    assert.deepEqual(
      [firstResponse.statusCode, secondResponse.statusCode].sort((a, b) => a - b),
      [200, 409],
    );
    assert.equal(auditCount, 1);
    assert.equal(record.investigationStatus, "completed");
  } finally {
    Report.findById = originalFindById;
    Report.findOneAndUpdate = originalFindOneAndUpdate;
    WebUser.find = originalWebUserFind;
    ReportAuditLog.create = originalAuditCreate;
  }
});
