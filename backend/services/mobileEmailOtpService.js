// @ts-check
import crypto from "node:crypto";
import MobileEmailOtp from "../models/MobileEmailOtp.js";
import { normalizeRecoveryEmail } from "../utils/recoveryEmail.js";

/** @param {string} value */
function hashValue(value) {
  const secret = process.env.OTP_HASH_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("An OTP hashing secret must be configured.");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/** @param {{email: string, purpose: string, otp: string}} input */
export function hashEmailOtp({ email, purpose, otp }) {
  return hashValue("email-otp:" + normalizeRecoveryEmail(email) + ":" + purpose + ":" + otp);
}

/** @param {string} token */
export function hashEmailVerificationToken(token) {
  return hashValue("email-verification:" + token);
}

/** @param {{email: string, purpose: string, verificationToken: string, userId: import('mongoose').Types.ObjectId, emailVersion: number}} input */
export async function consumeEmailOtpVerification({ email, purpose, verificationToken, userId, emailVersion }) {
  if (!userId || !Number.isSafeInteger(emailVersion) || emailVersion < 0
      || typeof verificationToken !== "string" || !/^[a-f0-9]{64}$/.test(verificationToken)) return false;
  const now = new Date();
  // Bind proof to its account and consume atomically, including the exact token.
  const consumed = await MobileEmailOtp.findOneAndUpdate({
    email: normalizeRecoveryEmail(email), purpose, userId, emailVersion,
    verificationTokenHash: hashEmailVerificationToken(verificationToken),
    verifiedAt: { $ne: null }, consumedAt: null, expiresAt: { $gt: now },
  }, { $set: { consumedAt: now }, $unset: { verificationTokenHash: "" } }, { new: true });
  return Boolean(consumed);
}
