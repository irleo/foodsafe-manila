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

/** @param {unknown} value @returns {value is string} */
export function validEmailRecoveryFlow(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

/** @param {string} flowId */
export function hashEmailRecoveryFlow(flowId) {
  return hashValue("email-recovery-flow:" + flowId);
}

/** @typedef {{email: string, purpose: string, userId: import('mongoose').Types.ObjectId, phoneNumber: string, emailVersion: number, tokenVersion: number, flowId: string}} RecoveryScope */
/** @param {RecoveryScope & {otp: string}} input */
export function hashEmailOtp({ email, purpose, userId, phoneNumber, emailVersion, tokenVersion, flowId, otp }) {
  return hashValue(JSON.stringify(["email-otp", String(userId), phoneNumber,
    normalizeRecoveryEmail(email), emailVersion, tokenVersion, purpose, flowId, otp]));
}

/** @param {string} token */
export function hashEmailVerificationToken(token) {
  return hashValue("email-verification:" + token);
}

/** @param {RecoveryScope & {verificationToken: string}} input @param {import('mongoose').ClientSession=} session */
export async function consumeEmailOtpVerification(input, session) {
  const { email, purpose, verificationToken, userId, emailVersion, tokenVersion, phoneNumber, flowId } = input;
  if (!userId || !validEmailRecoveryFlow(flowId) || !Number.isSafeInteger(emailVersion) || emailVersion < 0
      || !Number.isSafeInteger(tokenVersion) || tokenVersion < 0
      || !validEmailRecoveryFlow(verificationToken)) return false;
  const now = new Date();
  const consumed = await MobileEmailOtp.findOneAndUpdate({
    email: normalizeRecoveryEmail(email), purpose, userId, emailVersion, tokenVersion, phoneNumber,
    flowIdHash: hashEmailRecoveryFlow(flowId),
    verificationTokenHash: hashEmailVerificationToken(verificationToken),
    verifiedAt: { $ne: null }, consumedAt: null, expiresAt: { $gt: now },
  }, { $set: { consumedAt: now }, $unset: { verificationTokenHash: "" } }, { new: true, ...(session ? { session } : {}) });
  return Boolean(consumed);
}
