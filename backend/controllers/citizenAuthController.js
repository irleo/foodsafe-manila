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
import { logRequestError } from "../utils/serverLogger.js";

// POST /api/auth/register
export const registerCitizen = async (req, res) => {
  const { username, phone, password, email, verificationToken } = req.body;

  if (!username || !phone || !password || !verificationToken) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ message: passwordValidation.message });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const existing = await MobileUser.findOne({ phoneNumber: normalizedPhone });

    if (existing) {
      return res.status(409).json({ message: "Phone number already registered" });
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

    const mobileUser = await MobileUser.create({
      username: String(username).trim(),
      phoneNumber: normalizedPhone,
      password: hashedPassword,
      email: email ? String(email).trim() : "",
    });

    return res.status(201).json(sanitizeMobileUser(mobileUser));
  } catch (error) {
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

    const { accessToken, refreshToken } = signCitizenTokens(mobileUser._id);

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

// POST /api/auth/reset-password
export const resetCitizenPassword = async (req, res) => {
  const { phone, newPassword, verificationToken } = req.body;

  if (!phone || !newPassword || !verificationToken) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ message: passwordValidation.message });
  }

  try {
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

    const { accessToken, refreshToken } = signCitizenTokens(mobileUser._id);

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
