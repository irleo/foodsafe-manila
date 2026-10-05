// @ts-check
import crypto from "node:crypto";
import MobileOtp from "../models/MobileOtp.js";
import { sendSemaphoreSms } from "./semaphoreSmsService.js";

/** @typedef {'registration' | 'password_reset'} MobilePurpose */
const OTP_TTL_MS = 300_000;
const VERIFICATION_TTL_MS = 600_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;
export const mobileOtpDelivery = { send: sendSemaphoreSms };

export class MobileOtpError extends Error {
  /** @param {string} code @param {string} message @param {number=} retryAfterSeconds */
  constructor(code, message, retryAfterSeconds) {
    super(message);
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** @param {string} value */
function hashValue(value) {
  const secret = process.env.OTP_HASH_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("An OTP hashing secret must be configured.");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/** @param {{phone: string, purpose: MobilePurpose, otp: string}} input */
function hashOtp({ phone, purpose, otp }) {
  return hashValue(`otp:${phone}:${purpose}:${otp}`);
}

/** @param {string} token */
function hashVerificationToken(token) {
  return hashValue(`verification:${token}`);
}

function invalidCode() {
  return new MobileOtpError("OTP_INVALID", "Verification code is invalid or expired");
}

/** @param {{phone: string, purpose: MobilePurpose}} input */
export async function sendMobileOtp({ phone, purpose }) {
  const now = new Date();
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  try {
    // Reserve before delivery. The unique phone/purpose index has one winner
    // when simultaneous cooldown upserts compete for the same challenge.
    await MobileOtp.findOneAndUpdate({
      phone, purpose,
      $or: [{ lastSentAt: { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } }, { lastSentAt: null }],
    }, { $set: {
      otpHash: hashOtp({ phone, purpose, otp }), attempts: 0,
      lastSentAt: now, expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      verifiedAt: null, verificationTokenHash: null, consumedAt: null,
    } }, { upsert: true, runValidators: true });
  } catch (error) {
    if (/** @type {{code?: number}} */ (error).code !== 11000) throw error;
    const existing = await MobileOtp.findOne({ phone, purpose }).select("lastSentAt").lean();
    const remaining = existing
      ? Math.ceil((new Date(existing.lastSentAt).getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000)
      : RESEND_COOLDOWN_MS / 1000;
    throw new MobileOtpError("OTP_COOLDOWN", "Please wait before requesting another code", Math.max(1, remaining));
  }
  await mobileOtpDelivery.send({ phone,
    message: `Your One Time Password is ${otp}. It expires in 5 minutes. Do not share this code.` });
  return { expiresInSeconds: OTP_TTL_MS / 1000, retryAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
}

/** @param {{phone: string, purpose: MobilePurpose, otp: string}} input */
export async function verifyMobileOtp({ phone, purpose, otp }) {
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) throw invalidCode();
  const now = new Date();
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const active = { phone, purpose, consumedAt: null, verifiedAt: null,
    expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } };
  const verified = await MobileOtp.findOneAndUpdate({ ...active, otpHash: hashOtp({ phone, purpose, otp }) },
    { $set: { otpHash: null, verifiedAt: now,
      verificationTokenHash: hashVerificationToken(verificationToken),
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS) } }, { new: true });
  if (verified) return { verificationToken, expiresInSeconds: VERIFICATION_TTL_MS / 1000 };

  // Increment only an active, unverified challenge; $inc cannot lose parallel guesses.
  const failed = await MobileOtp.findOneAndUpdate({ ...active, otpHash: { $ne: null } },
    { $inc: { attempts: 1 } }, { new: true });
  if (failed?.attempts >= MAX_ATTEMPTS) {
    throw new MobileOtpError("OTP_ATTEMPTS_EXCEEDED", "Too many incorrect attempts. Request a new code");
  }
  throw invalidCode();
}

/** @param {{phone: string, purpose: MobilePurpose, verificationToken: string}} input @param {import('mongoose').ClientSession=} session */
export async function consumeMobileOtpVerification({ phone, purpose, verificationToken }, session) {
  if (typeof verificationToken !== "string" || !verificationToken) return false;
  const now = new Date();
  // Match proof and expiry in the consuming update, not in an earlier read.
  const consumed = await MobileOtp.findOneAndUpdate({
    phone, purpose, verificationTokenHash: hashVerificationToken(verificationToken),
    verifiedAt: { $ne: null }, consumedAt: null, expiresAt: { $gt: now },
  }, { $set: { consumedAt: now, verificationTokenHash: null } }, { new: true, ...(session ? { session } : {}) });
  return Boolean(consumed);
}
