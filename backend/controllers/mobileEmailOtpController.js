// @ts-check
import crypto from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import MobileEmailOtp from "../models/MobileEmailOtp.js";
import { brevoTimeoutMs, sendResetOtpEmail } from "../services/emailService.js";
import { logRequestError } from "../utils/serverLogger.js";
import { normalizePhone } from "../utils/citizenAuth.js";
import { normalizeRecoveryEmail, isValidRecoveryEmail } from "../utils/recoveryEmail.js";
import { findRecoveryAccount, emailRecoveryIndexReady } from "../services/recoveryEmailService.js";
import { hashEmailOtp, hashEmailRecoveryFlow, hashEmailVerificationToken, validEmailRecoveryFlow } from "../services/mobileEmailOtpService.js";

const PURPOSE = "password_reset";
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const INVALID_CODE = { code: "EMAIL_OTP_INVALID", message: "This recovery code is incorrect or expired. Check it or request a new code." };
export const emailOtpDelivery = { send: sendResetOtpEmail };

/** @param {import('express').Request} req @param {import('express').Response} res */
function parseRequest(req, res) {
  const phone = req.body?.phone;
  if (typeof phone !== "string" || !/^(?:09\d{9}|\+?639\d{9})$/.test(phone.trim())) {
    res.status(400).json({ code: "PHONE_INVALID", message: "Enter your registered mobile number to recover this account." });
    return null;
  }
  if (req.body?.purpose != null && req.body.purpose !== PURPOSE || req.body?.email != null
      || req.body?.flowId != null && !validEmailRecoveryFlow(req.body.flowId)) {
    res.status(400).json({ message: "Enter your registered mobile number and restart email recovery." });
    return null;
  }
  return { phone: normalizePhone(phone), flowId: /** @type {string | undefined} */ (req.body?.flowId) };
}

/** @param {import('express').Response} res @param {number} notBefore @param {string} flowId */
async function anonymousResponse(res, notBefore, flowId) {
  const remaining = Math.max(0, notBefore - Date.now());
  if (remaining > 0) await delay(remaining);
  // Do not disclose account existence, the saved address, cooldown, or provider failure.
  return res.status(202).json({ message: "If this account has a recovery email, a code will be sent there.",
    flowId, expiresInSeconds: 300, retryAfterSeconds: 60 });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function requestEmailOtp(req, res) {
  const request = parseRequest(req, res);
  if (!request) return;
  const respondAt = Date.now() + brevoTimeoutMs() + 250;
  const flowId = request.flowId || crypto.randomBytes(32).toString("hex");
  try {
    const user = await findRecoveryAccount(request.phone);
    if (!user || !isValidRecoveryEmail(user.email, true)) return anonymousResponse(res, respondAt, flowId);
    if (!await emailRecoveryIndexReady()) throw new Error("Account-bound email recovery index must be migrated before sending codes.");
    const email = normalizeRecoveryEmail(user.email);
    const now = new Date();
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const scope = { userId: user._id, purpose: PURPOSE, email, phoneNumber: user.phoneNumber,
      emailVersion: user.emailVersion || 0, tokenVersion: user.tokenVersion || 0, flowId };
    const accountScope = { userId: user._id, purpose: PURPOSE };
    const filter = { ...accountScope, flowIdHash: request.flowId ? hashEmailRecoveryFlow(flowId) : { $type: "string" },
      ...(request.flowId ? { email, phoneNumber: user.phoneNumber, emailVersion: scope.emailVersion,
        tokenVersion: scope.tokenVersion, consumedAt: null, expiresAt: { $gt: now } } : {}),
      $or: [{ lastSentAt: { $lte: new Date(now.getTime() - 60_000) } }, { lastSentAt: null }] };
    // Only a fresh flow may upsert. A foreign/expired resend cannot replace another challenge.
    const reserved = await MobileEmailOtp.findOneAndUpdate(filter, { $set: {
      ...accountScope, email, phoneNumber: user.phoneNumber, emailVersion: scope.emailVersion, tokenVersion: scope.tokenVersion,
      flowIdHash: hashEmailRecoveryFlow(flowId), otpHash: hashEmailOtp({ ...scope, otp }),
      verificationTokenHash: null, verifiedAt: null, consumedAt: null,
      attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    } }, { upsert: !request.flowId, new: true, runValidators: true });
    if (reserved) await emailOtpDelivery.send({ toEmail: email, otp, expiresMinutes: 5 });
    return anonymousResponse(res, respondAt, flowId);
  } catch (error) {
    if (/** @type {{code?: number}} */ (error).code !== 11000) logRequestError(error, req, "MOBILE_EMAIL_OTP_SEND_ERROR");
    return anonymousResponse(res, respondAt, flowId);
  }
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function confirmEmailOtp(req, res) {
  const request = parseRequest(req, res);
  if (!request) return;
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  if (!/^\d{6}$/.test(otp) || !request.flowId) return res.status(400).json(INVALID_CODE);
  try {
    const user = await findRecoveryAccount(request.phone);
    if (!user || !isValidRecoveryEmail(user.email, true)) return res.status(400).json(INVALID_CODE);
    const now = new Date();
    const token = crypto.randomBytes(32).toString("hex");
    const scope = { userId: user._id, purpose: PURPOSE, email: normalizeRecoveryEmail(user.email),
      phoneNumber: user.phoneNumber, emailVersion: user.emailVersion || 0, tokenVersion: user.tokenVersion || 0,
      flowId: request.flowId };
    const active = { userId: scope.userId, purpose: PURPOSE, email: scope.email, phoneNumber: scope.phoneNumber,
      emailVersion: scope.emailVersion, tokenVersion: scope.tokenVersion, flowIdHash: hashEmailRecoveryFlow(request.flowId),
      consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } };
    const verified = await MobileEmailOtp.findOneAndUpdate({
      ...active, verifiedAt: null, otpHash: hashEmailOtp({ ...scope, otp }),
    }, { $set: { otpHash: null, verifiedAt: now, verificationTokenHash: hashEmailVerificationToken(token),
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS) } }, { new: true });
    if (!verified) {
      await MobileEmailOtp.findOneAndUpdate({ ...active, verifiedAt: null, otpHash: { $ne: null } }, { $inc: { attempts: 1 } });
      return res.status(400).json(INVALID_CODE);
    }
    return res.json({ verificationToken: token, expiresInSeconds: VERIFICATION_TTL_MS / 1000 });
  } catch (error) {
    logRequestError(error, req, "MOBILE_EMAIL_OTP_VERIFY_ERROR");
    return res.status(500).json({ message: "We couldn't check your recovery code. Please try again." });
  }
}
