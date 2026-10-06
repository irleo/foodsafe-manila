// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import MobileOtp from "../models/MobileOtp.js";
import { mobileOtpDelivery, sendMobileOtp, verifyMobileOtp, consumeMobileOtpVerification } from "../services/mobileOtpService.js";

const identity = /** @type {const} */ ({ phone: "09171234567", purpose: "registration" });

/** @typedef {{phone: string, purpose: string, attempts: number, lastSentAt: Date, expiresAt: Date, otpHash: string | null, verificationTokenHash: string | null, verifiedAt: Date | null, consumedAt: Date | null}} OtpDocument */

/** @param {unknown} actual @param {unknown} expected */
function matchesValue(actual, expected) {
  if (expected && typeof expected === "object") {
    if ("$lt" in expected) return typeof actual === "number" && typeof expected.$lt === "number" && actual < expected.$lt;
    if ("$gt" in expected) return actual instanceof Date && expected.$gt instanceof Date && actual > expected.$gt;
    if ("$ne" in expected) return actual !== expected.$ne;
  }
  return actual === expected;
}

/** @param {import('node:test').TestContext} t */
function challengeStore(t) {
  process.env.OTP_HASH_SECRET = "mock-sms-concurrency-secret";
  /** @type {OtpDocument | null} */
  let document = null;
  /** @type {string[]} */
  const messages = [];
  t.mock.method(MobileOtp, "findOne", () => ({ select: () => ({ lean: async () => document && { ...document } }) }));
  // Model atomic MongoDB matching and mutation, including unique upsert failure.
  t.mock.method(MobileOtp, "findOneAndUpdate", async (filter, update, options) => {
    const matches = document && Object.entries(filter).every(([key, expected]) => {
      if (key === "$or") {
        const clauses = /** @type {{lastSentAt: null | {$lte: Date}}[]} */ (expected);
        return clauses.some((clause) => clause.lastSentAt === null
          ? document?.lastSentAt == null : Boolean(document && document.lastSentAt <= clause.lastSentAt.$lte));
      }
      return matchesValue(document?.[/** @type {keyof OtpDocument} */ (key)], expected);
    });
    if (!matches && !options?.upsert) return null;
    if (!matches && document) throw Object.assign(new Error("Duplicate challenge"), { code: 11000 });
    document ??= /** @type {OtpDocument} */ ({ ...identity, ...update.$set });
    Object.assign(document, update.$set);
    if (update.$inc) document.attempts += update.$inc.attempts;
    return { ...document };
  });
  t.mock.method(mobileOtpDelivery, "send", async ({ message }) => { messages.push(message); });
  return {
    messages,
    code: () => messages.at(-1)?.match(/\b\d{6}\b/)?.[0] ?? "",
    state: () => { assert.ok(document); return document; },
  };
}

test("parallel SMS sends reserve one cooldown and deliver only once", async (t) => {
  const store = challengeStore(t);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => sendMobileOtp(identity)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  for (const result of results) if (result.status === "rejected") {
    assert.equal(result.reason.code, "OTP_COOLDOWN");
    assert.ok(result.reason.retryAfterSeconds > 0 && result.reason.retryAfterSeconds <= 60);
  }
  assert.equal(store.messages.length, 1);
});

test("failed provider delivery retains cooldown reservation", async (t) => {
  const store = challengeStore(t);
  const delivery = t.mock.method(mobileOtpDelivery, "send", async () => { throw new Error("Mock provider unavailable"); });
  await assert.rejects(sendMobileOtp(identity), /provider unavailable/);
  const sentAt = store.state().lastSentAt;
  await assert.rejects(sendMobileOtp(identity), { code: "OTP_COOLDOWN" });
  assert.equal(delivery.mock.callCount(), 1);
  assert.equal(store.state().lastSentAt, sentAt);
});

test("parallel wrong guesses increment atomically and stop at five", async (t) => {
  const store = challengeStore(t);
  await sendMobileOtp(identity);
  const otp = store.code() === "000000" ? "000001" : "000000";
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => verifyMobileOtp({ ...identity, otp })));
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(store.state().attempts, 5);
  await assert.rejects(verifyMobileOtp({ ...identity, otp: store.code() }));
  assert.equal(store.state().verifiedAt, null);
});

test("parallel correct guesses issue one proof and consume it only once", async (t) => {
  const store = challengeStore(t);
  await sendMobileOtp(identity);
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => verifyMobileOtp({ ...identity, otp: store.code() })));
  const successful = results.filter((r) => r.status === "fulfilled");
  assert.equal(successful.length, 1);
  const proof = /** @type {PromiseFulfilledResult<{verificationToken: string}>} */ (successful[0]).value;
  assert.match(proof.verificationToken, /^[a-f0-9]{64}$/);
  assert.equal(store.state().attempts, 0);
  assert.equal(await consumeMobileOtpVerification({ ...identity, verificationToken: "forged" }), false);
  const consumed = await Promise.all(Array.from({ length: 5 }, () => consumeMobileOtpVerification({ ...identity, ...proof })));
  assert.equal(consumed.filter(Boolean).length, 1);
});

test("expired proof and resend-invalidated proof cannot authorize registration", async (t) => {
  const store = challengeStore(t);
  await sendMobileOtp(identity);
  const proof = await verifyMobileOtp({ ...identity, otp: store.code() });
  store.state().expiresAt = new Date(Date.now() - 1);
  assert.equal(await consumeMobileOtpVerification({ ...identity, ...proof }), false);
  store.state().lastSentAt = new Date(Date.now() - 61_000);
  await sendMobileOtp(identity);
  assert.equal(store.messages.length, 2);
  assert.equal(await consumeMobileOtpVerification({ ...identity, ...proof }), false);
  assert.equal(store.state().verifiedAt, null);
  assert.equal(store.state().attempts, 0);
});
