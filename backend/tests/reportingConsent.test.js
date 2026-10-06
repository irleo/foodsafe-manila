import test from "node:test";
import assert from "node:assert/strict";
import MobileUser from "../models/MobileUser.js";
import { mobilePolicies, reportingProcessing, hasRequiredReportingAcceptance } from "../policies/mobilePolicies.js";
import { acknowledgeReportingPolicies } from "../services/mobilePolicyService.js";
import { acceptReportingPolicies, getMobilePolicyStatus } from "../controllers/mobilePolicyController.js";
import { createReport } from "../controllers/reportController.js";

const receipt = () => ({
  version: mobilePolicies.reporting.version,
  locationVersion: mobilePolicies.location.version,
  acceptedAt: new Date("2026-10-05T00:00:00Z"),
  lawfulBasis: reportingProcessing.lawfulBasis,
  healthConsent: true,
});
const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const query = (result) => ({ select() { return this; }, async lean() { return result; } });

test("only a dated receipt for the current reporting activity skips review", () => {
  assert.equal(hasRequiredReportingAcceptance(receipt()), true);
  for (const invalid of [null, {}, { ...receipt(), version: "old" },
    { ...receipt(), locationVersion: "old" }, { ...receipt(), healthConsent: false },
    { ...receipt(), acceptedAt: undefined }, { ...receipt(), acceptedAt: new Date(NaN) },
    { ...receipt(), lawfulBasis: "different-purpose" }]) {
    assert.equal(hasRequiredReportingAcceptance(invalid), false);
  }
});

test("first acknowledgement saves versions and a server timestamp on the authenticated user", async (t) => {
  let recorded;
  t.mock.method(MobileUser, "findOneAndUpdate", (filter, update, options) => {
    assert.equal(filter._id, "citizen-1");
    assert.equal(options.runValidators, true);
    recorded = update.$set.reportingAcceptance;
    return query({ reportingAcceptance: recorded });
  });
  const before = Date.now();
  const user = await acknowledgeReportingPolicies("citizen-1");
  assert.ok(recorded.acceptedAt instanceof Date);
  assert.ok(recorded.acceptedAt.getTime() >= before);
  assert.equal(user.reportingAcceptance.version, mobilePolicies.reporting.version);
  assert.equal(hasRequiredReportingAcceptance(user.reportingAcceptance), true);
});

test("retrying acceptance preserves the original consent timestamp", async (t) => {
  const original = receipt();
  t.mock.method(MobileUser, "findOneAndUpdate", () => query(null));
  t.mock.method(MobileUser, "findById", (id) => {
    assert.equal(id, "citizen-1");
    return query({ reportingAcceptance: original });
  });
  const user = await acknowledgeReportingPolicies("citizen-1");
  assert.equal(user.reportingAcceptance.acceptedAt, original.acceptedAt);
});

test("false, missing, or stale reporting consent is rejected before persistence", async (t) => {
  t.mock.method(MobileUser, "findOneAndUpdate", () => { throw new Error("No database work expected"); });
  const valid = { version: mobilePolicies.reporting.version, acknowledged: true,
    locationVersion: mobilePolicies.location.version, locationAcknowledged: true, healthConsent: true };
  for (const choice of [undefined, {}, { ...valid, version: "old" }, { ...valid, healthConsent: false }]) {
    const res = response();
    await acceptReportingPolicies({ user: { id: "citizen-1" }, body: { reportDisclosure: choice } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "REPORT_DISCLOSURE_REQUIRED");
  }
});

test("status distinguishes registration receipts from reporting consent", async (t) => {
  const user = { policyAcceptance: {
    terms: { version: mobilePolicies.terms.version }, privacy: { version: mobilePolicies.privacy.version },
  }, reportingAcceptance: undefined };
  t.mock.method(MobileUser, "findById", () => query(user));
  const res = response();
  await getMobilePolicyStatus({ user: { id: "citizen-1" } }, res);
  assert.equal(res.body.requiresAcknowledgement, false);
  assert.equal(res.body.requiresReportingAcknowledgement, true);
  user.reportingAcceptance = receipt();
  await getMobilePolicyStatus({ user: { id: "citizen-1" } }, res);
  assert.equal(res.body.requiresReportingAcknowledgement, false);
});

test("a report payload cannot forge a saved user consent receipt", async () => {
  const res = response();
  await createReport({ user: { id: "citizen-1", accountType: "citizen", role: "citizen" },
    body: { reportDisclosure: { ...receipt(), acknowledged: true, locationAcknowledged: true } },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "REPORT_DISCLOSURE_REQUIRED");
});
