import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      default: null,
      index: true,
    },

    // Where the citizen was when they submitted the report (GPS)
    location: {
      name: { type: String, required: true, trim: true },
      district: { type: String, required: true, trim: true, index: true },

      barangay: {
        type: String,
        default: null,
        trim: true,
        index: true,
      },

      barangayNo: {
        type: Number,
        default: null,
        min: 1,
        max: 999,
        index: true,
      },

      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },

    // OPTIONAL: where the suspected food/exposure happened
    exposureDistrict: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    exposureBarangay: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    exposureBarangayNo: {
      type: Number,
      default: null,
      min: 1,
      max: 999,
      index: true,
    },

    symptoms: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one symptom is required.",
      },
      index: true,
    },

    caseCount: { type: Number, default: 1, min: 1 },

    foodSource: { type: String, default: null, trim: true },

    reportedAt: { type: Date, required: true, index: true },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MobileUser",
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: ["citizen_app", "health_official"],
      default: "citizen_app",
      index: true,
    },

    caseClassification: {
      type: String,
      enum: [
        "reported",
        "suspected",
        "not_validated",
        "ruled_out",
        "confirmed",
      ],
      default: "reported",
      required: true,
      index: true,
    },

    currentStatus: {
      type: String,
      enum: ["reported", "suspected", "confirmed", "not_validated", "ruled_out"],
      default: "reported",
      required: true,
    },
    investigationStatus: {
      type: String,
      enum: ["not_started", "completed"],
      default: "not_started",
      required: true,
    },
    validationStatus: {
      type: String,
      enum: ["not_started", "confirmed", "not_validated"],
      default: "not_started",
      required: true,
    },
    investigation: {
      investigationId: { type: mongoose.Schema.Types.ObjectId },
      investigationDate: { type: Date },
      personnelIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "WebUser" }],
      locationVisited: { type: String, trim: true, maxlength: 500 },
      findings: { type: String, trim: true, maxlength: 4000 },
      symptoms: [{ type: String, trim: true }],
      foodExposureInformation: { type: String, trim: true, maxlength: 4000 },
      remarks: { type: String, trim: true, maxlength: 4000 },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "WebUser" },
      recordedAt: { type: Date },
    },
    suspectedDecision: {
      outcome: {
        type: String,
        enum: ["suspected", "ruled_out"],
      },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "WebUser" },
      markedAt: { type: Date },
      investigationId: { type: mongoose.Schema.Types.ObjectId },
      investigationFindings: { type: String, trim: true, maxlength: 4000 },
      reason: {
        type: String,
        enum: ["fake_report", "not_foodborne_related", "duplicate_report", "insufficient_evidence", "other"],
      },
      remarks: { type: String, trim: true, maxlength: 4000 },
    },
    validation: {
      validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "WebUser" },
      validatedAt: { type: Date },
      result: {
        type: String,
        enum: ["confirmed", "not_validated"],
      },
      condition: { type: String, trim: true, maxlength: 200 },
      laboratoryEvidence: { type: String, trim: true, maxlength: 4000 },
      supportingFindings: { type: String, trim: true, maxlength: 4000 },
      remarks: { type: String, trim: true, maxlength: 4000 },
    },
    remarks: { type: String, default: null, trim: true, maxlength: 4000 },

    isCounted: { type: Boolean, default: true, index: true },
    excludeReason: { type: String, default: null, trim: true },
  },
  { timestamps: true, collection: "reports" },
);

// Useful indexes for queries by time + district
reportSchema.index({
  "location.barangayNo": 1,
  reportedAt: -1,
  isCounted: 1,
});

reportSchema.index({
  exposureBarangayNo: 1,
  reportedAt: -1,
  isCounted: 1,
});

reportSchema.index({
  exposureDistrict: 1,
  exposureBarangayNo: 1,
  reportedAt: -1,
  isCounted: 1,
});

export default mongoose.model("Report", reportSchema);
