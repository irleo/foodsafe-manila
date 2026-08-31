import MobileUser from "../models/MobileUser.js";
import { normalizePhone } from "../utils/citizenAuth.js";
import {
  sendMobileOtp,
  verifyMobileOtp,
} from "../services/mobileOtpService.js";

const PURPOSES = new Set(["registration", "password_reset"]);

function parseRequest(req, res) {
  const { phone, purpose } = req.body || {};

  if (!phone || !PURPOSES.has(purpose)) {
    res.status(400).json({ message: "Valid phone and purpose are required" });
    return null;
  }

  try {
    return { phone: normalizePhone(phone), purpose };
  } catch {
    res.status(400).json({ message: "Invalid Philippine mobile number" });
    return null;
  }
}

export const requestMobileOtp = async (req, res) => {
  const request = parseRequest(req, res);
  if (!request) return;

  try {
    const existingUser = await MobileUser.exists({
      phoneNumber: request.phone,
    });

    if (request.purpose === "registration" && existingUser) {
      return res.status(409).json({ message: "Phone number already registered" });
    }

    if (request.purpose === "password_reset" && !existingUser) {
      return res.status(404).json({ message: "Phone number is not registered" });
    }

    const result = await sendMobileOtp(request);
    return res.status(200).json({
      message: "Verification code sent",
      ...result,
    });
  } catch (error) {
    if (error?.code === "OTP_COOLDOWN") {
      res.set("Retry-After", String(error.retryAfterSeconds));
      return res.status(429).json({
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }

    if (
      error?.code === "SEMAPHORE_NOT_CONFIGURED" ||
      error?.code === "SEMAPHORE_INVALID_CONFIG"
    ) {
      return res.status(503).json({ message: error.message });
    }

    if (error?.code === "SEMAPHORE_AUTH_FAILED") {
      return res.status(503).json({
        message: "SMS provider authentication failed",
      });
    }

    console.error("Mobile OTP send error:", {
      code: error?.code,
      status: error?.status,
      message: error?.message,
    });
    return res.status(502).json({ message: "Failed to send verification code" });
  }
};

export const confirmMobileOtp = async (req, res) => {
  const request = parseRequest(req, res);
  if (!request) return;

  const otp = String(req.body?.otp || "").trim();
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: "Enter the 6-digit verification code" });
  }

  try {
    const result = await verifyMobileOtp({ ...request, otp });
    return res.status(200).json(result);
  } catch (error) {
    if (error?.code === "OTP_ATTEMPTS_EXCEEDED") {
      return res.status(429).json({ message: error.message });
    }
    if (error?.code === "OTP_INVALID") {
      return res.status(400).json({ message: error.message });
    }

    console.error("Mobile OTP verify error:", error);
    return res.status(500).json({ message: "Failed to verify code" });
  }
};
