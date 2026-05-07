import mongoose from "mongoose";

const predictionRunSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      enum: ["prophet"],
      default: "prophet",
      required: true,
      index: true,
    },

    granularity: {
      type: String,
      enum: ["yearly_total_cases"],
      required: true,
      index: true,
    },

    datasetScope: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: "all",
      index: true,
      // Can be "all" or a Dataset ObjectId
    },

    trigger: {
      type: String,
      enum: ["official_upload", "monthly_fallback", "manual"],
      required: true,
      index: true,
    },

    startedAt: {
      type: Date,
      default: null,
      index: true,
    },

    finishedAt: {
      type: Date,
      default: null,
      index: true,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // API payload: model, totals, districts, plus basisYear / basisMonth / forecastStartYear / forecastEndYear.
    },

    status: {
      type: String,
      enum: ["success", "failed", "running"],
      default: "running",
      required: true,
      index: true,
    },

    errorMessage: {
      type: String,
      default: null,
    },

    basisDatasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      default: null,
      index: true,
    },

    // Latest calendar year present in official case rows used for this run (max `year` in aggregated series).
    basisYear: {
      type: Number,
      default: null,
      min: 2015,
      max: 2100,
      index: true,
    },

    // When scope is a single dataset: month (1–12) from that dataset's `coverageEnd` (upload metadata).
    // Yearly case rows have no month; this is the "as of" boundary from the upload. Null for global scope.
    basisMonth: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },

    // Calendar years covered by the forward-looking forecast (inclusive). Yearly Prophet currently emits one horizon year.
    forecastStartYear: {
      type: Number,
      default: null,
      min: 2015,
      max: 2100,
      index: true,
    },

    forecastEndYear: {
      type: Number,
      default: null,
      min: 2015,
      max: 2100,
      index: true,
    },
  },
  { timestamps: true }
);

// Ensure single run per (model+granularity+scope). This prevents recompute storms
// and guarantees "only one forecast exists per dataset upload".
predictionRunSchema.index(
  { model: 1, granularity: 1, datasetScope: 1 },
  { unique: true }
);

// Checking latest forecast basis
predictionRunSchema.index({
  basisDatasetId: 1,
  basisYear: 1,
  generatedAt: -1,
});

const PredictionRun =
  mongoose.models.PredictionRun ||
  mongoose.model("PredictionRun", predictionRunSchema);

export default PredictionRun;