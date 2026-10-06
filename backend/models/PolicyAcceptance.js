import mongoose from "mongoose";

const PolicyAcceptanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "MobileUser", required: true, immutable: true },
  policyType: { type: String, enum: ["terms", "privacy"], required: true, immutable: true },
  policyVersion: { type: String, required: true, immutable: true },
  action: { type: String, enum: ["accepted", "acknowledged"], required: true, immutable: true },
  acceptedAt: { type: Date, required: true, immutable: true },
}, { collection: "policyAcceptances", timestamps: true });

PolicyAcceptanceSchema.index({ userId: 1, policyType: 1, policyVersion: 1 },
  { unique: true, name: "policyAcceptanceUserTypeVersion" });

export default mongoose.model("PolicyAcceptance", PolicyAcceptanceSchema);
