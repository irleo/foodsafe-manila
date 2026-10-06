import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import MobileUser from "../models/MobileUser.js";
import PolicyAcceptance from "../models/PolicyAcceptance.js";
import { registerCitizen } from "../controllers/citizenAuthController.js";
import { mobilePolicies, publicMobilePolicies, validatePolicyChoices, hasRequiredPolicies, validateReportingChoices } from "../policies/mobilePolicies.js";
import { createMobileUserWithPolicies } from "../services/mobilePolicyService.js";

const published = () => Object.fromEntries(Object.entries(mobilePolicies)
  .map(([type, policy]) => [type, { ...policy, status: "published" }]));
const choices = {
  terms: { accepted: true, version: mobilePolicies.terms.version },
  privacy: { accepted: true, version: mobilePolicies.privacy.version },
};

test("registration rejects absent, false, stale, or forged required acceptance before database work", async (t) => {
  let databaseCalls = 0;
  t.mock.method(MobileUser, "findOne", () => { databaseCalls++; throw new Error("Database must not be called"); });
  for (const policyAcceptance of [undefined, null, {}, [],
    { ...choices, terms: { ...choices.terms, accepted: false } },
    { ...choices, terms: { ...choices.terms, accepted: "true" } },
    { ...choices, terms: { ...choices.terms, version: "old" } },
    { ...choices, privacy: { ...choices.privacy, accepted: false } },
    { ...choices, privacy: { ...choices.privacy, version: "old" } }]) {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await registerCitizen({ body: { username: "Juan", phone: "09171234567", password: "ValidPass1!", verificationToken: "token", policyAcceptance } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "POLICY_ACCEPTANCE_REQUIRED");
  }
  assert.equal(databaseCalls, 0);
});

test("private testing registration requires acceptance but not legal publication", () => {
  assert.equal(validatePolicyChoices(choices, published()), null);
  assert.equal(validatePolicyChoices(choices), null);
  const pending = published();
  pending.terms.status = "pending_review";
  assert.equal(validatePolicyChoices(choices, pending).status, 503);
});

test("bundled policy links show the same content and versions validated by the API", () => {
  const bundled = JSON.parse(readFileSync(new URL("../../mobile/assets/mobile-policies.json", import.meta.url), "utf8"));
  // The bundled display copy may omit Markdown heading markers; preserve that
  // presentation choice while still checking every word and accepted version.
  const displayCopy = (bundle) => ({ ...bundle, policies: bundle.policies.map((policy) => ({
    ...policy, text: policy.text.split(/\r?\n/).map((line) => line.replace(/^#{1,6}\s*/, "").trim()).join("\n"),
  })) });
  assert.deepEqual(displayCopy(bundled), displayCopy(publicMobilePolicies()));
});

test("Terms acceptance and Privacy acknowledgement are independently required", () => {
  assert.equal(validatePolicyChoices({ terms: choices.terms }, published()).status, 400);
  assert.equal(validatePolicyChoices({ privacy: choices.privacy }, published()).status, 400);
});

test("legacy and materially outdated accounts require explicit new acknowledgement", () => {
  const registry = published();
  assert.equal(hasRequiredPolicies(null, registry), false);
  assert.equal(hasRequiredPolicies(choices, registry), true);
  registry.terms.version = registry.terms.requiredVersion = "next-material-version";
  assert.equal(hasRequiredPolicies(choices, registry), false);
  registry.terms.requiredVersion = choices.terms.version;
  assert.equal(hasRequiredPolicies(choices, registry), true);
});

test("registration stores user-linked receipts and server timestamps in the same transaction", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  const session = {};
  let saved;
  let receipts;
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  t.mock.method(MobileUser, "create", async (records, options) => {
    assert.equal(options.session, session);
    saved = records[0];
    return [{ ...saved, _id: userId }];
  });
  t.mock.method(PolicyAcceptance, "bulkWrite", async (operations, options) => {
    assert.equal(options.session, session);
    receipts = operations;
  });
  const before = Date.now();
  await createMobileUserWithPolicies({ username: "Juan", phoneNumber: "09171234567", password: "hashed" });
  assert.ok(saved.policyAcceptance.terms.acceptedAt.getTime() >= before);
  assert.equal(receipts.length, 2);
  assert.equal(receipts[0].updateOne.filter.userId, userId);
  assert.equal(receipts[0].updateOne.filter.policyType, "terms");
  assert.equal(receipts[0].updateOne.filter.policyVersion, choices.terms.version);
  assert.equal(receipts[0].updateOne.update.$setOnInsert.action, "accepted");
  assert.equal(receipts[1].updateOne.update.$setOnInsert.action, "acknowledged");
});

test("acceptance persistence errors propagate and cannot report account creation success", async (t) => {
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback({}));
  t.mock.method(MobileUser, "create", async () => [{ _id: new mongoose.Types.ObjectId() }]);
  t.mock.method(PolicyAcceptance, "bulkWrite", async () => { throw new Error("receipt failure"); });
  await assert.rejects(createMobileUserWithPolicies({}), /receipt failure/);
});

test("reporting does not infer health consent from Terms or location permission", () => {
  const registry = published();
  const processing = { lawfulBasis: "reviewed-basis", consentRequired: true, consentText: "Approved purpose-specific consent" };
  const disclosure = { version: registry.reporting.version, acknowledged: true,
    locationVersion: registry.location.version, locationAcknowledged: true };
  assert.equal(validateReportingChoices(disclosure, registry, processing).status, 400);
  assert.equal(validateReportingChoices({ ...disclosure, healthConsent: true }, registry, processing), null);
  assert.equal(validateReportingChoices({ ...disclosure, healthConsent: true, version: "old" }, registry, processing).status, 400);
  assert.equal(validateReportingChoices({ ...disclosure, healthConsent: true }, registry), null);
  assert.equal(validateReportingChoices({ ...disclosure, healthConsent: true }, registry,
    { ...processing, lawfulBasis: "pending_review" }).status, 503);
  assert.equal(validateReportingChoices(disclosure, registry, { ...processing, consentRequired: false }), null);
});
