import mongoose from "mongoose";
import { EMAIL_RECOVERY_ACCOUNT_INDEX } from "../utils/recoveryEmail.js";

const mobileEmailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: {
      type: String,
      required: true,
      enum: ["password_reset", "recovery_email"],
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "MobileUser", required: true },
    phoneNumber: { type: String, required: true, match: /^09\d{9}$/ },
    flowIdHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, min: 0, required: true },
    emailVersion: { type: Number, min: 0 },
    otpHash: { type: String, select: false },
    verificationTokenHash: { type: String, select: false },
    verifiedAt: Date,
    consumedAt: Date,
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: Date,
  },
  { timestamps: true, collection: "mobileEmailOtps", autoIndex: false },
);

mobileEmailOtpSchema.index(
  { userId: 1, purpose: 1 },
  { unique: true, name: EMAIL_RECOVERY_ACCOUNT_INDEX,
    partialFilterExpression: { flowIdHash: { $type: "string" } } },
);

export default mongoose.model("MobileEmailOtp", mobileEmailOtpSchema);
