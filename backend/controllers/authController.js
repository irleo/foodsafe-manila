import User from "../models/WebUser.js";
import EmailOtp from "../models/EmailOtp.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createNotification } from "../services/notificationService.js";
import {
  sendAccessRequestOtpEmail,
  sendResetOtpEmail,
} from "../services/emailService.js";
import { logActivity } from "../utils/logActivity.js";
import { validatePassword } from "../utils/passwordValidation.js";

const RESET_OTP_TTL_MINUTES = 10;
const RESET_OTP_LENGTH = 6;
const RESET_OTP_MAX_ATTEMPTS = 5;
const ACCESS_OTP_TTL_MINUTES = 10;
const ACCESS_OTP_MAX_ATTEMPTS = 5;
const ACCESS_OTP_PURPOSE = "request_access";

function generateOtp(length = RESET_OTP_LENGTH) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

async function findRequestAccessConflict(email) {
  const existingUser = await User.findOne({ email });

  if (!existingUser) return { existingUser: null, response: null };

  if (existingUser.status === "pending") {
    return {
      existingUser,
      response: {
        status: 409,
        body: {
          message:
            "An access request for this email is already pending approval.",
        },
      },
    };
  }

  if (existingUser.status === "approved") {
    return {
      existingUser,
      response: {
        status: 409,
        body: {
          message: "An account with this email already exists. Please sign in.",
        },
      },
    };
  }

  return { existingUser, response: null };
}

function validateAccessRequestFields({
  username,
  email,
  password,
  organization,
  position,
  reason,
}) {
  if (
    !username ||
    !email ||
    !password ||
    !organization ||
    !position ||
    !reason
  ) {
    return "All fields are required";
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) return passwordValidation.message;

  if (typeof reason !== "string" || reason.trim().length > 300) {
    return "Reason must be 300 characters or less";
  }

  return "";
}

async function verifyAccessOtpOrResponse(email, otp) {
  if (!otp) {
    return {
      ok: false,
      response: {
        status: 400,
        body: { message: "Email verification code is required." },
      },
    };
  }

  const record = await EmailOtp.findOne({
    email,
    purpose: ACCESS_OTP_PURPOSE,
  }).select("+otpHash +attempts");

  if (!record || !record.otpHash || record.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      response: {
        status: 400,
        body: { message: "Invalid or expired email verification code." },
      },
    };
  }

  if ((record.attempts || 0) >= ACCESS_OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      response: {
        status: 429,
        body: { message: "Too many invalid OTP attempts." },
      },
    };
  }

  if (record.otpHash !== hashOtp(otp)) {
    record.attempts = (record.attempts || 0) + 1;
    await record.save();
    return {
      ok: false,
      response: {
        status: 400,
        body: { message: "Invalid or expired email verification code." },
      },
    };
  }

  return { ok: true, record };
}

// POST /api/auth/request-access/send-otp
export const sendRequestAccessOtp = async (req, res) => {
  const { username, email, password, organization, position, reason } =
    req.body;
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  const validationMessage = validateAccessRequestFields({
    username,
    email: normalizedEmail,
    password,
    organization,
    position,
    reason,
  });
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  try {
    const { response } = await findRequestAccessConflict(normalizedEmail);
    if (response) return res.status(response.status).json(response.body);

    const existingOtp = await EmailOtp.findOne({
      email: normalizedEmail,
      purpose: ACCESS_OTP_PURPOSE,
    });

    const now = Date.now();
    const lastRequestedAt = existingOtp?.requestedAt
      ? new Date(existingOtp.requestedAt).getTime()
      : 0;
    const minGapMs = 60 * 1000;
    if (lastRequestedAt && now - lastRequestedAt < minGapMs) {
      return res.status(429).json({
        message: "Please wait before requesting another code.",
      });
    }

    const otp = generateOtp();
    await EmailOtp.findOneAndUpdate(
      { email: normalizedEmail, purpose: ACCESS_OTP_PURPOSE },
      {
        $set: {
          otpHash: hashOtp(otp),
          expiresAt: new Date(now + ACCESS_OTP_TTL_MINUTES * 60 * 1000),
          requestedAt: new Date(now),
          attempts: 0,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    const isProd = process.env.NODE_ENV === "production";
    let usedDevFallback = false;

    try {
      await sendAccessRequestOtpEmail({
        toEmail: normalizedEmail,
        otp,
        expiresMinutes: ACCESS_OTP_TTL_MINUTES,
      });

      console.log("OTP email sent through Brevo to:", normalizedEmail);
    } catch (mailError) {
      console.error("Brevo SMTP failed:", {
        message: mailError.message,
        code: mailError.code,
        command: mailError.command,
        response: mailError.response,
        responseCode: mailError.responseCode,
      });

      if (isProd) throw mailError;

      usedDevFallback = true;
      console.warn(
        "SMTP unavailable in development. Using access OTP fallback for:",
        normalizedEmail,
      );
    }

    return res.json({
      success: true,
      message: "Verification code sent.",
      ...(usedDevFallback
        ? {
            devFallback: true,
            debugOtp: otp,
            debugExpiresMinutes: ACCESS_OTP_TTL_MINUTES,
          }
        : {}),
    });
  } catch (error) {
    console.error("Error sending access request OTP:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    return res
      .status(500)
      .json({ message: "Failed to send verification code." });
  }
};

// POST /api/auth/request-access
export const requestAccess = async (req, res) => {
  const {
    username,
    email,
    password,
    organization,
    position,
    reason,
    accessOtp,
  } = req.body;
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const normalizedUsername = String(username || "").trim();

  const validationMessage = validateAccessRequestFields({
    username: normalizedUsername,
    email: normalizedEmail,
    password,
    organization,
    position,
    reason,
  });
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  try {
    const otpResult = await verifyAccessOtpOrResponse(
      normalizedEmail,
      String(accessOtp || "").trim(),
    );
    if (!otpResult.ok) {
      return res
        .status(otpResult.response.status)
        .json(otpResult.response.body);
    }

    const { existingUser, response } =
      await findRequestAccessConflict(normalizedEmail);
    if (response) return res.status(response.status).json(response.body);
    if (existingUser) {
      // conflict handling
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
        await EmailOtp.deleteOne({
          email: normalizedEmail,
          purpose: ACCESS_OTP_PURPOSE,
        });
        await createNotification({
          type: "user_access_request",
          title: "New User Request",
          message: `${existingUser.username || "A user"} requested access.`,
          dotColor: "blue",
          metadata: {
            userId: String(existingUser._id),
            email: existingUser.email,
          },
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
    await EmailOtp.deleteOne({
      email: normalizedEmail,
      purpose: ACCESS_OTP_PURPOSE,
    });
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
    const isProd = process.env.NODE_ENV === "production";

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
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
        message: "If the email exists, a reset code has been sent.",
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
      return res
        .status(429)
        .json({ message: "Too many invalid OTP attempts." });
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
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ message: passwordValidation.message });
  }

  try {
    const user = await User.findOne({ email }).select(
      "_id username email password resetOtpHash resetOtpExpiresAt resetOtpAttempts",
    );
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    if (user.resetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired." });
    }

    if ((user.resetOtpAttempts || 0) >= RESET_OTP_MAX_ATTEMPTS) {
      return res
        .status(429)
        .json({ message: "Too many invalid OTP attempts." });
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

    const displayName = user.username || user.email || "A user";
    await createNotification({
      type: "password_reset",
      title: "Password Reset",
      message: `${displayName} reset their password.`,
      dotColor: "green",
      metadata: { userId: String(user._id), email: user.email },
    });
    await logActivity({
      actor: user._id,
      actionType: "password_reset",
      title: "Password reset",
      subtitle: `${displayName} reset their password.`,
      metadata: { userId: user._id, email: user.email },
    });

    return res.json({ success: true, message: "Password has been reset." });
  } catch (error) {
    console.error("Error completing password reset:", error);
    return res.status(500).json({ message: "Failed to reset password." });
  }
};
