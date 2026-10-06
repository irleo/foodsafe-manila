import mongoose from "mongoose";
import {
  isValidRecoveryEmail,
  normalizeRecoveryEmail,
} from "../utils/recoveryEmail.js";

const PolicyReceiptSchema = new mongoose.Schema(
  {
    version: { type: String, required: true, trim: true },
    acceptedAt: { type: Date, required: true },
  },
  { _id: false },
);
const AccountPolicySchema = new mongoose.Schema(
  {
    terms: { type: PolicyReceiptSchema, required: true },
    privacy: { type: PolicyReceiptSchema, required: true },
  },
  { _id: false },
);
const ReportingAcceptanceSchema = new mongoose.Schema(
  {
    version: { type: String, required: true, trim: true },
    locationVersion: { type: String, required: true, trim: true },
    acceptedAt: { type: Date, required: true },
    lawfulBasis: { type: String, required: true, trim: true },
    healthConsent: { type: Boolean, required: true },
  },
  { _id: false },
);

const mobileUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    email: {
      type: String,
      default: "",
      set: normalizeRecoveryEmail,
      validate: {
        validator: isValidRecoveryEmail,
        message: "Enter a valid recovery email address.",
      },
    },
    // Historical evidence for the current address, never a recovery eligibility gate.
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    emailVersion: { type: Number, default: 0, min: 0 },
    tokenVersion: { type: Number, default: 0, min: 0 },
    policyAcceptance: { type: AccountPolicySchema, default: undefined },
    reportingAcceptance: {
      type: ReportingAcceptanceSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: "mobileUsers",
    // Index creation is an explicit maintenance step after resolving legacy duplicates.
    autoIndex: false,
  },
);

mobileUserSchema.index(
  { phoneNumber: 1 },
  { unique: true, name: "mobileUsersPhoneNumberUnique" },
);

mobileUserSchema.pre("validate", function () {
  if (this.isModified("email")) {
    this.emailVerified = false;
    this.emailVerifiedAt = undefined;
  }
});

export default mongoose.model("MobileUser", mobileUserSchema);
