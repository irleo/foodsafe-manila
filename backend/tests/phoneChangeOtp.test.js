import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import MobileUser from "../models/MobileUser.js";
import MobileOtp from "../models/MobileOtp.js";
import { sendPhoneChangeOtp, commitPhoneChange, phoneChangeDelivery } from "../services/phoneChangeOtpService.js";
import { updateMobileProfile } from "../controllers/mobileUserController.js";
import { requestPhoneChangeOtp } from "../controllers/phoneChangeOtpController.js";

process.env.OTP_HASH_SECRET = "phone-change-mocked-tests-only";
const userId = String(new mongoose.Types.ObjectId());
const phone = "09171234567";
const originalPhone = "09179999999";
const flowId = "a".repeat(64);
const input = { userId, phone, originalPhone, flowId, otp: "123456", profile: { username: "Tester", email: "", emailVerified: false } };
const query = (value) => ({ select: () => ({ lean: async () => value }) });
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; },
  set() { return this; }, json(body) { this.body = body; return this; } });
function account(t) {
  t.mock.method(MobileUser, "findById", () => query({ phoneNumber: originalPhone }));
  t.mock.method(MobileUser, "exists", async () => null);
}
function active(t, overrides = {}) {
  t.mock.method(MobileOtp, "findOne", (filter) => {
    assert.equal(filter.purpose, "phone_change");
    return query({ userId, flowId, originalPhone, lastSentAt: new Date(Date.now() - 61_000),
      expiresAt: new Date(Date.now() + 300_000), attempts: 0, consumedAt: null, ...overrides });
  });
}
function transaction(t) {
  t.mock.method(mongoose.connection, "transaction", async (fn) => fn("mock-session"));
}

test("phone-change send is authenticated and validates phone and flow input", async () => {
  for (const req of [
    { body: { phone } },
    { user: { id: userId, accountType: "citizen" }, body: { phone: { $ne: null } } },
    { user: { id: userId, accountType: "citizen" }, body: { phone, flowId: "wrong" } },
  ]) {
    const res = response();
    await requestPhoneChangeOtp(req, res);
    assert.ok([400, 403].includes(res.statusCode));
  }
});
test("successful send reserves before delivery and returns opaque flow, mask, expiry and cooldown", async (t) => {
  account(t);
  t.mock.method(MobileOtp, "findOne", () => query(null));
  const calls = [];
  t.mock.method(MobileOtp, "findOneAndUpdate", async (filter, update, options) => {
    calls.push("reserve");
    assert.equal(filter.purpose, "phone_change");
    assert.equal(update.$set.userId, userId);
    assert.equal(update.$set.originalPhone, originalPhone);
    assert.match(update.$set.flowId, /^[a-f0-9]{64}$/);
    assert.equal(update.$set.otpHash.length, 64);
    assert.ok(update.$set.lastSentAt instanceof Date);
    assert.equal(options.upsert, true);
    return {};
  });
  t.mock.method(phoneChangeDelivery, "send", async (sms) => { calls.push("send"); assert.equal(sms.phone, phone); });
  const result = await sendPhoneChangeOtp({ userId, phone });
  assert.deepEqual(calls, ["reserve", "send"]);
  assert.equal(result.maskedPhone, "+63 *** *** 4567");
  assert.equal(result.retryAfterSeconds, 60);
  assert.equal(result.expiresInSeconds, 300);
});
test("active resend cooldown sends no SMS and returns remaining server timing", async (t) => {
  account(t); active(t, { lastSentAt: new Date() });
  const send = t.mock.method(phoneChangeDelivery, "send", async () => {});
  await assert.rejects(sendPhoneChangeOtp({ userId, phone, flowId }), (error) =>
    error.code === "OTP_COOLDOWN" && error.retryAfterSeconds > 0 && error.retryAfterSeconds <= 60);
  assert.equal(send.mock.callCount(), 0);
});
test("resend keeps the owned flow and rotates its OTP hash after cooldown", async (t) => {
  account(t); active(t);
  t.mock.method(MobileOtp, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(filter.flowId, flowId);
    assert.equal(filter.userId, userId);
    assert.equal(options.upsert, false);
    assert.equal(update.$set.flowId, flowId);
    assert.equal(update.$set.attempts, 0);
    return {};
  });
  t.mock.method(phoneChangeDelivery, "send", async () => {});
  assert.equal((await sendPhoneChangeOtp({ userId, phone, flowId })).flowId, flowId);
});
test("wrong, foreign, expired and interrupted flow resends cannot replace challenges", async (t) => {
  account(t);
  let record = null;
  t.mock.method(MobileOtp, "findOne", () => query(record));
  const send = t.mock.method(phoneChangeDelivery, "send", async () => {});
  for (const value of [null, { flowId: "b".repeat(64), userId }, { flowId, userId: "someone-else" },
    { flowId, userId, originalPhone, expiresAt: new Date(0) },
    { flowId, userId, originalPhone, expiresAt: new Date(Date.now() + 300_000), consumedAt: new Date() }]) {
    record = value;
    await assert.rejects(sendPhoneChangeOtp({ userId, phone, flowId }), { code: "OTP_FLOW_EXPIRED" });
  }
  assert.equal(send.mock.callCount(), 0);
});
test("concurrent reservations map unique-index failure to cooldown without SMS", async (t) => {
  account(t); t.mock.method(MobileOtp, "findOne", () => query(null));
  t.mock.method(MobileOtp, "findOneAndUpdate", async () => { throw Object.assign(new Error("duplicate"), { code: 11000 }); });
  const send = t.mock.method(phoneChangeDelivery, "send", async () => {});
  await assert.rejects(sendPhoneChangeOtp({ userId, phone }), { code: "OTP_COOLDOWN" });
  assert.equal(send.mock.callCount(), 0);
});
test("verified code and profile phone commit share one account-bound transaction", async (t) => {
  active(t); transaction(t);
  t.mock.method(MobileOtp, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter.flowId, flowId);
    assert.equal(filter.originalPhone, originalPhone);
    assert.equal(filter.consumedAt, null);
    assert.equal(options.session, "mock-session");
    const expectedHash = crypto.createHmac("sha256", process.env.OTP_HASH_SECRET)
      .update(`phone_change:${userId}:${phone}:${flowId}:123456`).digest("hex");
    assert.equal(filter.otpHash, expectedHash);
    assert.equal(update.$set.otpHash, null);
    return {};
  });
  t.mock.method(MobileUser, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { _id: userId, phoneNumber: originalPhone });
    assert.equal(options.session, "mock-session");
    assert.equal(update.$set.phoneNumber, phone);
    return { _id: userId, ...update.$set };
  });
  assert.equal((await commitPhoneChange(input)).phoneNumber, phone);
});
test("wrong OTP counts attempts but never saves the phone", async (t) => {
  active(t); transaction(t);
  t.mock.method(MobileOtp, "findOneAndUpdate", async () => null);
  const attempts = t.mock.method(MobileOtp, "updateOne", async (filter, update) => {
    assert.equal(filter.userId, userId); assert.equal(update.$inc.attempts, 1); return {};
  });
  const save = t.mock.method(MobileUser, "findOneAndUpdate", async () => {});
  await assert.rejects(commitPhoneChange(input), { code: "OTP_INVALID" });
  assert.equal(attempts.mock.callCount(), 1);
  assert.equal(save.mock.callCount(), 0);
});
test("missing proof, expired challenge and exhausted attempts cannot commit a phone", async (t) => {
  await assert.rejects(commitPhoneChange({ ...input, flowId: undefined }), { code: "PHONE_VERIFICATION_REQUIRED" });
  active(t, { expiresAt: new Date(0) });
  await assert.rejects(commitPhoneChange(input), { code: "OTP_FLOW_EXPIRED" });
});
test("attempt ceiling prevents transaction and commit", async (t) => {
  active(t, { attempts: 5 });
  const tx = t.mock.method(mongoose.connection, "transaction", async () => {});
  await assert.rejects(commitPhoneChange(input), { code: "OTP_ATTEMPTS_EXCEEDED" });
  assert.equal(tx.mock.callCount(), 0);
});
test("legacy profile update cannot change phone with registration verification token", async (t) => {
  t.mock.method(bcrypt, "compare", async () => true);
  const save = t.mock.fn(async () => {});
  t.mock.method(MobileUser, "findById", async () => ({ _id: userId, phoneNumber: originalPhone, email: "", save }));
  t.mock.method(MobileUser, "exists", async () => null);
  const res = response();
  await updateMobileProfile({ user: { id: userId, accountType: "citizen" }, params: { id: userId },
    body: { phone, currentPassword: "CurrentPass1!", verificationToken: "old-registration-proof" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "PHONE_VERIFICATION_REQUIRED");
  assert.equal(save.mock.callCount(), 0);
});
