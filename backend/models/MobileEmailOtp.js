import mongoose from "mongoose";

const mobileEmailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: {
      type: String,
      required: true,
      enum: ["password_reset"],
    },
    otpHash: { type: String, select: false },
    verificationTokenHash: { type: String, select: false },
    verifiedAt: Date,
    consumedAt: Date,
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: Date,
  },
  { timestamps: true, collection: "mobileEmailOtps" },
);

mobileEmailOtpSchema.index(
  { email: 1, purpose: 1 },
  { unique: true },
);

export default mongoose.model("MobileEmailOtp", mobileEmailOtpSchema);