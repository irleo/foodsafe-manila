import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import MobileUser from "../models/MobileUser.js";
import MobileOtp from "../models/MobileOtp.js";
import MobileEmailOtp from "../models/MobileEmailOtp.js";
import PolicyAcceptance from "../models/PolicyAcceptance.js";
import { registerCitizen, resetCitizenPassword, checkEmailExists } from "../controllers/citizenAuthController.js";
import { updateMobileProfile } from "../controllers/mobileUserController.js";
import { requestEmailOtp, confirmEmailOtp, emailOtpDelivery } from "../controllers/mobileEmailOtpController.js";
import { normalizeRecoveryEmail, isValidRecoveryEmail, RECOVERY_EMAIL_INDEX } from "../utils/recoveryEmail.js";
import { consumeEmailOtpVerification } from "../services/mobileEmailOtpService.js";
import { migrateRecoveryEmails, normalizedAccountUpdate } from "../maintenance/recoveryEmailMigration.js";
import { mobilePolicies } from "../policies/mobilePolicies.js";

process.env.OTP_HASH_SECRET = "mocked-test-secret-not-used-outside-tests";
const userId = new mongoose.Types.ObjectId();
const readyIndex = { name: RECOVERY_EMAIL_INDEX, key: { email: 1 }, unique: true,
  partialFilterExpression: { email: { $type: "string", $gt: "" } } };
const choices = { terms: { accepted: true, version: mobilePolicies.terms.version },
  privacy: { accepted: true, version: mobilePolicies.privacy.version } };
const accountRequest = (email) => ({ user: { id: String(userId), accountType: "citizen" },
  params: { id: String(userId) }, body: { email, currentPassword: "CurrentPass1!" } });
const registration = (email) => ({ body: { username: "Tester", phone: "09171234567",
  password: "ValidPass1!", verificationToken: "proof", email, policyAcceptance: choices } });
const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });
const queryResult = (result) => ({ select: () => ({ lean: async () => result }) });
function ready(t) { t.mock.method(MobileUser.collection, "indexes", async () => [readyIndex]); }
function authorizeProfile(t) {
  t.mock.method(bcrypt, "compare", async (password) => {
    assert.equal(password, "CurrentPass1!");
    return true;
  });
  t.mock.method(MobileUser, "findOneAndUpdate", async (filter, update) => ({ _id: userId, ...update.$set, emailVersion: (filter.emailVersion || 0) + 1 }));
}

test("mixed case and whitespace normalize before email validation", () => {
  assert.equal(normalizeRecoveryEmail("  Alice+Test@Example.COM \n"), "alice+test@example.com");
  assert.equal(isValidRecoveryEmail("  Alice+Test@Example.COM \n"), true);
  for (const input of [{ $ne: null }, [], 7, "bad", "a..b@example.com", ".a@example.com", "a @example.com"]) {
    assert.equal(isValidRecoveryEmail(input), false);
  }
  assert.equal(isValidRecoveryEmail("  "), true);
  assert.equal(isValidRecoveryEmail("  ", true), false);
});

test("schema normalizes storage and never verifies newly supplied emails", async () => {
  const user = new MobileUser({ username: "Tester", phoneNumber: "09171234567", password: "hash",
    email: " Alice@Example.COM ", emailVerified: true, emailVerifiedAt: new Date() });
  await user.validate();
  assert.equal(user.email, "alice@example.com");
  assert.equal(user.emailVerified, false);
  assert.equal(user.emailVerifiedAt, undefined);
  assert.equal(MobileUser.schema.options.autoIndex, false);
  const index = MobileUser.schema.indexes().find(([, options]) => options.name === RECOVERY_EMAIL_INDEX);
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, readyIndex.partialFilterExpression);
});

test("duplicate registration rejects normalized email before consuming OTP", async (t) => {
  t.mock.method(MobileUser, "findOne", async () => null);
  t.mock.method(MobileUser, "exists", async (filter) => {
    assert.deepEqual(filter, { email: "alice@example.com" });
    return { _id: userId };
  });
  t.mock.method(MobileOtp, "findOneAndUpdate", () => { throw new Error("Must not consume OTP"); });
  const res = response();
  await registerCitizen(registration(" Alice@Example.COM "), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "RECOVERY_EMAIL_UNAVAILABLE");
  assert.ok(!res.body.message.includes("alice"));
});

function mockRegistrationProof(t) {
  ready(t);
  t.mock.method(MobileUser, "findOne", async () => null);
  t.mock.method(MobileUser, "exists", async () => null);
  t.mock.method(bcrypt, "hash", async () => "hashed-password");
  const proofHash = crypto.createHmac("sha256", process.env.OTP_HASH_SECRET).update("verification:proof").digest("hex");
  t.mock.method(MobileOtp, "findOne", () => ({ select: async () => ({ _id: userId, verificationTokenHash: proofHash }) }));
  t.mock.method(MobileOtp, "findOneAndUpdate", async () => ({}));
}

test("registration persists normalized email as unverified", async (t) => {
  mockRegistrationProof(t);
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback({}));
  t.mock.method(MobileUser, "create", async ([record]) => {
    assert.equal(record.email, "alice@example.com");
    return [new MobileUser({ ...record, _id: userId })];
  });
  t.mock.method(PolicyAcceptance, "bulkWrite", async () => ({}));
  const res = response();
  await registerCitizen(registration(" Alice@Example.COM "), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.emailVerified, false);
});

test("registration proof consumption participates in account and policy transaction", async (t) => {
  mockRegistrationProof(t);
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback("registration-session"));
  t.mock.method(MobileOtp, "findOneAndUpdate", async (_filter, _update, options) => {
    assert.equal(options.session, "registration-session");
    return {};
  });
  t.mock.method(MobileUser, "create", async (_records, options) => {
    assert.equal(options.session, "registration-session");
    throw Object.assign(new Error("Write conflict"), { code: 11000, keyPattern: { email: 1 } });
  });
  const res = response();
  await registerCitizen(registration("alice@example.com"), res);
  assert.equal(res.statusCode, 409);
});

test("expired registration proof cannot create an account and returns restart code", async (t) => {
  mockRegistrationProof(t);
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback("registration-session"));
  t.mock.method(MobileOtp, "findOneAndUpdate", async () => null);
  t.mock.method(MobileUser, "create", () => { throw new Error("Must not create account"); });
  const res = response();
  await registerCitizen(registration("alice@example.com"), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "PHONE_PROOF_INVALID");
});

test("concurrent duplicate registration maps email E11000 to a safe conflict", async (t) => {
  mockRegistrationProof(t);
  t.mock.method(mongoose.connection, "transaction", async () => {
    throw Object.assign(new Error("duplicate"), { code: 11000, keyPattern: { email: 1 } });
  });
  const res = response();
  await registerCitizen(registration(" Alice@Example.COM "), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "RECOVERY_EMAIL_UNAVAILABLE");
});

test("email assignment fails safely until the explicitly migrated unique index exists", async (t) => {
  t.mock.method(MobileUser, "findOne", async () => null);
  t.mock.method(MobileUser, "exists", async () => null);
  t.mock.method(MobileUser.collection, "indexes", async () => []);
  const res = response();
  await registerCitizen(registration("alice@example.com"), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, "RECOVERY_EMAIL_SETUP_REQUIRED");
});

test("duplicate profile update excludes current user and preserves saved identity", async (t) => {
  authorizeProfile(t);
  const account = { _id: userId, email: "old@example.com", emailVerified: true };
  t.mock.method(MobileUser, "findById", async () => account);
  t.mock.method(MobileUser, "exists", async (filter) => {
    assert.equal(filter.email, "alice@example.com");
    assert.equal(filter._id.$ne, userId);
    return {};
  });
  const res = response();
  await updateMobileProfile(accountRequest(" Alice@Example.COM "), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "RECOVERY_EMAIL_UNAVAILABLE");
  assert.equal(account.email, "old@example.com");
});

test("changed recovery email clears verification and invalidates earlier challenge version", async (t) => {
  authorizeProfile(t);
  ready(t);
  const account = { _id: userId, email: "old@example.com", emailVerified: true,
    emailVerifiedAt: new Date(), emailVersion: 2, save: async () => {} };
  t.mock.method(MobileUser, "findById", async () => account);
  t.mock.method(MobileUser, "exists", async () => null);
  const res = response();
  await updateMobileProfile(accountRequest(" Alice@Example.COM "), res);
  assert.equal(res.statusCode, 200);
  assert.equal(account.email, "alice@example.com");
  assert.equal(account.emailVerified, false);
  assert.equal(account.emailVerifiedAt, undefined);
  assert.equal(account.emailVersion, 3);
});

test("case-only same-email updates preserve existing verification", async (t) => {
  const account = { _id: userId, email: "alice@example.com", emailVerified: true,
    emailVerifiedAt: new Date(), emailVersion: 2, save: async () => {} };
  t.mock.method(MobileUser, "findById", async () => account);
  const res = response();
  await updateMobileProfile(accountRequest(" Alice@Example.COM "), res);
  assert.equal(res.statusCode, 200);
  assert.equal(account.emailVerified, true);
  assert.equal(account.emailVersion, 2);
});

test("concurrent duplicate profile writes return a safe conflict", async (t) => {
  authorizeProfile(t);
  ready(t);
  t.mock.method(MobileUser, "findById", async () => ({ _id: userId, email: "old@example.com",
    save: async () => { throw Object.assign(new Error("duplicate"), { code: 11000, keyValue: { email: "alice@example.com" } }); } }));
  t.mock.method(MobileUser, "exists", async () => null);
  t.mock.method(MobileUser, "findOneAndUpdate", async () => { throw Object.assign(new Error("duplicate"), { code: 11000, keyValue: { email: "alice@example.com" } }); });
  const res = response();
  await updateMobileProfile(accountRequest("alice@example.com"), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "RECOVERY_EMAIL_UNAVAILABLE");
});

test("anonymous OTP responses do not distinguish eligible, absent, or unverified email", async (t) => {
  ready(t);
  let time = 0;
  t.mock.method(Date, "now", () => time += 10_000);
  let eligible = false;
  let delivered = 0;
  t.mock.method(MobileUser, "findOne", (filter) => {
    assert.deepEqual(filter, { email: "alice@example.com" });
    return queryResult(eligible ? { _id: userId, emailVersion: 1 } : null);
  });
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async () => ({}));
  t.mock.method(emailOtpDelivery, "send", async (message) => {
    delivered++;
    assert.equal(message.toEmail, "alice@example.com");
  });
  const absent = response();
  await requestEmailOtp({ body: { email: " Alice@Example.COM " } }, absent);
  eligible = true;
  const present = response();
  await requestEmailOtp({ body: { email: " Alice@Example.COM " } }, present);
  assert.equal(absent.statusCode, 202);
  assert.equal(present.statusCode, 202);
  assert.deepEqual(present.body, absent.body);
  assert.equal(delivered, 1);
  assert.equal(present.body.debugOtp, undefined);
});

test("saved unverified email cannot reset a password without a valid OTP proof", async (t) => {
  ready(t);
  t.mock.method(bcrypt, "hash", async () => "hash");
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback({}));
  t.mock.method(MobileUser, "findOne", (filter) => {
    assert.equal(filter.email, "alice@example.com");
    assert.equal(filter.emailVerified, undefined);
    return queryResult({ _id: userId, emailVersion: 1, emailVerified: false });
  });
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async () => null);
  t.mock.method(MobileUser, "findOneAndUpdate", () => { throw new Error("No password change allowed"); });
  const res = response();
  await resetCitizenPassword({ body: { email: " Alice@Example.COM ", newPassword: "ValidPass1!", verificationToken: "a".repeat(64) } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Email verification is invalid or expired");
});

test("anonymous recovery hides cooldown and delivery failures behind the same response", async (t) => {
  ready(t);
  let time = 0;
  t.mock.method(Date, "now", () => time += 10_000);
  t.mock.method(console, "error", () => {});
  t.mock.method(MobileUser, "findOne", () => queryResult({ _id: userId, emailVersion: 1 }));
  let cooldown = true;
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async () => {
    if (cooldown) throw Object.assign(new Error("cooldown"), { code: 11000 });
    return {};
  });
  t.mock.method(emailOtpDelivery, "send", async () => { throw new Error("Mocked provider outage"); });
  const first = response();
  await requestEmailOtp({ body: { email: "alice@example.com" } }, first);
  cooldown = false;
  const second = response();
  await requestEmailOtp({ body: { email: "alice@example.com" } }, second);
  assert.equal(first.statusCode, 202);
  assert.equal(second.statusCode, 202);
  assert.deepEqual(first.body, second.body);
});

test("incorrect or expired ownership codes cannot enable recovery", async (t) => {
  ready(t);
  t.mock.method(MobileUser, "findOne", () => queryResult({ _id: userId, emailVersion: 1 }));
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.attempts.$lt, 5);
    assert.ok(filter.expiresAt.$gt instanceof Date);
    assert.equal(filter.userId, userId);
    if (update.$inc) assert.equal(update.$inc.attempts, 1);
    return null;
  });
  t.mock.method(MobileUser, "findOneAndUpdate", () => { throw new Error("Must not enable email recovery"); });
  const req = accountRequest("alice@example.com");
  req.body.otp = "123456";
  const res = response();
  await confirmEmailOtp(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Verification code is invalid or expired");
});

test("first recovery verifies saved email and revokes sessions in the proof-consumption transaction", async (t) => {
  ready(t);
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback("mock-session"));
  t.mock.method(MobileUser, "findOne", (filter) => {
    assert.equal(filter.email, "alice@example.com");
    return queryResult({ _id: userId, emailVersion: 3, emailVerified: false });
  });
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter, _update, options) => {
    assert.equal(options.session, "mock-session");
    assert.equal(filter.email, "alice@example.com");
    assert.equal(filter.userId, userId);
    assert.equal(filter.emailVersion, 3);
    assert.equal(filter.consumedAt, null);
    return {};
  });
  t.mock.method(bcrypt, "hash", async () => "hash");
  t.mock.method(MobileUser, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { _id: userId, email: "alice@example.com", emailVersion: 3 });
    assert.equal(options.session, "mock-session");
    assert.equal(update.$set.emailVerified, true);
    assert.ok(update.$set.emailVerifiedAt instanceof Date);
    assert.equal(update.$inc.tokenVersion, 1);
    return {};
  });
  const res = response();
  await resetCitizenPassword({ body: { email: " Alice@Example.COM ", newPassword: "ValidPass1!", verificationToken: "a".repeat(64) } }, res);
  assert.deepEqual(res.body, { success: true });
});

test("recovery verification issues only an account/version-bound reset proof", async (t) => {
  ready(t);
  t.mock.method(MobileUser, "findOne", () => queryResult({ _id: userId, emailVersion: 4 }));
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.purpose, "password_reset");
    assert.equal(filter.emailVersion, 4);
    return { emailVersion: 4 };
  });
  t.mock.method(MobileUser, "findOneAndUpdate", () => { throw new Error("Only reset completion records email verification"); });
  const req = accountRequest(" Alice@Example.COM ");
  req.body.otp = "123456";
  const res = response();
  await confirmEmailOtp(req, res);
  assert.match(res.body.verificationToken, /^[a-f0-9]{64}$/);
});

test("verification proof is single-use and rejects old unbound tokens", async (t) => {
  let consumed = false;
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter) => {
    assert.equal(filter.emailVersion, 1);
    assert.equal(filter.verificationTokenHash.length, 64);
    if (consumed) return null;
    consumed = true;
    return {};
  });
  const proof = { email: " Alice@Example.COM ", purpose: "password_reset", userId, emailVersion: 1, verificationToken: "b".repeat(64) };
  assert.equal(await consumeEmailOtpVerification(proof), true);
  assert.equal(await consumeEmailOtpVerification(proof), false);
  assert.equal(await consumeEmailOtpVerification({ ...proof, userId: undefined }), false);
  assert.equal(await consumeEmailOtpVerification({ ...proof, emailVersion: undefined }), false);
});

test("legacy anonymous email existence endpoint has a constant response", async (t) => {
  t.mock.method(MobileUser, "exists", () => { throw new Error("Must not query account ownership"); });
  const first = response();
  const second = response();
  await checkEmailExists({ query: { email: "alice@example.com" } }, first);
  await checkEmailExists({ query: { email: "missing@example.com" } }, second);
  assert.deepEqual(first.body, second.body);
});

test("phone reset consumes proof and atomically revokes sessions in the same transaction", async (t) => {
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback("mock-session"));
  t.mock.method(MobileUser, "findOne", async () => ({ _id: userId }));
  t.mock.method(bcrypt, "hash", async () => "new-password-hash");
  t.mock.method(MobileOtp, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(filter.phone, "09171234567");
    assert.equal(filter.purpose, "password_reset");
    assert.equal(options.session, "mock-session");
    assert.ok(update.$set.consumedAt instanceof Date);
    return {};
  });
  t.mock.method(MobileUser, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { _id: userId, phoneNumber: "09171234567" });
    assert.equal(options.session, "mock-session");
    assert.equal(update.$set.password, "new-password-hash");
    assert.equal(update.$inc.tokenVersion, 1);
    return {};
  });
  const res = response();
  await resetCitizenPassword({ body: { phone: "09171234567", newPassword: "ValidPass1!", verificationToken: "proof" } }, res);
  assert.deepEqual(res.body, { success: true });
});

test("failed reset commit throws inside the transaction rather than burning the proof", async (t) => {
  let transactionFailure;
  t.mock.method(mongoose.connection, "transaction", async (callback) => {
    try { return await callback("mock-session"); }
    catch (error) { transactionFailure = error; throw error; }
  });
  t.mock.method(MobileUser, "findOne", async () => ({ _id: userId }));
  t.mock.method(bcrypt, "hash", async () => "hash");
  t.mock.method(MobileOtp, "findOneAndUpdate", async () => ({}));
  t.mock.method(MobileUser, "findOneAndUpdate", async () => null);
  const res = response();
  await resetCitizenPassword({ body: { phone: "09171234567", newPassword: "ValidPass1!", verificationToken: "proof" } }, res);
  assert.equal(transactionFailure.code, "PHONE_PROOF_INVALID");
  assert.equal(res.statusCode, 403);
});

test("legacy normalization does not invent verification evidence", () => {
  const operation = normalizedAccountUpdate({ _id: userId, email: " Alice@Example.COM ", emailVerified: true });
  assert.equal(operation.updateOne.update.$set.email, "alice@example.com");
  assert.equal(operation.updateOne.update.$set.emailVerified, false);
  assert.equal(operation.updateOne.update.$set.emailVersion, 1);
  assert.equal(normalizedAccountUpdate({ _id: userId, email: "alice@example.com", emailVerified: true,
    emailVerifiedAt: new Date(), emailVersion: 1 }), null);
});

test("migration dry run never writes; approved cleanup unlinks all duplicates before creating index", async () => {
  const calls = [];
  const iterable = (values) => ({ async *[Symbol.asyncIterator]() { yield* values; }, async close() {} });
  const collection = {
    aggregate: () => iterable([{ _id: "alice@example.com", count: 2 }]),
    find: () => ({ batchSize: () => iterable([]) }),
    updateMany: async (filter, update) => { calls.push("unlink"); assert.equal(update.$set.email, ""); assert.ok(filter.$expr); },
    createIndex: async (_key, options) => { calls.push("index"); assert.equal(options.unique, true); },
  };
  const report = await migrateRecoveryEmails(collection, { apply: false, createIndex: false });
  assert.equal(report.conflictedAccounts, 2);
  assert.deepEqual(calls, []);
  await assert.rejects(migrateRecoveryEmails(collection, { apply: false, createIndex: true }), /Resolve duplicates/);
  await migrateRecoveryEmails(collection, { apply: true, createIndex: true });
  assert.deepEqual(calls, ["unlink", "index"]);
});
