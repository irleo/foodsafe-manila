import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import MobileUser from "../models/MobileUser.js";
import {
  normalizePhone,
  isDuplicateCitizenPhone,
  sanitizeMobileUser,
  signCitizenTokens,
} from "../utils/citizenAuth.js";
import { validatePassword } from "../utils/passwordValidation.js";
import { consumeMobileOtpVerification } from "../services/mobileOtpService.js";
import { consumeEmailOtpVerification } from "../services/mobileEmailOtpService.js";
import { logRequestError } from "../utils/serverLogger.js";
import { isTokenVersionCurrent } from "../utils/tokenVersion.js";
import { validatePolicyChoices } from "../policies/mobilePolicies.js";
import { createMobileUserWithPolicies } from "../services/mobilePolicyService.js";
import { isValidRecoveryEmail, normalizeRecoveryEmail } from "../utils/recoveryEmail.js";
import { findRecoveryAccount } from "../services/recoveryEmailService.js";

// POST /api/auth/register
export const registerCitizen = async (req, res) => {
  const policyFailure = validatePolicyChoices(req.body?.policyAcceptance);
  if (policyFailure) return res.status(policyFailure.status).json(policyFailure);
  const { username, phone, password, email, verificationToken } = req.body;

  if (!username || !phone || !password || !verificationToken) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ message: passwordValidation.message });
  }

  if (!isValidRecoveryEmail(email)) {
    return res.status(400).json({ message: "Enter a valid recovery email address." });
  }
  const normalizedEmail = normalizeRecoveryEmail(email);

  try {
    const normalizedPhone = normalizePhone(phone);
    const existing = await MobileUser.findOne({ phoneNumber: normalizedPhone });

    if (existing) {
      return res.status(409).json({ message: "Phone number already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const mobileUser = await createMobileUserWithPolicies({
      username: String(username).trim(),
      phoneNumber: normalizedPhone,
      password: hashedPassword,
      email: normalizedEmail,
    }, async (session) => {
      const verified = await consumeMobileOtpVerification({ phone: normalizedPhone,
        purpose: "registration", verificationToken }, session);
      if (!verified) throw Object.assign(new Error("Phone verification is invalid or expired"), { code: "PHONE_PROOF_INVALID" });
    });

    return res.status(201).json(sanitizeMobileUser(mobileUser));
  } catch (error) {
    if (error?.code === "PHONE_PROOF_INVALID") return res.status(403).json({ code: error.code, message: "Phone verification is invalid or expired" });
    if (isDuplicateCitizenPhone(error)) {
      return res.status(409).json({ message: "Phone number already registered" });
    }
    logRequestError(error, req, "CITIZEN_REGISTER_ERROR");
    return res.status(500).json({ message: "Failed to register user" });
  }
};

// POST /api/auth/login (phone branch)
export const loginCitizen = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ message: "Phone and password are required" });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const mobileUser = await MobileUser.findOne({ phoneNumber: normalizedPhone });

    if (!mobileUser) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, mobileUser.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = signCitizenTokens(
      mobileUser._id,
      mobileUser.tokenVersion,
    );

    return res.status(200).json({
      ...sanitizeMobileUser(mobileUser),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logRequestError(error, req, "CITIZEN_LOGIN_ERROR");
    return res.status(500).json({ message: "Failed to login" });
  }
};

// GET /api/auth/user/exists?phone=
export const checkPhoneExists = async (req, res) => {
  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ message: "Phone query is required" });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const exists = await MobileUser.exists({ phoneNumber: normalizedPhone });
    return res.json({ exists: Boolean(exists) });
  } catch (error) {
    logRequestError(error, req, "PHONE_LOOKUP_ERROR");
    return res.status(500).json({ message: "Failed to check phone number" });
  }
};

// GET /api/auth/user/email-exists?email=
export const checkEmailExists = async (req, res) => {
  // Compatibility endpoint for older apps: never disclose account existence.
  return res.json({ exists: true, message: "If eligible, a recovery code can be sent." });
};

// POST /api/auth/reset-password
export const resetCitizenPassword = async (req, res) => {
  const { phone, newPassword, verificationToken, flowId, recoveryMethod = "sms" } = req.body || {};

  if (!phone || !newPassword || !verificationToken) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (typeof phone !== "string" || !/^(?:09\d{9}|\+?639\d{9})$/.test(phone.trim())) {
    return res.status(400).json({ code: "PHONE_INVALID", message: "Enter your registered mobile number to recover this account." });
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ message: passwordValidation.message });
  }

  if (!["sms", "email"].includes(recoveryMethod) || req.body?.email != null
      || (recoveryMethod === "sms" && flowId != null)) {
    return res.status(400).json({ message: "Enter your registered mobile number and restart recovery." });
  }

  try {
    if (recoveryMethod === "email") {
      const failure = { message: "Email verification is invalid or expired" };
      const mobileUser = await findRecoveryAccount(phone);
      if (!mobileUser || !isValidRecoveryEmail(mobileUser.email, true)) return res.status(403).json(failure);
      const normalizedEmail = normalizeRecoveryEmail(mobileUser.email);
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await mongoose.connection.transaction(async (session) => {
        const verified = await consumeEmailOtpVerification({
          email: normalizedEmail,
          purpose: "password_reset",
          verificationToken,
          userId: mobileUser._id,
          phoneNumber: mobileUser.phoneNumber,
          tokenVersion: mobileUser.tokenVersion || 0,
          flowId,
          emailVersion: mobileUser.emailVersion || 0,
        }, session);

        if (!verified) throw Object.assign(new Error(failure.message), { code: "EMAIL_PROOF_INVALID" });
        const changed = await MobileUser.findOneAndUpdate(
          { _id: mobileUser._id, phoneNumber: mobileUser.phoneNumber, email: normalizedEmail,
            emailVersion: mobileUser.emailVersion || 0,
            tokenVersion: mobileUser.tokenVersion == null ? { $exists: false } : mobileUser.tokenVersion },
          { $set: { password: hashedPassword, emailVerified: true, emailVerifiedAt: new Date() }, $inc: { tokenVersion: 1 } },
          { new: true, runValidators: true, session },
        );
        if (!changed) throw Object.assign(new Error(failure.message), { code: "EMAIL_PROOF_INVALID" });
      });

      return res.json({ success: true });
    }

    const normalizedPhone = normalizePhone(phone);
    const mobileUser = await MobileUser.findOne({ phoneNumber: normalizedPhone });

    if (!mobileUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await mongoose.connection.transaction(async (session) => {
      const verified = await consumeMobileOtpVerification({
        phone: normalizedPhone,
        purpose: "password_reset",
        verificationToken,
      }, session);
      if (!verified) throw Object.assign(new Error("Phone verification is invalid or expired"), { code: "PHONE_PROOF_INVALID" });
      const changed = await MobileUser.findOneAndUpdate(
        { _id: mobileUser._id, phoneNumber: normalizedPhone },
        { $set: { password: hashedPassword }, $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true, session },
      );
      if (!changed) throw Object.assign(new Error("Phone verification is invalid or expired"), { code: "PHONE_PROOF_INVALID" });
    });

    return res.json({ success: true });
  } catch (error) {
    if (error?.code === "EMAIL_PROOF_INVALID") return res.status(403).json({ code: error.code, message: "Email verification is invalid or expired" });
    if (error?.code === "PHONE_PROOF_INVALID") return res.status(403).json({ code: error.code, message: "Phone verification is invalid or expired" });
    logRequestError(error, req, "CITIZEN_PASSWORD_RESET_ERROR");
    return res.status(500).json({ message: "Failed to reset password" });
  }
};

// POST /api/auth/mobile/refresh
export const refreshCitizenToken = async (req, res) => {
  const token = req.body?.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    if (decoded.accountType !== "citizen") {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const mobileUser = await MobileUser.findById(decoded.id);
    if (!mobileUser) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (!isTokenVersionCurrent(decoded.tokenVersion, mobileUser.tokenVersion)) {
      return res.status(401).json({ message: "Session has been revoked" });
    }

    const { accessToken, refreshToken } = signCitizenTokens(
      mobileUser._id,
      mobileUser.tokenVersion,
    );

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: sanitizeMobileUser(mobileUser),
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError || error instanceof jwt.NotBeforeError) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    logRequestError(error, req, "CITIZEN_SESSION_REFRESH_ERROR");
    return res.status(500).json({ code: "AUTHENTICATION_ERROR", message: "Session refresh is temporarily unavailable." });
  }
};
