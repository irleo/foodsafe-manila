// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import MobileUser from "../models/MobileUser.js";
import MobileEmailOtp from "../models/MobileEmailOtp.js";
import { updateMobileProfile } from "../controllers/mobileUserController.js";
import { emailOtpDelivery } from "../controllers/mobileEmailOtpController.js";
import { mobileOtpDelivery } from "../services/mobileOtpService.js";
import { RECOVERY_EMAIL_INDEX } from "../utils/recoveryEmail.js";

/** @param {import('node:test').TestContext} t */
function setup(t) {
  const account = { _id: "citizen-1", username: "Tester", phoneNumber: "09171234567",
    password: "stored-hash", email: "old@example.com", emailVerified: true, emailVersion: 2,
    emailVerifiedAt: new Date(), save: async () => account };
  t.mock.method(MobileUser, "findById", async () => account);
  t.mock.method(MobileUser, "exists", async () => null);
  t.mock.method(MobileUser.collection, "indexes", async () => [{
    name: RECOVERY_EMAIL_INDEX, unique: true, key: { email: 1 },
    partialFilterExpression: { email: { $type: "string", $gt: "" } },
  }]);
  t.mock.method(MobileEmailOtp, "findOneAndUpdate", () => { throw new Error("Profile saves must not touch email OTPs"); });
  for (const delivery of [emailOtpDelivery, mobileOtpDelivery]) {
    t.mock.method(delivery, "send", () => { throw new Error("Profile saves must not send OTPs"); });
  }
  const compare = t.mock.method(bcrypt, "compare", async (plain, hashed) => {
    assert.equal(hashed, "stored-hash");
    return plain === "CurrentPass1!";
  });
  const res = { statusCode: 200, body: /** @type {Record<string, unknown> | null} */ (null),
    /** @param {number} code */ status(code) { this.statusCode = code; return this; },
    /** @param {Record<string, unknown>} body */ json(body) { this.body = body; return this; } };
  /** @param {Record<string, unknown>} body */
  const request = (body) => /** @type {import('express').Request} */ (/** @type {unknown} */ ({
    user: { id: "citizen-1", accountType: "citizen" }, params: { id: "citizen-1" }, body,
  }));
  const response = /** @type {import('express').Response} */ (/** @type {unknown} */ (res));
  return { account, compare, res, request, response };
}

for (const change of [{ email: "new@example.com" }, { email: "" }, { phone: "09179999999" }]) {
  test(`contact change ${JSON.stringify(change)} requires password and leaves identity unchanged`, async (t) => {
    const { account, res, request, response } = setup(t);
    t.mock.method(MobileUser, "findOneAndUpdate", () => { throw new Error("Unauthorized write"); });
    await updateMobileProfile(request(change), response);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, "CURRENT_PASSWORD_REQUIRED");
    assert.equal(account.email, "old@example.com");
    assert.equal(account.phoneNumber, "09171234567");
  });
}

test("wrong current password cannot redirect recovery or log out a valid session", async (t) => {
  const { account, res, request, response } = setup(t);
  await updateMobileProfile(request({ email: "new@example.com", currentPassword: "WrongPass1!" }), response);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.code, "CURRENT_PASSWORD_INVALID");
  assert.equal(account.email, "old@example.com");
});

test("normalized email save is OTP-free and uses password/version compare-and-set", async (t) => {
  const { res, request, response } = setup(t);
  t.mock.method(MobileUser, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter, { _id: "citizen-1", email: "old@example.com", emailVersion: 2, password: "stored-hash" });
    assert.equal(update.$set.email, "new@example.com");
    assert.equal(update.$set.emailVerified, false);
    assert.equal(update.$inc.emailVersion, 1);
    assert.deepEqual(update.$unset, { emailVerifiedAt: "" });
    assert.equal(update.$set.currentPassword, undefined);
    return { _id: "citizen-1", ...update.$set, emailVersion: 3 };
  });
  await updateMobileProfile(request({ email: " New@Example.COM ", currentPassword: "CurrentPass1!" }), response);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.email, "new@example.com");
  assert.equal(res.body?.emailVerified, false);
});

test("concurrent reset or contact edit prevents stale recovery email replacement", async (t) => {
  const { res, request, response } = setup(t);
  t.mock.method(MobileUser, "findOneAndUpdate", async () => null);
  await updateMobileProfile(request({ email: "new@example.com", currentPassword: "CurrentPass1!" }), response);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body?.code, "PROFILE_CHANGED");
});

test("display-name or case-only contact edits do not require reauthentication", async (t) => {
  const { compare, res, request, response } = setup(t);
  await updateMobileProfile(request({ username: "New Name", email: " OLD@EXAMPLE.COM ", phone: "+639171234567" }), response);
  assert.equal(res.statusCode, 200);
  assert.equal(compare.mock.callCount(), 0);
  assert.equal(res.body?.emailVerified, true);
});
