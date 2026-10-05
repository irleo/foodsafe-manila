// @ts-check
import crypto from "node:crypto";
import mongoose from "mongoose";
import MobileOtp from "../models/MobileOtp.js";
import MobileUser from "../models/MobileUser.js";
import { sendSemaphoreSms } from "./semaphoreSmsService.js";

const TTL_MS = 300_000;
const COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;
export const phoneChangeDelivery = { send: sendSemaphoreSms };

export class PhoneChangeError extends Error {
  /** @param {string} code @param {string} message @param {number} status @param {number=} retryAfterSeconds */
  constructor(code, message, status, retryAfterSeconds) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** @param {{userId: string, phone: string, flowId: string, otp: string}} input */
function hashCode({ userId, phone, flowId, otp }) {
  const secret = process.env.OTP_HASH_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("OTP hashing secret is required");
  return crypto.createHmac("sha256", secret)
    .update(`phone_change:${userId}:${phone}:${flowId}:${otp}`).digest("hex");
}

/** @param {string} flowId */
export function validPhoneChangeFlow(flowId) {
  return typeof flowId === "string" && /^[a-f0-9]{64}$/.test(flowId);
}

function expired() {
  return new PhoneChangeError("OTP_FLOW_EXPIRED", "This verification has expired. Start again to request a new code.", 410);
}

/** @param {{userId: string, phone: string, flowId?: string}} input */
export async function sendPhoneChangeOtp({ userId, phone, flowId }) {
  const user = await MobileUser.findById(userId).select("phoneNumber").lean();
  if (!user) throw new PhoneChangeError("ACCOUNT_UNAVAILABLE", "Your account is unavailable.", 404);
  if (user.phoneNumber === phone) throw new PhoneChangeError("PHONE_UNCHANGED", "Enter a different phone number.", 400);
  if (await MobileUser.exists({ phoneNumber: phone })) {
    throw new PhoneChangeError("PHONE_UNAVAILABLE", "This phone number cannot be used.", 409);
  }
  const now = new Date();
  const scope = { phone, purpose: "phone_change" };
  const existing = await MobileOtp.findOne(scope).select("userId flowId originalPhone lastSentAt expiresAt consumedAt").lean();
  if (flowId && (!existing || existing.flowId !== flowId || String(existing.userId) !== userId ||
    existing.originalPhone !== user.phoneNumber || existing.expiresAt <= now || existing.consumedAt)) throw expired();
  if (existing && existing.expiresAt > now && String(existing.userId) !== userId) {
    throw new PhoneChangeError("PHONE_UNAVAILABLE", "This phone number cannot be used.", 409);
  }
  const remaining = existing ? Math.ceil((new Date(existing.lastSentAt).getTime() + COOLDOWN_MS - now.getTime()) / 1000) : 0;
  if (remaining > 0) throw new PhoneChangeError("OTP_COOLDOWN", "Please wait before requesting another code.", 429, remaining);
  const challenge = flowId || crypto.randomBytes(32).toString("hex");
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  try {
    // Reserve before SMS delivery; the existing unique phone/purpose index
    // prevents concurrent sends from bypassing the cooldown.
    const record = await MobileOtp.findOneAndUpdate({
      ...scope,
      ...(flowId ? { flowId, userId, originalPhone: user.phoneNumber, consumedAt: null, expiresAt: { $gt: now } } : {}),
      $and: [
        { $or: [{ lastSentAt: { $lte: new Date(now.getTime() - COOLDOWN_MS) } }, { lastSentAt: null }] },
        { $or: [{ userId }, { userId: null }, { expiresAt: { $lte: now } }] },
      ],
    }, { $set: {
      userId, flowId: challenge, originalPhone: user.phoneNumber,
      otpHash: hashCode({ userId, phone, flowId: challenge, otp }),
      attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + TTL_MS),
      verifiedAt: null, consumedAt: null, verificationTokenHash: null,
    } }, { upsert: !flowId, new: true, runValidators: true });
    if (!record) throw new PhoneChangeError("OTP_COOLDOWN", "Please wait before requesting another code.", 429, 60);
  } catch (error) {
    if (/** @type {{code?: number}} */ (error).code === 11000) {
      throw new PhoneChangeError("OTP_COOLDOWN", "Please wait before requesting another code.", 429, 60);
    }
    throw error;
  }
  await phoneChangeDelivery.send({ phone, message: `Your phone change verification code is ${otp}. It expires in 5 minutes. Do not share this code.` });
  return { flowId: challenge, maskedPhone: `+63 *** *** ${phone.slice(-4)}`, expiresInSeconds: TTL_MS / 1000, retryAfterSeconds: COOLDOWN_MS / 1000 };
}

/** @param {{userId: string, phone: string, originalPhone: string, flowId: string, otp: string, profile: Record<string, unknown>, expectedPasswordHash?: string, expectedEmail?: string, expectedEmailVersion?: number}} input */
export async function commitPhoneChange({ userId, phone, originalPhone, flowId, otp, profile, expectedPasswordHash, expectedEmail, expectedEmailVersion }) {
  if (!validPhoneChangeFlow(flowId)) throw new PhoneChangeError("PHONE_VERIFICATION_REQUIRED", "Verify your new phone number before saving it.", 403);
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) throw new PhoneChangeError("OTP_INVALID", "Enter the 6-digit verification code.", 400);
  const now = new Date();
  const scope = { userId, phone, flowId, originalPhone, purpose: "phone_change", consumedAt: null };
  const record = await MobileOtp.findOne(scope).select("expiresAt attempts").lean();
  if (!record || record.expiresAt <= now) throw expired();
  if (record.attempts >= MAX_ATTEMPTS) throw new PhoneChangeError("OTP_ATTEMPTS_EXCEEDED", "Too many incorrect attempts. Start verification again.", 429);
  const otpHash = hashCode({ userId, phone, flowId, otp });
  return mongoose.connection.transaction(async (session) => {
    const consumed = await MobileOtp.findOneAndUpdate({ ...scope, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS }, otpHash },
      { $set: { consumedAt: new Date(), verifiedAt: new Date(), otpHash: null } }, { new: true, session });
    if (!consumed) {
      // Return an error rather than throwing until the failed-attempt write commits.
      await MobileOtp.updateOne({ ...scope, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS }, otpHash: { $ne: null } },
        { $inc: { attempts: 1 } }, { session });
      return new PhoneChangeError("OTP_INVALID", "The code is incorrect or no longer valid.", 400);
    }
    const updated = await MobileUser.findOneAndUpdate({ _id: userId, phoneNumber: originalPhone,
      ...(expectedPasswordHash ? { password: expectedPasswordHash, email: expectedEmail, emailVersion: expectedEmailVersion } : {}) },
      { $set: { ...profile, phoneNumber: phone }, ...(!profile.emailVerifiedAt ? { $unset: { emailVerifiedAt: 1 } } : {}) }, { new: true, runValidators: true, session });
    if (!updated) throw expired();
    return updated;
  }).then((result) => {
    if (result instanceof PhoneChangeError) throw result;
    return result;
  });
}
