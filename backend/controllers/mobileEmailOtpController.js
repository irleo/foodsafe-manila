// @ts-check
import crypto from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import MobileUser from "../models/MobileUser.js";
import MobileEmailOtp from "../models/MobileEmailOtp.js";
import { brevoTimeoutMs, sendResetOtpEmail } from "../services/emailService.js";
import { logRequestError } from "../utils/serverLogger.js";
import { normalizeRecoveryEmail, isValidRecoveryEmail } from "../utils/recoveryEmail.js";
import { findVerifiedRecoveryAccount, recoveryEmailIndexReady, requireRecoveryEmailIndex } from "../services/recoveryEmailService.js";
import { hashEmailOtp, hashEmailVerificationToken } from "../services/mobileEmailOtpService.js";
import { sanitizeMobileUser } from "../utils/citizenAuth.js";

/** @typedef {'password_reset' | 'recovery_email'} EmailPurpose */
/** @typedef {import('express').Request & {user?: {id: string, accountType: string}}} CitizenRequest */
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const GENERIC_SENT = { message: "If this address is eligible, a verification code will be sent.", expiresInSeconds: 300 };
const INVALID_CODE = { message: "Verification code is invalid or expired" };
export const emailOtpDelivery = { send: sendResetOtpEmail };

/** @param {CitizenRequest} req @param {import('express').Response} res @param {EmailPurpose} purpose */
function parseRequest(req, res, purpose) {
  if (req.body?.purpose != null && req.body.purpose !== purpose) {
    res.status(400).json({ message: "Invalid verification purpose" });
    return null;
  }
  if (!isValidRecoveryEmail(req.body?.email, true)) {
    res.status(400).json({ message: "Enter a valid email address." });
    return null;
  }
  if (purpose === "recovery_email" && req.user?.accountType !== "citizen") {
    res.status(403).json({ message: "Access denied" });
    return null;
  }
  return { email: normalizeRecoveryEmail(req.body.email), purpose };
}

/** @param {import('express').Response} res @param {number} notBefore */
async function anonymousResponse(res, notBefore) {
  // Hide normal provider-delivery latency as well as response-body differences.
  const remaining = Math.max(0, notBefore - Date.now());
  if (remaining > 0) await delay(remaining);
  return res.status(202).json(GENERIC_SENT);
}

/** @param {CitizenRequest} req @param {import('express').Response} res @param {EmailPurpose} purpose */
async function sendOtp(req, res, purpose) {
  const request = parseRequest(req, res, purpose);
  if (!request) return;
  const respondAt = Date.now() + brevoTimeoutMs() + 250;
  try {
    const user = purpose === "password_reset"
      ? await findVerifiedRecoveryAccount(request.email)
      : await MobileUser.findOne({ _id: req.user?.id, email: request.email })
        .select("_id email emailVerified emailVersion").lean();
    if (purpose === "password_reset") {
      if (!user || !await recoveryEmailIndexReady()) return anonymousResponse(res, respondAt);
    } else {
      if (!user) return res.status(409).json({ message: "Save this email to your account before verifying it." });
      await requireRecoveryEmailIndex();
    }
    const now = new Date();
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    // Reserve before delivery. The unique email/purpose index ensures concurrent
    // cooldown upserts have one winner rather than sending duplicate codes.
    await MobileEmailOtp.findOneAndUpdate({
      ...request,
      $or: [{ lastSentAt: { $lte: new Date(now.getTime() - 60_000) } }, { lastSentAt: null }],
    }, { $set: {
      userId: user?._id, emailVersion: user?.emailVersion || 0,
      otpHash: hashEmailOtp({ ...request, otp }),
      verificationTokenHash: null, verifiedAt: null, consumedAt: null,
      attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    } }, { upsert: true, runValidators: true });
    await emailOtpDelivery.send({ toEmail: request.email, otp, expiresMinutes: 5 });
    return purpose === "password_reset" ? anonymousResponse(res, respondAt) : res.json(GENERIC_SENT);
  } catch (error) {
    const failure = /** @type {{code?: number | string, message?: string}} */ (error);
    if (purpose === "password_reset") {
      if (failure.code !== 11000) logRequestError(error, req, "MOBILE_EMAIL_OTP_SEND_ERROR");
      return anonymousResponse(res, respondAt);
    }
    if (failure.code === 11000) return res.status(429).json({ message: "Please wait before requesting another code", retryAfterSeconds: 60 });
    if (failure.code === "RECOVERY_EMAIL_SETUP_REQUIRED") return res.status(503).json({ code: failure.code, message: failure.message });
    logRequestError(error, req, "MOBILE_EMAIL_OTP_SEND_ERROR");
    return res.status(502).json({ message: "Failed to send verification code" });
  }
}

/** @param {CitizenRequest} req @param {import('express').Response} res @param {EmailPurpose} purpose */
async function confirmOtp(req, res, purpose) {
  const request = parseRequest(req, res, purpose);
  if (!request) return;
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  if (!/^\d{6}$/.test(otp)) return res.status(400).json(INVALID_CODE);
  try {
    if (purpose === "recovery_email") await requireRecoveryEmailIndex();
    const now = new Date();
    const token = crypto.randomBytes(32).toString("hex");
    const scope = { ...request, ...(purpose === "recovery_email" ? { userId: req.user?.id } : {}) };
    const active = { ...scope, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } };
    const verified = await MobileEmailOtp.findOneAndUpdate({
      ...active, verifiedAt: null, otpHash: hashEmailOtp({ ...request, otp }),
    }, { $set: {
      otpHash: null, verifiedAt: now,
      verificationTokenHash: purpose === "password_reset" ? hashEmailVerificationToken(token) : null,
      consumedAt: purpose === "recovery_email" ? now : null,
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    } }, { new: true });
    if (!verified) {
      await MobileEmailOtp.findOneAndUpdate({ ...active, otpHash: { $ne: null } }, { $inc: { attempts: 1 } });
      return res.status(400).json(INVALID_CODE);
    }
    if (purpose === "password_reset") {
      return res.json({ verificationToken: token, expiresInSeconds: VERIFICATION_TTL_MS / 1000 });
    }
    // A changed email invalidates an older challenge even if its code is valid.
    const user = await MobileUser.findOneAndUpdate({ _id: req.user?.id, email: request.email, emailVersion: verified.emailVersion },
      { $set: { emailVerified: true, emailVerifiedAt: now } }, { new: true, runValidators: true });
    if (!user) return res.status(400).json(INVALID_CODE);
    return res.json(sanitizeMobileUser(user));
  } catch (error) {
    logRequestError(error, req, "MOBILE_EMAIL_OTP_VERIFY_ERROR");
    return res.status(500).json({ message: "Failed to verify code" });
  }
}

/** @param {CitizenRequest} req @param {import('express').Response} res */
export const requestEmailOtp = (req, res) => sendOtp(req, res, "password_reset");
/** @param {CitizenRequest} req @param {import('express').Response} res */
export const confirmEmailOtp = (req, res) => confirmOtp(req, res, "password_reset");
/** @param {CitizenRequest} req @param {import('express').Response} res */
export const requestRecoveryEmailOtp = (req, res) => sendOtp(req, res, "recovery_email");
/** @param {CitizenRequest} req @param {import('express').Response} res */
export const confirmRecoveryEmailOtp = (req, res) => confirmOtp(req, res, "recovery_email");
