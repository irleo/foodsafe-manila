import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import MobileUser from "../models/MobileUser.js";
import {
  normalizePhone,
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
import { EMAIL_UNAVAILABLE, isDuplicateRecoveryEmail, isValidRecoveryEmail, normalizeRecoveryEmail } from "../utils/recoveryEmail.js";
import { findVerifiedRecoveryAccount, recoveryEmailIndexReady, recoveryEmailTaken, requireRecoveryEmailIndex } from "../services/recoveryEmailService.js";

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
    if (normalizedEmail) {
      if (await recoveryEmailTaken(normalizedEmail)) return res.status(409).json(EMAIL_UNAVAILABLE);
      await requireRecoveryEmailIndex();
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verified = await consumeMobileOtpVerification({
      phone: normalizedPhone,
      purpose: "registration",
      verificationToken,
    });

    if (!verified) {
      return res.status(403).json({
        message: "Phone verification is invalid or expired",
      });
    }

    const mobileUser = await createMobileUserWithPolicies({
      username: String(username).trim(),
      phoneNumber: normalizedPhone,
      password: hashedPassword,
      email: normalizedEmail,
    });

    return res.status(201).json(sanitizeMobileUser(mobileUser));
  } catch (error) {
    if (isDuplicateRecoveryEmail(error)) return res.status(409).json(EMAIL_UNAVAILABLE);
    if (error?.code === "RECOVERY_EMAIL_SETUP_REQUIRED") {
      return res.status(503).json({ code: error.code, message: error.message });
    }
    if (error?.code === 11000) {
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
  const { phone, email, newPassword, verificationToken } = req.body;

  if ((!phone && !email) || !newPassword || !verificationToken) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ message: passwordValidation.message });
  }

  try {
    if (email) {
      const failure = { message: "Email verification is invalid or expired" };
      if (!isValidRecoveryEmail(email, true)) return res.status(403).json(failure);
      const normalizedEmail = normalizeRecoveryEmail(email);
      const mobileUser = await findVerifiedRecoveryAccount(normalizedEmail);
      if (!mobileUser) return res.status(403).json(failure);
      if (!await recoveryEmailIndexReady()) return res.status(403).json(failure);
      const verified = await consumeEmailOtpVerification({
        email: normalizedEmail,
        purpose: "password_reset",
        verificationToken,
        userId: mobileUser._id,
        emailVersion: mobileUser.emailVersion || 0,
      });

      if (!verified) {
        return res.status(403).json(failure);
      }
      const changed = await MobileUser.findOneAndUpdate(
        { _id: mobileUser._id, email: normalizedEmail, emailVerified: true, emailVersion: mobileUser.emailVersion || 0 },
        { $set: { password: await bcrypt.hash(newPassword, 10) }, $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true },
      );
      if (!changed) return res.status(403).json(failure);

      return res.json({ success: true });
    }

    const normalizedPhone = normalizePhone(phone);
    const mobileUser = await MobileUser.findOne({ phoneNumber: normalizedPhone });

    if (!mobileUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const verified = await consumeMobileOtpVerification({
      phone: normalizedPhone,
      purpose: "password_reset",
      verificationToken,
    });

    if (!verified) {
      return res.status(403).json({
        message: "Phone verification is invalid or expired",
      });
    }

    mobileUser.password = await bcrypt.hash(newPassword, 10);
    mobileUser.tokenVersion = (mobileUser.tokenVersion || 0) + 1;
    await mobileUser.save();

    return res.json({ success: true });
  } catch (error) {
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
    logRequestError(error, req, "CITIZEN_SESSION_REFRESH_ERROR");
    return res.status(403).json({ message: "Invalid refresh token" });
  }
};
