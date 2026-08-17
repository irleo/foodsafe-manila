import mongoose from "mongoose";

const ExcludedPeriodSchema = new mongoose.Schema(
  {
    startYear: { type: Number, required: true, min: 1900, max: 2200 },
    startMonth: { type: Number, required: true, min: 1, max: 12 },
    endYear: { type: Number, required: true, min: 1900, max: 2200 },
    endMonth: { type: Number, required: true, min: 1, max: 12 },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const SurveillanceThresholdConfigSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    condition: { type: String, default: "all", trim: true, maxlength: 120 },
    geographicLevel: {
      type: String,
      enum: ["city", "district"],
      default: "city",
    },
    baselineYears: { type: Number, min: 3, max: 10, default: 5 },
    alertSdMultiplier: { type: Number, min: 0, max: 10, default: 1 },
    epidemicSdMultiplier: { type: Number, min: 0, max: 10, default: 2 },
    excludedPeriods: { type: [ExcludedPeriodSchema], default: [] },
    methodologyStatus: {
      type: String,
      enum: ["draft", "validated"],
      default: "draft",
    },
    methodologyNotes: { type: String, default: "", trim: true, maxlength: 2000 },
    isActive: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "WebUser", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "WebUser" },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "WebUser" },
    validatedAt: { type: Date },
  },
  { timestamps: true, collection: "surveillanceThresholdConfigs" },
);

SurveillanceThresholdConfigSchema.index({ isActive: 1, geographicLevel: 1, condition: 1 });

export default mongoose.model(
  "SurveillanceThresholdConfig",
  SurveillanceThresholdConfigSchema,
);
