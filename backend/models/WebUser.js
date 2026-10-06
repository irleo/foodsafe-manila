import { isValidName, normalizeName, NAME_MESSAGE } from "../utils/nameValidation.js";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Optional for existing accounts; new access requests require both components.
    firstName: { type: String, set: normalizeName, validate: { validator: isValidName, message: NAME_MESSAGE } },
    lastName: { type: String, set: normalizeName, validate: { validator: isValidName, message: NAME_MESSAGE } },
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      default: "unassigned",
      enum: ["unassigned", "admin", "cesu", "surveillance_team"],
    },
    requestedRole: {
      type: String,
      enum: ["cesu", "surveillance_team"],
    },
    canAccessPatientIdentity: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      index: { name: "webUsersStatus" },
    },
    organization: { type: String, trim: true },
    position: { type: String, trim: true },
    lastLoginAt: { type: Date },

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
    collection: "webUsers",
  }
);

// Validate new/edited identities without forcing a migration of legacy accounts.
userSchema.pre("validate", function () {
  if (this.isNew || this.isModified("firstName") || this.isModified("lastName")) {
    if (!isValidName(this.firstName)) this.invalidate("firstName", NAME_MESSAGE);
    if (!isValidName(this.lastName)) this.invalidate("lastName", NAME_MESSAGE);
    if (isValidName(this.firstName) && isValidName(this.lastName)) {
      this.username = `${this.firstName} ${this.lastName}`;
    }
  } else if (this.isModified("username")) {
    this.invalidate("username", "Update firstName and lastName instead of the display name.");
  }
});

userSchema.index(
  { email: 1 },
  { unique: true, name: "webUsersEmailUnique" },
);

export default mongoose.model("WebUser", userSchema);
