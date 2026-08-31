import mongoose from "mongoose";

const emailOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ["request_access"],
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    attempts: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  { timestamps: true, collection: "emailOtps" },
);

emailOtpSchema.index(
  { email: 1, purpose: 1 },
  { unique: true, name: "emailOtpsEmailPurposeUnique" },
);
emailOtpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "emailOtpsExpiresAtTtl" },
);

export default mongoose.model("EmailOtp", emailOtpSchema);
