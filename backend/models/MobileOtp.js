import mongoose from "mongoose";

const mobileOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, trim: true },
    purpose: {
      type: String,
      required: true,
      enum: ["registration", "password_reset"],
    },
    otpHash: { type: String, default: null, select: false },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null },
    verificationTokenHash: { type: String, default: null, select: false },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: "mobile_otps",
  },
);

mobileOtpSchema.index({ phone: 1, purpose: 1 }, { unique: true });
mobileOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("MobileOtp", mobileOtpSchema);
