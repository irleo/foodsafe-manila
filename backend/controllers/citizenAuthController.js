import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import CitizenUser from "../models/CitizenUser.js";
import {
  normalizePhone,
  sanitizeCitizenUser,
  signCitizenTokens,
} from "../utils/citizenAuth.js";

// POST /api/auth/register
export const registerCitizen = async (req, res) => {
  const { username, phone, password, email } = req.body;

  if (!username || !phone || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const existing = await CitizenUser.findOne({ phone_number: normalizedPhone });

    if (existing) {
      return res.status(409).json({ message: "Phone number already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await CitizenUser.create({
      username: String(username).trim(),
      phone_number: normalizedPhone,
      password: hashedPassword,
      email: email ? String(email).trim() : "",
    });

    return res.status(201).json(sanitizeCitizenUser(user));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Phone number already registered" });
    }
    console.error("Citizen register error:", error);
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
    const user = await CitizenUser.findOne({ phone_number: normalizedPhone });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = signCitizenTokens(user._id);

    return res.status(200).json({
      ...sanitizeCitizenUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Citizen login error:", error);
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
    const exists = await CitizenUser.exists({ phone_number: normalizedPhone });
    return res.json({ exists: Boolean(exists) });
  } catch (error) {
    console.error("Phone exists check error:", error);
    return res.status(500).json({ message: "Failed to check phone number" });
  }
};

// POST /api/auth/reset-password
export const resetCitizenPassword = async (req, res) => {
  const { phone, newPassword } = req.body;

  if (!phone || !newPassword) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const user = await CitizenUser.findOne({ phone_number: normalizedPhone });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ success: true });
  } catch (error) {
    console.error("Citizen reset password error:", error);
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

    const user = await CitizenUser.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const { accessToken, refreshToken } = signCitizenTokens(user._id);

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: sanitizeCitizenUser(user),
    });
  } catch (error) {
    console.error("Citizen refresh error:", error);
    return res.status(403).json({ message: "Invalid refresh token" });
  }
};
