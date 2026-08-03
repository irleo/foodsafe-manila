import crypto from "crypto";
import MobileOtp from "../models/MobileOtp.js";
import { sendSemaphoreSms } from "./semaphoreSmsService.js";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashValue(value) {
  const secret =
    process.env.OTP_HASH_SECRET || process.env.ACCESS_TOKEN_SECRET || "";

  if (!secret) {
    throw new Error("OTP_HASH_SECRET or ACCESS_TOKEN_SECRET is required");
  }

  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function hashOtp({ phone, purpose, otp }) {
  return hashValue(`otp:${phone}:${purpose}:${otp}`);
}

function hashVerificationToken(token) {
  return hashValue(`verification:${token}`);
}

function safeHashEquals(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export async function sendMobileOtp({ phone, purpose }) {
  const now = new Date();
  const existing = await MobileOtp.findOne({ phone, purpose })
    .select("+otpHash +verificationTokenHash")
    .lean();

  if (
    existing?.lastSentAt &&
    now.getTime() - new Date(existing.lastSentAt).getTime() <
      RESEND_COOLDOWN_MS
  ) {
    const error = new Error("Please wait before requesting another code");
    error.code = "OTP_COOLDOWN";
    error.retryAfterSeconds = Math.ceil(
      (RESEND_COOLDOWN_MS -
        (now.getTime() - new Date(existing.lastSentAt).getTime())) /
        1000,
    );
    throw error;
  }

  const otp = crypto
    .randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  await sendSemaphoreSms({
    phone,
    message: `Your FoodSafe verification code is ${otp}. It expires in 5 minutes. Do not share this code.`,
  });

  await MobileOtp.findOneAndUpdate(
    { phone, purpose },
    {
      $set: {
        otpHash: hashOtp({ phone, purpose, otp }),
        attempts: 0,
        lastSentAt: now,
        verifiedAt: null,
        verificationTokenHash: null,
        consumedAt: null,
        expiresAt,
      },
    },
    { upsert: true, runValidators: true },
  );

  return { expiresInSeconds: OTP_TTL_MS / 1000 };
}

export async function verifyMobileOtp({ phone, purpose, otp }) {
  const now = new Date();
  const record = await MobileOtp.findOne({ phone, purpose }).select(
    "+otpHash +verificationTokenHash",
  );

  if (!record || record.expiresAt <= now || record.consumedAt) {
    const error = new Error("Verification code is invalid or expired");
    error.code = "OTP_INVALID";
    throw error;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    const error = new Error("Too many incorrect attempts. Request a new code");
    error.code = "OTP_ATTEMPTS_EXCEEDED";
    throw error;
  }

  const candidateHash = hashOtp({ phone, purpose, otp });
  if (!safeHashEquals(record.otpHash, candidateHash)) {
    record.attempts += 1;
    await record.save();
    const error = new Error("Verification code is invalid or expired");
    error.code = "OTP_INVALID";
    throw error;
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  record.otpHash = null;
  record.verifiedAt = now;
  record.verificationTokenHash = hashVerificationToken(verificationToken);
  record.expiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS);
  await record.save();

  return {
    verificationToken,
    expiresInSeconds: VERIFICATION_TTL_MS / 1000,
  };
}

export async function consumeMobileOtpVerification({
  phone,
  purpose,
  verificationToken,
}) {
  if (!verificationToken) return false;

  const record = await MobileOtp.findOne({
    phone,
    purpose,
    verifiedAt: { $ne: null },
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).select("+verificationTokenHash");

  if (
    !record ||
    !safeHashEquals(
      record.verificationTokenHash,
      hashVerificationToken(verificationToken),
    )
  ) {
    return false;
  }

  const consumed = await MobileOtp.findOneAndUpdate(
    { _id: record._id, consumedAt: null },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );

  return Boolean(consumed);
}
