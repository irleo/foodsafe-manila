import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createNotification } from "../services/notificationService.js";
import { sendResetOtpEmail } from "../services/emailService.js";

const RESET_OTP_TTL_MINUTES = 10;
const RESET_OTP_LENGTH = 6;
const RESET_OTP_MAX_ATTEMPTS = 5;

function generateOtp(length = RESET_OTP_LENGTH) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

// POST /api/auth/request-access
export const requestAccess = async (req, res) => {
  const { username, email, password, organization, position, reason } =
    req.body;

  if (
    !username ||
    !email ||
    !password ||
    !organization ||
    !position ||
    !reason
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (typeof password !== "string" || password.length < 8) 
    return res.status(400).json({ message: "Password must be at least 8 characters", });
  
  if (typeof reason !== "string" || reason.trim().length > 300) 
    return res.status(400).json({ message: "Reason must be 300 characters or less" });
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      // conflict handling
      if (existingUser.status === "pending") {
        return res.status(409).json({
          message:
            "An access request for this email is already pending approval.",
        });
      }

      if (existingUser.status === "approved") {
        return res.status(409).json({
          message: "An account with this email already exists. Please sign in.",
        });
      }

      if (existingUser.status === "rejected") {
        // Allow re-apply by updating the existing record
        const hashedPassword = await bcrypt.hash(password, 10);

        existingUser.username = normalizedUsername;
        existingUser.password = hashedPassword;
        existingUser.organization = organization.trim();
        existingUser.position = position.trim();
        existingUser.reason = reason.trim();
        existingUser.status = "pending";
        existingUser.approvedAt = undefined;
        existingUser.approvedBy = undefined;

        await existingUser.save();
        await createNotification({
          type: "user_access_request",
          title: "New User Request",
          message: `${existingUser.username || "A user"} requested access.`,
          dotColor: "blue",
          metadata: { userId: String(existingUser._id), email: existingUser.email },
        });

        return res.status(200).json({
          message: "Access request resubmitted. Awaiting approval.",
          user: {
            id: existingUser._id,
            username: existingUser.username,
            email: existingUser.email,
            role: existingUser.role,
            status: existingUser.status,
          },
        });
      }
    }

    // Create new pending user
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      organization: organization.trim(),
      position: position.trim(),
      reason: reason.trim(),
      // status defaults to "pending"
    });

    await user.save();
    await createNotification({
      type: "user_access_request",
      title: "New User Request",
      message: `${user.username || "A user"} requested access.`,
      dotColor: "blue",
      metadata: { userId: String(user._id), email: user.email },
    });

    return res.status(201).json({
      message: "Access request submitted. Awaiting approval.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    // If two requests race at the same time, Mongo unique index on email can throw 11000
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "An account or access request with this email already exists.",
      });
    }
    console.error("Error requesting access:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  // Mobile citizen login uses phone; admin web login uses email.
  if (req.body?.phone) {
    const { loginCitizen } = await import("./citizenAuthController.js");
    return loginCitizen(req, res);
  }

  const { email, password } = req.body;
  const isProd = process.env.NODE_ENV === "production";

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Approval gate
    if (user.status !== "approved") {
      return res.status(403).json({
        message:
          user.status === "pending"
            ? "Your access request is pending approval."
            : "Your access request was rejected. Please contact an administrator.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd, // only HTTPS in production
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/refresh
export const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Block refresh if user becomes rejected later
    if (user.status !== "approved") {
      return res.status(403).json({
        message:
          user.status === "pending"
            ? "Your access request is pending approval."
            : "Your access request was rejected. Please contact an administrator.",
      });
    }

    const newAccessToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    return res.status(200).json({
      accessToken: newAccessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/logout
export const logout = (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error logging out:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const user = await User.findOne({ email }).select(
      "_id email resetOtpRequestedAt",
    );

    // Always return a generic response to avoid account enumeration.
    if (!user) {
      return res.json({
        success: true,
        message:
          "If the email exists, a reset code has been sent.",
      });
    }

    const now = Date.now();
    const lastRequestedAt = user.resetOtpRequestedAt
      ? new Date(user.resetOtpRequestedAt).getTime()
      : 0;
    const minGapMs = 60 * 1000;
    if (lastRequestedAt && now - lastRequestedAt < minGapMs) {
      return res.status(429).json({
        message: "Please wait before requesting another code.",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(now + RESET_OTP_TTL_MINUTES * 60 * 1000);

    user.resetOtpHash = hashOtp(otp);
    user.resetOtpExpiresAt = expiresAt;
    user.resetOtpRequestedAt = new Date(now);
    user.resetOtpAttempts = 0;
    await user.save();

    const isProd = process.env.NODE_ENV === "production";
    let usedDevFallback = false;

    try {
      await sendResetOtpEmail({
        toEmail: user.email,
        otp,
        expiresMinutes: RESET_OTP_TTL_MINUTES,
      });
    } catch (mailError) {
      if (isProd) throw mailError;
      usedDevFallback = true;
      console.warn(
        "SMTP unavailable in development. Using OTP fallback for:",
        user.email,
      );
    }

    return res.json({
      success: true,
      message: "If the email exists, a reset code has been sent.",
      ...(usedDevFallback
        ? {
            devFallback: true,
            debugOtp: otp,
            debugExpiresMinutes: RESET_OTP_TTL_MINUTES,
          }
        : {}),
    });
  } catch (error) {
    console.error("Error sending password reset OTP:", error);
    return res.status(500).json({ message: "Failed to process request." });
  }
};

// POST /api/auth/reset-password/verify-otp
export const verifyResetOtp = async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const otp = String(req.body?.otp || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }

  try {
    const user = await User.findOne({ email }).select(
      "_id resetOtpHash resetOtpExpiresAt resetOtpAttempts",
    );
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    if (user.resetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired." });
    }

    if ((user.resetOtpAttempts || 0) >= RESET_OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many invalid OTP attempts." });
    }

    const matches = user.resetOtpHash === hashOtp(otp);
    if (!matches) {
      user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    return res.json({ success: true, message: "OTP verified." });
  } catch (error) {
    console.error("Error verifying reset OTP:", error);
    return res.status(500).json({ message: "Failed to verify OTP." });
  }
};

// POST /api/auth/reset-password/complete
export const completePasswordReset = async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const otp = String(req.body?.otp || "").trim();
  const password = String(req.body?.password || "");

  if (!email || !otp || !password) {
    return res
      .status(400)
      .json({ message: "Email, OTP, and new password are required." });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters." });
  }

  try {
    const user = await User.findOne({ email }).select(
      "_id password resetOtpHash resetOtpExpiresAt resetOtpAttempts",
    );
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    if (user.resetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired." });
    }

    if ((user.resetOtpAttempts || 0) >= RESET_OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many invalid OTP attempts." });
    }

    const matches = user.resetOtpHash === hashOtp(otp);
    if (!matches) {
      user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetOtpHash = null;
    user.resetOtpExpiresAt = null;
    user.resetOtpRequestedAt = null;
    user.resetOtpAttempts = 0;
    await user.save();

    return res.json({ success: true, message: "Password has been reset." });
  } catch (error) {
    console.error("Error completing password reset:", error);
    return res.status(500).json({ message: "Failed to reset password." });
  }
};
