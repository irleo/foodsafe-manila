// @ts-check
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
import { normalizeRecoveryEmail, isValidRecoveryEmail, RECOVERY_EMAIL_INDEX, EMAIL_RECOVERY_ACCOUNT_INDEX } from "../utils/recoveryEmail.js";
import { consumeEmailOtpVerification, hashEmailOtp, hashEmailRecoveryFlow, hashEmailVerificationToken } from "../services/mobileEmailOtpService.js";
import { migrateRecoveryEmails, normalizedAccountUpdate } from "../maintenance/recoveryEmailMigration.js";
import { mobilePolicies } from "../policies/mobilePolicies.js";

process.env.OTP_HASH_SECRET = "mock-recovery-only";
const userId = new mongoose.Types.ObjectId();
const phone = "09171234567";
const flowId = "a".repeat(64);
const proof = "b".repeat(64);
const session = /** @type {mongoose.ClientSession} */ (/** @type {unknown} */ ({ marker: "mock-session" }));
const account = { _id: userId, phoneNumber: phone, email: "shared@example.com", emailVersion: 2, tokenVersion: 1 };
const readyIndex = { name: EMAIL_RECOVERY_ACCOUNT_INDEX, key: { userId: 1, purpose: 1 }, unique: true,
  partialFilterExpression: { flowIdHash: { $type: "string" } } };
const choices = { terms: { accepted: true, version: mobilePolicies.terms.version },
  privacy: { accepted: true, version: mobilePolicies.privacy.version } };
/** @param {Record<string, unknown>} body */
const request = (body) => /** @type {import('express').Request} */ (/** @type {unknown} */ ({ body }));
function response() {
  const state = { statusCode: 200, body: /** @type {Record<string, unknown>} */ ({}),
    /** @param {number} code */ status(code) { this.statusCode = code; return this; },
    /** @param {Record<string, unknown>} body */ json(body) { this.body = body; return this; } };
  return { state, res: /** @type {import('express').Response} */ (/** @type {unknown} */ (state)) };
}
/** @param {unknown} value */
const queryResult = (value) => ({ select: () => ({ lean: async () => value }) });
/** @param {import('node:test').TestContext} t */
function senderSetup(t) {
  let time = 0;
  t.mock.method(Date, "now", () => time += 20_000);
  t.mock.method(MobileEmailOtp.collection, "indexes", async () => [readyIndex]);
  t.mock.method(MobileUser, "findOne", (filter) => {
    assert.equal(Object.hasOwn(filter, "email"), false);
    assert.ok(filter.phoneNumber);
    return queryResult(account);
  });
}
/** @param {import('node:test').TestContext} t */
function registrationSetup(t) {
  t.mock.method(MobileUser, "findOne", async (filter) => { assert.ok(filter.phoneNumber); return null; });
  t.mock.method(MobileUser, "exists", () => { throw new Error("Must not check email ownership"); });
  t.mock.method(MobileUser.collection, "indexes", () => { throw new Error("No unique email index requirement"); });
  t.mock.method(bcrypt, "hash", async () => "hash");
  const hash = crypto.createHmac("sha256", process.env.OTP_HASH_SECRET || "").update("verification:proof").digest("hex");
  t.mock.method(MobileOtp, "findOne", () => ({ select: async () => ({ _id: userId, verificationTokenHash: hash }) }));
  t.mock.method(MobileOtp, "findOneAndUpdate", async (_filter, _update, options) => { assert.equal(options.session, session); return {}; });
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  t.mock.method(PolicyAcceptance, "bulkWrite", async () => ({}));
  t.mock.method(MobileUser, "create", async ([record], options) => {
    assert.equal(options.session, session);
    return [new MobileUser({ ...record, _id: new mongoose.Types.ObjectId() })];
  });
}

test("email normalization and validation remain independent of uniqueness", () => {
  assert.equal(normalizeRecoveryEmail(" Shared@Example.COM \n"), "shared@example.com");
  assert.equal(isValidRecoveryEmail(" Shared@Example.COM "), true);
  for (const value of [{ $ne: null }, [], 7, "bad", "a..b@example.com", ".a@example.com", "a @example.com"]) assert.equal(isValidRecoveryEmail(value), false);
  assert.equal(isValidRecoveryEmail("  "), true);
});

test("MobileUser has only phone uniqueness; historical email evidence clears on changes", async () => {
  assert.deepEqual(MobileUser.schema.indexes().filter(([, options]) => options.unique).map(([keys]) => keys), [{ phoneNumber: 1 }]);
  const user = new MobileUser({ username: "Tester", phoneNumber: phone, password: "hash",
    email: " Shared@Example.COM ", emailVerified: true, emailVerifiedAt: new Date() });
  await user.validate();
  assert.equal(user.email, "shared@example.com");
  assert.equal(user.emailVerified, false);
  assert.equal(user.emailVerifiedAt, undefined);
  const indexes = MobileEmailOtp.schema.indexes();
  assert.equal(indexes.some(([keys]) => keys.email === 1), false);
  assert.ok(indexes.some(([keys, options]) => keys.userId === 1 && options.name === EMAIL_RECOVERY_ACCOUNT_INDEX));
});

test("two citizen registrations may share a normalized recovery email", async (t) => {
  registrationSetup(t);
  for (const number of [phone, "09179999999"]) {
    const { state, res } = response();
    await registerCitizen(request({ username: "Tester", phone: number, password: "ValidPass1!",
      verificationToken: "proof", email: " Shared@Example.COM ", policyAcceptance: choices }), res);
    assert.equal(state.statusCode, 201);
    assert.equal(state.body.email, "shared@example.com");
    assert.equal(state.body.emailVerified, false);
  }
});

test("phone duplicates still return conflicts and absent registration proof prevents creation", async (t) => {
  registrationSetup(t);
  t.mock.method(MobileUser, "create", async () => { throw Object.assign(new Error("phone duplicate"), { code: 11000, keyPattern: { phoneNumber: 1 } }); });
  let result = response();
  const body = { username: "Tester", phone, password: "ValidPass1!", verificationToken: "proof", email: account.email, policyAcceptance: choices };
  await registerCitizen(request(body), result.res);
  assert.equal(result.state.statusCode, 409);
  t.mock.method(MobileOtp, "findOneAndUpdate", async () => null);
  result = response();
  await registerCitizen(request(body), result.res);
  assert.equal(result.state.body.code, "PHONE_PROOF_INVALID");
});

test("shared recovery email profile saves validate format, require password, and send no OTP", async (t) => {
  const profile = { ...account, username: "Tester", password: "hash", email: "old@example.com", save: async () => {} };
  t.mock.method(MobileUser, "findById", async () => profile);
  t.mock.method(MobileUser, "exists", () => { throw new Error("Email ownership lookup forbidden"); });
  t.mock.method(MobileUser.collection, "indexes", () => { throw new Error("Email index gate forbidden"); });
  t.mock.method(bcrypt, "compare", async () => true);
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", () => { throw new Error("Profile save must not touch OTPs"); });
  t.mock.method(emailOtpDelivery, "send", () => { throw new Error("Profile save must not send OTPs"); });
  t.mock.method(MobileUser, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id, String(userId));
    assert.equal(update.$set.email, account.email);
    assert.equal(update.$inc.emailVersion, 1);
    return { ...profile, ...update.$set };
  });
  const req = { user: { id: String(userId), accountType: "citizen" }, params: { id: String(userId) }, body: { email: " Shared@Example.COM ", currentPassword: "test" } };
  let result = response();
  await updateMobileProfile(/** @type {import('express').Request} */ (/** @type {unknown} */ (req)), result.res);
  assert.equal(result.state.statusCode, 200);
  assert.equal(result.state.body.email, account.email);
  req.body.email = "invalid";
  result = response();
  await updateMobileProfile(/** @type {import('express').Request} */ (/** @type {unknown} */ (req)), result.res);
  assert.equal(result.state.statusCode, 400);
});

test("send looks up the phone and delivers only to that account's saved email", async (t) => {
  senderSetup(t);
  const reserve = t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.purpose, "password_reset");
    assert.equal(update.$set.email, account.email);
    assert.equal(update.$set.phoneNumber, phone);
    assert.equal(update.$set.tokenVersion, 1);
    assert.equal(options.upsert, true);
    assert.ok(filter.$or[0].lastSentAt.$lte instanceof Date);
    return {};
  });
  const delivery = t.mock.method(emailOtpDelivery, "send", async (input) => { assert.equal(input.toEmail, account.email); });
  const result = response();
  await requestEmailOtp(request({ phone: "+639171234567", purpose: "password_reset" }), result.res);
  assert.equal(result.state.statusCode, 202);
  assert.match(String(result.state.body.flowId), /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(result.state.body, "email"), false);
  assert.equal(Object.hasOwn(result.state.body, "userId"), false);
  assert.equal(reserve.mock.callCount(), 1);
  assert.equal(delivery.mock.callCount(), 1);
});

test("shared destinations reserve independently and OTP hashes include account and flow", async (t) => {
  senderSetup(t);
  const other = { ...account, _id: new mongoose.Types.ObjectId(), phoneNumber: "09179999999" };
  t.mock.method(MobileUser, "findOne", (filter) => queryResult(filter.phoneNumber === phone ? account : other));
  const owners = new Set();
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter) => { owners.add(String(filter.userId)); return {}; });
  const delivery = t.mock.method(emailOtpDelivery, "send", async () => {});
  for (const number of [phone, other.phoneNumber]) await requestEmailOtp(request({ phone: number }), response().res);
  assert.equal(owners.size, 2);
  assert.equal(delivery.mock.callCount(), 2);
  const scope = { ...account, userId, purpose: "password_reset", flowId, otp: "123456" };
  assert.notEqual(hashEmailOtp(scope), hashEmailOtp({ ...scope, userId: other._id }));
  assert.notEqual(hashEmailOtp(scope), hashEmailOtp({ ...scope, flowId: "c".repeat(64) }));
});

test("anonymous send hides missing accounts, absent email, delivery failures, and cooldown", async (t) => {
  senderSetup(t);
  const outcomes = [];
  for (const eligible of [null, { ...account, email: "" }, account]) {
    t.mock.method(MobileUser, "findOne", () => queryResult(eligible));
    t.mock.method(MobileEmailOtp, "findOneAndUpdate", async () => { throw Object.assign(new Error("cooldown"), { code: 11000 }); });
    const result = response();
    await requestEmailOtp(request({ phone }), result.res);
    outcomes.push({ ...result.state.body, flowId: "opaque" });
    assert.equal(result.state.statusCode, 202);
  }
  t.mock.method(MobileUser, "findOne", () => queryResult(account));
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async () => ({}));
  t.mock.method(emailOtpDelivery, "send", async () => { throw new Error("mock delivery failure"); });
  const result = response();
  await requestEmailOtp(request({ phone }), result.res);
  outcomes.push({ ...result.state.body, flowId: "opaque" });
  for (const outcome of outcomes) assert.deepEqual(outcome, outcomes[0]);
});

test("parallel sends reserve one account cooldown before sending once", async (t) => {
  senderSetup(t);
  let reserved = false;
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async () => {
    if (reserved) throw Object.assign(new Error("cooldown"), { code: 11000 });
    reserved = true;
    return {};
  });
  const delivery = t.mock.method(emailOtpDelivery, "send", async () => {});
  await Promise.all([requestEmailOtp(request({ phone }), response().res), requestEmailOtp(request({ phone }), response().res)]);
  assert.equal(delivery.mock.callCount(), 1);
});

test("foreign or expired resends cannot upsert or replace another flow", async (t) => {
  senderSetup(t);
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter, _update, options) => {
    assert.equal(options.upsert, false);
    assert.equal(filter.flowIdHash, hashEmailRecoveryFlow(flowId));
    assert.ok(filter.expiresAt.$gt instanceof Date);
    assert.equal(filter.emailVersion, account.emailVersion);
    return null;
  });
  const delivery = t.mock.method(emailOtpDelivery, "send", async () => {});
  await requestEmailOtp(request({ phone, flowId }), response().res);
  assert.equal(delivery.mock.callCount(), 0);
});

test("email-only requests and forged phone objects never access accounts", async (t) => {
  const lookup = t.mock.method(MobileUser, "findOne", () => { throw new Error("Invalid input must not query"); });
  for (const body of [{ email: account.email }, { phone: { $ne: null } }, { phone, flowId: "forged" }, { phone, email: "attacker@example.com" }]) {
    const result = response();
    await requestEmailOtp(request(body), result.res);
    assert.equal(result.state.statusCode, 400);
  }
  assert.equal(lookup.mock.callCount(), 0);
});

test("verification binds account, phone, email version, session version, and flow before proof issuance", async (t) => {
  senderSetup(t);
  const otp = "123456";
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.phoneNumber, phone);
    assert.equal(filter.flowIdHash, hashEmailRecoveryFlow(flowId));
    assert.equal(filter.emailVersion, 2);
    assert.equal(filter.tokenVersion, 1);
    assert.equal(filter.attempts.$lt, 5);
    assert.equal(filter.otpHash, hashEmailOtp({ ...account, userId, purpose: "password_reset", flowId, otp }));
    assert.equal(update.$set.otpHash, null);
    assert.ok(update.$set.expiresAt instanceof Date);
    return {};
  });
  const result = response();
  await confirmEmailOtp(request({ phone, flowId, otp }), result.res);
  assert.match(String(result.state.body.verificationToken), /^[a-f0-9]{64}$/);
});

test("wrong and expired codes increment only their unverified flow, never issue proof", async (t) => {
  senderSetup(t);
  let mutations = 0;
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.flowIdHash, hashEmailRecoveryFlow(flowId));
    assert.equal(filter.verifiedAt, null);
    assert.equal(filter.attempts.$lt, 5);
    assert.ok(filter.expiresAt.$gt instanceof Date);
    if (update.$inc) { mutations++; assert.equal(update.$inc.attempts, 1); }
    return null;
  });
  const result = response();
  await confirmEmailOtp(request({ phone, flowId, otp: "999999" }), result.res);
  assert.equal(result.state.statusCode, 400);
  assert.equal(result.state.body.verificationToken, undefined);
  assert.equal(mutations, 1);
});

test("missing flow cannot verify and legacy account-unbound proofs cannot be consumed", async (t) => {
  const mutation = t.mock.method(MobileEmailOtp, "findOneAndUpdate", () => { throw new Error("Missing proof scope must not query"); });
  const result = response();
  await confirmEmailOtp(request({ phone, otp: "123456" }), result.res);
  assert.equal(result.state.statusCode, 400);
  assert.equal(await consumeEmailOtpVerification({ ...account, userId, purpose: "password_reset", flowId: "", verificationToken: proof }), false);
  assert.equal(mutation.mock.callCount(), 0);
});

test("one account's email proof cannot reset another account sharing the email", async (t) => {
  senderSetup(t);
  const other = { ...account, _id: new mongoose.Types.ObjectId(), phoneNumber: "09179999999" };
  t.mock.method(MobileUser, "findOne", () => queryResult(other));
  t.mock.method(bcrypt, "hash", async () => "new-hash");
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter) => { assert.equal(filter.userId, other._id); return null; });
  const write = t.mock.method(MobileUser, "findOneAndUpdate", () => { throw new Error("Foreign proof cannot change a password"); });
  const result = response();
  await resetCitizenPassword(request({ phone: other.phoneNumber, recoveryMethod: "email", flowId, verificationToken: proof, newPassword: "ValidPass1!" }), result.res);
  assert.equal(result.state.body.code, "EMAIL_PROOF_INVALID");
  assert.equal(write.mock.callCount(), 0);
});

test("email reset consumes exact account flow proof and revokes sessions in the same transaction", async (t) => {
  senderSetup(t);
  t.mock.method(bcrypt, "hash", async () => "new-hash");
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(options.session, session);
    assert.equal(filter.userId, userId);
    assert.equal(filter.flowIdHash, hashEmailRecoveryFlow(flowId));
    assert.equal(filter.verificationTokenHash, hashEmailVerificationToken(proof));
    assert.equal(filter.consumedAt, null);
    assert.ok(update.$set.consumedAt instanceof Date);
    return {};
  });
  t.mock.method(MobileUser, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(options.session, session);
    assert.equal(filter.phoneNumber, phone);
    assert.equal(filter.emailVersion, 2);
    assert.equal(filter.tokenVersion, 1);
    assert.equal(update.$inc.tokenVersion, 1);
    assert.equal(update.$set.emailVerified, true);
    assert.ok(update.$set.emailVerifiedAt instanceof Date);
    return {};
  });
  const result = response();
  await resetCitizenPassword(request({ phone, recoveryMethod: "email", flowId, verificationToken: proof, newPassword: "ValidPass1!" }), result.res);
  assert.equal(result.state.statusCode, 200);
  assert.equal(result.state.body.success, true);
});

test("proof is single-use and wrong flow, changed destination, or version cannot consume it", async (t) => {
  let consumed = false;
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter) => {
    if (consumed || filter.userId !== userId || filter.flowIdHash !== hashEmailRecoveryFlow(flowId)
        || filter.emailVersion !== 2 || filter.tokenVersion !== 1 || filter.email !== account.email) return null;
    consumed = true;
    return {};
  });
  const input = { ...account, userId, purpose: "password_reset", flowId, verificationToken: proof };
  assert.equal(await consumeEmailOtpVerification({ ...input, flowId: "c".repeat(64) }), false);
  assert.equal(await consumeEmailOtpVerification({ ...input, email: "changed@example.com" }), false);
  assert.equal(await consumeEmailOtpVerification({ ...input, emailVersion: 3 }), false);
  assert.equal(await consumeEmailOtpVerification({ ...input, tokenVersion: 2 }), false);
  assert.equal(await consumeEmailOtpVerification(input), true);
  assert.equal(await consumeEmailOtpVerification(input), false);
});

test("legacy anonymous email-existence responses remain non-enumerating", async () => {
  const a = response(), b = response();
  await checkEmailExists(/** @type {import('express').Request} */ (/** @type {unknown} */ ({ query: { email: account.email } })), a.res);
  await checkEmailExists(/** @type {import('express').Request} */ (/** @type {unknown} */ ({ query: { email: "missing@example.com" } })), b.res);
  assert.deepEqual(a.state.body, b.state.body);
});

test("migration drops email-only uniqueness, preserves shared addresses and phone index, and is idempotent", async () => {
  const phoneIndex = { name: "mobileUsersPhoneNumberUnique", key: { phoneNumber: 1 }, unique: true };
  let userIndexes = [phoneIndex, { name: RECOVERY_EMAIL_INDEX, key: { email: 1 }, unique: true }];
  let otpIndexes = [{ name: "email_1_purpose_1", key: { email: 1, purpose: 1 }, unique: true }];
  const records = [{ _id: userId, email: " Shared@Example.COM ", emailVersion: 0, emailVerified: false },
    { _id: new mongoose.Types.ObjectId(), email: "shared@example.com", emailVersion: 0, emailVerified: false }];
  const mutations = [];
  const users = { indexes: async () => userIndexes, dropIndex: async (name) => { userIndexes = userIndexes.filter((index) => index.name !== name); mutations.push(name); },
    find: () => ({ batchSize: () => ({ async *[Symbol.asyncIterator]() { yield* records; }, close: async () => {} }) }),
    bulkWrite: async (ops) => { for (const op of ops) { const record = records.find((row) => row._id === op.updateOne.filter._id); Object.assign(record, op.updateOne.update.$set); } mutations.push("normalize"); } };
  const otps = { indexes: async () => otpIndexes, createIndex: async (key, options) => { otpIndexes.push({ key, ...options }); mutations.push("scope"); },
    dropIndex: async (name) => { otpIndexes = otpIndexes.filter((index) => index.name !== name); mutations.push(name); } };
  const collection = /** @type {mongoose.mongo.Collection} */ (/** @type {unknown} */ (users));
  const otpCollection = /** @type {mongoose.mongo.Collection} */ (/** @type {unknown} */ (otps));
  const dry = await migrateRecoveryEmails(collection, { apply: false, otpCollection });
  assert.equal(dry.accountsNeedingNormalization, 1);
  assert.equal(mutations.length, 0);
  const applied = await migrateRecoveryEmails(collection, { apply: true, otpCollection });
  assert.equal(applied.indexesDropped, 2);
  assert.deepEqual(records.map((record) => record.email), ["shared@example.com", "shared@example.com"]);
  assert.deepEqual(userIndexes, [phoneIndex]);
  const before = mutations.length;
  await migrateRecoveryEmails(collection, { apply: true, otpCollection });
  assert.equal(mutations.length, before);
});

test("normalization never invents recovery verification evidence", () => {
  const op = normalizedAccountUpdate({ _id: userId, email: " Shared@Example.COM ", emailVerified: true });
  assert.equal(op?.updateOne.update.$set.emailVerified, false);
  assert.equal(normalizedAccountUpdate({ _id: userId, email: account.email, emailVerified: true, emailVerifiedAt: new Date(), emailVersion: 2 }), null);
});
