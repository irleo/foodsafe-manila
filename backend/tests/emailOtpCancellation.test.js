// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import authRouter from "../routes/auth.js";
import MobileEmailOtp from "../models/MobileEmailOtp.js";
import MobileUser from "../models/MobileUser.js";
import { emailOtpDelivery, requestRecoveryEmailOtp } from "../controllers/mobileEmailOtpController.js";
import { RECOVERY_EMAIL_INDEX } from "../utils/recoveryEmail.js";

/** @param {Record<string, unknown>} body */
async function removedCancellation(body) {
  // Exercise the actual router without opening a server or network connection.
  return new Promise((resolve, reject) => {
    const req = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
      method: "POST", url: "/email/otp/cancel", headers: {}, body,
    }));
    const res = /** @type {import('express').Response} */ (/** @type {unknown} */ ({
      status() { reject(new Error("Removed endpoint must not handle requests")); return this; },
      json() { reject(new Error("Removed endpoint must not handle requests")); return this; },
    }));
    try {
      authRouter.handle(req, res, (error) => error ? reject(error) : resolve(404));
    } catch (error) {
      reject(error);
    }
  });
}

function response() {
  return {
    statusCode: 200,
    body: /** @type {Record<string, unknown> | null} */ (null),
    /** @param {number} code */
    status(code) { this.statusCode = code; return this; },
    /** @param {Record<string, unknown>} body */
    json(body) { this.body = body; return this; },
  };
}

const cases = [
  { name: "forged victim email", body: { email: "victim@example.com", purpose: "password_reset" } },
  { name: "wrong challenge proof", body: { email: "victim@example.com", purpose: "password_reset", challengeId: "forged", verificationToken: "wrong" } },
  { name: "expired challenge", body: { email: "victim@example.com", purpose: "password_reset", challengeId: "expired" } },
  { name: "ownership verification purpose", body: { email: "victim@example.com", purpose: "recovery_email" } },
];

for (const scenario of cases) {
  test(`removed cancellation rejects ${scenario.name} without touching challenges`, async (t) => {
    for (const method of /** @type {const} */ (["findOneAndUpdate", "updateOne", "deleteOne"])) {
      t.mock.method(MobileEmailOtp, method, () => { throw new Error("Cancellation must never access OTP records"); });
    }
    assert.equal(await removedCancellation(scenario.body), 404);
  });
}

test("repeated cancellation requests remain unhandled and cannot mutate a challenge", async (t) => {
  const mutation = t.mock.method(MobileEmailOtp, "findOneAndUpdate", () => {
    throw new Error("Cancellation must never access OTP records");
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal(await removedCancellation({ email: "victim@example.com", purpose: "password_reset" }), 404);
  }
  assert.equal(mutation.mock.callCount(), 0);
});

test("closing recovery cannot reset lastSentAt or bypass resend cooldown", async (t) => {
  process.env.OTP_HASH_SECRET = "mock-otp-cancellation-test-only";
  const sentAt = new Date();
  let lastSentAt = sentAt;
  t.mock.method(MobileUser.collection, "indexes", async () => [{
    name: RECOVERY_EMAIL_INDEX, key: { email: 1 }, unique: true,
    partialFilterExpression: { email: { $type: "string", $gt: "" } },
  }]);
  t.mock.method(MobileUser, "findOne", () => ({
    select: () => ({ lean: async () => ({ _id: "citizen-owner", emailVersion: 1 }) }),
  }));
  const reserve = t.mock.method(MobileEmailOtp, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(filter.email, "victim@example.com");
    assert.equal(filter.purpose, "recovery_email");
    assert.equal(options.upsert, true);
    const cutoff = filter.$or[0].lastSentAt.$lte;
    assert.ok(cutoff instanceof Date);
    // Simulate the existing unique-index/upsert contract during cooldown.
    if (lastSentAt > cutoff) throw Object.assign(new Error("cooldown"), { code: 11000 });
    lastSentAt = update.$set.lastSentAt;
    return {};
  });
  const delivery = t.mock.method(emailOtpDelivery, "send", async () => {});
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal(await removedCancellation({ email: "victim@example.com", purpose: "recovery_email" }), 404);
    assert.equal(reserve.mock.callCount(), attempt);
    assert.equal(lastSentAt, sentAt);
    const res = response();
    await requestRecoveryEmailOtp(/** @type {import('express').Request} */ (/** @type {unknown} */ ({
      user: { id: "citizen-owner", accountType: "citizen" }, body: { email: "victim@example.com" },
    })), /** @type {import('express').Response} */ (/** @type {unknown} */ (res)));
    assert.equal(res.statusCode, 429);
    assert.equal(res.body?.retryAfterSeconds, 60);
  }
  assert.equal(delivery.mock.callCount(), 0);
  assert.equal(lastSentAt, sentAt);
  lastSentAt = new Date(sentAt.getTime() - 61_000);
  const res = response();
  await requestRecoveryEmailOtp(/** @type {import('express').Request} */ (/** @type {unknown} */ ({
    user: { id: "citizen-owner", accountType: "citizen" }, body: { email: "victim@example.com" },
  })), /** @type {import('express').Response} */ (/** @type {unknown} */ (res)));
  assert.equal(res.statusCode, 200);
  assert.equal(delivery.mock.callCount(), 1);
  assert.ok(lastSentAt >= sentAt);
});
