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
      district: { type: String, required: true, trim: true, index: true }, // canonical key
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },

    // OPTIONAL: where the suspected food/exposure happened
    // If present, this is what you use for district risk scoring
    exposureDistrict: {
      type: String,
      default: null,
      trim: true,
      index: true, // important for aggregation later
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
      ref: "User",
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: ["citizen_app", "health_official"],
      default: "citizen_app",
      index: true,
    },

    isCounted: { type: Boolean, default: true, index: true },
    excludeReason: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

// Useful indexes for queries by time + district
reportSchema.index({ "location.district": 1, reportedAt: -1, isCounted: 1 });
reportSchema.index({ exposureDistrict: 1, reportedAt: -1, isCounted: 1 });
reportSchema.index({ reportedBy: 1, reportedAt: -1 });

export default mongoose.model("Report", reportSchema);