import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      default: "unassigned",
      enum: ["unassigned", "admin", "cesu", "surveillance_team"],
    },
    canAccessPatientIdentity: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    organization: { type: String, trim: true },
    position: { type: String, trim: true },
    reason: { type: String, trim: true, maxlength: 500 },

    // optional audit fields
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "WebUser" },

    resetOtpHash: { type: String, default: null, select: false },
    resetOtpExpiresAt: { type: Date, default: null, select: false },
    resetOtpRequestedAt: { type: Date, default: null, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
    collection: "web_users",
  }
);

export default mongoose.model("WebUser", userSchema);
