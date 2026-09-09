import crypto from "crypto";
import MobileEmailOtp from "../models/MobileEmailOtp.js";

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function hashValue(value) {
  const secret =
    process.env.OTP_HASH_SECRET || process.env.ACCESS_TOKEN_SECRET || "";

  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex");
}

function hashOtp({ email, purpose, otp }) {
  return hashValue(`email-otp:${email}:${purpose}:${otp}`);
}

function hashVerificationToken(token) {
  return hashValue(`email-verification:${token}`);
}

function safeHashEquals(left, right) {
  if (!left || !right || left.length !== right.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(left),
    Buffer.from(right),
  );
}

export async function consumeEmailOtpVerification({
  email,
  purpose,
  verificationToken,
}) {
  if (!verificationToken) return false;

  const normalizedEmail = normalizeEmail(email);

  const record = await MobileEmailOtp.findOne({
    email: normalizedEmail,
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

  const consumed = await MobileEmailOtp.findOneAndUpdate(
    { _id: record._id, consumedAt: null },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );

  return Boolean(consumed);
}